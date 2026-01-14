import * as azdev from 'azure-devops-node-api';
import { WorkItem, CycleTimeData, DueDateChange, DeveloperDueDateStats } from '../types/workitem';
import { retryWithBackoff } from '../utils/retry';

export class AzureDevOpsService {
  private connection: azdev.WebApi;
  private organization: string;
  private project: string;
  private areaPath: string;

  constructor(project?: string, areaPath?: string) {
    const orgUrl = process.env.ADO_ORG;
    const pat = process.env.ADO_PAT;
    const defaultProject = process.env.ADO_PROJECT || '';
    const defaultAreaPath = process.env.ADO_AREA_PATH || '';
    
    // Use provided project/areaPath or fall back to env defaults
    this.project = project || defaultProject;
    this.areaPath = areaPath || defaultAreaPath;

    if (!orgUrl || !pat || !this.project) {
      throw new Error(
        'Missing required environment variables: ADO_ORG, ADO_PAT, and project must be provided'
      );
    }

    this.organization = orgUrl;
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    // Configure with longer timeout for revision queries (default is 30s, increase to 120s)
    const options = {
      socketTimeout: 120000, // 120 seconds
    };
    this.connection = new azdev.WebApi(orgUrl, authHandler, options);
  }

  async getWorkItems(from?: string, to?: string): Promise<WorkItem[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Build WIQL query to include Product Backlog Items, Technical Backlog Items, and Epics
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND ([System.WorkItemType] = 'Product Backlog Item' OR [System.WorkItemType] = 'Technical Backlog Item' OR [System.WorkItemType] = 'Epic')`;

      if (this.areaPath) {
        // Use exact match (=) instead of UNDER to avoid getting child area paths
        wiql += ` AND [System.AreaPath] = '${this.areaPath}'`;
      }

      // Query for items in date range OR with no due date/target date
      if (from && to) {
        wiql += ` AND (([Microsoft.VSTS.Scheduling.DueDate] >= '${from}' AND [Microsoft.VSTS.Scheduling.DueDate] <= '${to}') OR ([Microsoft.VSTS.Scheduling.TargetDate] >= '${from}' AND [Microsoft.VSTS.Scheduling.TargetDate] <= '${to}') OR [Microsoft.VSTS.Scheduling.DueDate] = '' OR [Microsoft.VSTS.Scheduling.TargetDate] = '')`;
      }

      wiql += ' ORDER BY [System.ChangedDate] DESC';

      const queryResult = await witApi.queryByWiql(
        { query: wiql },
        { project: this.project }
      );

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return [];
      }

      const ids = queryResult.workItems.map((wi) => wi.id!);

      // Fetch work items in batches of 200 (ADO limit)
      const batchSize = 200;
      const batches: number[][] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        batches.push(ids.slice(i, i + batchSize));
      }

      const fields = [
        'System.Id',
        'System.Title',
        'System.State',
        'System.AssignedTo',
        'System.WorkItemType',
        'System.ChangedDate',
        'System.CreatedDate',
        'Microsoft.VSTS.Common.ClosedDate',
        'System.AreaPath',
        'System.IterationPath',
        'Microsoft.VSTS.Scheduling.DueDate',
        'Microsoft.VSTS.Scheduling.TargetDate',
        'Custom.QACompleteDate',
      ];

      const allWorkItems: WorkItem[] = [];

      for (const batch of batches) {
        const workItems = await witApi.getWorkItems(
          batch,
          fields,
          undefined,
          undefined,
          undefined
        );

        for (const wi of workItems) {
          if (!wi.id || !wi.fields) continue;

          // Helper function to extract date as YYYY-MM-DD without timezone issues
          const extractDate = (dateValue: any): string | undefined => {
            if (!dateValue) return undefined;
            const date = new Date(dateValue);
            
            // Use LOCAL date methods because ADO stores dates at midnight UTC
            // which appears as the previous day in timezones behind UTC (EST/CST)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const result = `${year}-${month}-${day}`;
            
            return result;
          };

          allWorkItems.push({
            id: wi.id,
            title: wi.fields['System.Title'] || '',
            state: wi.fields['System.State'] || '',
            assignedTo: wi.fields['System.AssignedTo']?.displayName,
            dueDate: extractDate(wi.fields['Microsoft.VSTS.Scheduling.DueDate']),
            targetDate: extractDate(wi.fields['Microsoft.VSTS.Scheduling.TargetDate']),
            qaCompleteDate: extractDate(wi.fields['Custom.QACompleteDate']),
            workItemType: wi.fields['System.WorkItemType'] || '',
            changedDate: wi.fields['System.ChangedDate'] || '',
            createdDate: wi.fields['System.CreatedDate'] || '',
            closedDate: extractDate(wi.fields['Microsoft.VSTS.Common.ClosedDate']),
            areaPath: wi.fields['System.AreaPath'] || '',
            iterationPath: wi.fields['System.IterationPath'] || '',
          });
        }
      }

      // Skip cycle time calculation for now to improve load performance
      // Cycle time queries are timing out due to large revision history
      // TODO: Implement background job or on-demand cycle time calculation
      console.log(`Returning ${allWorkItems.length} work items (without cycle time data)`);
      
      return allWorkItems;
    });
  }

  async calculateCycleTime(workItemId: number): Promise<CycleTimeData | undefined> {
    try {
      const witApi = await this.connection.getWorkItemTrackingApi();
      
      // Get all revisions to track state changes
      const revisions = await witApi.getRevisions(workItemId, undefined, undefined, undefined, this.project);
      
      if (!revisions || revisions.length === 0) {
        return undefined;
      }

      let inProgressDate: string | undefined;
      let qaReadyDate: string | undefined;
      let uatReadyDate: string | undefined;
      let assignedToAtInProgress: string | undefined;
      let assignedToAtReadyForTest: string | undefined;

      // Iterate through revisions to find state transitions
      for (let i = 0; i < revisions.length; i++) {
        const revision = revisions[i];
        const state = revision.fields?.['System.State'];
        const changedDate = revision.fields?.['System.ChangedDate'];
        const assignedTo = revision.fields?.['System.AssignedTo'];

        // Track when item moved to "In Progress"
        if (!inProgressDate && state === 'In Progress' && changedDate) {
          inProgressDate = new Date(changedDate).toISOString();
          // Track who was assigned at this point
          assignedToAtInProgress = assignedTo?.displayName || assignedTo?.uniqueName || assignedTo;
        }

        // Track when item moved to "Ready For Test"
        if (!qaReadyDate && state === 'Ready For Test' && changedDate) {
          qaReadyDate = new Date(changedDate).toISOString();
          // Track who was assigned at this point (QA tester)
          assignedToAtReadyForTest = assignedTo?.displayName || assignedTo?.uniqueName || assignedTo;
        }

        // Track when item moved to "UAT - Ready For Test"
        if (!uatReadyDate && state === 'UAT - Ready For Test' && changedDate) {
          uatReadyDate = new Date(changedDate).toISOString();
        }
      }

      // Calculate developer cycle time in days if we have both dates
      let cycleTimeDays: number | undefined;
      if (inProgressDate && qaReadyDate) {
        const start = new Date(inProgressDate);
        const end = new Date(qaReadyDate);
        cycleTimeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Calculate QA cycle time in days
      let qaCycleTimeDays: number | undefined;
      if (qaReadyDate && uatReadyDate) {
        const start = new Date(qaReadyDate);
        const end = new Date(uatReadyDate);
        qaCycleTimeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        inProgressDate: inProgressDate ? inProgressDate.split('T')[0] : undefined,
        qaReadyDate: qaReadyDate ? qaReadyDate.split('T')[0] : undefined,
        cycleTimeDays,
        assignedTo: assignedToAtInProgress,
        uatReadyDate: uatReadyDate ? uatReadyDate.split('T')[0] : undefined,
        qaCycleTimeDays,
        qaAssignedTo: assignedToAtReadyForTest,
      };
    } catch (error) {
      console.error(`Error calculating cycle time for work item ${workItemId}:`, error);
      return undefined;
    }
  }

  async updateDueDate(id: number, dueDate: string | null, reason?: string): Promise<void> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      const patchDocument: any[] = [];

      if (dueDate === null) {
        // Remove the due date field
        patchDocument.push({
          op: 'remove',
          path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
        });
      } else {
        // Create a Date object at midnight in local timezone, then convert to UTC
        // This ensures ADO stores a time that, when read back with local methods, gives the correct date
        const [year, month, day] = dueDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, 0, 0, 0);
        const dateValue = localDate.toISOString();
        
        // Add or replace the due date field
        patchDocument.push({
          op: 'add',
          path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
          value: dateValue,
        });
      }

      // If a reason is provided, update the custom field AND add to history
      if (reason) {
        // Try to update custom field if it exists
        patchDocument.push({
          op: 'add',
          path: '/fields/Custom.DueDateMovementReasons',
          value: reason,
        });
        
        // Also add to history as a fallback (this field always exists)
        patchDocument.push({
          op: 'add',
          path: '/fields/System.History',
          value: `Due date change reason: ${reason}`,
        });
      }

      await witApi.updateWorkItem({}, patchDocument, id, this.project);
    });
  }

  async updateWorkItemField(id: number, field: string, value: any): Promise<void> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Map friendly field names to Azure DevOps field names
      const fieldMap: Record<string, string> = {
        state: 'System.State',
        assignedTo: 'System.AssignedTo',
        iterationPath: 'System.IterationPath',
        areaPath: 'System.AreaPath',
        title: 'System.Title',
        qaCompleteDate: 'Custom.QACompleteDate',
      };

      const adoFieldName = fieldMap[field] || field;
      
      const patchDocument: any[] = [];

      if (value === null || value === undefined || value === '') {
        // Remove the field
        patchDocument.push({
          op: 'remove',
          path: `/fields/${adoFieldName}`,
        });
      } else {
        // Check if this is a date field that needs special handling
        const dateFields = ['Custom.QACompleteDate', 'Microsoft.VSTS.Scheduling.DueDate', 'Microsoft.VSTS.Scheduling.TargetDate'];
        let fieldValue = value;
        
        if (dateFields.includes(adoFieldName) && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Convert YYYY-MM-DD to ISO string at midnight local time
          const [year, month, day] = value.split('-').map(Number);
          const localDate = new Date(year, month - 1, day, 0, 0, 0);
          fieldValue = localDate.toISOString();
        }
        
        // Add or replace the field
        patchDocument.push({
          op: 'add',
          path: `/fields/${adoFieldName}`,
          value: fieldValue,
        });
      }

      console.log(`Updating work item ${id} field ${adoFieldName} to:`, value);
      await witApi.updateWorkItem({}, patchDocument, id, this.project);
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const coreApi = await this.connection.getCoreApi();
      await coreApi.getProject(this.project);
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async calculateCycleTimeForItems(workItemIds: number[]): Promise<Record<number, CycleTimeData>> {
    const result: Record<number, CycleTimeData> = {};
    const batchSize = 3; // Process fewer items at a time to avoid timeouts
    
    for (let i = 0; i < workItemIds.length; i += batchSize) {
      const batch = workItemIds.slice(i, i + batchSize);
      console.log(`Processing cycle time batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(workItemIds.length / batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const cycleTime = await this.calculateCycleTime(id);
          return { id, cycleTime };
        })
      );
      
      batchResults.forEach(({ id, cycleTime }) => {
        if (cycleTime) {
          result[id] = cycleTime;
        }
      });
    }
    
    return result;
  }

  async getDueDateChangeHistory(workItemIds: number[]): Promise<DueDateChange[]> {
    try {
      const witApi = await this.connection.getWorkItemTrackingApi();
      const allChanges: DueDateChange[] = [];

      // Process items in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < workItemIds.length; i += batchSize) {
        const batch = workItemIds.slice(i, i + batchSize);
        console.log(`Processing due date history batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(workItemIds.length / batchSize)}`);
        
        for (const workItemId of batch) {
          try {
            // Get all revisions for this work item
            const revisions = await witApi.getRevisions(workItemId);
            
            if (!revisions || revisions.length === 0) continue;
            
            let previousDueDate: string | undefined = undefined;
            
            for (const revision of revisions) {
              const fields = revision.fields;
              if (!fields) continue;
              
              const currentDueDate = fields['Microsoft.VSTS.Scheduling.DueDate'];
              const changedBy = fields['System.ChangedBy']?.displayName || fields['System.ChangedBy'] || 'Unknown';
              const changedDate = fields['System.ChangedDate'];
              
              // Try multiple possible field names for the reason
              let reason = fields['Custom.DueDateMovementReasons'] 
                || fields['Custom.DueDateMovementReason']
                || fields['Custom.DueDateReason']
                || undefined;
              
              // If no custom field, try to extract from history
              if (!reason && fields['System.History']) {
                const historyText = fields['System.History'];
                const match = historyText.match(/Due date change reason:\s*(.+?)(?:<|$)/i);
                if (match) {
                  reason = match[1].trim();
                }
              }
              
              // Normalize dates to YYYY-MM-DD format
              const normalizeDate = (dateValue: any): string | undefined => {
                if (!dateValue) return undefined;
                try {
                  const date = new Date(dateValue);
                  return date.toISOString().split('T')[0];
                } catch {
                  return undefined;
                }
              };
              
              const normalizedCurrent = normalizeDate(currentDueDate);
              const normalizedPrevious = normalizeDate(previousDueDate);
              
              // Check if due date changed in this revision
              if (normalizedCurrent !== normalizedPrevious && changedDate) {
                // DEBUG: Log all available fields when a due date change is detected
                console.log(`\n=== Due Date Change Detected for Work Item ${workItemId} ===`);
                console.log(`Old: ${normalizedPrevious} -> New: ${normalizedCurrent}`);
                console.log(`Changed by: ${changedBy}`);
                console.log(`Changed date: ${changedDate}`);
                console.log(`Reason found:`, reason);
                console.log(`History field:`, fields['System.History']?.substring(0, 200));
                console.log(`Available custom fields:`, Object.keys(fields).filter(k => k.startsWith('Custom')));
                
                allChanges.push({
                  changedDate: new Date(changedDate).toISOString(),
                  changedBy,
                  oldDueDate: normalizedPrevious,
                  newDueDate: normalizedCurrent,
                  reason: reason || 'No reason provided'
                });
              }
              
              previousDueDate = currentDueDate;
            }
          } catch (error) {
            console.error(`Error getting revisions for work item ${workItemId}:`, error);
            // Continue processing other work items
          }
        }
      }

      return allChanges;
    } catch (error) {
      console.error('Error in getDueDateChangeHistory:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async getDueDateStatsByDeveloper(from?: string, to?: string, developerFilter?: string): Promise<DeveloperDueDateStats[]> {
    try {
      console.log('Fetching work items for due date stats...');
      
      // For stats, we want work items changed in the time range, not items with due dates in the range
      // This ensures we catch recent due date changes
      const witApi = await this.connection.getWorkItemTrackingApi();
      
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND [System.WorkItemType] = 'Product Backlog Item'`;

      if (this.areaPath) {
        wiql += ` AND [System.AreaPath] UNDER '${this.areaPath}'`;
      }

      // Query by CHANGED DATE to get recently modified items
      if (from && to) {
        wiql += ` AND [System.ChangedDate] >= '${from}' AND [System.ChangedDate] <= '${to}'`;
      }

      wiql += ' ORDER BY [System.ChangedDate] DESC';
      
      const queryResult = await witApi.queryByWiql(
        { query: wiql },
        { project: this.project }
      );

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        console.log('No work items found in date range');
        return [];
      }

      const ids = queryResult.workItems.map((wi) => wi.id!);
      console.log(`Found ${ids.length} work items changed in date range`);
      
      // OPTIMIZATION: Limit to most recent work items to avoid processing too many
      const maxItems = 150;
      const limitedIds = ids.slice(0, maxItems);
      if (ids.length > maxItems) {
        console.log(`Limiting to ${maxItems} most recently changed work items for performance`);
      }
      
      console.log(`Processing ${limitedIds.length} work items for due date change history...`);
      // Get due date change history for filtered work items
      const changes = await this.getDueDateChangeHistory(limitedIds);
      console.log(`Found ${changes.length} due date changes`);
      
      // Filter by developer if specified
      const filteredChanges = developerFilter 
        ? changes.filter(change => change.changedBy === developerFilter)
        : changes;
      
      console.log(`After developer filter: ${filteredChanges.length} changes`);
      
      // Aggregate by developer
      const statsByDev = new Map<string, { totalChanges: number, reasonBreakdown: Map<string, number> }>();
      
      for (const change of filteredChanges) {
        const developer = change.changedBy;
        
        if (!statsByDev.has(developer)) {
          statsByDev.set(developer, {
            totalChanges: 0,
            reasonBreakdown: new Map()
          });
        }
        
        const devStats = statsByDev.get(developer)!;
        devStats.totalChanges++;
        
        const reason = change.reason || 'No reason provided';
        devStats.reasonBreakdown.set(reason, (devStats.reasonBreakdown.get(reason) || 0) + 1);
      }
      
      // Convert to array format
      const result = Array.from(statsByDev.entries()).map(([developer, stats]) => ({
        developer,
        totalChanges: stats.totalChanges,
        reasonBreakdown: Object.fromEntries(stats.reasonBreakdown)
      })).sort((a, b) => b.totalChanges - a.totalChanges);
      
      console.log(`Returning stats for ${result.length} developers`);
      return result;
    } catch (error) {
      console.error('Error in getDueDateStatsByDeveloper:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async getEpicChildren(epicId: number): Promise<WorkItem[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Query for all work items that are descendants of this Epic (recursive query to get Features AND their PBIs)
      const wiql = `SELECT [System.Id] FROM WorkItemLinks WHERE ([Source].[System.Id] = ${epicId}) AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') MODE (Recursive)`;

      const queryResult = await witApi.queryByWiql(
        { query: wiql },
        { project: this.project }
      );

      if (!queryResult.workItemRelations || queryResult.workItemRelations.length === 0) {
        return [];
      }

      // Extract all descendant IDs (skip the first relation which is the Epic itself)
      const descendantIds = queryResult.workItemRelations
        .slice(1) // Skip the source Epic
        .map(rel => rel.target?.id)
        .filter((id): id is number => id !== undefined);

      if (descendantIds.length === 0) {
        return [];
      }

      // Fetch work items in batches of 200 (ADO limit)
      const batchSize = 200;
      const batches: number[][] = [];
      for (let i = 0; i < descendantIds.length; i += batchSize) {
        batches.push(descendantIds.slice(i, i + batchSize));
      }

      const fields = [
        'System.Id',
        'System.Title',
        'System.State',
        'System.AssignedTo',
        'System.WorkItemType',
        'System.ChangedDate',
        'System.CreatedDate',
        'Microsoft.VSTS.Common.ClosedDate',
        'System.AreaPath',
        'System.IterationPath',
        'Microsoft.VSTS.Scheduling.DueDate',
      ];

      const allWorkItems: WorkItem[] = [];

      for (const batch of batches) {
        const workItems = await witApi.getWorkItems(
          batch,
          fields,
          undefined,
          undefined,
          undefined
        );

        for (const wi of workItems) {
          if (!wi.id || !wi.fields) continue;

          const extractDate = (dateValue: any): string | undefined => {
            if (!dateValue) return undefined;
            const date = new Date(dateValue);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          allWorkItems.push({
            id: wi.id,
            title: wi.fields['System.Title'] || '',
            state: wi.fields['System.State'] || '',
            assignedTo: wi.fields['System.AssignedTo']?.displayName,
            dueDate: extractDate(wi.fields['Microsoft.VSTS.Scheduling.DueDate']),
            workItemType: wi.fields['System.WorkItemType'] || '',
            changedDate: wi.fields['System.ChangedDate'] || '',
            createdDate: wi.fields['System.CreatedDate'] || '',
            closedDate: extractDate(wi.fields['Microsoft.VSTS.Common.ClosedDate']),
            areaPath: wi.fields['System.AreaPath'] || '',
            iterationPath: wi.fields['System.IterationPath'] || '',
          });
        }
      }

      // Filter to only include PBIs and Technical Backlog Items (exclude Features to avoid double counting)
      const pbiItems = allWorkItems.filter(item => 
        item.workItemType === 'Product Backlog Item' || 
        item.workItemType === 'Technical Backlog Item'
      );

      return pbiItems;
    });
  }
}
