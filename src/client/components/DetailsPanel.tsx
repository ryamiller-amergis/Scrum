import React, { useState, useMemo } from 'react';
import { WorkItem } from '../types/workitem';
import { EpicProgress } from './EpicProgress';
import './DetailsPanel.css';

interface DetailsPanelProps {
  workItem: WorkItem | null;
  onClose: () => void;
  onUpdateDueDate: (id: number, dueDate: string | null, reason?: string) => void;
  allWorkItems?: WorkItem[];
  onUpdateField?: (id: number, field: string, value: any) => void;
  isSaving?: boolean;
  project: string;
  areaPath: string;
  onSelectItem: (item: WorkItem) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  workItem,
  onClose,
  onUpdateDueDate,
  allWorkItems = [],
  onUpdateField,
  isSaving = false,
  project,
  areaPath,
  onSelectItem,
}) => {
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState('');
  const [dueDateReason, setDueDateReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [parentEpicId, setParentEpicId] = useState<number | null>(null);

  if (!workItem) return null;

  const adoOrg = import.meta.env.VITE_ADO_ORG || 'amergis';
  const adoProject = import.meta.env.VITE_ADO_PROJECT || 'MaxView';
  const adoUrl = `https://dev.azure.com/${adoOrg}/${adoProject}/_workitems/edit/${workItem.id}`;

  // Extract unique values for dropdowns
  const uniqueStates = useMemo(() => {
    const states = new Set(allWorkItems.map(item => item.state));
    return Array.from(states).sort();
  }, [allWorkItems]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set(allWorkItems.map(item => item.assignedTo).filter(Boolean));
    return Array.from(assignees).sort();
  }, [allWorkItems]);

  const uniqueIterations = useMemo(() => {
    const iterations = new Set(allWorkItems.map(item => item.iterationPath));
    return Array.from(iterations).sort();
  }, [allWorkItems]);

  const handleRemoveDueDate = () => {
    onUpdateDueDate(workItem.id, null);
  };

  const handleFieldChange = (field: string, value: any) => {
    if (onUpdateField) {
      onUpdateField(workItem.id, field, value);
    }
  };

  const handleDueDateEdit = () => {
    setTempDueDate(workItem.dueDate || '');
    setDueDateReason('');
    setShowReasonInput(false);
    setIsEditingDueDate(true);
  };

  const handleDueDateSave = () => {
    if (tempDueDate && tempDueDate !== workItem.dueDate) {
      // Show reason input before saving
      if (!showReasonInput) {
        setShowReasonInput(true);
        return;
      }
      
      // Save with reason
      const finalReason = dueDateReason === 'Other' ? customReason : dueDateReason;
      onUpdateDueDate(workItem.id, tempDueDate, finalReason);
    }
    setIsEditingDueDate(false);
    setShowReasonInput(false);
    setDueDateReason('');
    setCustomReason('');
  };

  const handleDueDateCancel = () => {
    setIsEditingDueDate(false);
    setShowReasonInput(false);
    setTempDueDate('');
    setDueDateReason('');
    setCustomReason('');
  };

  const handleChildSelect = (child: WorkItem) => {
    // Store the current Epic ID before navigating to child
    if (workItem.workItemType === 'Epic') {
      setParentEpicId(workItem.id);
    }
    onSelectItem(child);
  };

  const handleBackToEpic = () => {
    if (parentEpicId) {
      const epicItem = allWorkItems.find(item => item.id === parentEpicId);
      if (epicItem) {
        setParentEpicId(null);
        onSelectItem(epicItem);
      }
    }
  };

  return (
    <div className="details-panel">
      <div className="details-header">
        <h3>Work Item Details</h3>
        {isSaving && <span className="saving-badge">Saving...</span>}
        {parentEpicId && (
          <button onClick={handleBackToEpic} className="back-to-epic-btn" title="Back to Epic">
            ← Back to Epic
          </button>
        )}
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
          <span className="detail-label">Type:</span>
          <span className="detail-value" style={{
            fontWeight: workItem.workItemType === 'Epic' ? 700 : 'normal',
            color: workItem.workItemType === 'Epic' ? '#7B68EE' : 'inherit'
          }}>
            {workItem.workItemType === 'Epic' && '👑 '}
            {workItem.workItemType}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">State:</span>
          <select 
            className="detail-select"
            value={workItem.state}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            disabled={!onUpdateField}
          >
            {uniqueStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
        <div className="detail-row">
          <span className="detail-label">Assigned To:</span>
          <select 
            className="detail-select"
            value={workItem.assignedTo || ''}
            onChange={(e) => handleFieldChange('assignedTo', e.target.value || undefined)}
            disabled={!onUpdateField}
          >
            <option value="">Unassigned</option>
            {uniqueAssignees.map(assignee => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
        </div>
        <div className="detail-row">
          <span className="detail-label">Due Date:</span>
          {isEditingDueDate ? (
            <div className="detail-date-edit-container">
              <div className="detail-date-edit">
                <input 
                  type="date"
                  className="detail-date-input"
                  value={tempDueDate}
                  onChange={(e) => setTempDueDate(e.target.value)}
                />
                <button onClick={handleDueDateSave} className="date-save-btn">✓</button>
                <button onClick={handleDueDateCancel} className="date-cancel-btn">✕</button>
              </div>
              {showReasonInput && (
                <div className="detail-reason-input">
                  <label className="reason-label">Reason for date change:</label>
                  <select 
                    className="reason-select"
                    value={dueDateReason}
                    onChange={(e) => setDueDateReason(e.target.value)}
                    autoFocus
                  >
                    <option value="">Select a reason...</option>
                    <option value="Scope change">Scope change</option>
                    <option value="Dependencies">Dependencies</option>
                    <option value="Resource availability">Resource availability</option>
                    <option value="Technical complexity">Technical complexity</option>
                    <option value="Priority shift">Priority shift</option>
                    <option value="Customer request">Customer request</option>
                    <option value="Other">Other</option>
                  </select>
                  {dueDateReason === 'Other' && (
                    <textarea
                      className="reason-textarea"
                      placeholder="Please specify the reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      rows={3}
                    />
                  )}
                  <div className="reason-buttons">
                    <button 
                      onClick={handleDueDateSave} 
                      className="reason-confirm-btn"
                      disabled={!dueDateReason || (dueDateReason === 'Other' && !customReason.trim())}
                    >
                      Confirm Change
                    </button>
                    <button onClick={handleDueDateCancel} className="reason-cancel-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="detail-date-display">
              <span className="detail-value">{workItem.dueDate || 'Not set'}</span>
              <button onClick={handleDueDateEdit} className="date-edit-btn">Edit</button>
              {workItem.dueDate && (
                <button onClick={handleRemoveDueDate} className="date-remove-btn">Remove</button>
              )}
            </div>
          )}
        </div>
        {workItem.workItemType === 'Epic' && (
          <div className="detail-row">
            <span className="detail-label">Target Date:</span>
            <span className="detail-value" style={{ color: '#7B68EE', fontWeight: 600 }}>
              {workItem.targetDate || 'Not set'}
            </span>
          </div>
        )}
        {workItem.workItemType === 'Epic' && (
          <EpicProgress 
            epicId={workItem.id} 
            project={project} 
            areaPath={areaPath}
            onSelectChild={handleChildSelect}
          />
        )}
        <div className="detail-row">
          <span className="detail-label">Area Path:</span>
          <span className="detail-value">{workItem.areaPath}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Iteration:</span>
          <select 
            className="detail-select"
            value={workItem.iterationPath}
            onChange={(e) => handleFieldChange('iterationPath', e.target.value)}
            disabled={!onUpdateField}
          >
            {uniqueIterations.map(iteration => (
              <option key={iteration} value={iteration}>{iteration}</option>
            ))}
          </select>
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
