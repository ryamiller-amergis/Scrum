import express, { Request, Response } from 'express';
import { AzureDevOpsService } from '../services/azureDevOps';
import { WorkItemsQuery, UpdateDueDateRequest } from '../types/workitem';

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
    const { from, to, developer, project, areaPath } = req.query as WorkItemsQuery & { developer?: string; project?: string; areaPath?: string };
    const adoService = new AzureDevOpsService(project, areaPath);
    const stats = await adoService.getDueDateStatsByDeveloper(from, to, developer);
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching due date stats:', error);
    res.status(500).json({ error: 'Failed to fetch due date statistics' });
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

export default router;
