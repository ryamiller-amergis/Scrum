import React from 'react';
import { useDrag } from 'react-dnd';
import { WorkItem } from '../types/workitem';
import { WorkItemCard } from './WorkItemCard';
import './UnscheduledList.css';

interface UnscheduledListProps {
  workItems: WorkItem[];
  onSelectItem: (item: WorkItem) => void;
}

export const UnscheduledList: React.FC<UnscheduledListProps> = ({
  workItems,
  onSelectItem,
}) => {
  return (
    <div className="unscheduled-list">
      <h3>Unscheduled Items</h3>
      <div className="unscheduled-items">
        {workItems.length === 0 ? (
          <div className="empty-state">No unscheduled items</div>
        ) : (
          workItems.map((item) => (
            <DraggableWorkItem
              key={item.id}
              workItem={item}
              onClick={() => onSelectItem(item)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface DraggableWorkItemProps {
  workItem: WorkItem;
  onClick: () => void;
}

const DraggableWorkItem: React.FC<DraggableWorkItemProps> = ({
  workItem,
  onClick,
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WORK_ITEM',
    item: { workItem },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div ref={drag}>
      <WorkItemCard
        workItem={workItem}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  );
};
