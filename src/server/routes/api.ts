import express, { Request, Response } from 'express';
import { AzureDevOpsService } from '../services/azureDevOps';
import { WorkItemsQuery, UpdateDueDateRequest, DeveloperDueDateStats, DueDateHitRateStats, CreateDeploymentRequest } from '../types/workitem';
import { getFeatureAutoCompleteService } from '../services/featureAutoComplete';
import { DeploymentTrackingService } from '../services/deploymentTracking';

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

// GET /api/workitems/search - Search for work items by query
router.get('/workitems/search', async (req: Request, res: Response) => {
  try {
    const { query, type, project, areaPath } = req.query as { query?: string; type?: string; project?: string; areaPath?: string };
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    const workItems = await adoService.searchWorkItems(query, type);
    res.json(workItems);
  } catch (error: any) {
    console.error('Error searching work items:', error);
    res.status(500).json({ error: 'Failed to search work items' });
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

// GET /api/workitems/:id/parent-epic - Get parent epic for a work item
router.get('/workitems/:id/parent-epic', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work item ID' });
    }

    console.log(`[API] Fetching parent epic for work item ${id}`);
    const adoService = new AzureDevOpsService(project, areaPath);
    const parentEpic = await adoService.getParentReleaseEpic(id);
    
    if (parentEpic) {
      console.log(`[API] Found parent epic:`, parentEpic);
      res.json(parentEpic);
    } else {
      console.log(`[API] No parent epic found for work item ${id}`);
      res.json(null);
    }
  } catch (error: any) {
    console.error('[API] Error fetching parent epic:', error);
    res.status(500).json({ error: 'Failed to fetch parent epic' });
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

// ============= RELEASE MANAGEMENT ROUTES =============

// GET /api/releases/epics - Get all release Epics with progress
router.get('/releases/epics', async (req: Request, res: Response) => {
  try {
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };
    const adoService = new AzureDevOpsService(project, areaPath);
    const epics = await adoService.getReleaseEpics();
    res.json(epics);
  } catch (error: any) {
    console.error('Error fetching release epics:', error);
    res.status(500).json({ error: 'Failed to fetch release epics' });
  }
});

// PATCH /api/releases/:epicId - Update a release Epic
router.patch('/releases/:epicId', async (req: Request, res: Response) => {
  try {
    const epicId = parseInt(req.params.epicId, 10);
    const { title, startDate, targetDate, description, project, areaPath } = req.body as {
      title?: string;
      startDate?: string;
      targetDate?: string;
      description?: string;
      project?: string;
      areaPath?: string;
    };

    if (isNaN(epicId)) {
      return res.status(400).json({ error: 'Invalid epic ID' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.updateReleaseEpic(epicId, title, startDate, targetDate, description);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating release epic:', error);
    res.status(500).json({ error: 'Failed to update release epic' });
  }
});

// POST /api/releases/:epicId/link - Link work items to release epic
router.post('/releases/:epicId/link', async (req: Request, res: Response) => {
  try {
    const epicId = parseInt(req.params.epicId, 10);
    const { workItemIds, project, areaPath } = req.body as { workItemIds: number[]; project?: string; areaPath?: string };

    if (isNaN(epicId)) {
      return res.status(400).json({ error: 'Invalid epic ID' });
    }

    if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
      return res.status(400).json({ error: 'workItemIds array is required' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.linkWorkItemsToEpic(epicId, workItemIds);
    res.json({ success: true, linkedCount: workItemIds.length });
  } catch (error: any) {
    console.error('Error linking work items:', error);
    res.status(500).json({ error: 'Failed to link work items' });
  }
});

// POST /api/releases/:epicId/unlink - Unlink work items from release epic
router.post('/api/releases/:epicId/unlink', async (req: Request, res: Response) => {
  try {
    const epicId = parseInt(req.params.epicId, 10);
    const { workItemIds, project, areaPath } = req.body as { workItemIds: number[]; project?: string; areaPath?: string };

    if (isNaN(epicId)) {
      return res.status(400).json({ error: 'Invalid epic ID' });
    }

    if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
      return res.status(400).json({ error: 'workItemIds array is required' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.unlinkWorkItemsFromEpic(epicId, workItemIds);
    res.json({ success: true, unlinkedCount: workItemIds.length });
  } catch (error: any) {
    console.error('Error unlinking work items:', error);
    res.status(500).json({ error: 'Failed to unlink work items' });
  }
});

// DELETE /api/releases/:epicId - Delete a release epic
router.delete('/releases/:epicId', async (req: Request, res: Response) => {
  try {
    const epicId = parseInt(req.params.epicId, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };

    if (isNaN(epicId)) {
      return res.status(400).json({ error: 'Invalid epic ID' });
    }

    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.deleteWorkItem(epicId);
    res.json({ success: true, deletedEpicId: epicId });
  } catch (error: any) {
    console.error('Error deleting release epic:', error);
    res.status(500).json({ error: 'Failed to delete release epic' });
  }
});

// GET /api/releases - Get all release versions
router.get('/releases', async (req: Request, res: Response) => {
  try {
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };
    const adoService = new AzureDevOpsService(project, areaPath);
    const versions = await adoService.getReleaseVersions();
    res.json(versions);
  } catch (error: any) {
    console.error('Error fetching release versions:', error);
    res.status(500).json({ error: 'Failed to fetch release versions' });
  }
});

// GET /api/releases/:version/workitems - Get work items for a specific release
router.get('/releases/:version/workitems', async (req: Request, res: Response) => {
  try {
    const version = req.params.version;
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };
    const adoService = new AzureDevOpsService(project, areaPath);
    const workItems = await adoService.getWorkItemsByRelease(version);
    res.json(workItems);
  } catch (error: any) {
    console.error('Error fetching release work items:', error);
    res.status(500).json({ error: 'Failed to fetch release work items' });
  }
});

// GET /api/releases/:version/metrics - Get metrics for a specific release
router.get('/releases/:version/metrics', async (req: Request, res: Response) => {
  try {
    const version = req.params.version;
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };
    const adoService = new AzureDevOpsService(project, areaPath);
    const deploymentService = new DeploymentTrackingService();
    
    const metrics = await adoService.getReleaseMetrics(version);
    
    // Add deployment history from tracking service
    metrics.deploymentHistory = await deploymentService.getDeploymentsByRelease(version);
    
    res.json(metrics);
  } catch (error: any) {
    console.error('Error fetching release metrics:', error);
    res.status(500).json({ error: 'Failed to fetch release metrics' });
  }
});

// POST /api/releases/:version/tag - Add release tag to work items
router.post('/releases/:version/tag', async (req: Request, res: Response) => {
  try {
    const version = req.params.version;
    const { workItemIds, project, areaPath, startDate, targetDate, description } = req.body as { 
      workItemIds?: number[]; 
      project?: string; 
      areaPath?: string;
      startDate?: string;
      targetDate?: string;
      description?: string;
    };
    
    const adoService = new AzureDevOpsService(project, areaPath);
    
    // Create release Epic
    const epicId = await adoService.createReleaseEpic(version, startDate, targetDate, description);
    
    // If workItemIds were provided, add release tag to each work item
    if (workItemIds && Array.isArray(workItemIds) && workItemIds.length > 0) {
      await Promise.all(
        workItemIds.map(id => adoService.addReleaseTag(id, version))
      );
    }
    
    res.json({ success: true, epicId, taggedCount: workItemIds?.length || 0 });
  } catch (error: any) {
    console.error('Error creating release:', error);
    res.status(500).json({ error: 'Failed to create release' });
  }
});

// DELETE /api/releases/:version/tag/:workItemId - Remove release tag from work item
router.delete('/releases/:version/tag/:workItemId', async (req: Request, res: Response) => {
  try {
    const version = req.params.version;
    const workItemId = parseInt(req.params.workItemId, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };
    
    if (isNaN(workItemId)) {
      return res.status(400).json({ error: 'Invalid work item ID' });
    }
    
    const adoService = new AzureDevOpsService(project, areaPath);
    await adoService.removeReleaseTag(workItemId, version);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing release tag:', error);
    res.status(500).json({ error: 'Failed to remove release tag' });
  }
});

// ============= DEPLOYMENT TRACKING ROUTES =============

// POST /api/deployments - Create a new deployment record
router.post('/deployments', async (req: Request, res: Response) => {
  try {
    const { releaseVersion, environment, workItemIds, notes } = req.body as CreateDeploymentRequest;
    
    if (!releaseVersion || !environment || !workItemIds || !Array.isArray(workItemIds)) {
      return res.status(400).json({ error: 'releaseVersion, environment, and workItemIds are required' });
    }
    
    const deploymentService = new DeploymentTrackingService();
    
    // Get user from session or use a default
    const deployedBy = (req.user as any)?.displayName || 'Unknown User';
    
    const deployment = await deploymentService.createDeployment(
      releaseVersion,
      environment,
      workItemIds,
      deployedBy,
      notes
    );
    
    res.json(deployment);
  } catch (error: any) {
    console.error('Error creating deployment:', error);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

// GET /api/deployments - Get all deployments (or filter by release/environment)
router.get('/deployments', async (req: Request, res: Response) => {
  try {
    const { releaseVersion, environment, limit } = req.query as { 
      releaseVersion?: string; 
      environment?: string;
      limit?: string;
    };
    
    const deploymentService = new DeploymentTrackingService();
    
    let deployments;
    
    if (releaseVersion) {
      deployments = await deploymentService.getDeploymentsByRelease(releaseVersion);
    } else if (environment) {
      deployments = await deploymentService.getDeploymentsByEnvironment(environment as any);
    } else if (limit) {
      deployments = await deploymentService.getDeploymentHistory(parseInt(limit, 10));
    } else {
      deployments = await deploymentService.getAllDeployments();
    }
    
    res.json(deployments);
  } catch (error: any) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// GET /api/deployments/:releaseVersion/latest - Get latest deployments by environment for a release
router.get('/deployments/:releaseVersion/latest', async (req: Request, res: Response) => {
  try {
    const releaseVersion = req.params.releaseVersion;
    const deploymentService = new DeploymentTrackingService();
    const latest = await deploymentService.getLatestDeploymentsByRelease(releaseVersion);
    res.json(latest);
  } catch (error: any) {
    console.error('Error fetching latest deployments:', error);
    res.status(500).json({ error: 'Failed to fetch latest deployments' });
  }
});

// GET /api/releases/:epicId/children - Get child work items for a release Epic
router.get('/releases/:epicId/children', async (req: Request, res: Response) => {
  try {
    const epicId = parseInt(req.params.epicId, 10);
    const { project, areaPath } = req.query as { project?: string; areaPath?: string };

    if (isNaN(epicId)) {
      return res.status(400).json({ error: 'Invalid Epic ID' });
    }

    console.log(`Fetching children for release Epic ${epicId}`);
    const adoService = new AzureDevOpsService(project, areaPath);
    const children = await adoService.getReleaseEpicChildren(epicId);
    console.log(`Returning ${children.length} children for release Epic ${epicId}`);
    res.json(children);
  } catch (error: any) {
    console.error('Error fetching release Epic children:', error);
    res.status(500).json({ error: 'Failed to fetch release Epic children' });
  }
});

// GET /api/releases/:version/notes - Generate release notes
router.get('/releases/:version/notes', async (req: Request, res: Response) => {
  try {
    const version = req.params.version;
    const { project, areaPath, format = 'json' } = req.query as { project?: string; areaPath?: string; format?: string };
    
    const adoService = new AzureDevOpsService(project, areaPath);
    const workItems = await adoService.getWorkItemsByRelease(version);
    
    // Group by work item type
    const features = workItems.filter(wi => wi.workItemType === 'Feature');
    const epics = workItems.filter(wi => wi.workItemType === 'Epic');
    const bugs = workItems.filter(wi => wi.workItemType === 'Bug');
    
    if (format === 'markdown') {
      // Generate markdown format
      let markdown = `# Release ${version}\n\n`;
      
      if (features.length > 0) {
        markdown += `## Features\n\n`;
        features.forEach(f => {
          markdown += `- **[${f.id}]** ${f.title} - ${f.state}\n`;
        });
        markdown += '\n';
      }
      
      if (epics.length > 0) {
        markdown += `## Epics\n\n`;
        epics.forEach(e => {
          markdown += `- **[${e.id}]** ${e.title} - ${e.state}\n`;
        });
        markdown += '\n';
      }
      
      if (bugs.length > 0) {
        markdown += `## Bug Fixes\n\n`;
        bugs.forEach(b => {
          markdown += `- **[${b.id}]** ${b.title} - ${b.state}\n`;
        });
        markdown += '\n';
      }
      
      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
    } else {
      // Return JSON format
      res.json({
        version,
        generatedAt: new Date().toISOString(),
        features: features.map(f => ({ id: f.id, title: f.title, state: f.state })),
        epics: epics.map(e => ({ id: e.id, title: e.title, state: e.state })),
        bugs: bugs.map(b => ({ id: b.id, title: b.title, state: b.state })),
      });
    }
  } catch (error: any) {
    console.error('Error generating release notes:', error);
    res.status(500).json({ error: 'Failed to generate release notes' });
  }
});

export default router;
