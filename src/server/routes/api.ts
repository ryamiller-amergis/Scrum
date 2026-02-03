import express, { Request, Response } from 'express';
import { AzureDevOpsService } from '../services/azureDevOps';
import { WorkItemsQuery, UpdateDueDateRequest, DeveloperDueDateStats, DueDateHitRateStats } from '../types/workitem';
import { getFeatureAutoCompleteService } from '../services/featureAutoComplete';

const router = express.Router();

// GET /api/workitems - Fetch work items for date range
router.get('/workitems', async (req: Request, res: Response) => {
  try {
    const { from, to, project, areaPath } = req.query as WorkItemsQuery & { project?: string; areaPath?: string };
    const adoService = new AzureDevOpsService(project, areaPath);
    const workItems = await adoService.getWorkItems(from, to);
    res.json(workItems);
  } catch (error: any) {
    console.error('Error fetching work items:', error);
    res.status(500).json({ error: 'Failed to fetch work items' });
  }
});

// PATCH /api/workitems/:id/due-date - Update due date for a work item
router.patch('/workitems/:id/due-date', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { dueDate, reason, project, areaPath } = req.body as UpdateDueDateRequest & { project?: string; areaPath?: string };

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work item ID' });
    }

    // Validate date format if not null
    if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res
        .status(400)
        .json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.updateDueDate(id, dueDate, reason);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating due date:', error);
    res.status(500).json({ error: 'Failed to update due date' });
  }
});

// PATCH /api/workitems/:id/field - Update a specific field for a work item
router.patch('/workitems/:id/field', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { field, value, project, areaPath } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work item ID' });
    }

    if (!field) {
      return res.status(400).json({ error: 'Field name is required' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.updateWorkItemField(id, field, value);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating work item field:', error);
    res.status(500).json({ error: 'Failed to update work item field' });
  }
});

// POST /api/cycle-time - Calculate cycle time for specific work items
router.post('/cycle-time', async (req: Request, res: Response) => {
  try {
    const { workItemIds, project, areaPath } = req.body as { workItemIds: number[]; project?: string; areaPath?: string };

    if (!Array.isArray(workItemIds) || workItemIds.length === 0) {
      return res.status(400).json({ error: 'workItemIds array is required' });
    }

    console.log(`Calculating cycle time for ${workItemIds.length} work items`);
    const adoService = new AzureDevOpsService(project, areaPath);
    const cycleTimeData = await adoService.calculateCycleTimeForItems(workItemIds);
    res.json(cycleTimeData);
  } catch (error: any) {
    console.error('Error calculating cycle time:', error);
    res.status(500).json({ error: 'Failed to calculate cycle time' });
  }
});

// GET /api/health - Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Health check uses default project from env
    const adoService = new AzureDevOpsService();
    const healthy = await adoService.healthCheck();
    res.json({ healthy, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(503).json({ healthy: false, error: 'Service unavailable' });
  }
});

// GET /api/due-date-stats - Get due date change statistics by developer
router.get('/due-date-stats', async (req: Request, res: Response) => {
  try {
    const { from, to, developer, project } = req.query as WorkItemsQuery & { developer?: string; project?: string };
    
    // Define specific teams to query for developer statistics
    // Using project-level query for now to ensure we get data
    const devStatsTeams = [
      { project: 'MaxView', areaPath: '' } // Empty to get all from project
    ];
    
    // Fetch stats from all teams and aggregate
    const allStats: DeveloperDueDateStats[] = [];
    
    for (const team of devStatsTeams) {
      try {
        const adoService = new AzureDevOpsService(team.project, team.areaPath);
        const teamStats = await adoService.getDueDateStatsByDeveloper(from, to, developer);
        allStats.push(...teamStats);
      } catch (error) {
        console.error(`Error fetching stats for ${team.project}/${team.areaPath}:`, error);
        // Continue with other teams even if one fails
      }
    }
    
    // Aggregate stats by developer
    const aggregatedStats = new Map<string, DeveloperDueDateStats>();
    
    for (const stat of allStats) {
      if (aggregatedStats.has(stat.developer)) {
        const existing = aggregatedStats.get(stat.developer)!;
        existing.totalChanges += stat.totalChanges;
        
        // Merge reason breakdown
        for (const [reason, count] of Object.entries(stat.reasonBreakdown)) {
          existing.reasonBreakdown[reason] = (existing.reasonBreakdown[reason] || 0) + count;
        }
      } else {
        aggregatedStats.set(stat.developer, {
          developer: stat.developer,
          totalChanges: stat.totalChanges,
          reasonBreakdown: { ...stat.reasonBreakdown }
        });
      }
    }
    
    const stats = Array.from(aggregatedStats.values());
    console.log(`Returning ${stats.length} developer stats:`, stats.map(s => s.developer));
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching due date stats:', error);
    res.status(500).json({ error: 'Failed to fetch due date statistics' });
  }
});

