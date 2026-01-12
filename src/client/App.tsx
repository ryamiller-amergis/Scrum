import { useState, useMemo, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { startOfMonth, endOfMonth } from 'date-fns';
import { ScrumCalendar } from './components/ScrumCalendar';
import { UnscheduledList } from './components/UnscheduledList';
import { DetailsPanel } from './components/DetailsPanel';
import { CycleTimeAnalytics } from './components/CycleTimeAnalytics';
import { DevStats } from './components/DevStats';
import { DueDateReasonModal } from './components/DueDateReasonModal';
import { useWorkItems } from './hooks/useWorkItems';
import { WorkItem } from './types/workitem';
import './App.css';

interface DueDateChange {
  workItemId: number;
  workItemTitle: string;
  oldDueDate: string | null;
  newDueDate: string | null;
}

function App() {
  const [currentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'analytics'>('calendar');
  const [analyticsTab, setAnalyticsTab] = useState<'cycle-time' | 'dev-stats'>('cycle-time');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  // Track original due dates and pending changes
  const originalDueDates = useRef<Map<number, string | undefined>>(new Map());
  const [pendingDueDateChange, setPendingDueDateChange] = useState<DueDateChange | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const { workItems, loading, error, updateDueDate } = useWorkItems(
    startDate,
    endDate
  );

  const handleFieldUpdate = async (id: number, field: string, value: any) => {
    console.log(`Updating work item ${id} field ${field} to:`, value);
    
    // Optimistic update
    const response = await fetch(`/api/workitems/${id}/field`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, value }),
    });

    if (!response.ok) {
      console.error('Failed to update field');
    }
  };

  // Store original due dates when work items are loaded
  useEffect(() => {
    workItems.forEach((item) => {
      if (!originalDueDates.current.has(item.id)) {
        originalDueDates.current.set(item.id, item.dueDate);
      }
    });
  }, [workItems]);

  const scheduledItems = useMemo(
    () => workItems.filter((item) => item.dueDate),
    [workItems]
  );

  const unscheduledItems = useMemo(
    () => workItems.filter((item) => !item.dueDate),
    [workItems]
  );

  // Keep selectedItem in sync with workItems
  useEffect(() => {
    if (selectedItem) {
      const updatedItem = workItems.find(item => item.id === selectedItem.id);
      if (updatedItem) {
        setSelectedItem(updatedItem);
      }
    }
  }, [workItems, selectedItem?.id]);

  const handleDueDateChange = (id: number, newDueDate: string | null, reason?: string) => {
    const workItem = workItems.find(item => item.id === id);
    if (!workItem) return;

    // Use the current due date from the work item, not the original
    const oldDueDate = workItem.dueDate || null;
    const newDateStr = newDueDate;
    
    console.log('=== handleDueDateChange ===' );
    console.log('Work Item ID:', id);
    console.log('Work Item Title:', workItem.title);
    console.log('Current Due Date (from workItem):', oldDueDate);
    console.log('New Due Date (parameter):', newDateStr);
    console.log('Reason:', reason);
    console.log('Original Due Date (from ref):', originalDueDates.current.get(id));
    
    // If both are null or the same, no change occurred
    if (oldDueDate === newDateStr) {
      console.log('Dates are the same, skipping modal');
      return;
    }

    // If reason is provided (from DetailsPanel), update directly without modal
    if (reason) {
      console.log('Reason provided, updating directly');
      originalDueDates.current.set(id, newDateStr || undefined);
      updateDueDate(id, newDateStr, reason);
      return;
    }

    // If there's a change and no reason, show the modal
    console.log('Setting pending due date change');
    setPendingDueDateChange({
      workItemId: id,
      workItemTitle: workItem.title,
      oldDueDate: oldDueDate,
      newDueDate: newDateStr,
    });
  };

  const handleConfirmDueDateChange = async (reason: string) => {
    if (!pendingDueDateChange) return;

    const { workItemId, newDueDate } = pendingDueDateChange;
    
    // Update the original due date reference
    originalDueDates.current.set(workItemId, newDueDate || undefined);
    
    // Perform the update with the reason
    await updateDueDate(workItemId, newDueDate, reason);
    
    // Clear the pending change and close modal
    setPendingDueDateChange(null);
  };

  const handleCancelDueDateChange = () => {
    setPendingDueDateChange(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading work items...</p>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <div className="app-header">
          <div className="view-switcher">
            <button 
              className={`view-btn ${currentView === 'calendar' ? 'active' : ''}`}
              onClick={() => setCurrentView('calendar')}
            >
              Calendar
            </button>
            <button 
              className={`view-btn ${currentView === 'analytics' ? 'active' : ''}`}
              onClick={() => setCurrentView('analytics')}
            >
              Analytics
            </button>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        
        {currentView === 'calendar' ? (
          <div className="calendar-view">
            <UnscheduledList
              workItems={unscheduledItems}
              onSelectItem={setSelectedItem}
              onUpdateDueDate={(id, dueDate) => {
                // Close details panel when dragging items
                setSelectedItem(null);
                handleDueDateChange(id, dueDate);
              }}
            />
            <ScrumCalendar
              workItems={scheduledItems}
              onUpdateDueDate={(id, dueDate) => {
                // Close details panel when dragging items
                setSelectedItem(null);
                handleDueDateChange(id, dueDate);
              }}
              onSelectItem={setSelectedItem}
            />
            {selectedItem && (
              <DetailsPanel
                workItem={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdateDueDate={handleDueDateChange}
                allWorkItems={workItems}
                onUpdateField={handleFieldUpdate}
              />
            )}
            {pendingDueDateChange && (
              <DueDateReasonModal
                workItemId={pendingDueDateChange.workItemId}
                workItemTitle={pendingDueDateChange.workItemTitle}
                oldDueDate={pendingDueDateChange.oldDueDate}
                newDueDate={pendingDueDateChange.newDueDate}
                onConfirm={handleConfirmDueDateChange}
                onCancel={handleCancelDueDateChange}
              />
            )}
          </div>
        ) : (
          <div className="analytics-view">
            <div className="analytics-tabs">
              <button
                className={`tab-button ${analyticsTab === 'cycle-time' ? 'active' : ''}`}
                onClick={() => setAnalyticsTab('cycle-time')}
              >
                Cycle Time Analytics
              </button>
              <button
                className={`tab-button ${analyticsTab === 'dev-stats' ? 'active' : ''}`}
                onClick={() => setAnalyticsTab('dev-stats')}
              >
                Developer Statistics
              </button>
            </div>
            <div className="analytics-content">
              {analyticsTab === 'cycle-time' ? (
                <CycleTimeAnalytics workItems={workItems} />
              ) : (
                <DevStats workItems={workItems} />
              )}
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}

export default App;
