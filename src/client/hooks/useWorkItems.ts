import { useState, useEffect, useCallback } from 'react';
import { WorkItem } from '../types/workitem';
import { workItemService } from '../services/workItemService';

const POLL_INTERVAL =
  (parseInt(import.meta.env.VITE_POLL_INTERVAL || '30') || 30) * 1000;

export function useWorkItems(startDate: Date, endDate: Date) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const fetchWorkItems = useCallback(async () => {
    try {
      const from = formatDate(startDate);
      const to = formatDate(endDate);
      const items = await workItemService.getWorkItems(from, to);
      setWorkItems(items);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching work items:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchWorkItems();
    const interval = setInterval(fetchWorkItems, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchWorkItems]);

  const updateDueDate = async (id: number, dueDate: string | null) => {
    // Optimistic update
    setWorkItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, dueDate: dueDate || undefined } : item
      )
    );

    try {
      await workItemService.updateDueDate(id, dueDate);
      // Refresh to get latest data
      await fetchWorkItems();
    } catch (err: any) {
      setError(err.message);
      // Revert on error
      await fetchWorkItems();
    }
  };

  return { workItems, loading, error, updateDueDate, refetch: fetchWorkItems };
}
