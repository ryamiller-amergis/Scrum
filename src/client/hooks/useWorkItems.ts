import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkItem } from '../types/workitem';
import { workItemService } from '../services/workItemService';

const POLL_INTERVAL =
  (parseInt(import.meta.env.VITE_POLL_INTERVAL || '30') || 30) * 1000;

export function useWorkItems(startDate: Date, endDate: Date, project: string, areaPath: string) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updatingItemsRef = useRef<Map<number, string | null>>(new Map());
  const currentRequestRef = useRef({ project, areaPath });
  const hasLoadedOnce = useRef(false);
  const fetchFnRef = useRef<() => Promise<void>>();

  // Convert forward slashes to backslashes for Azure DevOps API
  const normalizedAreaPath = areaPath.replace(/\//g, '\\');

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Update current request ref when team changes
    currentRequestRef.current = { project, areaPath };
    setLoading(true);
    setWorkItems([]); // Clear old data immediately

    const fetchWorkItems = async () => {
      try {
        const from = formatDate(startDate);
        const to = formatDate(endDate);
        
        // Store the request params to validate response matches current selection
        const requestParams = { project, areaPath };
        
        const items = await workItemService.getWorkItems(from, to, project, normalizedAreaPath);
        
        // Only update if this response is for the current team selection
        if (requestParams.project === currentRequestRef.current.project && 
            requestParams.areaPath === currentRequestRef.current.areaPath) {
          
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
          hasLoadedOnce.current = true;
          setLoading(false);
        } else {
          console.log(`Ignoring stale response for ${requestParams.project}/${requestParams.areaPath}`);
        }
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching work items:', err);
        setLoading(false);
      }
    };

    // Store in ref for updateDueDate to use
    fetchFnRef.current = fetchWorkItems;

    fetchWorkItems();
    const interval = setInterval(fetchWorkItems, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [startDate, endDate, project, areaPath]);

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
      await workItemService.updateDueDate(id, dueDate, reason, project, areaPath);
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
      if (fetchFnRef.current) {
        await fetchFnRef.current();
      }
    }
  }, [project, areaPath]);

  return { workItems, loading, error, updateDueDate, refetch: () => fetchFnRef.current?.() };
}
