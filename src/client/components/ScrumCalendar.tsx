import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, View, EventProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUSLocale from 'date-fns/locale/en-US';
import { WorkItem } from '../types/workitem';
import { getAssigneeColor, getEpicColor } from '../utils/assigneeColors';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './ScrumCalendar.css';

const DragAndDropCalendar = withDragAndDrop(Calendar);

const locales = {
  'en-US': enUSLocale,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface ScrumCalendarProps {
  workItems: WorkItem[];
  onUpdateDueDate: (id: number, dueDate: string | null) => void;
  onUpdateField?: (id: number, field: string, value: any) => void;
  onSelectItem: (item: WorkItem) => void;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: WorkItem;
  allDay?: boolean;
}

export const ScrumCalendar: React.FC<ScrumCalendarProps> = ({
  workItems,
  onUpdateDueDate,
  onUpdateField,
  onSelectItem,
}) => {
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');
  const [selectedWorkItemType, setSelectedWorkItemType] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedIteration, setSelectedIteration] = useState<string>('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventsRef = useRef<CalendarEvent[]>([]);

  // Get unique assigned to values
  const assignedToOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.assignedTo) {
        unique.add(item.assignedTo);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Get unique work item types
  const workItemTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.workItemType) {
        unique.add(item.workItemType);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Get unique states
  const stateOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.state) {
        unique.add(item.state);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Get unique iterations
  const iterationOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.iterationPath) {
        unique.add(item.iterationPath);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Filter work items based on selected filters
  const filteredWorkItems = useMemo(() => {
    return workItems.filter(item => {
      if (selectedAssignedTo && item.assignedTo !== selectedAssignedTo) {
        return false;
      }
      if (selectedWorkItemType && item.workItemType !== selectedWorkItemType) {
        return false;
      }
      if (selectedState && item.state !== selectedState) {
        return false;
      }
      if (selectedIteration && item.iterationPath !== selectedIteration) {
        return false;
      }
      return true;
    });
  }, [workItems, selectedAssignedTo, selectedWorkItemType, selectedState, selectedIteration]);

  const events: CalendarEvent[] = useMemo(() => {
    return filteredWorkItems
      .filter((item) => {
        // Include items that have either dueDate, targetDate (for Epics), or qaCompleteDate (for test items)
        return item.dueDate || item.targetDate || item.qaCompleteDate;
      })
      .map((item) => {
        let dateString: string | undefined;
        
        // Determine which date to use based on state and work item type
        // Check for various QA/Testing state names
        const isTestState = item.state?.toLowerCase().includes('test') || 
                           item.state?.toLowerCase().includes('qa') ||
                           item.state === 'Ready For Test' || 
                           item.state === 'In Test';
        
        if (isTestState && item.qaCompleteDate) {
          // For items in test states, use qaCompleteDate
          dateString = item.qaCompleteDate;
        } else if (item.workItemType === 'Epic' || item.workItemType === 'Feature' || item.workItemType === 'Bug') {
          // For Epics, Features, and Bugs, use targetDate
          dateString = item.targetDate;
        } else {
          // For all other items (PBI, TBI), use dueDate
          dateString = item.dueDate;
        }
        
        if (!dateString) return null;
        
        // Parse the date string directly (YYYY-MM-DD format)
        const [year, month, day] = dateString.split('-').map(Number);
        // Create date at noon local time to avoid timezone boundary issues
        const eventDate = new Date(year, month - 1, day, 12, 0, 0);
        
        // Create event with custom onDragStart
        const event: CalendarEvent = {
          id: item.id,
          title: `#${item.id}: ${item.title}`,
          start: eventDate,
          end: eventDate,
          resource: item,
          allDay: true,
        };
        
        return event;
      })
      .filter((event): event is CalendarEvent => event !== null);
  }, [filteredWorkItems]);

  // Update the ref when events change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Add event listeners for popup events
  useEffect(() => {
    const handlePopupDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('rbc-event') && target.closest('.rbc-overlay')) {
        const eventId = target.getAttribute('data-event-id');
        if (eventId) {
          const event = eventsRef.current.find(ev => ev.id === parseInt(eventId));
          if (event) {
            // Immediately remove all overlay popups when drag starts
            document.querySelectorAll('.rbc-overlay').forEach(overlay => {
              overlay.remove();
            });
            
            (window as any).__DRAGGED_WORK_ITEM__ = event.resource;
            (window as any).__DRAGGED_CALENDAR_ITEM__ = event.resource;
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
            }
          }
        }
      }
    };

    const handlePopupDragEnd = () => {
      (window as any).__DRAGGED_WORK_ITEM__ = null;
      (window as any).__DRAGGED_CALENDAR_ITEM__ = null;
    };

    document.addEventListener('dragstart', handlePopupDragStart);
    document.addEventListener('dragend', handlePopupDragEnd);

    return () => {
      document.removeEventListener('dragstart', handlePopupDragStart);
      document.removeEventListener('dragend', handlePopupDragEnd);
    };
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    onSelectItem(event.resource);
  }, [onSelectItem]);

  const handleEventDrop = useCallback(({ event, start }: any) => {
    // Use the local date components to avoid timezone issues
    const year = start.getFullYear();
    const month = start.getMonth();
    const day = start.getDate();
    const dropDate = new Date(year, month, day);
    
    // Format as YYYY-MM-DD
    const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const workItemState = event.resource.state;
    const workItemType = event.resource.workItemType;
    const isTestOrBlockedState = workItemState === 'Ready For Test' || workItemState === 'In Test' || workItemState === 'Blocked';
    const usesTargetDate = workItemType === 'Epic' || workItemType === 'Feature' || workItemType === 'Bug';
    
    let currentDate;
    if (isTestOrBlockedState) {
      currentDate = event.resource.qaCompleteDate;
    } else if (usesTargetDate) {
      currentDate = event.resource.targetDate;
    } else {
      currentDate = event.resource.dueDate;
    }
    
    console.log('Drop event:', { 
      start, 
      year,
      month,
      day,
      dropDate,
      newDate, 
      currentDate,
      workItemId: event.resource.id,
      state: workItemState,
      type: workItemType,
      isTestOrBlockedState,
      usesTargetDate
    });
    
    // Only update if the date actually changed
    if (newDate === currentDate) {
      console.log('Date unchanged, skipping update');
      return;
    }

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce the update slightly to prevent rapid-fire updates
    updateTimeoutRef.current = setTimeout(() => {
      if (isTestOrBlockedState && onUpdateField) {
        console.log('Updating QA Complete Date:', event.resource.id, newDate);
        onUpdateField(event.resource.id, 'qaCompleteDate', newDate);
      } else if (usesTargetDate && onUpdateField) {
        console.log('Updating Target Date:', event.resource.id, newDate);
        onUpdateField(event.resource.id, 'targetDate', newDate);
      } else {
        console.log('Updating due date:', event.resource.id, newDate);
        onUpdateDueDate(event.resource.id, newDate);
      }
    }, 100);
  }, [onUpdateDueDate, onUpdateField]);

  const handleEventDragStart = useCallback((event: CalendarEvent) => {
    (window as any).__DRAGGED_CALENDAR_ITEM__ = event.resource;
  }, []);

  const handleDropFromOutside = useCallback(({ start }: any) => {
    // This handles drops from external sources (unscheduled items or popup events)
    const draggedItem = (window as any).__DRAGGED_WORK_ITEM__ || (window as any).__DRAGGED_CALENDAR_ITEM__;
    
    if (!draggedItem) {
      return;
    }

    console.log('=== handleDropFromOutside ===');
    console.log('Start Date Object:', start);
    console.log('Start ISO:', start.toISOString());
    console.log('Start UTC:', {
      year: start.getUTCFullYear(),
      month: start.getUTCMonth(),
      day: start.getUTCDate(),
      hours: start.getUTCHours()
    });
    console.log('Start Local:', {
      year: start.getFullYear(),
      month: start.getMonth(),
      day: start.getDate(),
      hours: start.getHours()
    });

    // Handle timezone issues by using UTC components or local components based on what we receive
    // If the date is UTC midnight, we need to use UTC methods
    let year, month, day;
    
    if (start.getUTCHours() === 0 && start.getUTCMinutes() === 0) {
      // Date is UTC midnight, use UTC components
      console.log('Using UTC components (UTC midnight detected)');
      year = start.getUTCFullYear();
      month = start.getUTCMonth();
      day = start.getUTCDate();
    } else {
      // Use local components
      console.log('Using Local components');
      year = start.getFullYear();
      month = start.getMonth();
      day = start.getDate();
    }
    
    // Format as YYYY-MM-DD
    const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const workItemState = draggedItem.state;
    const workItemType = draggedItem.workItemType;
    const isTestOrBlockedState = workItemState === 'Ready For Test' || workItemState === 'In Test' || workItemState === 'Blocked';
    const usesTargetDate = workItemType === 'Epic' || workItemType === 'Feature' || workItemType === 'Bug';
    
    console.log('Formatted Date:', newDate);
    console.log('Calling update with:', { workItemId: draggedItem.id, newDate, state: workItemState, type: workItemType, isTestOrBlockedState, usesTargetDate });
    
    if (isTestOrBlockedState && onUpdateField) {
      onUpdateField(draggedItem.id, 'qaCompleteDate', newDate);
    } else if (usesTargetDate && onUpdateField) {
      onUpdateField(draggedItem.id, 'targetDate', newDate);
    } else {
      onUpdateDueDate(draggedItem.id, newDate);
    }
    
    // Clear the dragged item references
    (window as any).__DRAGGED_WORK_ITEM__ = null;
    (window as any).__DRAGGED_CALENDAR_ITEM__ = null;
  }, [onUpdateDueDate, onUpdateField]);

  const AgendaEvent = ({ event }: { event: CalendarEvent }) => {
    const colors = getAssigneeColor(event.resource.assignedTo);
    const isEpic = event.resource.workItemType === 'Epic';
    const isFeature = event.resource.workItemType === 'Feature';
    const isBug = event.resource.workItemType === 'Bug';
    const isPBI = event.resource.workItemType === 'Product Backlog Item';
    const isTBI = event.resource.workItemType === 'Technical Backlog Item';
    
    return (
      <div>
        <div style={{ 
          fontWeight: isEpic || isFeature ? 700 : 500, 
          marginBottom: '4px',
          color: isEpic ? '#7B68EE' : 'inherit'
        }}>
          {isEpic && <span style={{ marginRight: '4px' }}>👑</span>}
          {isFeature && <span style={{ marginRight: '4px' }}>⭐</span>}
          {isBug && <span style={{ marginRight: '4px' }}>🐛</span>}
          {isPBI && <span style={{ marginRight: '4px' }}>📋</span>}
          {isTBI && <span style={{ marginRight: '4px' }}>🔧</span>}
          {event.title}
          {isEpic && <span style={{ 
            marginLeft: '8px', 
            fontSize: '0.8em', 
            padding: '2px 6px', 
            backgroundColor: '#7B68EE', 
            color: 'white', 
            borderRadius: '3px',
            fontWeight: 600
          }}>EPIC</span>}
          {isFeature && <span style={{ 
            marginLeft: '8px', 
            fontSize: '0.8em', 
            padding: '2px 6px', 
            backgroundColor: '#FFA500', 
            color: 'white', 
            borderRadius: '3px',
            fontWeight: 600
          }}>FEATURE</span>}
          {isBug && <span style={{ 
            marginLeft: '8px', 
            fontSize: '0.8em', 
            padding: '2px 6px', 
            backgroundColor: '#DC143C', 
            color: 'white', 
            borderRadius: '3px',
            fontWeight: 600
          }}>BUG</span>}
        </div>
        <div style={{ fontSize: '0.85em', color: colors.text }}>
          <strong>Assigned To:</strong> {event.resource.assignedTo || 'Unassigned'}
        </div>
        {(isEpic || isFeature || isBug) && event.resource.targetDate && (
          <div style={{ fontSize: '0.85em', color: isEpic ? '#7B68EE' : isFeature ? '#FFA500' : '#DC143C', marginTop: '4px' }}>
            <strong>Target Date:</strong> {event.resource.targetDate}
          </div>
        )}
      </div>
    );
  };

  const EventComponent = ({ event }: EventProps<CalendarEvent>) => {
    const isEpic = event.resource.workItemType === 'Epic';
    const isFeature = event.resource.workItemType === 'Feature';
    const isBug = event.resource.workItemType === 'Bug';
    const isPBI = event.resource.workItemType === 'Product Backlog Item';
    const isTBI = event.resource.workItemType === 'Technical Backlog Item';
    const isSpecialType = isEpic || isFeature;
    const colors = isEpic ? getEpicColor(event.resource.id) : getAssigneeColor(event.resource.assignedTo);
    
    return (
      <div
        data-event-id={event.id}
        className={isEpic ? 'epic-event' : ''}
        style={{
          height: isSpecialType ? '28px' : '22px',
          backgroundColor: colors.bg,
          borderLeft: `${isSpecialType ? '4px' : '3px'} solid ${colors.border}`,
          color: colors.text,
          padding: isSpecialType ? '0 5px' : '2px 4px',
          overflow: 'hidden',
          fontSize: isSpecialType ? '0.75em' : '0.7em',
          fontWeight: isSpecialType ? 700 : 500,
          lineHeight: isSpecialType ? '28px' : '18px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          borderRadius: '3px',
          boxShadow: isSpecialType ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none',
          display: isSpecialType ? 'flex' : 'block',
          alignItems: isSpecialType ? 'center' : 'initial',
        }}
      >
        {isEpic && <span style={{ marginRight: '3px', fontSize: '0.9em' }}>👑</span>}
        {isFeature && <span style={{ marginRight: '3px', fontSize: '0.9em' }}>⭐</span>}
        {isBug && <span style={{ marginRight: '3px', fontSize: '0.9em' }}>🐛</span>}
        {isPBI && <span style={{ marginRight: '3px', fontSize: '0.9em' }}>📋</span>}
        {isTBI && <span style={{ marginRight: '3px', fontSize: '0.9em' }}>🔧</span>}
        #{event.resource.id} {event.resource.title}
      </div>
    );
  };

  return (
    <div className="scrum-calendar-container">
      <div className="calendar-filters">
        <div className="filter-group">
          <label htmlFor="workItemType">Type:</label>
          <select 
            id="workItemType"
            value={selectedWorkItemType} 
            onChange={(e) => {
              setSelectedWorkItemType(e.target.value);
              onSelectItem(null as any);
            }}
            className="filter-select"
          >
            <option value="">All Types</option>
            {workItemTypeOptions.map(type => (
              <option key={type} value={type}>
                {type === 'Product Backlog Item' ? '📋 Product Backlog Item' : 
                 type === 'Technical Backlog Item' ? '🔧 Technical Backlog Item' : 
                 type === 'Epic' ? '👑 Epic' :
                 type === 'Feature' ? '⭐ Feature' :
                 type === 'Bug' ? '🐛 Bug' :
                 type}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="state">State:</label>
          <select 
            id="state"
            value={selectedState} 
            onChange={(e) => {
              setSelectedState(e.target.value);
              onSelectItem(null as any);
            }}
            className="filter-select"
          >
            <option value="">All States</option>
            {stateOptions.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="iteration">Iteration:</label>
          <select 
            id="iteration"
            value={selectedIteration} 
            onChange={(e) => {
              setSelectedIteration(e.target.value);
              onSelectItem(null as any);
            }}
            className="filter-select"
          >
            <option value="">All Iterations</option>
            {iterationOptions.map(iteration => (
              <option key={iteration} value={iteration}>{iteration}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="assignedTo">Assigned To:</label>
          <select 
            id="assignedTo"
            value={selectedAssignedTo} 
            onChange={(e) => {
              setSelectedAssignedTo(e.target.value);
              onSelectItem(null as any); // Close details panel
            }}
            className="filter-select"
          >
            <option value="">All</option>
            {assignedToOptions.map(person => (
              <option key={person} value={person}>{person}</option>
            ))}
          </select>
        </div>
        {(selectedAssignedTo || selectedWorkItemType || selectedState || selectedIteration) && (
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setSelectedAssignedTo('');
              setSelectedWorkItemType('');
              setSelectedState('');
              setSelectedIteration('');
              onSelectItem(null as any); // Close details panel
            }}
          >
            Clear
          </button>
        )}
      </div>
      <DragAndDropCalendar
        localizer={localizer}
        events={events}
        startAccessor={(event: any) => event.start}
        endAccessor={(event: any) => event.end}
        allDayAccessor={(event: any) => event.allDay || false}
        style={{ height: 'calc(100vh - 60px)' }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        onSelectEvent={(event: any) => handleSelectEvent(event as CalendarEvent)}
        onEventDrop={handleEventDrop}
        onDropFromOutside={handleDropFromOutside}
        onDragStart={(args: any) => {
          handleEventDragStart(args.event);
        }}
        draggableAccessor={() => true}
        resizable={false}
        step={60}
        showMultiDayTimes
        defaultDate={new Date()}
        popup
        popupOffset={30}
        components={{
          event: (EventComponent as any),
          agenda: {
            event: (AgendaEvent as any),
          },
          eventContainerWrapper: (props: any) => {
            return <div {...props}>{props.children}</div>;
          },
        }}
        eventPropGetter={() => {
          return {
            className: 'custom-event',
          };
        }}
      />
    </div>
  );
};
