export interface AzureSubscription {
  id: string;
  subscriptionId: string;
  name: string;
  state: string;
  resourceGroups?: string[];
}

export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  subscriptionId: string;
}

export interface CostData {
  totalCost: number;
  dailyAverage: number;
  projectedMonthly: number;
  percentChange: number;
  costByDay: Array<{ date: string; cost: number }>;
  costByResourceGroup: Array<{ name: string; cost: number }>;
  costDetails: Array<{
    resourceGroup: string;
    service: string;
    resource: string;
    dailyCost: number;
    totalCost: number;
    trend: number;
  }>;
}

class AzureCostService {
  private baseUrl = '/api/azure';

  /**
   * Fetch all Azure subscriptions
   */
  async getSubscriptions(): Promise<AzureSubscription[]> {
    const response = await fetch(`${this.baseUrl}/subscriptions`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch resource groups for a specific subscription
   */
  async getResourceGroups(subscriptionId: string): Promise<AzureResourceGroup[]> {
    const response = await fetch(
      `${this.baseUrl}/subscriptions/${subscriptionId}/resource-groups`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch resource groups: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all subscriptions with their resource groups in one call
   */
  async getSubscriptionsWithResourceGroups(): Promise<AzureSubscription[]> {
    const response = await fetch(`${this.baseUrl}/subscriptions-with-resource-groups`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscriptions with resource groups: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch cost data for selected resource groups over a time period
   */
  async getCostData(
    subscriptionId: string,
    resourceGroups: string[],
    timePeriod: string
  ): Promise<CostData> {
    const params = new URLSearchParams({
      subscriptionId,
      resourceGroups: resourceGroups.join(','),
      timePeriod
    });

    const response = await fetch(`${this.baseUrl}/cost-data?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cost data: ${response.statusText}`);
    }

    return response.json();
  }
}

export const azureCostService = new AzureCostService();
