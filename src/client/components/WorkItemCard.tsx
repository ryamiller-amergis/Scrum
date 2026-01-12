import React from 'react';
import { WorkItem } from '../types/workitem';
import { getAssigneeColor } from '../utils/assigneeColors';
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
  const colors = getAssigneeColor(workItem.assignedTo);
  
  return (
    <div
      className={`work-item-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'pointer',
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
      }}
    >
      <div className="work-item-id" style={{ color: colors.text }}>
        #{workItem.id}
      </div>
      <div className="work-item-title">{workItem.title}</div>
      <div className="work-item-state">{workItem.state}</div>
      {workItem.assignedTo && (
        <div className="work-item-assigned" style={{ color: colors.text }}>
          {workItem.assignedTo}
        </div>
      )}
    </div>
  );
};
