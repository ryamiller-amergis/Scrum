import * as azdev from 'azure-devops-node-api';
import { WorkItemExpand } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import { WorkItem, CycleTimeData, DueDateChange, DeveloperDueDateStats, DueDateHitRateStats } from '../types/workitem';
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

      // Build WIQL query to include Product Backlog Items, Technical Backlog Items, Epics, Features, and Bugs
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND ([System.WorkItemType] = 'Product Backlog Item' OR [System.WorkItemType] = 'Technical Backlog Item' OR [System.WorkItemType] = 'Epic' OR [System.WorkItemType] = 'Feature' OR [System.WorkItemType] = 'Bug')`;

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
        'System.Tags',
        'System.Description',
        'Microsoft.VSTS.Common.AcceptanceCriteria',
        'Microsoft.VSTS.TCM.ReproSteps',
        'Custom.Design',
        'System.History',
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

          // Debug logging for item 38656
          if (wi.id === 38656) {
            console.log('Item 38656 tags field:', wi.fields['System.Tags']);
            console.log('Item 38656 all fields:', Object.keys(wi.fields));
          }
          
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
            tags: wi.fields['System.Tags'] || '',
            description: wi.fields['System.Description'] || '',
            acceptanceCriteria: wi.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
            reproSteps: wi.fields['Microsoft.VSTS.TCM.ReproSteps'] || '',
            design: wi.fields['Custom.Design'] || '',
            discussions: wi.fields['System.History'] || '',
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

      // If a reason is provided, add to history
      if (reason) {
        // Add to history (this field always exists)
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
        targetDate: 'Microsoft.VSTS.Scheduling.TargetDate',
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
      console.log('Fetching work items for due date stats...', {
        project: this.project,
        areaPath: this.areaPath,
        from,
        to
      });
      
      // For stats, we want work items that have been in progress at some point
      const witApi = await this.connection.getWorkItemTrackingApi();
      
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND [System.WorkItemType] = 'Product Backlog Item'`;

      if (this.areaPath) {
        wiql += ` AND [System.AreaPath] UNDER '${this.areaPath}'`;
      }

      // Don't restrict by date in the initial query - get all PBIs, then filter by revision dates
      // This ensures we don't miss items that had due date changes but weren't recently modified
      wiql += ' ORDER BY [System.ChangedDate] DESC';
      
      console.log('Executing WIQL:', wiql);
      
      const queryResult = await witApi.queryByWiql(
        { query: wiql },
        { project: this.project }
      );

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        console.log('No work items found for area path');
        return [];
      }

      const ids = queryResult.workItems.map((wi) => wi.id!);
      console.log(`Found ${ids.length} work items in area path`);
      
      // OPTIMIZATION: Limit to most recent work items to avoid processing too many
      const maxItems = 150;
      const limitedIds = ids.slice(0, maxItems);
      if (ids.length > maxItems) {
        console.log(`Limiting to ${maxItems} most recently changed work items for performance`);
      }
      
      // Filter work items that have been in "In Progress" state
      console.log('Filtering work items that have been In Progress...');
      const inProgressIds: number[] = [];
      
      for (const workItemId of limitedIds) {
        try {
          const revisions = await witApi.getRevisions(workItemId);
          const hasBeenInProgress = revisions.some(rev => 
            rev.fields && rev.fields['System.State'] === 'In Progress'
          );
          
          if (hasBeenInProgress) {
            inProgressIds.push(workItemId);
          }
        } catch (error) {
          console.error(`Error checking state for work item ${workItemId}:`, error);
        }
      }
      
      console.log(`Found ${inProgressIds.length} work items that have been In Progress out of ${limitedIds.length} total`);
      
      if (inProgressIds.length === 0) {
        console.log('No work items found that have been In Progress');
        return [];
      }
      
      console.log(`Processing ${inProgressIds.length} work items for due date change history...`);
      // Get due date change history for filtered work items
      const changes = await this.getDueDateChangeHistory(inProgressIds);
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
        'Microsoft.VSTS.Scheduling.TargetDate',
        'System.Tags',
        'System.Description',
        'Microsoft.VSTS.Common.AcceptanceCriteria',
        'Microsoft.VSTS.TCM.ReproSteps',
        'Custom.Design',
        'System.History',
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
            targetDate: extractDate(wi.fields['Microsoft.VSTS.Scheduling.TargetDate']),
            workItemType: wi.fields['System.WorkItemType'] || '',
            changedDate: wi.fields['System.ChangedDate'] || '',
            createdDate: wi.fields['System.CreatedDate'] || '',
            closedDate: extractDate(wi.fields['Microsoft.VSTS.Common.ClosedDate']),
            areaPath: wi.fields['System.AreaPath'] || '',
            iterationPath: wi.fields['System.IterationPath'] || '',
            tags: wi.fields['System.Tags'] || '',
            description: wi.fields['System.Description'] || '',
            acceptanceCriteria: wi.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
            reproSteps: wi.fields['Microsoft.VSTS.TCM.ReproSteps'] || '',
            design: wi.fields['Custom.Design'] || '',
            discussions: wi.fields['System.History'] || '',
          });
        }
      }

      // For Epic children, return Features (direct children for rollup calculation)
      const featureItems = allWorkItems.filter(item => 
        item.workItemType === 'Feature'
      );

      return featureItems;
    });
  }

  async getFeatureChildren(featureId: number): Promise<WorkItem[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Query for all work items that are descendants of this Feature (recursive query to get PBIs/TBIs)
      const wiql = `SELECT [System.Id] FROM WorkItemLinks WHERE ([Source].[System.Id] = ${featureId}) AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') MODE (Recursive)`;

      const queryResult = await witApi.queryByWiql(
        { query: wiql },
        { project: this.project }
      );

      if (!queryResult.workItemRelations || queryResult.workItemRelations.length === 0) {
        return [];
      }

      // Extract all descendant IDs (skip the first relation which is the Feature itself)
      const descendantIds = queryResult.workItemRelations
        .slice(1) // Skip the source Feature
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
        'Custom.QACompleteDate',
        'System.Tags',
        'System.Description',
        'Microsoft.VSTS.Common.AcceptanceCriteria',
        'Microsoft.VSTS.TCM.ReproSteps',
        'Custom.Design',
        'System.History',
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
            qaCompleteDate: extractDate(wi.fields['Custom.QACompleteDate']),
            workItemType: wi.fields['System.WorkItemType'] || '',
            changedDate: wi.fields['System.ChangedDate'] || '',
            createdDate: wi.fields['System.CreatedDate'] || '',
            closedDate: extractDate(wi.fields['Microsoft.VSTS.Common.ClosedDate']),
            areaPath: wi.fields['System.AreaPath'] || '',
            iterationPath: wi.fields['System.IterationPath'] || '',
            tags: wi.fields['System.Tags'] || '',
            description: wi.fields['System.Description'] || '',
            acceptanceCriteria: wi.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
            reproSteps: wi.fields['Microsoft.VSTS.TCM.ReproSteps'] || '',
            design: wi.fields['Custom.Design'] || '',
            discussions: wi.fields['System.History'] || '',
          });
        }
      }

      // Return all PBIs, Technical Backlog Items, and Bugs
      const childItems = allWorkItems.filter(item => 
        item.workItemType === 'Product Backlog Item' || 
        item.workItemType === 'Technical Backlog Item' ||
        item.workItemType === 'Bug'
      );

      return childItems;
    });
  }

  async getTeamMembers(teamName: string): Promise<string[]> {
    try {
      const coreApi = await this.connection.getCoreApi();
      
      // Get team members
      const teamMembers = await coreApi.getTeamMembersWithExtendedProperties(
        this.project,
        teamName
      );
      
      // Extract display names
      const memberNames = teamMembers
        .map(member => member.identity?.displayName)
        .filter((name): name is string => !!name)
        .sort();
      
      return memberNames;
    } catch (error) {
      console.error(`Error fetching team members for ${teamName}:`, error);
      return [];
    }
  }

  /**
   * Analyzes work item history to determine if developers hit their due dates.
   * Criteria: 
   * - Hit = Work item transitions from "In Progress" to completion state on or before the due date without any due date changes
   * - Miss = Count each due date change as a miss
   */
  async getDueDateHitRate(from?: string, to?: string, developerFilter?: string): Promise<DueDateHitRateStats[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Build WIQL query to get PBIs and Technical Backlog Items with due dates
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND ([System.WorkItemType] = 'Product Backlog Item' OR [System.WorkItemType] = 'Technical Backlog Item') AND [Microsoft.VSTS.Scheduling.DueDate] <> ''`;

      if (this.areaPath) {
        wiql += ` AND [System.AreaPath] = '${this.areaPath}'`;
      }

      // Filter by date range based on when items were changed
      if (from && to) {
        wiql += ` AND [System.ChangedDate] >= '${from}' AND [System.ChangedDate] <= '${to}'`;
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
      console.log(`Analyzing ${ids.length} work items with due dates for hit rate`);
      
      // Debug: Check if 38505 is in the query results
      if (ids.includes(38505)) {
        console.log(`✓ Work item 38505 is in the query results`);
      } else {
        console.log(`✗ Work item 38505 NOT in query results - it may not match the WIQL filter criteria`);
      }

      // Fetch work items in batches
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
        'Microsoft.VSTS.Scheduling.DueDate',
      ];

      interface WorkItemAnalysis {
        id: number;
        title: string;
        assignedTo?: string;
        dueDate?: string;
        dueDateChangeCount: number;
        hit: boolean;
        completionInfo: string;
        status: 'hit' | 'miss' | 'in-progress';
      }

      const developerMap = new Map<string, WorkItemAnalysis[]>();

      for (const batch of batches) {
        const workItems = await witApi.getWorkItems(
          batch,
          fields,
          undefined,
          undefined,
          undefined
        );

        // Analyze each work item's history
        for (const wi of workItems) {
          if (!wi.id || !wi.fields) continue;

          const assignedTo = wi.fields['System.AssignedTo']?.displayName;
          const currentDueDate = wi.fields['Microsoft.VSTS.Scheduling.DueDate'];

          // Debug: Check if this is work item 38505
          if (wi.id === 38505) {
            console.log(`\n=== FOUND Work Item 38505 ===`);
            console.log(`Assigned to: ${assignedTo}`);
            console.log(`Has due date: ${!!currentDueDate}`);
            console.log(`Due date value: ${currentDueDate}`);
            console.log(`Will be processed: ${assignedTo && currentDueDate ? 'YES' : 'NO'}`);
            if (developerFilter) {
              console.log(`Developer filter active: ${developerFilter}`);
              console.log(`Matches filter: ${assignedTo === developerFilter ? 'YES' : 'NO'}`);
            }
            console.log(`=== END ===\n`);
          }

          // Skip if no assignee or no due date
          if (!assignedTo || !currentDueDate) continue;

          // Apply developer filter if specified
          if (developerFilter && assignedTo !== developerFilter) continue;

          try {
            // Get full revision history
            const revisions = await witApi.getRevisions(wi.id);

            if (!revisions || revisions.length === 0) continue;

            // Track due date changes and state transitions
            let dueDateChangeCount = 0;
            let previousDueDate: string | null = null;
            let transitionDate: string | null = null;
            let dueDateAtTransition: string | null = null;
            let hitDueDate = false;
            let hasTransitioned = false;
            let assignedToAtTransition: string | undefined = undefined;

            // Debug logging for specific work item
            const isDebugItem = wi.id === 38505;
            if (isDebugItem) {
              console.log(`\n=== DEBUG: Work Item ${wi.id} ===`);
              console.log(`Currently assigned to: ${assignedTo}`);
              console.log(`Current state: ${wi.fields['System.State']}`);
              console.log(`Due date: ${currentDueDate}`);
              console.log(`Total revisions: ${revisions.length}`);
            }

            // Process revisions in chronological order
            for (let i = 0; i < revisions.length; i++) {
              const revision = revisions[i];
              const prevRevision = i > 0 ? revisions[i - 1] : null;

              const revState = revision.fields?.['System.State'];
              const prevState = prevRevision?.fields?.['System.State'];
              const revDueDate = revision.fields?.['Microsoft.VSTS.Scheduling.DueDate'];
              const revChangedDate = revision.fields?.['System.ChangedDate'];

              // Track due date changes
              if (revDueDate) {
                // Parse as UTC to avoid timezone shifts
                const dueDateStr = revDueDate.split('T')[0];
                
                if (previousDueDate && previousDueDate !== dueDateStr) {
                  dueDateChangeCount++;
                }
                
                previousDueDate = dueDateStr;
              }

              // Check for transition from working states to completion states
              const workingStates = ['In Progress', 'Committed', 'In Pull Request'];
              const completionStates = ['Ready for Test', 'Ready For Test', 'In Test', 'Done'];
              
              if (workingStates.includes(prevState) && completionStates.includes(revState)) {
                hasTransitioned = true;
                transitionDate = revChangedDate ? revChangedDate.split('T')[0] : null;
                
                // Capture who was assigned at the time of transition (from the previous revision)
                assignedToAtTransition = prevRevision?.fields?.['System.AssignedTo']?.displayName;
                
                if (isDebugItem) {
                  console.log(`\nTransition detected at revision ${i}:`);
                  console.log(`  From: ${prevState} → To: ${revState}`);
                  console.log(`  Transition date: ${transitionDate}`);
                  console.log(`  Assigned to at transition: ${assignedToAtTransition}`);
                }
                
                // Get the due date at the time of transition
                const prevDueDate = prevRevision?.fields?.['Microsoft.VSTS.Scheduling.DueDate'];
                if (prevDueDate) {
                  dueDateAtTransition = prevDueDate.split('T')[0];
                  
                  if (isDebugItem) {
                    console.log(`  Due date at transition: ${dueDateAtTransition}`);
                  }
                  
                  // Check if transition happened on or before the due date
                  if (transitionDate && dueDateAtTransition) {
                    const transitionTime = new Date(transitionDate).getTime();
                    const dueTime = new Date(dueDateAtTransition).getTime();
                    
                    if (transitionTime <= dueTime) {
                      hitDueDate = true;
                      if (isDebugItem) console.log(`  Result: HIT (${transitionDate} <= ${dueDateAtTransition})`);
                    } else {
                      if (isDebugItem) console.log(`  Result: MISS (${transitionDate} > ${dueDateAtTransition})`);
                    }
                  }
                }
              }
            }

            const currentDueDateStr = currentDueDate.split('T')[0];
            const currentState = wi.fields['System.State'];
            const today = new Date().toISOString().split('T')[0];
            
            // Determine hit/miss/in-progress status
            // Hit = transitioned from working state to completion on/before due date AND no due date changes
            const hit = hitDueDate && dueDateChangeCount === 0;
            
            // Check if item has reached a completion state
            const completionStates = ['Ready for Test', 'Ready For Test', 'In Test', 'Done', 'Closed', 'Resolved'];
            const isCompleted = completionStates.includes(currentState);
            
            // Determine status: 'hit', 'miss', or 'in-progress'
            let status: 'hit' | 'miss' | 'in-progress';
            if (dueDateChangeCount > 0) {
              status = 'miss';
            } else if (hit) {
              status = 'hit';
            } else if (hasTransitioned && !hitDueDate) {
              // Transitioned but after the due date
              status = 'miss';
            } else {
              status = 'in-progress';
            }
            
            if (isDebugItem) {
              console.log(`\nFinal analysis:`);
              console.log(`  Due date changes: ${dueDateChangeCount}`);
              console.log(`  Has transitioned: ${hasTransitioned}`);
              console.log(`  Hit due date: ${hitDueDate}`);
              console.log(`  Status: ${status}`);
              console.log(`  Will be attributed to: ${assignedToAtTransition || assignedTo}`);
              console.log(`=== END DEBUG ===\n`);
            }
            
            let completionInfo: string;
            if (dueDateChangeCount > 0) {
              completionInfo = `${dueDateChangeCount} change${dueDateChangeCount > 1 ? 's' : ''}`;
            } else if (transitionDate && dueDateAtTransition) {
              completionInfo = `Completed ${transitionDate}`;
            } else if (!isCompleted) {
              // Still in progress - check if past due
              if (currentDueDateStr < today) {
                completionInfo = 'Past due (In Progress)';
              } else {
                completionInfo = 'In Progress';
              }
            } else {
              // Completed but didn't track the transition properly
              completionInfo = 'Completed (date unknown)';
            }

            // Use the assignee at transition time if available, otherwise current assignee
            const developerForStats = assignedToAtTransition || assignedTo;

            const analysis: WorkItemAnalysis = {
              id: wi.id,
              title: wi.fields['System.Title'] || '',
              assignedTo: developerForStats,
              dueDate: currentDueDateStr,
              dueDateChangeCount,
              hit,
              completionInfo,
              status
            };

            if (!developerMap.has(developerForStats)) {
              developerMap.set(developerForStats, []);
            }
            developerMap.get(developerForStats)!.push(analysis);
          } catch (error) {
            console.error(`Error analyzing work item ${wi.id}:`, error);
            // Continue with next work item
          }
        }
      }

      // Build stats for each developer
      const stats: DueDateHitRateStats[] = [];

      for (const [developer, workItems] of developerMap.entries()) {
        // Hit count = work items that completed on time with no due date changes
        const hitCount = workItems.filter(wi => wi.hit).length;
        
        // Miss count = work items that had due date changes OR completed after due date
        const missCount = workItems.filter(wi => wi.status === 'miss').length;
        
        const totalCount = workItems.length;

        stats.push({
          developer,
          totalWorkItems: totalCount,
          hitDueDate: hitCount,
          missedDueDate: missCount,
          hitRate: totalCount > 0 ? (hitCount / totalCount) * 100 : 0,
          workItemDetails: workItems.map(wi => ({
            id: wi.id,
            title: wi.title,
            dueDate: wi.dueDate!,
            completionDate: wi.completionInfo,
            hit: wi.hit,
            status: wi.status
          }))
        });
      }

      console.log(`Calculated hit rate stats for ${stats.length} developers`);
      return stats.sort((a, b) => a.developer.localeCompare(b.developer));
    });
  }

  async getWorkItemRelations(workItemId: number): Promise<WorkItem[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Get the work item with relations - must explicitly expand relations
      const workItem = await witApi.getWorkItem(
        workItemId,
        undefined,
        undefined,
        WorkItemExpand.Relations, // Expand relations
        this.project
      );

      console.log(`Fetching relations for work item ${workItemId}`);
      console.log(`Relations found: ${workItem?.relations?.length || 0}`);

      if (!workItem || !workItem.relations) {
        console.log(`No relations found for work item ${workItemId}`);
        return [];
      }

      // Filter for relevant relation types:
      // - Hierarchy-Forward: Child items
      // - Hierarchy-Reverse: Parent items
      // - Related: Related work items
      const relevantRelations = workItem.relations.filter(
        (rel) => rel.rel === 'System.LinkTypes.Hierarchy-Forward' ||
                 rel.rel === 'System.LinkTypes.Hierarchy-Reverse' ||
                 rel.rel === 'System.LinkTypes.Related'
      );

      console.log(`All relations:`, workItem.relations.map(r => ({ rel: r.rel, url: r.url })));
      console.log(`Relevant relations found: ${relevantRelations.length}`);

      if (relevantRelations.length === 0) {
        return [];
      }

      // Extract related work item IDs from URLs
      const relatedIds = relevantRelations
        .map((rel) => {
          const url = rel.url;
          if (!url) return null;
          const match = url.match(/\/(\d+)$/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((id): id is number => id !== null);

      console.log(`Extracted related IDs: ${relatedIds.join(', ')}`);

      if (relatedIds.length === 0) {
        return [];
      }

      // Fetch related work items
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
        'System.Tags',
        'System.Description',
        'Microsoft.VSTS.Common.AcceptanceCriteria',
        'Microsoft.VSTS.TCM.ReproSteps',
        'Custom.Design',
        'System.History',
      ];

      const workItems = await witApi.getWorkItems(
        relatedIds,
        fields,
        undefined,
        undefined,
        undefined
      );

      const extractDate = (dateValue: any): string | undefined => {
        if (!dateValue) return undefined;
        const date = new Date(dateValue);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const relatedItems: WorkItem[] = [];
      for (const wi of workItems) {
        if (!wi.id || !wi.fields) continue;

        relatedItems.push({
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
          tags: wi.fields['System.Tags'] || '',
          description: wi.fields['System.Description'] || '',
          acceptanceCriteria: wi.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
          reproSteps: wi.fields['Microsoft.VSTS.TCM.ReproSteps'] || '',
          design: wi.fields['Custom.Design'] || '',
          discussions: wi.fields['System.History'] || '',
        });
      }

      return relatedItems;
    });
  }

  async getDueDateChangeHistoryForItem(workItemId: number): Promise<Array<{
    changedDate: string;
    changedBy: string;
    oldDueDate: string | null;
    newDueDate: string | null;
    reason: string | null;
  }>> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();
      
      // Get all revisions of the work item
      const revisions = await witApi.getRevisions(workItemId);
      
      if (!revisions || revisions.length === 0) {
        return [];
      }

      const changes: Array<{
        changedDate: string;
        changedBy: string;
        oldDueDate: string | null;
        newDueDate: string | null;
        reason: string | null;
      }> = [];

      let previousDueDate: string | null = null;

      for (let i = 0; i < revisions.length; i++) {
        const revision = revisions[i];
        const currentDueDate = revision.fields?.['Microsoft.VSTS.Scheduling.DueDate'];
        const currentDueDateStr = currentDueDate ? currentDueDate.split('T')[0] : null;
        const changedBy = revision.fields?.['System.ChangedBy']?.displayName || 'Unknown';
        const changedDate = revision.fields?.['System.ChangedDate'];
        
        // Try to get reason from custom field first, then from history
        let reason = revision.fields?.['Custom.DueDateChangeReason'] || null;
        if (!reason) {
          const history = revision.fields?.['System.History'];
          if (history && typeof history === 'string') {
            const match = history.match(/Due date change reason: (.+)/);
            if (match) {
              reason = match[1];
            }
          }
        }

        // Detect due date change (skip initial setting from null)
        if (currentDueDateStr !== previousDueDate && previousDueDate !== null) {
          changes.push({
            changedDate: changedDate ? new Date(changedDate).toISOString() : '',
            changedBy,
            oldDueDate: previousDueDate,
            newDueDate: currentDueDateStr,
            reason
          });
        }

        previousDueDate = currentDueDateStr;
      }

      return changes;
    });
  }

  async getWorkItemComments(workItemId: number): Promise<string> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();
      
      try {
        // Get comments for the work item
        const comments = await witApi.getComments(this.project, workItemId);
        
        if (!comments || !comments.comments || comments.comments.length === 0) {
          return '';
        }

        // Format comments as HTML
        const commentsHtml = comments.comments
          .map(comment => {
            const author = comment.createdBy?.displayName || 'Unknown';
            const date = comment.createdDate ? new Date(comment.createdDate).toLocaleString() : '';
            const text = comment.text || '';
            
            return `
              <div class="discussion-comment">
                <div class="discussion-header">
                  <strong>${author}</strong> <span class="discussion-date">${date}</span>
                </div>
                <div class="discussion-text">${text}</div>
              </div>
            `;
          })
          .join('\n');

        return commentsHtml;
      } catch (error) {
        console.error(`Error fetching comments for work item ${workItemId}:`, error);
        return '';
      }
    });
  }
}
