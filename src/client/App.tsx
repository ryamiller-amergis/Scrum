import { useState, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { startOfMonth, endOfMonth } from 'date-fns';
import { ScrumCalendar } from './components/ScrumCalendar';
import { UnscheduledList } from './components/UnscheduledList';
import { DetailsPanel } from './components/DetailsPanel';
import { useWorkItems } from './hooks/useWorkItems';
import { WorkItem } from './types/workitem';
import './App.css';

function App() {
  const [currentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const { workItems, loading, error, updateDueDate } = useWorkItems(
    startDate,
    endDate
  );

  const scheduledItems = useMemo(
    () => workItems.filter((item) => item.dueDate),
    [workItems]
  );

  const unscheduledItems = useMemo(
    () => workItems.filter((item) => !item.dueDate),
    [workItems]
  );

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
        {error && <div className="error-banner">{error}</div>}
        <UnscheduledList
          workItems={unscheduledItems}
          onSelectItem={setSelectedItem}
        />
        <ScrumCalendar
          workItems={scheduledItems}
          onUpdateDueDate={updateDueDate}
          onSelectItem={setSelectedItem}
        />
        {selectedItem && (
          <DetailsPanel
            workItem={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default App;
