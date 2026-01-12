import React from 'react';
import { WorkItem } from '../types/workitem';
import { getAssigneeColor, getEpicColor } from '../utils/assigneeColors';
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
  const isEpic = workItem.workItemType === 'Epic';
  const colors = isEpic ? getEpicColor(workItem.id) : getAssigneeColor(workItem.assignedTo);
  
  return (
    <div
      className={`work-item-card ${isDragging ? 'dragging' : ''} ${isEpic ? 'epic-card' : ''}`}
      onClick={onClick}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'pointer',
        backgroundColor: colors.bg,
        borderLeft: `${isEpic ? '5px' : '4px'} solid ${colors.border}`,
        boxShadow: isEpic ? `0 2px 6px ${colors.border}40` : 'none',
      }}
    >
      <div className="work-item-id" style={{ color: colors.text }}>
        {isEpic && <span style={{ marginRight: '4px' }}>👑</span>}
        #{workItem.id}
      </div>
      <div className="work-item-title" style={{ color: colors.text }}>
        {workItem.title}
      </div>
      <div className="work-item-state" style={{ 
        backgroundColor: isEpic ? 'rgba(255, 255, 255, 0.2)' : undefined,
        color: colors.text
      }}>
        {workItem.state}
      </div>
      {workItem.assignedTo && (
        <div className="work-item-assigned" style={{ color: colors.text }}>
          {workItem.assignedTo}
        </div>
      )}
      {isEpic && workItem.targetDate && (
        <div className="work-item-target-date" style={{ 
          fontSize: '10px', 
          color: colors.text, 
          marginTop: '4px',
          fontWeight: 600
        }}>
          Target: {workItem.targetDate}
        </div>
      )}
    </div>
  );
};