// GET /api/due-date-hit-rate - Get statistics on whether developers hit their due dates
router.get('/due-date-hit-rate', async (req: Request, res: Response) => {
  try {
    const { from, to, developer } = req.query as WorkItemsQuery & { developer?: string };
    
    // Define specific teams to query
    const devStatsTeams = [
      { project: 'MaxView', areaPath: '' } // Empty to get all from project
    ];
    
    // Fetch hit rate stats from all teams and aggregate
    const allStats: DueDateHitRateStats[] = [];
    
    for (const team of devStatsTeams) {
      try {
        const adoService = new AzureDevOpsService(team.project, team.areaPath);
        const teamStats = await adoService.getDueDateHitRate(from, to, developer);
        allStats.push(...teamStats);
      } catch (error) {
        console.error(`Error fetching hit rate stats for ${team.project}/${team.areaPath}:`, error);
        // Continue with other teams even if one fails
      }
    }
    
    // Aggregate stats by developer
    const aggregatedStats = new Map<string, DueDateHitRateStats>();
    
    for (const stat of allStats) {
      if (aggregatedStats.has(stat.developer)) {
        const existing = aggregatedStats.get(stat.developer)!;
        existing.totalWorkItems += stat.totalWorkItems;
        existing.hitDueDate += stat.hitDueDate;
        existing.missedDueDate += stat.missedDueDate;
        existing.workItemDetails.push(...stat.workItemDetails);
      } else {
        aggregatedStats.set(stat.developer, {
          developer: stat.developer,
          totalWorkItems: stat.totalWorkItems,
          hitDueDate: stat.hitDueDate,
          missedDueDate: stat.missedDueDate,
          hitRate: 0, // Will recalculate
          workItemDetails: [...stat.workItemDetails]
        });
      }
    }
    
    // Recalculate hit rates
    const stats = Array.from(aggregatedStats.values()).map(stat => ({
      ...stat,
      hitRate: stat.totalWorkItems > 0 ? (stat.hitDueDate / stat.totalWorkItems) * 100 : 0
    }));
    
    console.log(`Returning ${stats.length} developer hit rate stats`);
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching due date hit rate:', error);
    res.status(500).json({ error: 'Failed to fetch due date hit rate statistics' });
  }
});

