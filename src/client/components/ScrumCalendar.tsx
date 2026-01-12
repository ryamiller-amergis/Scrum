import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, View, EventProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import enUSLocale from 'date-fns/locale/en-US';
import { WorkItem } from '../types/workitem';
import { getAssigneeColor } from '../utils/assigneeColors';
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
  onSelectItem,
}) => {
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [isDraggingFromPopup, setIsDraggingFromPopup] = useState(false);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');
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

  // Filter work items based on selected filters
  const filteredWorkItems = useMemo(() => {
    return workItems.filter(item => {
      if (selectedAssignedTo && item.assignedTo !== selectedAssignedTo) {
        return false;
      }
      return true;
    });
  }, [workItems, selectedAssignedTo]);

  const events: CalendarEvent[] = useMemo(() => {
    return filteredWorkItems
      .filter((item) => item.dueDate)
      .map((item) => {
        // Parse the date string directly (YYYY-MM-DD format)
        const [year, month, day] = item.dueDate!.split('-').map(Number);
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
      });
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
            setIsDraggingFromPopup(true);
            
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
      setIsDraggingFromPopup(false);
      
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

  const handleEventDrop = useCallback(({ event, start, end, allDay }: any) => {
    // Use the local date components to avoid timezone issues
    const year = start.getFullYear();
    const month = start.getMonth();
    const day = start.getDate();
    const dropDate = new Date(year, month, day);
    
    // Format as YYYY-MM-DD
    const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDate = event.resource.dueDate;
    
    console.log('Drop event:', { 
      start, 
      year,
      month,
      day,
      dropDate,
      newDate, 
      currentDate,
      workItemId: event.resource.id,
      allDay
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
      console.log('Updating due date:', event.resource.id, newDate);
      onUpdateDueDate(event.resource.id, newDate);
    }, 100);
  }, [onUpdateDueDate]);

  const handleEventDragStart = useCallback((event: CalendarEvent) => {
    (window as any).__DRAGGED_CALENDAR_ITEM__ = event.resource;
  }, []);

  const handleDropFromOutside = useCallback(({ start, end, allDay }: any) => {
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
    
    console.log('Formatted Date:', newDate);
    console.log('Calling onUpdateDueDate with:', { workItemId: draggedItem.id, newDate });
    
    onUpdateDueDate(draggedItem.id, newDate);
    
    // Clear the dragged item references
    (window as any).__DRAGGED_WORK_ITEM__ = null;
    (window as any).__DRAGGED_CALENDAR_ITEM__ = null;
  }, [onUpdateDueDate]);

  const AgendaEvent = ({ event }: { event: CalendarEvent }) => {
    const colors = getAssigneeColor(event.resource.assignedTo);
    
    return (
      <div>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>{event.title}</div>
        <div style={{ fontSize: '0.85em', color: colors.text }}>
          <strong>Assigned To:</strong> {event.resource.assignedTo || 'Unassigned'}
        </div>
      </div>
    );
  };

  const EventComponent = ({ event }: EventProps<CalendarEvent>) => {
    const colors = getAssigneeColor(event.resource.assignedTo);
    
    return (
      <div
        data-event-id={event.id}
        style={{
          height: '24px',
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.border}`,
          color: colors.text,
          padding: '2px 4px',
          overflow: 'hidden',
          fontSize: '0.75em',
          fontWeight: 500,
          lineHeight: '20px',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        #{event.resource.id} {event.resource.title}
      </div>
    );
  };

  return (
    <div className="scrum-calendar-container">
      <div className="calendar-filters">
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
        {selectedAssignedTo && (
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setSelectedAssignedTo('');
              onSelectItem(null as any); // Close details panel
            }}
          >
            Clear Filters
          </button>
        )}
      </div>
      <DragAndDropCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        style={{ height: 'calc(100vh - 60px)' }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        onSelectEvent={handleSelectEvent}
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
          event: EventComponent,
          agenda: {
            event: AgendaEvent,
          },
          eventContainerWrapper: (props: any) => {
            // Check if we're in the popup overlay
            const isPopup = props.slotMetrics === undefined;
            return <div {...props}>{props.children}</div>;
          },
        }}
        eventPropGetter={(event: CalendarEvent) => {
          return {
            className: 'custom-event',
          };
        }}
      />
    </div>
  );
};
