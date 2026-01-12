import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkItem } from '../types/workitem';
import { workItemService } from '../services/workItemService';

const POLL_INTERVAL =
  (parseInt(import.meta.env.VITE_POLL_INTERVAL || '30') || 30) * 1000;

export function useWorkItems(startDate: Date, endDate: Date) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updatingItemsRef = useRef<Map<number, string | null>>(new Map());

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const fetchWorkItems = useCallback(async () => {
    try {
      const from = formatDate(startDate);
      const to = formatDate(endDate);
      const items = await workItemService.getWorkItems(from, to);
      
      const hasUpdatingItems = updatingItemsRef.current.size > 0;
      if (hasUpdatingItems) {
        console.log('Merging with locked items:', Array.from(updatingItemsRef.current.keys()));
      }
      
      // Merge fetched items with items currently being updated
      setWorkItems(items.map(item => {
        // If this item is being updated, use the optimistic value instead
        if (updatingItemsRef.current.has(item.id)) {
          const newDate = updatingItemsRef.current.get(item.id);
          console.log(`Keeping optimistic value for item ${item.id}: ${newDate}`);
          return { ...item, dueDate: newDate || undefined };
        }
        return item;
      }));
      
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

  const updateDueDate = useCallback(async (id: number, dueDate: string | null, reason?: string) => {
    console.log(`Updating item ${id} to date ${dueDate} with reason: ${reason || 'none'}`);
    
    // Mark this item as being updated with the new date
    updatingItemsRef.current.set(id, dueDate);
    console.log('Locked items:', Array.from(updatingItemsRef.current.keys()));
    
    // Optimistic update - apply immediately
    setWorkItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, dueDate: dueDate || undefined } : item
      )
    );

    try {
      await workItemService.updateDueDate(id, dueDate, reason);
      console.log(`Successfully updated item ${id} on server`);
      
      // Keep the item marked as updating for longer to ensure backend has processed and propagated
      setTimeout(() => {
        updatingItemsRef.current.delete(id);
        console.log(`Released lock on item ${id}`);
      }, 5000); // Increased to 5 seconds
    } catch (err: any) {
      setError(err.message);
      console.error('Error updating due date:', err);
      
      // On error, remove from updating list and refetch to get correct state
      updatingItemsRef.current.delete(id);
      await fetchWorkItems();
    }
  }, [fetchWorkItems]);

  return { workItems, loading, error, updateDueDate, refetch: fetchWorkItems };
}
