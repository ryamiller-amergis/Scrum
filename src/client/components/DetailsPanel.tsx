import React from 'react';
import { WorkItem } from '../types/workitem';
import './DetailsPanel.css';

interface DetailsPanelProps {
  workItem: WorkItem | null;
  onClose: () => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  workItem,
  onClose,
}) => {
  if (!workItem) return null;

  const adoUrl = `${import.meta.env.VITE_ADO_ORG || ''}/${import.meta.env.VITE_ADO_PROJECT || ''}/_workitems/edit/${workItem.id}`;

  return (
    <div className="details-panel">
      <div className="details-header">
        <h3>Work Item Details</h3>
        <button onClick={onClose} className="close-btn">
          ×
        </button>
      </div>
      <div className="details-content">
        <div className="detail-row">
          <span className="detail-label">ID:</span>
          <span className="detail-value">#{workItem.id}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Title:</span>
          <span className="detail-value">{workItem.title}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">State:</span>
          <span className="detail-value">{workItem.state}</span>
        </div>
        {workItem.assignedTo && (
          <div className="detail-row">
            <span className="detail-label">Assigned To:</span>
            <span className="detail-value">{workItem.assignedTo}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Due Date:</span>
          <span className="detail-value">{workItem.dueDate || 'Not set'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Area Path:</span>
          <span className="detail-value">{workItem.areaPath}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Iteration:</span>
          <span className="detail-value">{workItem.iterationPath}</span>
        </div>
        <div className="detail-row">
          <a
            href={adoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ado-link"
          >
            Open in Azure DevOps →
          </a>
        </div>
      </div>
    </div>
  );
};
