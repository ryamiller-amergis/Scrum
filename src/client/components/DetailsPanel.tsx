import React, { useState, useMemo, useEffect } from 'react';
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
  const [isEditingQADate, setIsEditingQADate] = useState(false);
  const [tempQADate, setTempQADate] = useState('');
  const [isEditingTargetDate, setIsEditingTargetDate] = useState(false);
  const [tempTargetDate, setTempTargetDate] = useState('');
  const [relatedItems, setRelatedItems] = useState<WorkItem[]>([]);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  const [showRelatedItems, setShowRelatedItems] = useState(false);

  if (!workItem) return null;

  const adoOrg = import.meta.env.VITE_ADO_ORG || 'amergis';
  const adoProject = import.meta.env.VITE_ADO_PROJECT || 'MaxView';
  const adoUrl = `https://dev.azure.com/${adoOrg}/${adoProject}/_workitems/edit/${workItem.id}`;

  // Fetch related items when workItem changes and is PBI or TBI
  useEffect(() => {
    const shouldFetchRelations = 
      workItem.workItemType === 'Product Backlog Item' || 
      workItem.workItemType === 'Technical Backlog Item';

    console.log(`Work item ${workItem.id} type: ${workItem.workItemType}, should fetch relations: ${shouldFetchRelations}`);

    if (shouldFetchRelations) {
      setIsLoadingRelations(true);
      const url = `/api/workitems/${workItem.id}/relations?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
      console.log(`Fetching relations from: ${url}`);
      
      fetch(url)
        .then(res => {
          console.log(`Relations API response status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log(`Received ${data.length} related items:`, data);
          setRelatedItems(data);
          setIsLoadingRelations(false);
        })
        .catch(err => {
          console.error('Error fetching related items:', err);
          setIsLoadingRelations(false);
        });
    } else {
      setRelatedItems([]);
    }
  }, [workItem.id, workItem.workItemType, project, areaPath]);

  // Extract unique values for dropdowns
  const uniqueStates = useMemo(() => {
    const states = new Set(allWorkItems.map(item => item.state));
    // Add common states that may not be in current items
    states.add('New');
    states.add('Active');
    states.add('Resolved');
    states.add('Closed');
    states.add('Ready For Test');
    states.add('In Test');
    states.add('Removed');
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

  const handleFieldChange = async (field: string, value: any) => {
    if (onUpdateField) {
      await onUpdateField(workItem.id, field, value);
      // Small delay to ensure better flow before UI reflects the change
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleDueDateEdit = () => {
    setTempDueDate(workItem.dueDate || '');
    setDueDateReason('');
    setShowReasonInput(false);
    setIsEditingDueDate(true);
  };

  const handleDueDateSave = async () => {
    if (tempDueDate && tempDueDate !== workItem.dueDate) {
      // Show reason input before saving
      if (!showReasonInput) {
        setShowReasonInput(true);
        return;
      }
      
      // Save with reason
      const finalReason = dueDateReason === 'Other' ? customReason : dueDateReason;
      await onUpdateDueDate(workItem.id, tempDueDate, finalReason);
      // Wait for the API request to complete before closing edit mode
      await new Promise(resolve => setTimeout(resolve, 500));
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

  const handleQADateEdit = () => {
    setTempQADate(workItem.qaCompleteDate || '');
    setIsEditingQADate(true);
  };

  const handleQADateSave = async () => {
    if (onUpdateField) {
      await onUpdateField(workItem.id, 'qaCompleteDate', tempQADate || undefined);
      // Wait for the API request to complete before closing edit mode
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsEditingQADate(false);
    }
  };

  const handleQADateCancel = () => {
    setIsEditingQADate(false);
    setTempQADate('');
  };

  const handleRemoveQADate = async () => {
    if (onUpdateField) {
      await onUpdateField(workItem.id, 'qaCompleteDate', undefined);
    }
  };

  const handleTargetDateEdit = () => {
    setTempTargetDate(workItem.targetDate || '');
    setIsEditingTargetDate(true);
  };

  const handleTargetDateSave = async () => {
    if (onUpdateField) {
      await onUpdateField(workItem.id, 'targetDate', tempTargetDate || undefined);
      // Wait for the API request to complete before closing edit mode
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsEditingTargetDate(false);
    }
  };

  const handleTargetDateCancel = () => {
    setIsEditingTargetDate(false);
    setTempTargetDate('');
  };

  const handleRemoveTargetDate = async () => {
    if (onUpdateField) {
      await onUpdateField(workItem.id, 'targetDate', undefined);
    }
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
        {(workItem.workItemType === 'Product Backlog Item' || workItem.workItemType === 'Technical Backlog Item') && (
          <div className="detail-row">
            <span className="detail-label">Dev Due Date:</span>
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
        )}
        {(workItem.state === 'Ready For Test' || workItem.state === 'In Test') && (
          <div className="detail-row">
            <span className="detail-label">QA Complete Date:</span>
            {isEditingQADate ? (
              <div className="detail-date-edit">
                <input 
                  type="date"
                  className="detail-date-input"
                  value={tempQADate}
                  onChange={(e) => setTempQADate(e.target.value)}
                />
                <button onClick={handleQADateSave} className="date-save-btn">✓</button>
                <button onClick={handleQADateCancel} className="date-cancel-btn">✕</button>
              </div>
            ) : (
              <div className="detail-date-display">
                <span className="detail-value">{workItem.qaCompleteDate || 'Not set'}</span>
                <button onClick={handleQADateEdit} className="date-edit-btn">Edit</button>
                {workItem.qaCompleteDate && (
                  <button onClick={handleRemoveQADate} className="date-remove-btn">Remove</button>
                )}
              </div>
            )}
          </div>
        )}
        {(workItem.workItemType === 'Epic' || workItem.workItemType === 'Feature' || workItem.workItemType === 'Bug') && (
          <div className="detail-row">
            <span className="detail-label">Target Date:</span>
            {(workItem.workItemType === 'Feature' || workItem.workItemType === 'Bug') ? (
              isEditingTargetDate ? (
                <div className="detail-date-edit">
                  <input 
                    type="date"
                    className="detail-date-input"
                    value={tempTargetDate}
                    onChange={(e) => setTempTargetDate(e.target.value)}
                  />
                  <button onClick={handleTargetDateSave} className="date-save-btn">✓</button>
                  <button onClick={handleTargetDateCancel} className="date-cancel-btn">✕</button>
                </div>
              ) : (
                <div className="detail-date-display">
                  <span className="detail-value" style={{ 
                    color: workItem.workItemType === 'Feature' ? '#FFA500' : '#DC143C', 
                    fontWeight: 600 
                  }}>
                    {workItem.targetDate || 'Not set'}
                  </span>
                  <button onClick={handleTargetDateEdit} className="date-edit-btn">Edit</button>
                  {workItem.targetDate && (
                    <button onClick={handleRemoveTargetDate} className="date-remove-btn">Remove</button>
                  )}
                </div>
              )
            ) : (
              <span className="detail-value" style={{ 
                color: '#7B68EE', 
                fontWeight: 600 
              }}>
                {workItem.targetDate || 'Not set'}
              </span>
            )}
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
        {(workItem.workItemType === 'Product Backlog Item' || workItem.workItemType === 'Technical Backlog Item') && (
          <div className="related-items-section">
            <div 
              className="related-items-header"
              onClick={() => setShowRelatedItems(!showRelatedItems)}
            >
              <span className="related-items-title">
                {showRelatedItems ? '▼' : '▶'} Related Items ({relatedItems.length})
              </span>
            </div>
            {showRelatedItems && (
              <div className="related-items-content">
                {isLoadingRelations ? (
                  <div className="related-items-loading">Loading...</div>
                ) : relatedItems.length === 0 ? (
                  <div className="related-items-empty">No related items</div>
                ) : (
                  <ul className="related-items-list">
                    {relatedItems.map(item => (
                      <li 
                        key={item.id} 
                        className="related-item"
                        onClick={() => onSelectItem(item)}
                      >
                        <div className="related-item-header">
                          <span className="related-item-id">#{item.id}</span>
                          <span className="related-item-type">{item.workItemType}</span>
                          <span className={`related-item-state state-${item.state.toLowerCase().replace(/\s+/g, '-')}`}>
                            {item.state}
                          </span>
                        </div>
                        <div className="related-item-title">{item.title}</div>
                        {item.assignedTo && (
                          <div className="related-item-assignee">
                            Assigned to: {item.assignedTo}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
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
