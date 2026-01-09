import * as azdev from 'azure-devops-node-api';
import { WorkItem } from '../types/workitem';
import { retryWithBackoff } from '../utils/retry';

export class AzureDevOpsService {
  private connection: azdev.WebApi;
  private organization: string;
  private project: string;
  private areaPath: string;

  constructor() {
    const orgUrl = process.env.ADO_ORG;
    const pat = process.env.ADO_PAT;
    this.project = process.env.ADO_PROJECT || '';
    this.areaPath = process.env.ADO_AREA_PATH || '';

    if (!orgUrl || !pat || !this.project) {
      throw new Error(
        'Missing required environment variables: ADO_ORG, ADO_PAT, ADO_PROJECT'
      );
    }

    this.organization = orgUrl;
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    this.connection = new azdev.WebApi(orgUrl, authHandler);
  }

  async getWorkItems(from?: string, to?: string): Promise<WorkItem[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Build WIQL query
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND [System.WorkItemType] = 'Product Backlog Item'`;

      if (this.areaPath) {
        wiql += ` AND [System.AreaPath] UNDER '${this.areaPath}'`;
      }

      // Query for items in date range OR with no due date
      if (from && to) {
        wiql += ` AND ([Microsoft.VSTS.Scheduling.DueDate] >= '${from}' AND [Microsoft.VSTS.Scheduling.DueDate] <= '${to}' OR [Microsoft.VSTS.Scheduling.DueDate] = '')`;
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

          allWorkItems.push({
            id: wi.id,
            title: wi.fields['System.Title'] || '',
            state: wi.fields['System.State'] || '',
            assignedTo: wi.fields['System.AssignedTo']?.displayName,
            dueDate: wi.fields['Microsoft.VSTS.Scheduling.DueDate']
              ? new Date(wi.fields['Microsoft.VSTS.Scheduling.DueDate'])
                  .toISOString()
                  .split('T')[0]
              : undefined,
            workItemType: wi.fields['System.WorkItemType'] || '',
            changedDate: wi.fields['System.ChangedDate'] || '',
            areaPath: wi.fields['System.AreaPath'] || '',
            iterationPath: wi.fields['System.IterationPath'] || '',
          });
        }
      }

      return allWorkItems;
    });
  }

  async updateDueDate(id: number, dueDate: string | null): Promise<void> {
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
        // Add or replace the due date field
        patchDocument.push({
          op: 'add',
          path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
          value: dueDate,
        });
      }

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
}
