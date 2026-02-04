import React, { useState, useMemo, useEffect } from 'react';
import { WorkItem } from '../types/workitem';
import { EpicProgress } from './EpicProgress';
import { RichTextField } from './RichTextField';
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
  const [dueDateChanges, setDueDateChanges] = useState<Array<{
    changedDate: string;
    changedBy: string;
    oldDueDate: string | null;
    newDueDate: string | null;
    reason: string | null;
  }>>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);
  const [showDueDateChanges, setShowDueDateChanges] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    // Set default to 45% of window width
    return Math.floor(window.innerWidth * 0.45);
  });
  const [isResizing, setIsResizing] = useState(false);
  const [discussions, setDiscussions] = useState<string>('');
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<number[]>([]);
  const [availableReleaseEpics, setAvailableReleaseEpics] = useState<Array<{id: number; version: string; status: string}>>([]);
  const [isLoadingReleaseEpics, setIsLoadingReleaseEpics] = useState(false);
  const [showLinkToEpic, setShowLinkToEpic] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState<number | null>(null);
  const [isLinkingToEpic, setIsLinkingToEpic] = useState(false);
  const [showLinkConfirmModal, setShowLinkConfirmModal] = useState(false);
  const [linkResultMessage, setLinkResultMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [currentParentEpic, setCurrentParentEpic] = useState<{id: number; title: string; version: string} | null>(null);
  const [isLoadingParentEpic, setIsLoadingParentEpic] = useState(false);
  const [showUnlinkConfirmModal, setShowUnlinkConfirmModal] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

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

  // Fetch available release epics (not in Done status)
  useEffect(() => {
    setIsLoadingReleaseEpics(true);
    fetch(`/api/releases/epics?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`)
      .then(res => res.json())
      .then(data => {
        // Filter out Done epics
        const activeEpics = data.filter((epic: any) => 
          epic.status !== 'Done' && epic.status !== 'Closed'
        );
        setAvailableReleaseEpics(activeEpics);
        setIsLoadingReleaseEpics(false);
      })
      .catch(err => {
        console.error('Error fetching release epics:', err);
        setIsLoadingReleaseEpics(false);
      });
  }, [project, areaPath]);

  // Fetch current parent epic when Link to Release section is opened
  useEffect(() => {
    if (showLinkToEpic && !currentParentEpic) {
      setIsLoadingParentEpic(true);
      console.log(`Fetching parent epic for work item ${workItem.id}`);
      fetch(`/api/workitems/${workItem.id}/parent-epic?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`)
        .then(res => {
          console.log(`Parent epic API response status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log(`Parent epic data received:`, data);
          if (data && data.id) {
            setCurrentParentEpic(data);
          }
          setIsLoadingParentEpic(false);
        })
        .catch(err => {
          console.error('Error fetching parent epic:', err);
          setIsLoadingParentEpic(false);
        });
    }
  }, [showLinkToEpic, workItem.id, project, areaPath, currentParentEpic]);

  // Fetch due date change history for PBI/TBI
  useEffect(() => {
    const shouldFetchChanges = 
      workItem.workItemType === 'Product Backlog Item' || 
      workItem.workItemType === 'Technical Backlog Item';

    if (shouldFetchChanges) {
      setIsLoadingChanges(true);
      fetch(`/api/workitems/${workItem.id}/due-date-changes?project=${encodeURIComponent(project)}`)
        .then(res => res.json())
        .then(data => {
          setDueDateChanges(data);
          setIsLoadingChanges(false);
        })
        .catch(err => {
          console.error('Error fetching due date changes:', err);
          setIsLoadingChanges(false);
        });
    } else {
      setDueDateChanges([]);
    }
  }, [workItem.id, workItem.workItemType, project]);

  // Fetch discussions/comments for all work items
  useEffect(() => {
    setIsLoadingDiscussions(true);
    fetch(`/api/workitems/${workItem.id}/discussions?project=${encodeURIComponent(project)}`)
      .then(res => res.json())
      .then(data => {
        setDiscussions(data.discussions || '');
        setIsLoadingDiscussions(false);
      })
      .catch(err => {
        console.error('Error fetching discussions:', err);
        setIsLoadingDiscussions(false);
      });
  }, [workItem.id, project]);

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

  const handleRemoveDueDate = async () => {
    await onUpdateDueDate(workItem.id, null);
    // Wait for the API request to complete
    await new Promise(resolve => setTimeout(resolve, 500));
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
    // Add current work item to navigation history
    setNavigationHistory(prev => [...prev, workItem.id]);
    
    // Store the current Epic ID before navigating to child (for backward compatibility)
    if (workItem.workItemType === 'Epic') {
      setParentEpicId(workItem.id);
    }
    onSelectItem(child);
  };

  const handleRelatedItemSelect = (item: WorkItem) => {
    // Add current work item to navigation history
    setNavigationHistory(prev => [...prev, workItem.id]);
    onSelectItem(item);
  };

  const handleBackToPrevious = () => {
    if (navigationHistory.length > 0) {
      const previousId = navigationHistory[navigationHistory.length - 1];
      const previousItem = allWorkItems.find(item => item.id === previousId);
      
      if (previousItem) {
        // Remove the last item from history
        setNavigationHistory(prev => prev.slice(0, -1));
        onSelectItem(previousItem);
      }
    }
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

  const handleLinkToReleaseEpic = async () => {
    if (!selectedEpicId) return;
    
    setIsLinkingToEpic(true);
    setLinkResultMessage(null);
    
    try {
      const response = await fetch(`/api/releases/${selectedEpicId}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workItemIds: [workItem.id],
          project,
          areaPath,
        }),
      });

      if (response.ok) {
        setLinkResultMessage({
          type: 'success',
          message: `Successfully linked work item #${workItem.id} to release epic!`
        });
        setShowLinkConfirmModal(false);
        setSelectedEpicId(null);
        // Refresh current parent epic
        setCurrentParentEpic(null);
        setTimeout(() => setLinkResultMessage(null), 5000);
      } else {
        const error = await response.json();
        setLinkResultMessage({
          type: 'error',
          message: `Failed to link: ${error.error || 'Unknown error'}`
        });
        setShowLinkConfirmModal(false);
      }
    } catch (error) {
      console.error('Error linking to release epic:', error);
      setLinkResultMessage({
        type: 'error',
        message: 'Failed to link work item to release epic'
      });
      setShowLinkConfirmModal(false);
    } finally {
      setIsLinkingToEpic(false);
    }
  };

  const handleUnlinkFromReleaseEpic = async () => {
    if (!currentParentEpic) return;
    
    setIsUnlinking(true);
    setLinkResultMessage(null);
    
    try {
      const response = await fetch(`/api/releases/${currentParentEpic.id}/unlink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workItemIds: [workItem.id],
          project,
          areaPath,
        }),
      });

      if (response.ok) {
        setLinkResultMessage({
          type: 'success',
          message: `Successfully unlinked work item #${workItem.id} from release epic!`
        });
        setShowUnlinkConfirmModal(false);
        setCurrentParentEpic(null);
        setTimeout(() => setLinkResultMessage(null), 5000);
      } else {
        const error = await response.json();
        setLinkResultMessage({
          type: 'error',
          message: `Failed to unlink: ${error.error || 'Unknown error'}`
        });
        setShowUnlinkConfirmModal(false);
      }
    } catch (error) {
      console.error('Error unlinking from release epic:', error);
      setLinkResultMessage({
        type: 'error',
        message: 'Failed to unlink work item from release epic'
      });
      setShowUnlinkConfirmModal(false);
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      // Min width: 300px, Max width: 70% of window
      const maxWidth = Math.floor(window.innerWidth * 0.7);
      if (newWidth >= 300 && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="details-panel" style={{ width: `${panelWidth}px` }}>
      <div 
        className="details-resize-handle" 
        onMouseDown={handleResizeStart}
        style={{ cursor: isResizing ? 'ew-resize' : 'col-resize' }}
      />
      <div className="details-header">
        <h3>Work Item Details</h3>
        {isSaving && <span className="saving-badge">Saving...</span>}
        {navigationHistory.length > 0 && (
          <button onClick={handleBackToPrevious} className="back-to-epic-btn" title="Go back to previous work item">
            Back
          </button>
        )}
        {parentEpicId && !navigationHistory.length && (
          <button onClick={handleBackToEpic} className="back-to-epic-btn" title="Back to Epic">
            Back to Epic
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
          <span className="detail-label">Tags:</span>
          <div className="detail-tags">
            {workItem.tags && workItem.tags.trim() !== '' ? (
              workItem.tags.split(';').map((tag, index) => (
                <span key={index} className="tag-badge">
                  {tag.trim()}
                </span>
              ))
            ) : (
              <span className="detail-value-empty">No tags</span>
            )}
          </div>
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
            {isEditingTargetDate ? (
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
                  color: workItem.workItemType === 'Epic' ? '#7B68EE' : 
                         workItem.workItemType === 'Feature' ? '#FFA500' : '#DC143C', 
                  fontWeight: 600 
                }}>
                  {workItem.targetDate || 'Not set'}
                </span>
                <button onClick={handleTargetDateEdit} className="date-edit-btn">Edit</button>
                {workItem.targetDate && (
                  <button onClick={handleRemoveTargetDate} className="date-remove-btn">Remove</button>
                )}
              </div>
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
                        onClick={() => handleRelatedItemSelect(item)}
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

        {/* Due Date Changes Section */}
        {(workItem.workItemType === 'Product Backlog Item' || workItem.workItemType === 'TBI') && (
          <div className="related-items-section">
            <div 
              className="related-items-header"
              onClick={() => setShowDueDateChanges(!showDueDateChanges)}
            >
              <span className="related-items-title">
                {showDueDateChanges ? '▼' : '▶'} Due Date Changes ({dueDateChanges.length})
              </span>
            </div>
            {showDueDateChanges && (
              <div className="related-items-content">
                {isLoadingChanges ? (
                  <div className="related-items-loading">Loading...</div>
                ) : dueDateChanges.length === 0 ? (
                  <div className="related-items-empty">No due date changes found</div>
                ) : (
                  <ul className="related-items-list">
                    {dueDateChanges.map((change, index) => (
                      <li key={index} className="related-item">
                        <div className="related-item-header">
                          <span className="related-item-id">
                            {new Date(change.changedDate).toLocaleDateString()}
                          </span>
                          <span className="related-item-type">by {change.changedBy}</span>
                        </div>
                        <div className="related-item-title">
                          {change.oldDueDate ? new Date(change.oldDueDate).toLocaleDateString() : 'No Date'} → {change.newDueDate ? new Date(change.newDueDate).toLocaleDateString() : 'No Date'}
                        </div>
                        {change.reason && (
                          <div className="related-item-assignee">
                            Reason: {change.reason}
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

        {/* Link to Release Epic */}
        <div className="link-to-release-section">
          <div 
            className="link-to-release-header"
            onClick={() => setShowLinkToEpic(!showLinkToEpic)}
          >
            <span className="link-to-release-title">
              {showLinkToEpic ? '▼' : '▶'} Link to Release Epic
            </span>
          </div>
          {showLinkToEpic && (
            <div className="link-to-release-content">
              {/* Show current parent epic if exists */}
              {isLoadingParentEpic ? (
                <div className="current-parent-loading">Loading current parent...</div>
              ) : currentParentEpic ? (
                <div className="current-parent-info">
                  <div className="current-parent-header">Currently Linked To:</div>
                  <div className="current-parent-details">
                    <div className="current-parent-text">
                      <span className="current-parent-id">#{currentParentEpic.id}</span>
                      <span className="current-parent-title">{currentParentEpic.version || currentParentEpic.title}</span>
                    </div>
                    <button
                      className="btn-unlink"
                      onClick={() => setShowUnlinkConfirmModal(true)}
                      title="Remove link to this release epic"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ) : (
                <div className="current-parent-info no-parent">
                  <span className="no-parent-icon">🔗</span>
                  <span className="no-parent-text">Not currently linked to any release epic</span>
                </div>
              )}

              {/* Result message */}
              {linkResultMessage && (
                <div className={`link-result-message ${linkResultMessage.type}`}>
                  {linkResultMessage.type === 'success' ? '✓' : '✕'} {linkResultMessage.message}
                </div>
              )}

              {isLoadingReleaseEpics ? (
                <div className="link-loading">Loading release epics...</div>
              ) : availableReleaseEpics.length === 0 ? (
                <div className="link-empty">No active release epics available</div>
              ) : (
                <div className="link-form">
                  <label className="link-label">Select Release Epic:</label>
                  <select
                    className="link-select"
                    value={selectedEpicId || ''}
                    onChange={(e) => setSelectedEpicId(e.target.value ? parseInt(e.target.value) : null)}
                    disabled={isLinkingToEpic}
                  >
                    <option value="">-- Select a release --</option>
                    {availableReleaseEpics.map(epic => (
                      <option key={epic.id} value={epic.id}>
                        {epic.version} ({epic.status})
                      </option>
                    ))}
                  </select>
                  <button
                    className="link-button"
                    onClick={() => setShowLinkConfirmModal(true)}
                    disabled={!selectedEpicId || isLinkingToEpic}
                  >
                    Link to Release
                  </button>
                  <div className="link-info">
                    ℹ️ This will add this work item as a child of the selected release epic.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showLinkConfirmModal && selectedEpicId && (
          <div className="modal-overlay" onClick={() => setShowLinkConfirmModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Confirm Link to Release</h3>
                <button className="modal-close" onClick={() => setShowLinkConfirmModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-icon">🔗</div>
                <p className="modal-message">
                  Are you sure you want to link work item <strong>#{workItem.id}</strong> to release epic:
                </p>
                <div className="modal-epic-info">
                  <span className="modal-epic-version">
                    {availableReleaseEpics.find(e => e.id === selectedEpicId)?.version}
                  </span>
                  <span className="modal-epic-status">
                    {availableReleaseEpics.find(e => e.id === selectedEpicId)?.status}
                  </span>
                </div>
                {currentParentEpic && (
                  <div className="modal-warning">
                    ⚠️ This work item is currently linked to: <strong>{currentParentEpic.version || currentParentEpic.title}</strong>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-btn modal-btn-cancel" 
                  onClick={() => setShowLinkConfirmModal(false)}
                  disabled={isLinkingToEpic}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn modal-btn-confirm" 
                  onClick={handleLinkToReleaseEpic}
                  disabled={isLinkingToEpic}
                >
                  {isLinkingToEpic ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unlink Confirmation Modal */}
        {showUnlinkConfirmModal && currentParentEpic && (
          <div className="modal-overlay" onClick={() => setShowUnlinkConfirmModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Confirm Unlink from Release</h3>
                <button className="modal-close" onClick={() => setShowUnlinkConfirmModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-icon modal-icon-danger">🗑️</div>
                <p className="modal-message">
                  Are you sure you want to remove the link between work item <strong>#{workItem.id}</strong> and release epic:
                </p>
                <div className="modal-epic-info">
                  <span className="modal-epic-version">
                    {currentParentEpic.version || currentParentEpic.title}
                  </span>
                  <span className="modal-epic-id">
                    #{currentParentEpic.id}
                  </span>
                </div>
                <div className="modal-warning">
                  ⚠️ This will remove the hierarchical relationship. This action cannot be undone from here.
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-btn modal-btn-cancel" 
                  onClick={() => setShowUnlinkConfirmModal(false)}
                  disabled={isUnlinking}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn modal-btn-danger" 
                  onClick={handleUnlinkFromReleaseEpic}
                  disabled={isUnlinking}
                >
                  {isUnlinking ? 'Unlinking...' : 'Remove Link'}
                </button>
              </div>
            </div>
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

        {/* Work Item Type Specific Fields */}
        <div className="work-item-details-section">
          {/* PBI Fields: Description, Acceptance Criteria, Discussions */}
          {workItem.workItemType === 'Product Backlog Item' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Acceptance Criteria" content={workItem.acceptanceCriteria} />
              <RichTextField label="Discussions" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}

          {/* Bug Fields: Repro Steps, Discussion */}
          {workItem.workItemType === 'Bug' && (
            <>
              <RichTextField label="Repro Steps" content={workItem.reproSteps} defaultExpanded={true} />
              <RichTextField label="Discussion" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}

          {/* TBI Fields: Description, Design, Discussion */}
          {workItem.workItemType === 'Technical Backlog Item' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Design" content={workItem.design} />
              <RichTextField label="Discussion" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}

          {/* Epic Fields: Description, Acceptance Criteria, Discussions */}
          {workItem.workItemType === 'Epic' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Acceptance Criteria" content={workItem.acceptanceCriteria} />
              <RichTextField label="Discussions" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}

          {/* Feature Fields: Description, Acceptance Criteria */}
          {workItem.workItemType === 'Feature' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Acceptance Criteria" content={workItem.acceptanceCriteria} />
            </>
          )}
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
