import { Router } from 'express';
import { AzureCostService } from '../services/azureCost';

const router = Router();

// Initialize Azure Cost Service
let azureCostService: AzureCostService;

try {
  azureCostService = new AzureCostService();
} catch (error) {
  console.error('Failed to initialize AzureCostService:', error);
}

/**
 * GET /api/azure/subscriptions
 * Get all Azure subscriptions
 */
router.get('/subscriptions', async (req, res) => {
  try {
    if (!azureCostService) {
      return res.status(500).json({ 
        error: 'Azure Cost Service not initialized. Check your Azure credentials.' 
      });
    }

    const subscriptions = await azureCostService.getSubscriptions();
    res.json(subscriptions);
  } catch (error) {
    console.error('Error in /api/azure/subscriptions:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch subscriptions' 
    });
  }
});

/**
 * GET /api/azure/subscriptions/:subscriptionId/resource-groups
 * Get all resource groups for a specific subscription
 */
router.get('/subscriptions/:subscriptionId/resource-groups', async (req, res) => {
  try {
    if (!azureCostService) {
      return res.status(500).json({ 
        error: 'Azure Cost Service not initialized. Check your Azure credentials.' 
      });
    }

    const { subscriptionId } = req.params;
    const resourceGroups = await azureCostService.getResourceGroups(subscriptionId);
    res.json(resourceGroups);
  } catch (error) {
    console.error(`Error in /api/azure/subscriptions/${req.params.subscriptionId}/resource-groups:`, error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch resource groups' 
    });
  }
});

/**
 * GET /api/azure/subscriptions-with-resource-groups
 * Get all subscriptions with their resource groups in one call
 */
router.get('/subscriptions-with-resource-groups', async (req, res) => {
  try {
    if (!azureCostService) {
      return res.status(500).json({ 
        error: 'Azure Cost Service not initialized. Check your Azure credentials.' 
      });
    }

    const data = await azureCostService.getSubscriptionsWithResourceGroups();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/azure/subscriptions-with-resource-groups:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch data' 
    });
  }
});

/**
 * GET /api/azure/cost-data
 * Get cost data for selected resource groups
 */
router.get('/cost-data', async (req, res) => {
  try {
    if (!azureCostService) {
      return res.status(500).json({ 
        error: 'Azure Cost Service not initialized. Check your Azure credentials.' 
      });
    }

    const { subscriptionId, resourceGroups, timePeriod } = req.query;

    if (!subscriptionId || !resourceGroups || !timePeriod) {
      return res.status(400).json({ 
        error: 'Missing required parameters: subscriptionId, resourceGroups, timePeriod' 
      });
    }

    const rgArray = (resourceGroups as string).split(',').filter(rg => rg.trim());
    const costData = await azureCostService.getCostData(
      subscriptionId as string,
      rgArray,
      timePeriod as '7d' | '30d' | '90d'
    );
    
    res.json(costData);
  } catch (error) {
    console.error('Error in /api/azure/cost-data:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch cost data' 
    });
  }
});

export default router;
