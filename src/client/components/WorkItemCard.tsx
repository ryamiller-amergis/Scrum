import React from 'react';
import { WorkItem } from '../types/workitem';
import styles from './WorkItemCard.module.css';

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
  const isFeature = workItem.workItemType === 'Feature';
  const isBug = workItem.workItemType === 'Bug';
  const isPBI = workItem.workItemType === 'Product Backlog Item';
  const isTBI = workItem.workItemType === 'Technical Backlog Item';

  const getTypeColor = () => {
    if (isEpic) return '#8b5cf6';
    if (isFeature) return '#3b82f6';
    if (isBug) return '#ef4444';
    if (isPBI) return '#10b981';
    if (isTBI) return '#f59e0b';
    return '#6b7280';
  };

  return (
    <div
      className={[
        styles['work-item-card'],
        isDragging ? styles.dragging : '',
        isEpic ? styles['epic-card'] : '',
        isFeature ? styles['feature-card'] : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: 'pointer', borderLeftColor: getTypeColor() }}
    >
      <div className={styles['work-item-header']}>
        <div className={styles['work-item-id']}>
          {isEpic && <span className={styles['type-icon']}>👑</span>}
          {isFeature && <span className={styles['type-icon']}>⭐</span>}
          {isBug && <span className={styles['type-icon']}>🐛</span>}
          {isPBI && <span className={styles['type-icon']}>📋</span>}
          {isTBI && <span className={styles['type-icon']}>🔧</span>}
          <span className={styles['id-number']}>#{workItem.id}</span>
        </div>
        <div className={styles['work-item-state']}>{workItem.state}</div>
      </div>
      <div className={styles['work-item-title']}>{workItem.title}</div>
      {workItem.assignedTo && (
        <div className={styles['work-item-assigned']}>{workItem.assignedTo}</div>
      )}
      {(isEpic || isFeature || isBug) && workItem.targetDate && (
        <div className={styles['work-item-target-date']}>Target: {workItem.targetDate}</div>
      )}
    </div>
  );
};
