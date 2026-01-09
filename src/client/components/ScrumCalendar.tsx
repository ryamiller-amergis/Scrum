import { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUSLocale from 'date-fns/locale/en-US';
import { useDrop, useDrag } from 'react-dnd';
import { WorkItem } from '../types/workitem';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './ScrumCalendar.css';

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
}

export const ScrumCalendar: React.FC<ScrumCalendarProps> = ({
  workItems,
  onUpdateDueDate,
  onSelectItem,
}) => {
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  const events: CalendarEvent[] = useMemo(() => {
    return workItems
      .filter((item) => item.dueDate)
      .map((item) => ({
        id: item.id,
        title: `#${item.id}: ${item.title}`,
        start: new Date(item.dueDate!),
        end: new Date(item.dueDate!),
        resource: item,
      }));
  }, [workItems]);

  const handleSelectEvent = (event: CalendarEvent) => {
    onSelectItem(event.resource);
  };

  const CustomEvent = ({ event }: { event: CalendarEvent }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'WORK_ITEM',
      item: { workItem: event.resource },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }));

    return (
      <div
        ref={drag}
        style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}
        onClick={() => onSelectItem(event.resource)}
      >
        {event.title}
      </div>
    );
  };

  const DateCellWrapper = ({ children, value }: any) => {
    const [{ isOver }, drop] = useDrop(() => ({
      accept: 'WORK_ITEM',
      drop: (item: { workItem: WorkItem }) => {
        const newDate = format(value, 'yyyy-MM-dd');
        onUpdateDueDate(item.workItem.id, newDate);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }));

    return (
      <div
        ref={drop}
        style={{
          backgroundColor: isOver ? '#e3f2fd' : 'transparent',
          height: '100%',
        }}
      >
        {children}
      </div>
    );
  };

  const UnscheduledDropZone = () => {
    const [{ isOver }, drop] = useDrop(() => ({
      accept: 'WORK_ITEM',
      drop: (item: { workItem: WorkItem }) => {
        onUpdateDueDate(item.workItem.id, null);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }));

    return (
      <div
        ref={drop}
        className={`unscheduled-drop-zone ${isOver ? 'over' : ''}`}
      >
        Drop here to unschedule
      </div>
    );
  };

  return (
    <div className="scrum-calendar-container">
      <UnscheduledDropZone />
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 60px)' }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        onSelectEvent={handleSelectEvent}
        components={{
          event: CustomEvent,
          dateCellWrapper: DateCellWrapper,
        }}
      />
    </div>
  );
};
