import React from 'react';
import { WorkItem } from '../types/workitem';
import './WorkItemCard.css';

interface WorkItemCardProps {
  workItem: WorkItem;
  onClick: () => void;
  isDragging?: boolean;
}

export const WorkItemCard: React.FC<WorkItemCardProps> = ({
  workItem,
  onClick,
  isDragging = false,
}) => {
  return (
    <div
      className={`work-item-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'pointer',
      }}
    >
      <div className="work-item-id">#{workItem.id}</div>
      <div className="work-item-title">{workItem.title}</div>
      <div className="work-item-state">{workItem.state}</div>
      {workItem.assignedTo && (
        <div className="work-item-assigned">{workItem.assignedTo}</div>
      )}
    </div>
  );
};
