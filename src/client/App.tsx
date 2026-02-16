import { useState, useMemo, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { startOfMonth, endOfMonth } from 'date-fns';
import { ScrumCalendar } from './components/ScrumCalendar';
import { UnscheduledList } from './components/UnscheduledList';
import { DetailsPanel } from './components/DetailsPanel';
import { CycleTimeAnalytics } from './components/CycleTimeAnalytics';
import { DevStats } from './components/DevStats';
import { RoadmapView } from './components/RoadmapView';
import ReleaseView from './components/ReleaseView';
import { CloudCost } from './components/CloudCost';
import { DueDateReasonModal } from './components/DueDateReasonModal';
import { Changelog } from './components/Changelog';
import { UserMenu } from './components/UserMenu';
import { Login } from './components/Login';
import { useWorkItems } from './hooks/useWorkItems';
import { WorkItem } from './types/workitem';
import './App.css';

// Current version - update this when releasing new versions
const CURRENT_VERSION = '1.9.0';

interface DueDateChange {
  workItemId: number;
  workItemTitle: string;
  oldDueDate: string | null;
  newDueDate: string | null;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'planning' | 'cloudcost'>('calendar');
  const [planningTab, setPlanningTab] = useState<'cycle-time' | 'dev-stats' | 'qa' | 'roadmap' | 'releases'>('cycle-time');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  const [showChangelog, setShowChangelog] = useState(false);
  const [hasUnreadChangelog, setHasUnreadChangelog] = useState(() => {
    const lastReadVersion = localStorage.getItem('lastReadChangelogVersion');
    const hasUnread = lastReadVersion !== CURRENT_VERSION;
    console.log('Changelog status:', { lastReadVersion, currentVersion: CURRENT_VERSION, hasUnread });
    return hasUnread;
  });

  // Parse available projects and area paths from environment (must be before any conditional returns)
  const { availableProjects, availableAreaPaths } = useMemo(() => {
    const teamsEnv = import.meta.env.VITE_TEAMS || 'MaxView|MaxView';
    console.log('VITE_TEAMS raw value:', teamsEnv);
    const projects = new Set<string>();
    const areaPaths = new Set<string>();

    teamsEnv.split('~~~').forEach((team: string) => {
      const [project, areaPath] = team.trim().split('|');
      console.log('Parsed team:', { project, areaPath });
      if (project) projects.add(project);
      // Keep the full area path including hierarchy
      if (areaPath) areaPaths.add(areaPath);
    });
    
    console.log('Available projects:', Array.from(projects));
    console.log('Available area paths:', Array.from(areaPaths));
    
    return {
      availableProjects: Array.from(projects).sort(),
      availableAreaPaths: Array.from(areaPaths).sort()
    };
  }, []);

  // Selected project and area path (load from localStorage or defaults)
  const [selectedProject, setSelectedProject] = useState<string>(() => {
    const saved = localStorage.getItem('selectedProject');
    return saved || availableProjects[0] || 'MaxView';
  });
  
  const [selectedAreaPath, setSelectedAreaPath] = useState<string>(() => {
    const saved = localStorage.getItem('selectedAreaPath');
    return saved || availableAreaPaths[0] || 'MaxView';
  });
  
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const currentTeamRef = useRef({ project: selectedProject, areaPath: selectedAreaPath });
  const [isSaving, setIsSaving] = useState(false);
  
  // Track original due dates and pending changes
  const originalDueDates = useRef<Map<number, string | undefined>>(new Map());
  const [pendingDueDateChange, setPendingDueDateChange] = useState<DueDateChange | null>(null);

  const startDate = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const endDate = useMemo(() => endOfMonth(currentDate), [currentDate]);

  // Check authentication status on mount FIRST
  useEffect(() => {
    fetch('/auth/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(data.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  // Only fetch work items if authenticated
  const { workItems, loading, error, updateDueDate, refetch } = useWorkItems(
    startDate,
    endDate,
    selectedProject,
    selectedAreaPath,
    isAuthenticated === true // Only fetch if authenticated
  );

  useEffect(() => {
    localStorage.setItem('selectedProject', selectedProject);
  }, [selectedProject]);
  
  useEffect(() => {
    localStorage.setItem('selectedAreaPath', selectedAreaPath);
  }, [selectedAreaPath]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle team changes with loading state - must be after useWorkItems
  useEffect(() => {
    // Clear loading state only when data is loaded AND matches the selected team
    if (isChangingTeam && !loading) {
      // Update the current team ref to match what's displayed
      currentTeamRef.current = { project: selectedProject, areaPath: selectedAreaPath };
      setIsChangingTeam(false);
    }
  }, [isChangingTeam, loading, selectedProject, selectedAreaPath]);

  // Store original due dates when work items are loaded
  useEffect(() => {
    workItems.forEach((item) => {
      if (!originalDueDates.current.has(item.id)) {
        originalDueDates.current.set(item.id, item.dueDate);
      }
    });
  }, [workItems]);

  const scheduledItems = useMemo(
    () => workItems.filter((item) => item.dueDate || item.targetDate),
    [workItems]
  );

  const unscheduledItems = useMemo(
    () => workItems.filter((item) => !item.dueDate && !item.targetDate),
    [workItems]
  );

  // Keep selectedItem in sync with workItems
  useEffect(() => {
    if (selectedItem) {
      const updatedItem = workItems.find(item => item.id === selectedItem.id);
      if (updatedItem) {
        setSelectedItem(updatedItem);
      }
    }
  }, [workItems, selectedItem?.id]);

  // Show login page if not authenticated (after all hooks are called)
  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const isLoading = loading || isChangingTeam;

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleOpenChangelog = () => {
    setShowChangelog(true);
  };

  const handleMarkChangelogAsRead = () => {
    console.log('Marking changelog as read:', CURRENT_VERSION);
    localStorage.setItem('lastReadChangelogVersion', CURRENT_VERSION);
    setHasUnreadChangelog(false);
  };
  const handleLogout = async () => {
    try {
      // Call the logout endpoint which will destroy the session
      await fetch('/auth/logout', {
        credentials: 'include'
      });
      // Redirect to login page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, redirect to home which will show login
      window.location.href = '/';
    }
  };
  const handleFieldUpdate = async (id: number, field: string, value: any) => {
    console.log(`Updating work item ${id} field ${field} to:`, value);
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/workitems/${id}/field`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field, value, project: selectedProject, areaPath: selectedAreaPath }),
      });

      if (!response.ok) {
        console.error('Failed to update field');
        setIsSaving(false);
        return;
      }
      
      // Wait for ADO to process the change
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Trigger refetch and wait for it to complete
      if (refetch) {
        await refetch();
      }
      
      // Small additional delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setIsSaving(false);
    } catch (error) {
      console.error('Error updating field:', error);
      setIsSaving(false);
    }
  };

  const handleDueDateChange = (id: number, newDueDate: string | null, reason?: string) => {
    const workItem = workItems.find(item => item.id === id);
    if (!workItem) return;

    // Skip modal for Bugs, Features, and Epics - they use targetDate updated via onUpdateField
    const usesTargetDate = workItem.workItemType === 'Epic' || workItem.workItemType === 'Feature' || workItem.workItemType === 'Bug';
    if (usesTargetDate) {
      console.log('Work item uses targetDate, skipping due date change modal');
      return;
    }

    // Use the current due date from the work item, not the original
    const oldDueDate = workItem.dueDate || null;
    const newDateStr = newDueDate;
    
    console.log('=== handleDueDateChange ===' );
    console.log('Work Item ID:', id);
    console.log('Work Item Title:', workItem.title);
    console.log('Current Due Date (from workItem):', oldDueDate);
    console.log('New Due Date (parameter):', newDateStr);
    console.log('Reason:', reason);
    console.log('Original Due Date (from ref):', originalDueDates.current.get(id));
    
    // If both are null or the same, no change occurred
    if (oldDueDate === newDateStr) {
      console.log('Dates are the same, skipping modal');
      return;
    }

    // If reason is provided (from DetailsPanel), update directly without modal
    if (reason) {
      console.log('Reason provided, updating directly');
      originalDueDates.current.set(id, newDateStr || undefined);
      updateDueDate(id, newDateStr, reason);
      return;
    }

    // If there's a change and no reason, show the modal
    console.log('Setting pending due date change');
    setPendingDueDateChange({
      workItemId: id,
      workItemTitle: workItem.title,
      oldDueDate: oldDueDate,
      newDueDate: newDateStr,
    });
  };

  const handleConfirmDueDateChange = async (reason: string) => {
    if (!pendingDueDateChange) return;

    const { workItemId, newDueDate } = pendingDueDateChange;
    
    // Update the original due date reference
    originalDueDates.current.set(workItemId, newDueDate || undefined);
    
    // Perform the update with the reason
    await updateDueDate(workItemId, newDueDate, reason);
    
    // Clear the pending change and close modal
    setPendingDueDateChange(null);
  };

  const handleCancelDueDateChange = () => {
    setPendingDueDateChange(null);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner-container">
              <div className="spinner"></div>
              <p>Loading work items...</p>
            </div>
          </div>
        )}
        {isSaving && (
          <div className="saving-indicator">
            <div className="saving-content">
              <div className="saving-spinner"></div>
              <span>Saving...</span>
            </div>
          </div>
        )}
        <div className="app-header">
          <div className="view-switcher">
            <button 
              className={`view-btn ${currentView === 'calendar' ? 'active' : ''}`}
              onClick={() => setCurrentView('calendar')}
            >
              Calendar
            </button>
            <button 
              className={`view-btn ${currentView === 'planning' ? 'active' : ''}`}
              onClick={() => setCurrentView('planning')}
            >
              Planning
            </button>
            <button 
              className={`view-btn ${currentView === 'cloudcost' ? 'active' : ''}`}
              onClick={() => setCurrentView('cloudcost')}
            >
              Cloud Cost
            </button>
          </div>
          <div className="header-controls">
            <div className="selector-group">
              <label htmlFor="project-selector">Project:</label>
              <select 
                id="project-selector"
                className="team-selector"
                value={selectedProject}
                onChange={(e) => {
                  setIsChangingTeam(true);
                  setSelectedProject(e.target.value);
                }}
                disabled={isLoading}
              >
                {availableProjects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>
            <div className="selector-group">
              <label htmlFor="team-selector">Team:</label>
              <select 
                id="team-selector"
                className="team-selector"
                value={selectedAreaPath}
                onChange={(e) => {
                  setIsChangingTeam(true);
                  setSelectedAreaPath(e.target.value);
                }}
                disabled={isLoading}
              >
                {availableAreaPaths.map((areaPath) => {
                  // Display just the team name (last part after backslash)
                  const displayName = areaPath.includes('\\') 
                    ? areaPath.split('\\').pop() || areaPath
                    : areaPath;
                  return (
                    <option key={areaPath} value={areaPath}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>
            <UserMenu
              onOpenChangelog={handleOpenChangelog}
              onToggleTheme={toggleTheme}
              onLogout={handleLogout}
              theme={theme}
              hasUnreadChangelog={hasUnreadChangelog}
            />
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        
        {!isLoading && currentView === 'calendar' ? (
          <div className="calendar-view">
            <UnscheduledList
              workItems={unscheduledItems}
              onSelectItem={setSelectedItem}
              onUpdateDueDate={(id, dueDate) => {
                // Close details panel when dragging items
                setSelectedItem(null);
                handleDueDateChange(id, dueDate);
              }}
            />
            <ScrumCalendar
              workItems={scheduledItems}
              unscheduledItems={unscheduledItems}
              onUpdateDueDate={(id, dueDate) => {
                // Close details panel when dragging items
                setSelectedItem(null);
                handleDueDateChange(id, dueDate);
              }}
              onUpdateField={handleFieldUpdate}
              onSelectItem={setSelectedItem}
            />
            {selectedItem && (
              <DetailsPanel
                workItem={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdateDueDate={handleDueDateChange}
                allWorkItems={workItems}
                onUpdateField={handleFieldUpdate}
                isSaving={isSaving}
                project={selectedProject}
                areaPath={selectedAreaPath}
                onSelectItem={setSelectedItem}
              />
            )}
            {pendingDueDateChange && (
              <DueDateReasonModal
                workItemId={pendingDueDateChange.workItemId}
                workItemTitle={pendingDueDateChange.workItemTitle}
                oldDueDate={pendingDueDateChange.oldDueDate}
                newDueDate={pendingDueDateChange.newDueDate}
                onConfirm={handleConfirmDueDateChange}
                onCancel={handleCancelDueDateChange}
              />
            )}
          </div>
        ) : !isLoading && currentView === 'cloudcost' ? (
          <div className="cloudcost-view">
            <CloudCost 
              project={selectedProject}
              areaPath={selectedAreaPath}
            />
          </div>
        ) : !isLoading && (
          <div className="planning-view">
            <div className="planning-tabs">
              <button
                className={`tab-button ${planningTab === 'cycle-time' ? 'active' : ''}`}
                onClick={() => setPlanningTab('cycle-time')}
              >
                Cycle Time
              </button>
              <button
                className={`tab-button ${planningTab === 'dev-stats' ? 'active' : ''}`}
                onClick={() => setPlanningTab('dev-stats')}
              >
                Developer Stats
              </button>
              <button
                className={`tab-button ${planningTab === 'qa' ? 'active' : ''}`}
                onClick={() => setPlanningTab('qa')}
              >
                QA Metrics
              </button>
              <button
                className={`tab-button ${planningTab === 'roadmap' ? 'active' : ''}`}
                onClick={() => setPlanningTab('roadmap')}
              >
                Roadmap
              </button>
              <button
                className={`tab-button ${planningTab === 'releases' ? 'active' : ''}`}
                onClick={() => setPlanningTab('releases')}
              >
                Releases
              </button>
            </div>
            <div className="planning-content">
              {planningTab === 'cycle-time' ? (
                <CycleTimeAnalytics 
                  workItems={workItems}
                  project={selectedProject}
                  areaPath={selectedAreaPath}
                />
              ) : planningTab === 'dev-stats' ? (
                <DevStats 
                  workItems={workItems}
                  project={selectedProject}
                  areaPath={selectedAreaPath}
                  onSelectItem={setSelectedItem}
                />
              ) : planningTab === 'qa' ? (
                <div style={{ padding: '24px' }}>
                  <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', color: 'var(--text-primary)', fontWeight: '600' }}>QA Metrics</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Coming soon...</p>
                </div>
              ) : planningTab === 'roadmap' ? (
                <RoadmapView 
                  workItems={workItems}
                  project={selectedProject}
                  areaPath={selectedAreaPath}
                  onSelectItem={setSelectedItem}
                />
              ) : planningTab === 'releases' ? (
                <ReleaseView 
                  workItems={workItems}
                  project={selectedProject}
                  areaPath={selectedAreaPath}
                  onSelectItem={setSelectedItem}
                />
              ) : null}
            </div>
            {selectedItem && currentView === 'planning' && (
              <DetailsPanel
                workItem={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdateDueDate={handleDueDateChange}
                allWorkItems={workItems}
                onUpdateField={handleFieldUpdate}
                isSaving={isSaving}
                project={selectedProject}
                areaPath={selectedAreaPath}
                onSelectItem={setSelectedItem}
              />
            )}
          </div>
        )}
      </div>
      <Changelog 
        isOpen={showChangelog}
        onClose={() => setShowChangelog(false)}
        onMarkAsRead={handleMarkChangelogAsRead}
      />
    </DndProvider>
  );
}

export default App;