// GET /api/workitems/:id/due-date-changes - Get due date change history for a work item
router.get('/workitems/:id/due-date-changes', async (req: Request, res: Response) => {
  try {
    const workItemId = parseInt(req.params.id);
    const { project } = req.query as { project?: string };

    if (!project) {
      return res.status(400).json({ error: 'project parameter is required' });
    }

    const adoService = new AzureDevOpsService(project);
    const changes = await adoService.getDueDateChangeHistoryForItem(workItemId);
    
    res.json(changes);
  } catch (error: any) {
    console.error(`Error fetching due date changes for work item ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch due date change history' });
  }
});

// GET /api/workitems/:id/discussions - Get discussions/comments for a work item
router.get('/workitems/:id/discussions', async (req: Request, res: Response) => {
  try {
    const workItemId = parseInt(req.params.id);
    const { project } = req.query as { project?: string };

    if (!project) {
      return res.status(400).json({ error: 'project parameter is required' });
    }

    const adoService = new AzureDevOpsService(project);
    const discussions = await adoService.getWorkItemComments(workItemId);
    
    res.json({ discussions });
  } catch (error: any) {
    console.error(`Error fetching discussions for work item ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

// GET /api/team-members - Get list of members from a specific team
router.get('/team-members', async (req: Request, res: Response) => {
  try {
    const { project, teamName } = req.query as { project?: string; teamName?: string };
    
    if (!project || !teamName) {
      return res.status(400).json({ error: 'project and teamName are required' });
    }
    
    const adoService = new AzureDevOpsService(project);
    const members = await adoService.getTeamMembers(teamName);
    
    console.log(`Returning ${members.length} members for ${project}/${teamName}`);
    res.json(members);
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// GET /api/dev-team-members - Get list of developers from dev teams
router.get('/dev-team-members', async (req: Request, res: Response) => {
  try {
    // Define specific teams to query for developer list
    const devTeams = [
      { project: 'MaxView', teamName: 'MaxView - Dev' },
      { project: 'MaxView', teamName: 'MaxView Infra Team' },
      { project: 'MaxView', teamName: 'Mobile - Dev' }
    ];
    
    const allMembers = new Set<string>();
    
    for (const team of devTeams) {
      try {
        const adoService = new AzureDevOpsService(team.project);
        const members = await adoService.getTeamMembers(team.teamName);
        members.forEach(member => allMembers.add(member));
      } catch (error) {
        console.error(`Error fetching members for ${team.project}/${team.teamName}:`, error);
        // Continue with other teams even if one fails
      }
    }
    
    const membersList = Array.from(allMembers).sort();
    console.log(`Returning ${membersList.length} team members from dev teams`);
    res.json(membersList);
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// GET /api/epics/:id/children - Get child work items for an Epic
router.get('/epics/:id/children', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid Epic ID' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    const children = await adoService.getEpicChildren(id);
    res.json(children);
  } catch (error: any) {
    console.error('Error fetching Epic children:', error);
    res.status(500).json({ error: 'Failed to fetch Epic children' });
  }
});

// GET /api/features/:id/children - Get child work items for a Feature
router.get('/features/:id/children', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid Feature ID' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    const children = await adoService.getFeatureChildren(id);
    res.json(children);
  } catch (error: any) {
    console.error('Error fetching Feature children:', error);
    res.status(500).json({ error: 'Failed to fetch Feature children' });
  }
});

// GET /api/workitems/:id/relations - Get related/child work items for a PBI or TBI
router.get('/workitems/:id/relations', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };

    console.log(`Fetching relations for work item ${id}, project: ${project}, areaPath: ${areaPath}`);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work item ID' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    const relatedItems = await adoService.getWorkItemRelations(id);
    
    console.log(`Returning ${relatedItems.length} related items for work item ${id}`);
    res.json(relatedItems);
  } catch (error: any) {
    console.error('Error fetching work item relations:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to fetch work item relations' });
  }
});

// POST /api/admin/trigger-feature-check - Manually trigger feature auto-complete check
router.post('/admin/trigger-feature-check', async (req: Request, res: Response) => {
  try {
    console.log('[API] Manual trigger of feature auto-complete check requested');
    const service = getFeatureAutoCompleteService();
    
    // Run the check asynchronously
    service.triggerCheck().catch(error => {
      console.error('[API] Error during manual feature check:', error);
    });
    
    res.json({ 
      success: true, 
      message: 'Feature auto-complete check triggered. Check server logs for results.' 
    });
  } catch (error: any) {
    console.error('Error triggering feature check:', error);
    res.status(500).json({ error: 'Failed to trigger feature check' });
  }
});

export default router;
