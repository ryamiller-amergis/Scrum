import React, { useState, useEffect } from 'react';
import type { WorkItem, Deployment } from '../types/workitem';
import { useReleases } from '../hooks/useReleases';
import { useDeployments } from '../hooks/useDeployments';
import { DeploymentModal } from './DeploymentModal';
import { ReleaseFormModal } from './ReleaseFormModal';
import type { ReleaseFormValues } from './ReleaseFormModal';
import { LinkItemsModal } from './LinkItemsModal';
import { DeleteReleaseModal } from './DeleteReleaseModal';
import './ReleaseView.css';

interface ReleaseViewProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
  onSelectItem?: (workItem: WorkItem) => void;
}

const ReleaseView: React.FC<ReleaseViewProps> = ({ project, areaPath, onSelectItem }) => {
  const {
    releaseEpics, loadingEpics, selectedRelease,
    releaseWorkItems, releaseMetrics, latestDeployments,
    loadingDetails, refreshReleaseEpics, refreshReleases, refreshReleaseDetails,
  } = useReleases(project, areaPath);

  const deployments = useDeployments(
    selectedRelease,
    releaseWorkItems.map((wi: WorkItem) => wi.id),
    refreshReleaseDetails
  );

  // Release form modal state
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEpicId, setEditingEpicId] = useState<number | null>(null);
  const [editModalDefaults, setEditModalDefaults] = useState<Partial<ReleaseFormValues> | undefined>(undefined);

  // Link items modal state
  const [linkingEpicId, setLinkingEpicId] = useState<number | null>(null);

  // Delete modal state
  const [deletingEpicId, setDeletingEpicId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Row expansion state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [childItems, setChildItems] = useState<Map<number, WorkItem[]>>(new Map());
  const [loadingChildren, setLoadingChildren] = useState<Set<number>>(new Set());
  const [expandedNestedItems, setExpandedNestedItems] = useState<Set<number>>(new Set());
  const [nestedChildren, setNestedChildren] = useState<Map<number, WorkItem[]>>(new Map());
  const [loadingNestedChildren, setLoadingNestedChildren] = useState<Set<number>>(new Set());
  const [itemsWithUatReadyChildren, setItemsWithUatReadyChildren] = useState<Set<number>>(new Set());
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [showProgressInfo, setShowProgressInfo] = useState(false);

  // Close action menu on outside click
  useEffect(() => {
    if (openActionMenuId === null) return;
    const handle = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.actions-cell')) setOpenActionMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openActionMenuId]);

  const handleOpenEditModal = (epic: any) => {
    setIsEditMode(true);
    setEditingEpicId(epic.id);
    setEditModalDefaults({
      version: epic.version,
      startDate: epic.startDate || '',
      targetDate: epic.targetDate || '',
      description: epic.description || '',
      status: epic.status || 'New',
    });
    setShowReleaseModal(true);
  };

  const handleCloseReleaseModal = () => {
    setShowReleaseModal(false);
    setIsEditMode(false);
    setEditingEpicId(null);
    setEditModalDefaults(undefined);
  };

  const handleCreateRelease = async (values: ReleaseFormValues) => {
    const res = await fetch(`/api/releases/${encodeURIComponent(values.version)}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project, areaPath,
        startDate: values.startDate || undefined,
        targetDate: values.targetDate || undefined,
        description: values.description || undefined,
      }),
    });
    if (res.ok) {
      handleCloseReleaseModal();
      refreshReleases();
      refreshReleaseEpics();
    }
  };

  const handleUpdateRelease = async (values: ReleaseFormValues) => {
    if (!editingEpicId) return;
    const res = await fetch(`/api/releases/${editingEpicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.version,
        startDate: values.startDate || undefined,
        targetDate: values.targetDate || undefined,
        description: values.description || undefined,
        status: values.status,
        project, areaPath,
      }),
    });
    if (res.ok) {
      handleCloseReleaseModal();
      refreshReleaseEpics();
    }
  };

  const handleLinkItems = async (epicId: number, workItemIds: number[]) => {
    const res = await fetch(`/api/releases/${epicId}/link-related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workItemIds, project, areaPath }),
    });
    if (res.ok) refreshReleaseEpics();
  };

  const handleUnlinkItem = async (epicId: number, workItemId: number) => {
    if (!confirm('Are you sure you want to unlink this item from the release?')) return;
    const res = await fetch(`/api/releases/${epicId}/unlink-related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workItemIds: [workItemId], project, areaPath }),
    });
    if (res.ok) {
      setChildItems(prev => {
        const next = new Map(prev);
        next.set(epicId, (next.get(epicId) ?? []).filter(i => i.id !== workItemId));
        return next;
      });
      refreshReleaseEpics();
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = (data as any).error || 'Unknown error';
      console.error('Unlink error:', msg);
      alert(`Failed to unlink item: ${msg}`);
    }
  };

  const handleDeleteEpic = async () => {
    if (!deletingEpicId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/releases/${deletingEpicId}?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setDeletingEpicId(null);
        refreshReleaseEpics();
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = (data as any).error || 'Unknown error';
        console.error('Delete error:', msg);
        alert(`Failed to delete epic: ${msg}`);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const checkForUatReadyChildren = async (itemId: number, type: string) => {
    if (type !== 'Epic' && type !== 'Feature') return;
    const endpoint = type === 'Epic'
      ? `/api/epics/${itemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      : `/api/features/${itemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const children: WorkItem[] = await res.json();
        const hasUat = children.some(c =>
          c.state === 'UAT - Ready For Test' || c.state === 'UAT Ready For Test' || c.state === 'UAT-Ready For Test'
        );
        if (hasUat) setItemsWithUatReadyChildren(prev => new Set(prev).add(itemId));
      }
    } catch { /* silent */ }
  };

  const toggleRowExpansion = async (epicId: number) => {
    const next = new Set(expandedRows);
    if (next.has(epicId)) {
      next.delete(epicId);
      setExpandedRows(next);
      return;
    }
    next.add(epicId);
    setExpandedRows(next);
    if (childItems.has(epicId)) return;
    setLoadingChildren(prev => new Set(prev).add(epicId));
    try {
      const res = await fetch(
        `/api/releases/${epicId}/related-items?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      if (res.ok) {
        const children: WorkItem[] = await res.json();
        setChildItems(prev => new Map(prev).set(epicId, children));
        for (const child of children) checkForUatReadyChildren(child.id, child.workItemType);
      }
    } finally {
      setLoadingChildren(prev => { const s = new Set(prev); s.delete(epicId); return s; });
    }
  };

  const toggleNestedExpansion = async (itemId: number, type: string) => {
    const next = new Set(expandedNestedItems);
    if (next.has(itemId)) { next.delete(itemId); setExpandedNestedItems(next); return; }
    next.add(itemId);
    setExpandedNestedItems(next);
    if (nestedChildren.has(itemId)) return;
    setLoadingNestedChildren(prev => new Set(prev).add(itemId));
    try {
      const endpoint = type === 'Epic'
        ? `/api/epics/${itemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
        : `/api/features/${itemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const children = await res.json();
        setNestedChildren(prev => new Map(prev).set(itemId, children));
      }
    } finally {
      setLoadingNestedChildren(prev => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  };

  const downloadReleaseNotes = async (format: 'json' | 'markdown') => {
    if (!selectedRelease) return;
    const res = await fetch(
      `/api/releases/${encodeURIComponent(selectedRelease)}/notes?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}&format=${format}`
    );
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `release-${selectedRelease}-notes.${format === 'markdown' ? 'md' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getHealthStatus = () => {
    if (!releaseMetrics) return 'on-track';
    if (releaseMetrics.blockedFeatures > 0) return 'blocked';
    const pct = releaseMetrics.totalFeatures > 0
      ? (releaseMetrics.completedFeatures / releaseMetrics.totalFeatures) * 100 : 0;
    if (pct < 50 && releaseMetrics.inProgressFeatures < releaseMetrics.totalFeatures * 0.5) return 'at-risk';
    return 'on-track';
  };

  const completionPct = releaseMetrics && releaseMetrics.totalFeatures > 0
    ? Math.round((releaseMetrics.completedFeatures / releaseMetrics.totalFeatures) * 100)
    : 0;

  const getStateClass = (state: string) => {
    if (['Ready For Release', 'UAT - Test Done', 'Done', 'Closed'].includes(state)) return 'state-completed';
    if (['Committed', 'In Progress', 'Ready For Test', 'In Test', 'UAT - Ready For Test'].includes(state)) return 'state-in-progress';
    if (state === 'Blocked') return 'state-blocked';
    return 'state-not-started';
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : 'N/A';

  const healthStatus = getHealthStatus();

  return (
    <div className="release-view">
      <div className="release-header">
        <div className="release-header-top">
          <div className="header-title-wrapper">
            <h2>Release Management</h2>
            <div className="info-icon-wrapper">
              <div className="info-icon" onClick={() => setShowProgressInfo(v => !v)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
              </div>
              {showProgressInfo && (
                <div className="progress-info-tooltip">
                  <div className="tooltip-header">
                    <h4>Progress Calculation</h4>
                    <button className="btn-close-tooltip" onClick={() => setShowProgressInfo(false)}>✕</button>
                  </div>
                  <div className="tooltip-content">
                    <p>Release progress is based on completed work items only:</p>
                    <div className="calculation-breakdown">
                      <div className="calc-item">
                        <span className="calc-badge complete">✓ Completed</span>
                        <span className="calc-label">Done, Closed, Ready For Release</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-badge not-started">○ Not Completed</span>
                        <span className="calc-label">All other states</span>
                      </div>
                    </div>
                    <p className="tooltip-note">
                      <strong>Example:</strong> 2 Done + 2 In Progress out of 4 total = 50%
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="release-actions">
            <button className="btn-create-release" onClick={() => setShowReleaseModal(true)}>+ New Release</button>
          </div>
        </div>
      </div>

      {/* Release Epics Grid */}
      <div className="release-epics-grid">
        {loadingEpics ? (
          <div className="loading-message">Loading releases...</div>
        ) : releaseEpics.length === 0 ? (
          <div className="empty-message">No releases yet. Click "+ New Release" to create one.</div>
        ) : (
          <table className="epics-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Version</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Start Date</th>
                <th>Target Date</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {releaseEpics.map((epic: any) => (
                <React.Fragment key={epic.id}>
                  <tr>
                    <td>
                      <button className="btn-expand" onClick={() => toggleRowExpansion(epic.id)} title={expandedRows.has(epic.id) ? 'Collapse' : 'Expand'}>
                        {expandedRows.has(epic.id) ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="version-cell">{epic.version}</td>
                    <td>
                      <span className={`status-badge status-${epic.status.toLowerCase().replace(/\s+/g, '-')}`}>{epic.status}</span>
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${epic.progress}%` }} />
                        </div>
                        <span className="progress-text">{epic.progress}%</span>
                        <span className="progress-details">({epic.completedItems}/{epic.totalItems} items)</span>
                      </div>
                    </td>
                    <td>{epic.startDate || 'N/A'}</td>
                    <td>{epic.targetDate || 'N/A'}</td>
                    <td className="description-cell">
                      <div className="description-truncate" title={epic.description}>
                        {epic.description ? epic.description.replace(/<[^>]*>/g, '').substring(0, 100) : 'N/A'}
                        {epic.description?.length > 100 ? '...' : ''}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-action-menu" onClick={() => setOpenActionMenuId(openActionMenuId === epic.id ? null : epic.id)} title="Actions">⋯</button>
                        {openActionMenuId === epic.id && (
                          <div className="action-dropdown">
                            <button className="action-menu-item" onClick={() => { handleOpenEditModal(epic); setOpenActionMenuId(null); }}>✏️ Edit</button>
                            <button className="action-menu-item" onClick={() => { setLinkingEpicId(epic.id); setOpenActionMenuId(null); }}>🔗 Link Items</button>
                            <button className="action-menu-item" onClick={() => setOpenActionMenuId(null)}>📝 Create Changelog</button>
                            <button className="action-menu-item" onClick={() => { setDeletingEpicId(epic.id); setOpenActionMenuId(null); }}>🗑️ Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRows.has(epic.id) && (
                    <tr className="expanded-row">
                      <td colSpan={8}>
                        <div className="expanded-content">
                          <div className="expanded-header">
                            <div className="expanded-title">
                              <span className="expanded-icon">📦</span>
                              <h4>Associated Work Items</h4>
                              <span className="expanded-count">{epic.completedItems}/{epic.totalItems} completed</span>
                            </div>
                          </div>
                          {loadingChildren.has(epic.id) ? (
                            <div className="child-loading"><div className="loading-spinner" /><span>Loading work items...</span></div>
                          ) : (childItems.get(epic.id)?.length ?? 0) === 0 ? (
                            <div className="child-empty">
                              <div className="empty-icon">📋</div>
                              <div className="empty-text">No items linked to this release yet</div>
                              <div className="empty-hint">Click "Link Items" to add work items to this release</div>
                            </div>
                          ) : (
                            <div className="child-items-grid">
                              {childItems.get(epic.id)?.map(item => {
                                const stateClass = item.state.toLowerCase().replace(/\s+/g, '-');
                                const typeClass = item.workItemType.toLowerCase().replace(/\s+/g, '-');
                                const isExpandable = item.workItemType === 'Epic' || item.workItemType === 'Feature';
                                const isExpanded = expandedNestedItems.has(item.id);
                                return (
                                  <React.Fragment key={item.id}>
                                    <div className={`child-item-card type-${typeClass}${itemsWithUatReadyChildren.has(item.id) ? ' has-uat-ready' : ''}${isExpanded ? ' expanded' : ''}`}>
                                      {isExpandable && (
                                        <button className="btn-expand-nested" onClick={e => { e.stopPropagation(); toggleNestedExpansion(item.id, item.workItemType); }} title={isExpanded ? 'Collapse children' : 'Expand to view children'}>
                                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={`expand-icon${isExpanded ? ' expanded' : ''}`}>
                                            <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        </button>
                                      )}
                                      <div className="child-item-content" onClick={() => onSelectItem?.(item)} title="Click to view details">
                                        <div className="child-item-header">
                                          <span className="child-item-id">#{item.id}</span>
                                          <span className={`child-item-type type-${typeClass}`}>{item.workItemType}</span>
                                          <span className={`child-item-state state-${stateClass}`}>{item.state}</span>
                                        </div>
                                        <div className="child-item-title" title={item.title}>{item.title}</div>
                                        <div className="child-item-footer">
                                          <div className="footer-left">
                                            {item.assignedTo ? (
                                              <div className="child-item-assignee">
                                                <span className="assignee-avatar">{item.assignedTo.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}</span>
                                                <span className="assignee-name">{item.assignedTo}</span>
                                              </div>
                                            ) : (
                                              <div className="child-item-unassigned"><span className="unassigned-icon">👤</span><span className="unassigned-text">Unassigned</span></div>
                                            )}
                                            {item.targetDate && (
                                              <div className="child-item-date"><span className="date-icon">📅</span><span className="date-text">{new Date(item.targetDate).toLocaleDateString()}</span></div>
                                            )}
                                          </div>
                                          <button className="btn-unlink-item" onClick={e => { e.stopPropagation(); handleUnlinkItem(epic.id, item.id); }} title="Unlink from release">✕</button>
                                        </div>
                                      </div>
                                      {isExpanded && (
                                        <div className="nested-children-container">
                                          {loadingNestedChildren.has(item.id) ? (
                                            <div className="nested-loading"><div className="loading-spinner" /><span>Loading child items...</span></div>
                                          ) : (nestedChildren.get(item.id)?.length ?? 0) === 0 ? (
                                            <div className="nested-empty"><span>No child items found</span></div>
                                          ) : (
                                            <div className="nested-items-list">
                                              {nestedChildren.get(item.id)?.map(nested => (
                                                <div key={nested.id} className={`nested-item type-${nested.workItemType.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => onSelectItem?.(nested)} title="Click to view details">
                                                  <div className="nested-item-main">
                                                    <div className="nested-item-id">#{nested.id}</div>
                                                    <div className="nested-item-title">{nested.title}</div>
                                                    <span className={`nested-item-type type-${nested.workItemType.toLowerCase().replace(/\s+/g, '-')}`}>{nested.workItemType}</span>
                                                    <span className={`nested-item-state state-${nested.state.toLowerCase().replace(/\s+/g, '-')}`}>{nested.state}</span>
                                                  </div>
                                                  {nested.assignedTo && (
                                                    <div className="nested-item-assignee">
                                                      <span className="nested-assignee-avatar">{nested.assignedTo.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}</span>
                                                      <span className="nested-assignee-name">{nested.assignedTo}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedRelease && !loadingDetails && (
        <>
          <div className="release-metrics">
            {[
              { label: 'Total Features', value: releaseMetrics?.totalFeatures ?? 0, cls: '' },
              { label: 'Completed', value: releaseMetrics?.completedFeatures ?? 0, cls: 'completed' },
              { label: 'In Progress', value: releaseMetrics?.inProgressFeatures ?? 0, cls: 'in-progress' },
              { label: 'Blocked', value: releaseMetrics?.blockedFeatures ?? 0, cls: 'blocked' },
              { label: 'Ready for Release', value: releaseMetrics?.readyForReleaseFeatures ?? 0, cls: 'ready' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="metric-card">
                <div className="metric-label">{label}</div>
                <div className={`metric-value${cls ? ` ${cls}` : ''}`}>{value}</div>
              </div>
            ))}
            <div className={`metric-card health-${healthStatus}`}>
              <div className="metric-label">Health</div>
              <div className="metric-value">{healthStatus.replace('-', ' ')}</div>
            </div>
          </div>

          <div className="release-progress">
            <div className="progress-header"><span>Completion: {completionPct}%</span></div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completionPct}%` }} />
            </div>
          </div>

          <div className="deployment-status">
            <h3>Deployment Status</h3>
            <div className="deployment-environments">
              {(['dev', 'staging', 'production'] as const).map(env => {
                const dep: Deployment | undefined = (latestDeployments as any)[env];
                return (
                  <div key={env} className={`environment-card ${dep ? 'deployed' : ''}`}>
                    <div className="environment-name">{env.charAt(0).toUpperCase() + env.slice(1)}</div>
                    {dep ? (
                      <>
                        <div className="deployment-info">Deployed by: {dep.deployedBy}</div>
                        <div className="deployment-date">{formatDate(dep.deployedAt)}</div>
                      </>
                    ) : (
                      <div className="deployment-info">Not deployed</div>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="btn-deploy" onClick={deployments.openModal}>Record Deployment</button>
          </div>

          <div className="release-notes-section">
            <h3>Release Notes</h3>
            <div className="release-notes-actions">
              <button onClick={() => downloadReleaseNotes('markdown')}>Download Markdown</button>
              <button onClick={() => downloadReleaseNotes('json')}>Download JSON</button>
            </div>
          </div>

          <div className="release-work-items">
            <h3>Features &amp; Epics ({releaseWorkItems.length})</h3>
            <div className="work-items-table">
              <table>
                <thead>
                  <tr><th>ID</th><th>Type</th><th>Title</th><th>State</th><th>Assigned To</th><th>Target Date</th></tr>
                </thead>
                <tbody>
                  {releaseWorkItems.map((wi: WorkItem) => (
                    <tr key={wi.id} onClick={() => onSelectItem?.(wi)} className="clickable-row">
                      <td>{wi.id}</td>
                      <td>{wi.workItemType}</td>
                      <td>{wi.title}</td>
                      <td><span className={`state-badge ${getStateClass(wi.state)}`}>{wi.state}</span></td>
                      <td>{wi.assignedTo || 'Unassigned'}</td>
                      <td>{formatDate(wi.targetDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loadingDetails && <div className="loading-message">Loading release details...</div>}

      {/* Modals */}
      {deployments.showModal && (
        <DeploymentModal
          form={deployments.form}
          onFormChange={deployments.setForm}
          onSubmit={deployments.createDeployment}
          onClose={deployments.closeModal}
          isCreating={deployments.isCreating}
        />
      )}

      {showReleaseModal && (
        <ReleaseFormModal
          isEditMode={isEditMode}
          defaultValues={editModalDefaults}
          onSubmit={isEditMode ? handleUpdateRelease : handleCreateRelease}
          onClose={handleCloseReleaseModal}
        />
      )}

      {linkingEpicId !== null && (
        <LinkItemsModal
          epicId={linkingEpicId}
          project={project}
          areaPath={areaPath}
          onLink={handleLinkItems}
          onClose={() => setLinkingEpicId(null)}
        />
      )}

      {deletingEpicId !== null && (
        <DeleteReleaseModal
          epicId={deletingEpicId}
          epicVersion={releaseEpics.find((e: any) => e.id === deletingEpicId)?.version}
          isDeleting={isDeleting}
          onConfirm={handleDeleteEpic}
          onClose={() => setDeletingEpicId(null)}
        />
      )}
    </div>
  );
};

export default ReleaseView;


