import React, { useState, useEffect } from 'react';
import { WorkItem, Release, ReleaseMetrics, Deployment, DeploymentEnvironment } from '../types/workitem';
import { usePrefetch } from '../contexts/PrefetchContext';
import './ReleaseView.css';

interface ReleaseViewProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
  onSelectItem?: (workItem: WorkItem) => void;
}

const ReleaseView: React.FC<ReleaseViewProps> = ({
  workItems,
  project,
  areaPath,
  onSelectItem,
}) => {
  const [releases, setReleases] = useState<string[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [releaseWorkItems, setReleaseWorkItems] = useState<WorkItem[]>([]);
  const [releaseMetrics, setReleaseMetrics] = useState<ReleaseMetrics | null>(null);
  const [latestDeployments, setLatestDeployments] = useState<{
    dev?: Deployment;
    staging?: Deployment;
    production?: Deployment;
  }>({});
  const [loading, setLoading] = useState(false);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [deploymentForm, setDeploymentForm] = useState({
    environment: 'dev' as DeploymentEnvironment,
    notes: '',
  });
  const [showNewReleaseModal, setShowNewReleaseModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEpicId, setEditingEpicId] = useState<number | null>(null);
  const [newReleaseVersion, setNewReleaseVersion] = useState('');
  const [newReleaseStartDate, setNewReleaseStartDate] = useState('');
  const [newReleaseTargetDate, setNewReleaseTargetDate] = useState('');
  const [newReleaseDescription, setNewReleaseDescription] = useState('');
  const [newReleaseStatus, setNewReleaseStatus] = useState<string>('New');
  const [selectedWorkItemsForRelease, setSelectedWorkItemsForRelease] = useState<number[]>([]);
  const [releaseEpics, setReleaseEpics] = useState<any[]>([]);
  const [loadingEpics, setLoadingEpics] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<number>>(new Set());
  const [linkedItems, setLinkedItems] = useState<Map<number, WorkItem[]>>(new Map());
  const [loadingLinkedItems, setLoadingLinkedItems] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [childItems, setChildItems] = useState<Map<number, WorkItem[]>>(new Map());
  const [loadingChildren, setLoadingChildren] = useState<Set<number>>(new Set());
  const [showLinkItemsModal, setShowLinkItemsModal] = useState(false);
  const [linkingEpicId, setLinkingEpicId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [workItemTypeFilter, setWorkItemTypeFilter] = useState('All');
  const [searchResults, setSearchResults] = useState<WorkItem[]>([]);
  const [selectedItemsToLink, setSelectedItemsToLink] = useState<number[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingEpicId, setDeletingEpicId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showProgressInfo, setShowProgressInfo] = useState(false);
  const [itemsWithUatReadyChildren, setItemsWithUatReadyChildren] = useState<Set<number>>(new Set());
  const [expandedNestedItems, setExpandedNestedItems] = useState<Set<number>>(new Set());
  const [nestedChildren, setNestedChildren] = useState<Map<number, WorkItem[]>>(new Map());
  const [loadingNestedChildren, setLoadingNestedChildren] = useState<Set<number>>(new Set());

  const {
    prefetchedReleases,
    prefetchedReleaseEpics,
    prefetchProject,
    prefetchAreaPath,
  } = usePrefetch();

  const prefetchCacheMatches =
    prefetchedReleases &&
    prefetchProject === project &&
    prefetchAreaPath === areaPath;

  // Apply prefetched data when available so Release tab shows data immediately
  useEffect(() => {
    if (!prefetchCacheMatches || !prefetchedReleases) return;
    setReleases(prefetchedReleases);
    setReleaseEpics(Array.isArray(prefetchedReleaseEpics) ? prefetchedReleaseEpics : []);
    setSelectedRelease((prev) => (prev ? prev : prefetchedReleases.length > 0 ? prefetchedReleases[0] : null));
    setLoadingEpics(false);
  }, [prefetchCacheMatches, prefetchedReleases, prefetchedReleaseEpics]);

  // Fetch all release versions on mount (refreshes prefetched data or loads if no prefetch)
  useEffect(() => {
    fetchReleases();
    fetchReleaseEpics();
  }, [project, areaPath]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.actions-cell')) {
        setOpenActionMenuId(null);
      }
    };

    if (openActionMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openActionMenuId]);

  const fetchReleaseEpics = async () => {
    setLoadingEpics(true);
    try {
      const response = await fetch(
        `/api/releases/epics?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      
      if (!response.ok) {
        console.error('Failed to fetch release epics:', response.status, response.statusText);
        setReleaseEpics([]);
        return;
      }
      
      const data = await response.json();
      setReleaseEpics(data);
    } catch (error) {
      console.error('Error fetching release epics:', error);
      setReleaseEpics([]);
    } finally {
      setLoadingEpics(false);
    }
  };

  const searchWorkItems = async (query: string, typeFilter: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(
        `/api/workitems/search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(typeFilter)}&project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      
      if (!response.ok) {
        console.error('Failed to search work items:', response.status);
        setSearchResults([]);
        return;
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching work items:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchLinkedItems = async (epicId: number) => {
    if (linkedItems.has(epicId)) {
      return; // Already fetched
    }

    setLoadingLinkedItems(prev => new Set(prev).add(epicId));
    try {
      const response = await fetch(
        `/api/releases/${epicId}/related-items?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      
      if (!response.ok) {
        console.error('Failed to fetch related items:', response.status);
        return;
      }
      
      const data = await response.json();
      setLinkedItems(prev => new Map(prev).set(epicId, data));
    } catch (error) {
      console.error('Error fetching related items:', error);
    } finally {
      setLoadingLinkedItems(prev => {
        const next = new Set(prev);
        next.delete(epicId);
        return next;
      });
    }
  };

  const toggleEpicExpansion = (epicId: number) => {
    const newExpanded = new Set(expandedEpicIds);
    if (newExpanded.has(epicId)) {
      newExpanded.delete(epicId);
    } else {
      newExpanded.add(epicId);
      fetchLinkedItems(epicId);
    }
    setExpandedEpicIds(newExpanded);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showLinkItemsModal) {
        searchWorkItems(searchQuery, workItemTypeFilter);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, workItemTypeFilter, showLinkItemsModal]);

  // Fetch release details when selected release changes
  useEffect(() => {
    if (selectedRelease) {
      fetchReleaseDetails(selectedRelease);
    }
  }, [selectedRelease, project, areaPath]);

  const fetchReleases = async () => {
    try {
      const response = await fetch(
        `/api/releases?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      
      if (!response.ok) {
        console.error('Failed to fetch releases:', response.status, response.statusText);
        setReleases([]);
        return;
      }
      
      const data = await response.json();
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setReleases(data);
        if (data.length > 0 && !selectedRelease) {
          setSelectedRelease(data[0]);
        }
      } else {
        console.error('Releases data is not an array:', data);
        setReleases([]);
      }
    } catch (error) {
      console.error('Error fetching releases:', error);
      setReleases([]);
    }
  };

  const fetchReleaseDetails = async (version: string) => {
    setLoading(true);
    try {
      // Fetch work items for this release
      const workItemsResponse = await fetch(
        `/api/releases/${encodeURIComponent(version)}/workitems?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      const workItemsData = await workItemsResponse.json();
      setReleaseWorkItems(workItemsData);

      // Fetch metrics for this release
      const metricsResponse = await fetch(
        `/api/releases/${encodeURIComponent(version)}/metrics?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
      );
      const metricsData = await metricsResponse.json();
      setReleaseMetrics(metricsData);

      // Fetch latest deployments
      const deploymentsResponse = await fetch(
        `/api/deployments/${encodeURIComponent(version)}/latest`
      );
      const deploymentsData = await deploymentsResponse.json();
      setLatestDeployments(deploymentsData);
    } catch (error) {
      console.error('Error fetching release details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeployment = async () => {
    if (!selectedRelease) return;

    try {
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseVersion: selectedRelease,
          environment: deploymentForm.environment,
          workItemIds: releaseWorkItems.map(wi => wi.id),
          notes: deploymentForm.notes,
        }),
      });

      if (response.ok) {
        setShowDeploymentModal(false);
        setDeploymentForm({ environment: 'dev', notes: '' });
        // Refresh release details
        fetchReleaseDetails(selectedRelease);
      }
    } catch (error) {
      console.error('Error creating deployment:', error);
    }
  };

  const handleCreateRelease = async () => {
    if (!newReleaseVersion) return;

    try {
      const response = await fetch(`/api/releases/${encodeURIComponent(newReleaseVersion)}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          areaPath,
          startDate: newReleaseStartDate || undefined,
          targetDate: newReleaseTargetDate || undefined,
          description: newReleaseDescription || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Release Epic created with ID: ${data.epicId}`);
        handleCloseModal();
        fetchReleases();
        fetchReleaseEpics();
      }
    } catch (error) {
      console.error('Error creating release:', error);
    }
  };

  const handleUpdateRelease = async () => {
    if (!newReleaseVersion || !editingEpicId) return;

    try {
      const response = await fetch(`/api/releases/${editingEpicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReleaseVersion,
          startDate: newReleaseStartDate || undefined,
          targetDate: newReleaseTargetDate || undefined,
          description: newReleaseDescription || undefined,
          status: newReleaseStatus,
          project,
          areaPath,
        }),
      });

      if (response.ok) {
        console.log(`Release Epic updated: ${editingEpicId}`);
        handleCloseModal();
        fetchReleaseEpics();
      }
    } catch (error) {
      console.error('Error updating release:', error);
    }
  };

  const handleOpenEditModal = (epic: any) => {
    setIsEditMode(true);
    setEditingEpicId(epic.id);
    setNewReleaseVersion(epic.version);
    setNewReleaseStartDate(epic.startDate || '');
    setNewReleaseTargetDate(epic.targetDate || '');
    setNewReleaseDescription(epic.description || '');
    setNewReleaseStatus(epic.status || 'New');
    setShowNewReleaseModal(true);
  };

  const handleCloseModal = () => {
    setShowNewReleaseModal(false);
    setIsEditMode(false);
    setEditingEpicId(null);
    setNewReleaseVersion('');
    setNewReleaseStartDate('');
    setNewReleaseTargetDate('');
    setNewReleaseDescription('');
    setNewReleaseStatus('New');
    setSelectedWorkItemsForRelease([]);
  };

  const handleOpenLinkItemsModal = (epicId: number) => {
    setLinkingEpicId(epicId);
    setShowLinkItemsModal(true);
    setSearchQuery('');
    setWorkItemTypeFilter('All');
    setSearchResults([]);
    setSelectedItemsToLink([]);
  };

  const handleCloseLinkItemsModal = () => {
    setShowLinkItemsModal(false);
    setLinkingEpicId(null);
    setSearchQuery('');
    setWorkItemTypeFilter('All');
    setSearchResults([]);
    setSelectedItemsToLink([]);
  };

  const handleLinkItems = async () => {
    if (!linkingEpicId || selectedItemsToLink.length === 0) return;

    try {
      const response = await fetch(`/api/releases/${linkingEpicId}/link-related`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemIds: selectedItemsToLink,
          project,
          areaPath,
        }),
      });

      if (response.ok) {
        console.log(`Linked ${selectedItemsToLink.length} items to epic ${linkingEpicId}`);
        handleCloseLinkItemsModal();
        fetchReleaseEpics(); // Refresh to update progress
      }
    } catch (error) {
      console.error('Error linking items:', error);
    }
  };

  const handleUnlinkItem = async (epicId: number, workItemId: number) => {
    if (!confirm('Are you sure you want to unlink this item from the release?')) {
      return;
    }

    try {
      const response = await fetch(`/api/releases/${epicId}/unlink-related`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemIds: [workItemId],
          project,
          areaPath,
        }),
      });

      if (response.ok) {
        console.log(`Unlinked item ${workItemId} from epic ${epicId}`);
        // Update local state to remove the item
        setChildItems(prev => {
          const next = new Map(prev);
          const items = next.get(epicId) || [];
          next.set(epicId, items.filter(item => item.id !== workItemId));
          return next;
        });
        // Refresh epic list to update progress counts
        fetchReleaseEpics();
      } else {
        const error = await response.json();
        alert(`Failed to unlink item: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error unlinking item:', error);
      alert('Failed to unlink item. Please try again.');
    }
  };

  const checkForUatReadyChildren = async (workItemId: number, workItemType: string) => {
    // Only check for Epics and Features
    if (workItemType !== 'Epic' && workItemType !== 'Feature') {
      return;
    }

    try {
      let endpoint = '';
      if (workItemType === 'Epic') {
        endpoint = `/api/epics/${workItemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
      } else if (workItemType === 'Feature') {
        endpoint = `/api/features/${workItemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const children = await response.json();
        // Check if any children are in UAT Ready for Test state
        const hasUatReady = children.some((child: WorkItem) => 
          child.state === 'UAT - Ready For Test' || 
          child.state === 'UAT Ready For Test' ||
          child.state === 'UAT-Ready For Test'
        );

        if (hasUatReady) {
          setItemsWithUatReadyChildren(prev => new Set(prev).add(workItemId));
        }
      }
    } catch (error) {
      console.error('Error checking for UAT-ready children:', error);
    }
  };

  const toggleNestedItemExpansion = async (itemId: number, workItemType: string) => {
    const newExpanded = new Set(expandedNestedItems);
    
    if (expandedNestedItems.has(itemId)) {
      // Collapse
      newExpanded.delete(itemId);
      setExpandedNestedItems(newExpanded);
    } else {
      // Expand
      newExpanded.add(itemId);
      setExpandedNestedItems(newExpanded);
      
      // Fetch children if not already loaded
      if (!nestedChildren.has(itemId)) {
        setLoadingNestedChildren(prev => new Set(prev).add(itemId));
        
        try {
          let endpoint = '';
          if (workItemType === 'Epic') {
            endpoint = `/api/epics/${itemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
          } else if (workItemType === 'Feature') {
            endpoint = `/api/features/${itemId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`;
          }
          
          const response = await fetch(endpoint);
          if (response.ok) {
            const children = await response.json();
            setNestedChildren(prev => new Map(prev).set(itemId, children));
          }
        } catch (error) {
          console.error('Error fetching nested children:', error);
        } finally {
          setLoadingNestedChildren(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      }
    }
  };

  const handleDeleteReleaseEpic = async () => {
    if (!deletingEpicId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/releases/${deletingEpicId}?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log(`Deleted epic ${deletingEpicId}`);
        setShowDeleteConfirmModal(false);
        setDeletingEpicId(null);
        fetchReleaseEpics(); // Refresh the list
      } else {
        const error = await response.json();
        console.error('Failed to delete epic:', error);
        alert(`Failed to delete epic: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting epic:', error);
      alert('Failed to delete epic. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleRowExpansion = async (epicId: number) => {
    const newExpandedRows = new Set(expandedRows);
    
    if (expandedRows.has(epicId)) {
      // Collapse row
      newExpandedRows.delete(epicId);
      setExpandedRows(newExpandedRows);
    } else {
      // Expand row
      newExpandedRows.add(epicId);
      setExpandedRows(newExpandedRows);
      
      // Fetch child items if not already loaded
      if (!childItems.has(epicId)) {
        // Add to loading state
        setLoadingChildren(prev => {
          const next = new Set(prev);
          next.add(epicId);
          return next;
        });
        
        try {
          console.log(`Fetching related items for epic ${epicId}`);
          const response = await fetch(
            `/api/releases/${epicId}/related-items?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`
          );
          
          if (response.ok) {
            const children = await response.json();
            console.log(`Received ${children.length} related items for epic ${epicId}`, children);
            
            // Update child items state
            setChildItems(prev => {
              const next = new Map(prev);
              next.set(epicId, children);
              return next;
            });
            
            // Check each child for UAT-ready descendants
            for (const child of children) {
              if (child.workItemType === 'Epic' || child.workItemType === 'Feature') {
                checkForUatReadyChildren(child.id, child.workItemType);
              }
            }
          } else {
            console.error(`Failed to fetch children: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error('Error fetching child items:', error);
        } finally {
          // Remove from loading state
          setLoadingChildren(prev => {
            const next = new Set(prev);
            next.delete(epicId);
            return next;
          });
        }
      }
    }
  };

  const getHealthStatus = (): 'on-track' | 'at-risk' | 'blocked' => {
    if (!releaseMetrics) return 'on-track';
    
    if (releaseMetrics.blockedFeatures > 0) return 'blocked';
    
    const completionPct = calculateCompletionPercentage();
    if (completionPct < 50 && releaseMetrics.inProgressFeatures < releaseMetrics.totalFeatures * 0.5) {
      return 'at-risk';
    }
    return 'on-track';
  };

  const calculateCompletionPercentage = (): number => {
    if (!releaseMetrics || releaseMetrics.totalFeatures === 0) return 0;
    return Math.round((releaseMetrics.completedFeatures / releaseMetrics.totalFeatures) * 100);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStateClass = (state: string): string => {
    const completedStates = ['Ready For Release', 'UAT - Test Done', 'Done', 'Closed'];
    const inProgressStates = ['Committed', 'In Progress', 'Ready For Test', 'In Test', 'UAT - Ready For Test'];
    const blockedStates = ['Blocked'];

    if (completedStates.includes(state)) return 'state-completed';
    if (inProgressStates.includes(state)) return 'state-in-progress';
    if (blockedStates.includes(state)) return 'state-blocked';
    return 'state-not-started';
  };

  const downloadReleaseNotes = async (format: 'json' | 'markdown') => {
    if (!selectedRelease) return;

    try {
      const response = await fetch(
        `/api/releases/${encodeURIComponent(selectedRelease)}/notes?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}&format=${format}`
      );
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `release-${selectedRelease}-notes.${format === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading release notes:', error);
    }
  };

  const availableFeatures = workItems.filter(
    wi => (wi.workItemType === 'Feature' || wi.workItemType === 'Epic') && 
    !wi.tags?.includes('Release:')
  );

  const healthStatus = getHealthStatus();
  const completionPercentage = calculateCompletionPercentage();

  return (
    <div className="release-view">
      <div className="release-header">
        <div className="release-header-top">
          <div className="header-title-wrapper">
            <h2>Release Management</h2>
            <div className="info-icon-wrapper">
              <div
                className="info-icon"
                onClick={() => setShowProgressInfo(!showProgressInfo)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
              </div>
              {showProgressInfo && (
                <div className="progress-info-tooltip">
                  <div className="tooltip-header">
                    <h4>Progress Calculation</h4>
                    <button 
                      className="btn-close-tooltip"
                      onClick={() => setShowProgressInfo(false)}
                    >
                      ✕
                    </button>
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
                      <strong>Example:</strong> If you have 2 items Done and 2 items In Progress out of 4 total items:<br/>
                      Progress = 2 completed / 4 total = 50%
                    </p>
                    <p className="tooltip-note">
                      This conservative approach ensures the progress bar accurately reflects release readiness.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="release-actions">
            <button 
              className="btn-create-release"
              onClick={() => setShowNewReleaseModal(true)}
            >
              + New Release
            </button>
          </div>
        </div>
      </div>

      {/* Release Epics Data Grid */}
      <div className="release-epics-grid">
        {loadingEpics ? (
          <div className="loading-message">Loading releases...</div>
        ) : releaseEpics.length === 0 ? (
          <div className="empty-message">No releases yet. Click "+ New Release" to create one.</div>
        ) : (
          <table className="epics-table">
            <thead>
              <tr>
                <th style={{width: '40px'}}></th>
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
              {releaseEpics.map((epic) => (
                <React.Fragment key={epic.id}>
                  <tr>
                    <td>
                      <button
                        className="btn-expand"
                        onClick={() => toggleRowExpansion(epic.id)}
                        title={expandedRows.has(epic.id) ? 'Collapse' : 'Expand'}
                      >
                        {expandedRows.has(epic.id) ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="version-cell">{epic.version}</td>
                  <td>
                    <span className={`status-badge status-${epic.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {epic.status}
                    </span>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${epic.progress}%` }}
                        ></div>
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
                      {epic.description && epic.description.length > 100 ? '...' : ''}
                    </div>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button 
                        className="btn-action-menu" 
                        onClick={() => setOpenActionMenuId(openActionMenuId === epic.id ? null : epic.id)}
                        title="Actions"
                      >
                        ⋯
                      </button>
                      {openActionMenuId === epic.id && (
                        <div className="action-dropdown">
                          <button 
                            className="action-menu-item"
                            onClick={() => {
                              handleOpenEditModal(epic);
                              setOpenActionMenuId(null);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="action-menu-item"
                            onClick={() => {
                              handleOpenLinkItemsModal(epic.id);
                              setOpenActionMenuId(null);
                            }}
                          >
                            🔗 Link Items
                          </button>
                          <button 
                            className="action-menu-item"
                            onClick={() => {
                              console.log('Create changelog for:', epic.id);
                              setOpenActionMenuId(null);
                            }}
                          >
                            📝 Create Changelog
                          </button>
                          <button 
                            className="action-menu-item"
                            onClick={() => {
                              setDeletingEpicId(epic.id);
                              setShowDeleteConfirmModal(true);
                              setOpenActionMenuId(null);
                            }}
                          >
                            🗑️ Delete
                          </button>
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
                            <div className="expanded-stats">
                              <div className="stat-badge">
                                <span className="stat-label">Progress</span>
                                <span className="stat-value">{epic.progress}%</span>
                              </div>
                            </div>
                          </div>
                          
                          {loadingChildren.has(epic.id) ? (
                            <div className="child-loading">
                              <div className="loading-spinner"></div>
                              <span>Loading work items...</span>
                            </div>
                          ) : childItems.get(epic.id)?.length === 0 ? (
                            <div className="child-empty">
                              <div className="empty-icon">📋</div>
                              <div className="empty-text">No items linked to this release yet</div>
                              <div className="empty-hint">Click "Link Items" to add work items to this release</div>
                            </div>
                          ) : (
                            <div className="child-items-grid">
                              {childItems.get(epic.id)?.map((item) => {
                                const stateClass = item.state.toLowerCase().replace(/\s+/g, '-');
                                const typeClass = item.workItemType.toLowerCase().replace(/\s+/g, '-');
                                const hasUatReadyChildren = itemsWithUatReadyChildren.has(item.id);
                                const isExpandable = item.workItemType === 'Epic' || item.workItemType === 'Feature';
                                const isExpanded = expandedNestedItems.has(item.id);
                                
                                return (
                                  <React.Fragment key={item.id}>
                                    <div 
                                      className={`child-item-card type-${typeClass}${hasUatReadyChildren ? ' has-uat-ready' : ''}${isExpanded ? ' expanded' : ''}`}
                                    >
                                      {isExpandable && (
                                        <button
                                          className="btn-expand-nested"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleNestedItemExpansion(item.id, item.workItemType);
                                          }}
                                          title={isExpanded ? "Collapse children" : "Expand to view children"}
                                        >
                                          <svg 
                                            width="20" 
                                            height="20" 
                                            viewBox="0 0 20 20" 
                                            fill="none" 
                                            className={`expand-icon${isExpanded ? ' expanded' : ''}`}
                                          >
                                            <path 
                                              d="M6 8L10 12L14 8" 
                                              stroke="currentColor" 
                                              strokeWidth="2" 
                                              strokeLinecap="round" 
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        </button>
                                      )}
                                      <div 
                                        className="child-item-content"
                                        onClick={() => onSelectItem && onSelectItem(item)}
                                        title="Click to view details"
                                      >
                                        <div className="child-item-header">
                                          <span className="child-item-id">#{item.id}</span>
                                          <span className={`child-item-type type-${typeClass}`}>
                                            {item.workItemType}
                                          </span>
                                          <span className={`child-item-state state-${stateClass}`}>
                                            {item.state}
                                          </span>
                                        </div>
                                        
                                        <div className="child-item-title" title={item.title}>
                                          {item.title}
                                        </div>
                                        
                                        <div className="child-item-footer">
                                          <div className="footer-left">
                                            {item.assignedTo ? (
                                              <div className="child-item-assignee">
                                                <span className="assignee-avatar">
                                                  {item.assignedTo.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                                </span>
                                                <span className="assignee-name">{item.assignedTo}</span>
                                              </div>
                                            ) : (
                                              <div className="child-item-unassigned">
                                                <span className="unassigned-icon">👤</span>
                                                <span className="unassigned-text">Unassigned</span>
                                              </div>
                                            )}
                                            
                                            {item.targetDate && (
                                              <div className="child-item-date">
                                                <span className="date-icon">📅</span>
                                                <span className="date-text">{new Date(item.targetDate).toLocaleDateString()}</span>
                                              </div>
                                            )}
                                          </div>
                                          
                                          <button
                                            className="btn-unlink-item"
                                            onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnlinkItem(epic.id, item.id);
                                          }}
                                          title="Unlink from release"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Nested children for Epic/Feature */}
                                    {isExpanded && (
                                      <div className="nested-children-container">
                                        {loadingNestedChildren.has(item.id) ? (
                                          <div className="nested-loading">
                                            <div className="loading-spinner"></div>
                                            <span>Loading child items...</span>
                                          </div>
                                        ) : nestedChildren.get(item.id)?.length === 0 ? (
                                          <div className="nested-empty">
                                            <span>No child items found</span>
                                          </div>
                                        ) : (
                                          <div className="nested-items-list">
                                            {nestedChildren.get(item.id)?.map((nestedItem) => {
                                              const nestedStateClass = nestedItem.state.toLowerCase().replace(/\s+/g, '-');
                                              const nestedTypeClass = nestedItem.workItemType.toLowerCase().replace(/\s+/g, '-');
                                              
                                              return (
                                                <div 
                                                  key={nestedItem.id} 
                                                  className={`nested-item type-${nestedTypeClass}`}
                                                  onClick={() => onSelectItem && onSelectItem(nestedItem)}
                                                  title="Click to view details"
                                                >
                                                  <div className="nested-item-main">
                                                    <div className="nested-item-id">#{nestedItem.id}</div>
                                                    <div className="nested-item-title">{nestedItem.title}</div>
                                                    <span className={`nested-item-type type-${nestedTypeClass}`}>
                                                      {nestedItem.workItemType}
                                                    </span>
                                                    <span className={`nested-item-state state-${nestedStateClass}`}>
                                                      {nestedItem.state}
                                                    </span>
                                                  </div>
                                                  {nestedItem.assignedTo && (
                                                    <div className="nested-item-assignee">
                                                      <span className="nested-assignee-avatar">
                                                        {nestedItem.assignedTo.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                                      </span>
                                                      <span className="nested-assignee-name">{nestedItem.assignedTo}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
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
                </React.Fragment>              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedRelease && !loading && (
        <>
          {/* Metrics Dashboard */}
          <div className="release-metrics">
            <div className="metric-card">
              <div className="metric-label">Total Features</div>
              <div className="metric-value">{releaseMetrics?.totalFeatures || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Completed</div>
              <div className="metric-value completed">{releaseMetrics?.completedFeatures || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">In Progress</div>
              <div className="metric-value in-progress">{releaseMetrics?.inProgressFeatures || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Blocked</div>
              <div className="metric-value blocked">{releaseMetrics?.blockedFeatures || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Ready for Release</div>
              <div className="metric-value ready">{releaseMetrics?.readyForReleaseFeatures || 0}</div>
            </div>
            <div className={`metric-card health-${healthStatus}`}>
              <div className="metric-label">Health</div>
              <div className="metric-value">{healthStatus.replace('-', ' ')}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="release-progress">
            <div className="progress-header">
              <span>Completion: {completionPercentage}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Deployment Status */}
          <div className="deployment-status">
            <h3>Deployment Status</h3>
            <div className="deployment-environments">
              <div className={`environment-card ${latestDeployments.dev ? 'deployed' : ''}`}>
                <div className="environment-name">Development</div>
                {latestDeployments.dev ? (
                  <>
                    <div className="deployment-info">
                      Deployed by: {latestDeployments.dev.deployedBy}
                    </div>
                    <div className="deployment-date">
                      {formatDate(latestDeployments.dev.deployedAt)}
                    </div>
                  </>
                ) : (
                  <div className="deployment-info">Not deployed</div>
                )}
              </div>
              <div className={`environment-card ${latestDeployments.staging ? 'deployed' : ''}`}>
                <div className="environment-name">Staging</div>
                {latestDeployments.staging ? (
                  <>
                    <div className="deployment-info">
                      Deployed by: {latestDeployments.staging.deployedBy}
                    </div>
                    <div className="deployment-date">
                      {formatDate(latestDeployments.staging.deployedAt)}
                    </div>
                  </>
                ) : (
                  <div className="deployment-info">Not deployed</div>
                )}
              </div>
              <div className={`environment-card ${latestDeployments.production ? 'deployed' : ''}`}>
                <div className="environment-name">Production</div>
                {latestDeployments.production ? (
                  <>
                    <div className="deployment-info">
                      Deployed by: {latestDeployments.production.deployedBy}
                    </div>
                    <div className="deployment-date">
                      {formatDate(latestDeployments.production.deployedAt)}
                    </div>
                  </>
                ) : (
                  <div className="deployment-info">Not deployed</div>
                )}
              </div>
            </div>
            <button 
              className="btn-deploy"
              onClick={() => setShowDeploymentModal(true)}
            >
              Record Deployment
            </button>
          </div>

          {/* Release Notes */}
          <div className="release-notes-section">
            <h3>Release Notes</h3>
            <div className="release-notes-actions">
              <button onClick={() => downloadReleaseNotes('markdown')}>
                Download Markdown
              </button>
              <button onClick={() => downloadReleaseNotes('json')}>
                Download JSON
              </button>
            </div>
          </div>

          {/* Work Items List */}
          <div className="release-work-items">
            <h3>Features & Epics ({releaseWorkItems.length})</h3>
            <div className="work-items-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>State</th>
                    <th>Assigned To</th>
                    <th>Target Date</th>
                  </tr>
                </thead>
                <tbody>
                  {releaseWorkItems.map((wi) => (
                    <tr 
                      key={wi.id}
                      onClick={() => onSelectItem && onSelectItem(wi)}
                      className="clickable-row"
                    >
                      <td>{wi.id}</td>
                      <td>{wi.workItemType}</td>
                      <td>{wi.title}</td>
                      <td>
                        <span className={`state-badge ${getStateClass(wi.state)}`}>
                          {wi.state}
                        </span>
                      </td>
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

      {loading && (
        <div className="loading-message">Loading release details...</div>
      )}

      {/* Deployment Modal */}
      {showDeploymentModal && (
        <div className="modal-overlay" onClick={() => setShowDeploymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Record Deployment</h3>
            <div className="form-group">
              <label>Environment:</label>
              <select
                value={deploymentForm.environment}
                onChange={(e) => setDeploymentForm({
                  ...deploymentForm,
                  environment: e.target.value as DeploymentEnvironment
                })}
              >
                <option value="dev">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes (optional):</label>
              <textarea
                value={deploymentForm.notes}
                onChange={(e) => setDeploymentForm({
                  ...deploymentForm,
                  notes: e.target.value
                })}
                placeholder="Deployment notes..."
                rows={4}
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleCreateDeployment} className="btn-primary">
                Create Deployment
              </button>
              <button onClick={() => setShowDeploymentModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Release Modal */}
      {showNewReleaseModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{isEditMode ? 'Edit Release' : 'Create New Release'}</h3>
            {isEditMode && (
              <div className="form-group">
                <label>Status:</label>
                <select
                  value={newReleaseStatus}
                  onChange={(e) => setNewReleaseStatus(e.target.value)}
                  className="status-select"
                >
                  <option value="New">New</option>
                  <option value="In Progress">In Progress</option>
                  <option value="In Design">In Design</option>
                  <option value="Done">Done</option>
                  <option value="Removed">Removed</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Release Name: <span style={{color: 'red'}}>*</span></label>
              <input
                type="text"
                value={newReleaseVersion}
                onChange={(e) => setNewReleaseVersion(e.target.value)}
                placeholder="e.g., v1.0.0, 2024-Q1"
                required
                disabled={isEditMode}
              />
            </div>
            <div className="form-group">
              <label>Start Date: <span style={{color: 'red'}}>*</span></label>
              <input
                type="date"
                value={newReleaseStartDate}
                onChange={(e) => setNewReleaseStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Target Date: <span style={{color: 'red'}}>*</span></label>
              <input
                type="date"
                value={newReleaseTargetDate}
                onChange={(e) => setNewReleaseTargetDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Description: <span style={{color: 'red'}}>*</span></label>
              <textarea
                value={newReleaseDescription}
                onChange={(e) => setNewReleaseDescription(e.target.value)}
                placeholder="Release description..."
                rows={4}
                required
              />
            </div>
            <div className="modal-actions">
              <button 
                onClick={isEditMode ? handleUpdateRelease : handleCreateRelease} 
                className="btn-primary"
                disabled={!newReleaseVersion || !newReleaseStartDate || !newReleaseTargetDate || !newReleaseDescription}
              >
                {isEditMode ? 'Update Release' : 'Create Release'}
              </button>
              <button onClick={handleCloseModal} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Link Items Modal */}
      {showLinkItemsModal && (
        <div className="modal-overlay" onClick={handleCloseLinkItemsModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>Link Items to Release</h3>
            
            <div className="search-section">
              <div className="search-filters">
                <div className="form-group">
                  <label>Search:</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, title, or keyword..."
                    className="search-input"
                  />
                </div>
                <div className="form-group">
                  <label>Type:</label>
                  <select
                    value={workItemTypeFilter}
                    onChange={(e) => setWorkItemTypeFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="All">All Types</option>
                    <option value="Epic">Epic</option>
                    <option value="Feature">Feature</option>
                    <option value="Product Backlog Item">Product Backlog Item</option>
                    <option value="Technical Backlog Item">Technical Backlog Item</option>
                    <option value="Bug">Bug</option>
                  </select>
                </div>
              </div>

              <div className="search-results">
                {searchLoading ? (
                  <div className="search-loading">Searching...</div>
                ) : searchQuery.length < 2 ? (
                  <div className="search-hint">Enter at least 2 characters to search</div>
                ) : searchResults.length === 0 ? (
                  <div className="search-hint">No items found</div>
                ) : (
                  <div className="results-list">
                    <div className="results-header">
                      <span>{searchResults.length} items found</span>
                      <button
                        className="btn-select-all"
                        onClick={() => {
                          if (selectedItemsToLink.length === searchResults.length) {
                            setSelectedItemsToLink([]);
                          } else {
                            setSelectedItemsToLink(searchResults.map(wi => wi.id));
                          }
                        }}
                      >
                        {selectedItemsToLink.length === searchResults.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {searchResults.map((item) => (
                      <div key={item.id} className="result-item">
                        <input
                          type="checkbox"
                          checked={selectedItemsToLink.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemsToLink([...selectedItemsToLink, item.id]);
                            } else {
                              setSelectedItemsToLink(selectedItemsToLink.filter(id => id !== item.id));
                            }
                          }}
                        />
                        <div className="result-item-details">
                          <div className="result-item-header">
                            <span className="result-item-id">#{item.id}</span>
                            <span className="result-item-type">{item.workItemType}</span>
                            <span className={`result-item-state state-${item.state.toLowerCase().replace(/\s+/g, '-')}`}>
                              {item.state}
                            </span>
                          </div>
                          <div className="result-item-title">{item.title}</div>
                          {item.assignedTo && (
                            <div className="result-item-assigned">Assigned to: {item.assignedTo}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={handleLinkItems} 
                className="btn-primary"
                disabled={selectedItemsToLink.length === 0}
              >
                Link {selectedItemsToLink.length} Item{selectedItemsToLink.length !== 1 ? 's' : ''}
              </button>
              <button onClick={handleCloseLinkItemsModal} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && deletingEpicId && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete Release Epic</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirmModal(false)} disabled={isDeleting}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-icon-danger">🗑️</div>
              <p className="modal-message">
                Are you sure you want to delete this release epic?
              </p>
              <div className="modal-epic-info-delete">
                <span className="modal-epic-version">
                  {releaseEpics.find(e => e.id === deletingEpicId)?.version}
                </span>
                <span className="modal-epic-id">
                  #{deletingEpicId}
                </span>
              </div>
              <div className="modal-warning-danger">
                ⚠️ <strong>Warning:</strong> This will permanently delete the epic and remove all hierarchical relationships with child work items. The child work items themselves will NOT be deleted, only the links to this epic.
              </div>
              <div className="modal-info">
                ℹ️ This action cannot be undone.
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn modal-btn-cancel" 
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="modal-btn modal-btn-danger" 
                onClick={handleDeleteReleaseEpic}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Epic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReleaseView;
