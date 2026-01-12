import { WorkItem } from '../types/workitem';

const API_BASE = '/api';

export const workItemService = {
  async getWorkItems(from?: string, to?: string): Promise<WorkItem[]> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const url = `${API_BASE}/workitems${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch work items');
    }

    return response.json();
  },

  async updateDueDate(id: number, dueDate: string | null, reason?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/workitems/${id}/due-date`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDate, reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to update due date');
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; timestamp: string }> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  },

  async calculateCycleTime(workItemIds: number[]): Promise<Record<number, any>> {
    const response = await fetch(`${API_BASE}/cycle-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workItemIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate cycle time');
    }

    return response.json();
  },
};
