import React, { useState, useMemo, useEffect } from 'react';
import { WorkItem } from '../types/workitem';
import { EpicProgress } from './EpicProgress';
import { RichTextField } from './RichTextField';
import { WorkItemDateEditor } from './WorkItemDateEditor';
import { useWorkItemDetail } from '../hooks/useWorkItemDetail';
import { env } from '../config/env';
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
  const [parentEpicId, setParentEpicId] = useState<number | null>(null);
  const [showRelatedItems, setShowRelatedItems] = useState(false);
  const [showDueDateChanges, setShowDueDateChanges] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => Math.floor(window.innerWidth * 0.45));
  const [isResizing, setIsResizing] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<number[]>([]);
  const [showLinkToEpic, setShowLinkToEpic] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState<number | null>(null);
  const [isLinkingToEpic, setIsLinkingToEpic] = useState(false);
  const [showLinkConfirmModal, setShowLinkConfirmModal] = useState(false);
  const [linkResultMessage, setLinkResultMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showUnlinkConfirmModal, setShowUnlinkConfirmModal] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [newTag, setNewTag] = useState('');

  const {
    relatedItems, isLoadingRelations,
    dueDateChanges, isLoadingChanges,
    discussions, isLoadingDiscussions,
    availableReleaseEpics, isLoadingReleaseEpics,
    currentParentEpic, isLoadingParentEpic,
    invalidateParentEpic,
  } = useWorkItemDetail(workItem, project, areaPath, showLinkToEpic);

  const uniqueStates = useMemo(() => {
    const states = new Set(allWorkItems.map(item => item.state));
    ['New', 'Active', 'Resolved', 'Closed', 'Ready For Test', 'In Test', 'Removed'].forEach(s => states.add(s));
    return Array.from(states).sort();
  }, [allWorkItems]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set(allWorkItems.map(item => item.assignedTo).filter(Boolean));
    return Array.from(assignees as Set<string>).sort();
  }, [allWorkItems]);

  const uniqueIterations = useMemo(() => {
    const iterations = new Set(allWorkItems.map(item => item.iterationPath));
    return Array.from(iterations).sort();
  }, [allWorkItems]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = Math.floor(window.innerWidth * 0.7);
      if (newWidth >= 300 && newWidth <= maxWidth) setPanelWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // All hooks above. Guard ensures workItem is non-null for all handlers and JSX below.
  if (!workItem) return null;

  const handleFieldChange = async (field: string, value: any) => {
    if (onUpdateField) {
      await onUpdateField(workItem.id, field, value);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleAddTag = async () => {
    if (newTag.trim() && onUpdateField) {
      const current = workItem.tags ? workItem.tags.split(';').map(t => t.trim()).filter(t => t) : [];
      const trimmed = newTag.trim();
      if (!current.includes(trimmed)) {
        await handleFieldChange('tags', [...current, trimmed].join('; '));
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (onUpdateField) {
      const current = workItem.tags ? workItem.tags.split(';').map(t => t.trim()).filter(t => t) : [];
      await handleFieldChange('tags', current.filter(t => t !== tag).join('; '));
    }
  };

  const handleChildSelect = (child: WorkItem) => {
    setNavigationHistory(prev => [...prev, workItem.id]);
    if (workItem.workItemType === 'Epic') setParentEpicId(workItem.id);
    onSelectItem(child);
  };

  const handleRelatedItemSelect = (item: WorkItem) => {
    setNavigationHistory(prev => [...prev, workItem.id]);
    onSelectItem(item);
  };

  const handleBackToPrevious = () => {
    if (navigationHistory.length > 0) {
      const prevId = navigationHistory[navigationHistory.length - 1];
      const prev = allWorkItems.find(i => i.id === prevId);
      if (prev) { setNavigationHistory(h => h.slice(0, -1)); onSelectItem(prev); }
    }
  };

  const handleBackToEpic = () => {
    if (parentEpicId) {
      const epic = allWorkItems.find(i => i.id === parentEpicId);
      if (epic) { setParentEpicId(null); onSelectItem(epic); }
    }
  };

  const handleLinkToReleaseEpic = async () => {
    if (!selectedEpicId) return;
    setIsLinkingToEpic(true);
    setLinkResultMessage(null);
    try {
      const res = await fetch(`/api/releases/${selectedEpicId}/link-related`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemIds: [workItem.id], project, areaPath }),
      });
      if (res.ok) {
        setLinkResultMessage({ type: 'success', message: `Successfully linked work item #${workItem.id} to release epic!` });
        setShowLinkConfirmModal(false);
        setSelectedEpicId(null);
        invalidateParentEpic();
        setTimeout(() => setLinkResultMessage(null), 5000);
      } else {
        const err = await res.json();
        setLinkResultMessage({ type: 'error', message: `Failed to link: ${err.error || 'Unknown error'}` });
        setShowLinkConfirmModal(false);
      }
    } catch {
      setLinkResultMessage({ type: 'error', message: 'Failed to link work item to release epic' });
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
      const res = await fetch(`/api/releases/${currentParentEpic.id}/unlink-related`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemIds: [workItem.id], project, areaPath }),
      });
      if (res.ok) {
        setLinkResultMessage({ type: 'success', message: `Successfully unlinked work item #${workItem.id} from release epic!` });
        setShowUnlinkConfirmModal(false);
        invalidateParentEpic();
        setTimeout(() => setLinkResultMessage(null), 5000);
      } else {
        const err = await res.json();
        setLinkResultMessage({ type: 'error', message: `Failed to unlink: ${err.error || 'Unknown error'}` });
        setShowUnlinkConfirmModal(false);
      }
    } catch {
      setLinkResultMessage({ type: 'error', message: 'Failed to unlink work item from release epic' });
      setShowUnlinkConfirmModal(false);
    } finally {
      setIsUnlinking(false);
    }
  };

  const adoOrg = env.VITE_ADO_ORG;
  const adoProject = env.VITE_ADO_PROJECT;
  const adoUrl = `https://dev.azure.com/${adoOrg}/${adoProject}/_workitems/edit/${workItem.id}`;

  return (
    <div className="details-panel" style={{ width: `${panelWidth}px` }}>
      <div
        className="details-resize-handle"
        onMouseDown={e => { e.preventDefault(); setIsResizing(true); }}
        style={{ cursor: isResizing ? 'ew-resize' : 'col-resize' }}
      />
      <div className="details-header">
        <h3>Work Item Details</h3>
        {isSaving && <span className="saving-badge">Saving...</span>}
        {navigationHistory.length > 0 && (
          <button onClick={handleBackToPrevious} className="back-to-epic-btn" title="Go back to previous work item">Back</button>
        )}
        {parentEpicId && !navigationHistory.length && (
          <button onClick={handleBackToEpic} className="back-to-epic-btn" title="Back to Epic">Back to Epic</button>
        )}
        <button onClick={onClose} className="close-btn">×</button>
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
            {workItem.tags?.trim() ? (
              workItem.tags.split(';').map((tag, i) => (
                <span key={i} className="tag-badge">
                  {tag.trim()}
                  {onUpdateField && (
                    <button className="tag-remove-btn" onClick={() => handleRemoveTag(tag.trim())} title="Remove tag">×</button>
                  )}
                </span>
              ))
            ) : (
              <span className="detail-value-empty">No tags</span>
            )}
            {onUpdateField && (
              <div className="tag-input-container">
                <input
                  type="text"
                  className="tag-input"
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyPress={e => { if (e.key === 'Enter') handleAddTag(); }}
                />
                <button className="tag-add-btn" onClick={handleAddTag} disabled={!newTag.trim()}>Add</button>
              </div>
            )}
          </div>
        </div>
        <div className="detail-row">
          <span className="detail-label">Type:</span>
          <span className="detail-value" style={{ fontWeight: workItem.workItemType === 'Epic' ? 700 : 'normal', color: workItem.workItemType === 'Epic' ? '#7B68EE' : 'inherit' }}>
            {workItem.workItemType === 'Epic' && '👑 '}{workItem.workItemType}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">State:</span>
          <select className="detail-select" value={workItem.state} onChange={e => handleFieldChange('state', e.target.value)} disabled={!onUpdateField}>
            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="detail-row">
          <span className="detail-label">Assigned To:</span>
          <select className="detail-select" value={workItem.assignedTo || ''} onChange={e => handleFieldChange('assignedTo', e.target.value || undefined)} disabled={!onUpdateField}>
            <option value="">Unassigned</option>
            {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {(workItem.workItemType === 'Product Backlog Item' || workItem.workItemType === 'Technical Backlog Item') && (
          <WorkItemDateEditor
            label="Dev Due Date"
            value={workItem.dueDate}
            requiresReason
            canEdit={!!onUpdateField}
            onSave={async (val, reason) => {
              await onUpdateDueDate(workItem.id, val, reason);
              await new Promise(r => setTimeout(r, 500));
            }}
          />
        )}

        {(workItem.state === 'Ready For Test' || workItem.state === 'In Test') && (
          <WorkItemDateEditor
            label="QA Complete Date"
            value={workItem.qaCompleteDate}
            canEdit={!!onUpdateField}
            onSave={async val => {
              if (onUpdateField) {
                await onUpdateField(workItem.id, 'qaCompleteDate', val || undefined);
                await new Promise(r => setTimeout(r, 500));
              }
            }}
          />
        )}

        {(workItem.workItemType === 'Epic' || workItem.workItemType === 'Feature' || workItem.workItemType === 'Bug') && (
          <WorkItemDateEditor
            label="Target Date"
            value={workItem.targetDate}
            canEdit={!!onUpdateField}
            valueStyle={{
              color: workItem.workItemType === 'Epic' ? '#7B68EE' : workItem.workItemType === 'Feature' ? '#FFA500' : '#DC143C',
              fontWeight: 600,
            }}
            onSave={async val => {
              if (onUpdateField) {
                await onUpdateField(workItem.id, 'targetDate', val || undefined);
                await new Promise(r => setTimeout(r, 500));
              }
            }}
          />
        )}

        {workItem.workItemType === 'Epic' && (
          <EpicProgress epicId={workItem.id} project={project} areaPath={areaPath} onSelectChild={handleChildSelect} />
        )}

        {(workItem.workItemType === 'Product Backlog Item' || workItem.workItemType === 'Technical Backlog Item' || workItem.workItemType === 'Feature') && (
          <div className="related-items-section">
            <div className="related-items-header" onClick={() => setShowRelatedItems(v => !v)}>
              <span className="related-items-title">{showRelatedItems ? '▼' : '▶'} Related Items ({relatedItems.length})</span>
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
                      <li key={item.id} className="related-item" onClick={() => handleRelatedItemSelect(item)}>
                        <div className="related-item-header">
                          <span className="related-item-id">#{item.id}</span>
                          <span className="related-item-type">{item.workItemType}</span>
                          <span className={`related-item-state state-${item.state.toLowerCase().replace(/\s+/g, '-')}`}>{item.state}</span>
                        </div>
                        <div className="related-item-title">{item.title}</div>
                        {item.assignedTo && <div className="related-item-assignee">Assigned to: {item.assignedTo}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {(workItem.workItemType === 'Product Backlog Item' || workItem.workItemType === 'TBI') && (
          <div className="related-items-section">
            <div className="related-items-header" onClick={() => setShowDueDateChanges(v => !v)}>
              <span className="related-items-title">{showDueDateChanges ? '▼' : '▶'} Due Date Changes ({dueDateChanges.length})</span>
            </div>
            {showDueDateChanges && (
              <div className="related-items-content">
                {isLoadingChanges ? (
                  <div className="related-items-loading">Loading...</div>
                ) : dueDateChanges.length === 0 ? (
                  <div className="related-items-empty">No due date changes found</div>
                ) : (
                  <ul className="related-items-list">
                    {dueDateChanges.map((change, i) => (
                      <li key={i} className="related-item">
                        <div className="related-item-header">
                          <span className="related-item-id">{new Date(change.changedDate).toLocaleDateString()}</span>
                          <span className="related-item-type">by {change.changedBy}</span>
                        </div>
                        <div className="related-item-title">
                          {change.oldDueDate ? new Date(change.oldDueDate).toLocaleDateString() : 'No Date'} → {change.newDueDate ? new Date(change.newDueDate).toLocaleDateString() : 'No Date'}
                        </div>
                        {change.reason && <div className="related-item-assignee">Reason: {change.reason}</div>}
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
          <div className="link-to-release-header" onClick={() => setShowLinkToEpic(v => !v)}>
            <span className="link-to-release-title">{showLinkToEpic ? '▼' : '▶'} Link to Release Epic</span>
          </div>
          {showLinkToEpic && (
            <div className="link-to-release-content">
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
                    <button className="btn-unlink" onClick={() => setShowUnlinkConfirmModal(true)} title="Remove link to this release epic">🗑️</button>
                  </div>
                </div>
              ) : (
                <div className="current-parent-info no-parent">
                  <span className="no-parent-icon">🔗</span>
                  <span className="no-parent-text">Not currently linked to any release epic</span>
                </div>
              )}

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
                  <select className="link-select" value={selectedEpicId || ''} onChange={e => setSelectedEpicId(e.target.value ? parseInt(e.target.value) : null)} disabled={isLinkingToEpic}>
                    <option value="">-- Select a release --</option>
                    {availableReleaseEpics.map(epic => <option key={epic.id} value={epic.id}>{epic.version} ({epic.status})</option>)}
                  </select>
                  <button className="link-button" onClick={() => setShowLinkConfirmModal(true)} disabled={!selectedEpicId || isLinkingToEpic}>Link to Release</button>
                  <div className="link-info">ℹ️ This will add this work item as a child of the selected release epic.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {showLinkConfirmModal && selectedEpicId && (
          <div className="modal-overlay" onClick={() => setShowLinkConfirmModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Confirm Link to Release</h3>
                <button className="modal-close" onClick={() => setShowLinkConfirmModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-icon">🔗</div>
                <p className="modal-message">Are you sure you want to link work item <strong>#{workItem.id}</strong> to release epic:</p>
                <div className="modal-epic-info">
                  <span className="modal-epic-version">{availableReleaseEpics.find(e => e.id === selectedEpicId)?.version}</span>
                  <span className="modal-epic-status">{availableReleaseEpics.find(e => e.id === selectedEpicId)?.status}</span>
                </div>
                {currentParentEpic && (
                  <div className="modal-warning">⚠️ This work item is currently linked to: <strong>{currentParentEpic.version || currentParentEpic.title}</strong></div>
                )}
              </div>
              <div className="modal-footer">
                <button className="modal-btn modal-btn-cancel" onClick={() => setShowLinkConfirmModal(false)} disabled={isLinkingToEpic}>Cancel</button>
                <button className="modal-btn modal-btn-confirm" onClick={handleLinkToReleaseEpic} disabled={isLinkingToEpic}>
                  {isLinkingToEpic ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showUnlinkConfirmModal && currentParentEpic && (
          <div className="modal-overlay" onClick={() => setShowUnlinkConfirmModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Confirm Unlink from Release</h3>
                <button className="modal-close" onClick={() => setShowUnlinkConfirmModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-icon modal-icon-danger">🗑️</div>
                <p className="modal-message">Are you sure you want to remove the link between work item <strong>#{workItem.id}</strong> and release epic:</p>
                <div className="modal-epic-info">
                  <span className="modal-epic-version">{currentParentEpic.version || currentParentEpic.title}</span>
                  <span className="modal-epic-id">#{currentParentEpic.id}</span>
                </div>
                <div className="modal-warning">⚠️ This will remove the hierarchical relationship. This action cannot be undone from here.</div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn modal-btn-cancel" onClick={() => setShowUnlinkConfirmModal(false)} disabled={isUnlinking}>Cancel</button>
                <button className="modal-btn modal-btn-danger" onClick={handleUnlinkFromReleaseEpic} disabled={isUnlinking}>
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
          <select className="detail-select" value={workItem.iterationPath} onChange={e => handleFieldChange('iterationPath', e.target.value)} disabled={!onUpdateField}>
            {uniqueIterations.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="work-item-details-section">
          {workItem.workItemType === 'Product Backlog Item' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Acceptance Criteria" content={workItem.acceptanceCriteria} />
              <RichTextField label="Discussions" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}
          {workItem.workItemType === 'Bug' && (
            <>
              <RichTextField label="Repro Steps" content={workItem.reproSteps} defaultExpanded={true} />
              <RichTextField label="Discussion" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}
          {workItem.workItemType === 'Technical Backlog Item' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Design" content={workItem.design} />
              <RichTextField label="Discussion" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}
          {workItem.workItemType === 'Epic' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Acceptance Criteria" content={workItem.acceptanceCriteria} />
              <RichTextField label="Discussions" content={isLoadingDiscussions ? 'Loading discussions...' : discussions} />
            </>
          )}
          {workItem.workItemType === 'Feature' && (
            <>
              <RichTextField label="Description" content={workItem.description} defaultExpanded={true} />
              <RichTextField label="Acceptance Criteria" content={workItem.acceptanceCriteria} />
            </>
          )}
        </div>

        <div className="detail-row">
          <a href={adoUrl} target="_blank" rel="noopener noreferrer" className="ado-link">
            Open in Azure DevOps →
          </a>
        </div>
      </div>
    </div>
  );
};


