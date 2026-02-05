import { WorkItem, DeveloperDueDateStats, DueDateHitRateStats } from '../types/workitem';
import './DevStats.css';
import { useState, useMemo, useEffect, useRef } from 'react';

interface DevStatsProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
  onSelectItem?: (item: WorkItem) => void;
}

const LOADING_STATE_KEY = 'devStatsLoadingState';
const DATA_STATE_KEY = 'devStatsData';
const FILTER_STATE_KEY = 'devStatsFilters';
const HIT_RATE_DATA_KEY = 'devStatsHitRateData';
const HIT_RATE_LOADING_STATE_KEY = 'devStatsHitRateLoadingState';
const SESSION_INITIALIZED_KEY = 'devStatsSessionInitialized';

// Check for page refresh once - this runs before component render
const checkAndClearOnRefresh = () => {
  // If session was already initialized, this is a tab switch, not a page refresh
  const wasInitialized = sessionStorage.getItem(SESSION_INITIALIZED_KEY);
  
  if (!wasInitialized) {
    // First load or actual page refresh - clear everything
    console.log('DevStats - Page refresh/first load detected, clearing sessionStorage');
    sessionStorage.removeItem(DATA_STATE_KEY);
    sessionStorage.removeItem(LOADING_STATE_KEY);
    sessionStorage.removeItem(FILTER_STATE_KEY);
    sessionStorage.removeItem(HIT_RATE_DATA_KEY);
    sessionStorage.removeItem(HIT_RATE_LOADING_STATE_KEY);
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    return true;
  }
  
  console.log('DevStats - Tab navigation detected, restoring from sessionStorage');
  return false;
};

export const DevStats: React.FC<DevStatsProps> = ({ workItems, project, areaPath, onSelectItem }) => {
  const [isPageRefresh] = useState(() => checkAndClearOnRefresh());

  // Restore data from sessionStorage on mount
  const [dueDateStats, setDueDateStats] = useState<DeveloperDueDateStats[]>(() => {
    if (isPageRefresh) return [];
    const savedData = sessionStorage.getItem(DATA_STATE_KEY);
    return savedData ? JSON.parse(savedData).stats : [];
  });
  const [loading, setLoading] = useState(() => {
    if (isPageRefresh) return false;
    const savedLoading = sessionStorage.getItem(LOADING_STATE_KEY);
    return savedLoading ? JSON.parse(savedLoading).loading : false;
  });
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => {
    if (isPageRefresh) return false;
    const savedData = sessionStorage.getItem(DATA_STATE_KEY);
    return savedData ? JSON.parse(savedData).hasLoaded : false;
  });
  const [showNotification, setShowNotification] = useState(() => {
    if (isPageRefresh) return false;
    const savedLoading = sessionStorage.getItem(LOADING_STATE_KEY);
    return savedLoading ? JSON.parse(savedLoading).loading : false;
  });
  const [notificationMessage, setNotificationMessage] = useState(() => {
    if (isPageRefresh) return '';
    const savedLoading = sessionStorage.getItem(LOADING_STATE_KEY);
    return savedLoading ? 'Loading statistics in background...' : '';
  });
  
  // Due date hit rate state
  const [hitRateStats, setHitRateStats] = useState<DueDateHitRateStats[]>(() => {
    if (isPageRefresh) return [];
    const savedData = sessionStorage.getItem(HIT_RATE_DATA_KEY);
    return savedData ? JSON.parse(savedData).stats : [];
  });
  const [hitRateLoading, setHitRateLoading] = useState(() => {
    if (isPageRefresh) return false;
    const savedLoading = sessionStorage.getItem(HIT_RATE_LOADING_STATE_KEY);
    return savedLoading ? JSON.parse(savedLoading).loading : false;
  });
  const [hitRateHasLoaded, setHitRateHasLoaded] = useState(() => {
    if (isPageRefresh) return false;
    const savedData = sessionStorage.getItem(HIT_RATE_DATA_KEY);
    return savedData ? JSON.parse(savedData).hasLoaded : false;
  });
  const [hitRateError, setHitRateError] = useState<string | null>(null);
  const [showHitRateNotification, setShowHitRateNotification] = useState(() => {
    if (isPageRefresh) return false;
    const savedLoading = sessionStorage.getItem(HIT_RATE_LOADING_STATE_KEY);
    return savedLoading ? JSON.parse(savedLoading).loading : false;
  });
  const [hitRateNotificationMessage, setHitRateNotificationMessage] = useState(() => {
    if (isPageRefresh) return '';
    const savedLoading = sessionStorage.getItem(HIT_RATE_LOADING_STATE_KEY);
    return savedLoading ? 'Loading hit rate data in background...' : '';
  });
  
  // Info tooltip state
  const [showChangesInfo, setShowChangesInfo] = useState(false);
  const [showHitRateInfo, setShowHitRateInfo] = useState(false);
  
  // Collapse state for sections
  const [isChangesCollapsed, setIsChangesCollapsed] = useState(false);
  const [isHitRateCollapsed, setIsHitRateCollapsed] = useState(false);
  const [collapsedReasons, setCollapsedReasons] = useState<Set<string>>(new Set());
  const [collapsedHitRate, setCollapsedHitRate] = useState<Set<string>>(new Set());
  
  // Filter states - restore from sessionStorage
  const [selectedDeveloper, setSelectedDeveloper] = useState<string>(() => {
    if (isPageRefresh) return 'all';
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).selectedDeveloper : 'all';
  });
  const [timeFrame, setTimeFrame] = useState<string>(() => {
    if (isPageRefresh) return '30';
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).timeFrame : '30';
  });
  const [customFromDate, setCustomFromDate] = useState(() => {
    if (isPageRefresh) return '';
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).customFromDate : '';
  });
  const [customToDate, setCustomToDate] = useState(() => {
    if (isPageRefresh) return '';
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).customToDate : '';
  });

  // Get unique developers from stats data (not local workItems)
  const developers = useMemo(() => {
    if (dueDateStats.length === 0) return [];
    const devSet = new Set<string>();
    dueDateStats.forEach(stat => {
      devSet.add(stat.developer);
    });
    const devList = Array.from(devSet).sort();
    console.log('DevStats - Developers from stats:', devList);
    console.log('DevStats - Stats data:', dueDateStats);
    return devList;
  }, [dueDateStats]);

  // Team selection state
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allTeamMembers, setAllTeamMembers] = useState<string[]>([]);

  // Available teams
  const teams = [
    { id: 'all', name: 'All Teams' },
    { id: 'maxview-dev', name: 'MaxView - Dev', teamName: 'MaxView - Dev', project: 'MaxView' },
    { id: 'maxview-infra', name: 'MaxView Infra Team', teamName: 'MaxView Infra Team', project: 'MaxView' },
    { id: 'mobile-dev', name: 'Mobile - Dev', teamName: 'Mobile - Dev', project: 'MaxView' }
  ];

  // Fetch team members when team selection changes
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (selectedTeam === 'all') {
        // Fetch all team members from all dev teams
        try {
          setLoadingMembers(true);
          const response = await fetch('/api/dev-team-members', {
            credentials: 'include'
          });
          
          if (response.ok) {
            const members = await response.json();
            console.log(`DevStats - Loaded ${members.length} members from all teams:`, members);
            setAllTeamMembers(members);
            setTeamMembers([]);
          }
        } catch (error) {
          console.error('Error fetching all team members:', error);
          setAllTeamMembers([]);
        } finally {
          setLoadingMembers(false);
        }
        return;
      }

      const team = teams.find(t => t.id === selectedTeam);
      if (!team || !('teamName' in team) || !team.teamName || !team.project) return;

      try {
        setLoadingMembers(true);
        const params = new URLSearchParams();
        params.append('project', team.project);
        params.append('teamName', team.teamName);
        
        const response = await fetch(`/api/team-members?${params.toString()}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const members = await response.json();
          console.log(`DevStats - Loaded ${members.length} members for ${team.name}:`, members);
          setTeamMembers(members);
          setAllTeamMembers([]);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        setTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [selectedTeam]); // Run when team selection changes

  // Poll sessionStorage to sync loading state and data across navigation
  useEffect(() => {
    const checkState = () => {
      // Check loading state for due date changes
      const savedLoadingState = sessionStorage.getItem(LOADING_STATE_KEY);
      if (savedLoadingState) {
        const { loading: isLoading } = JSON.parse(savedLoadingState);
        if (isLoading && !loading) {
          setLoading(true);
          setShowNotification(true);
          setNotificationMessage('Loading statistics in background...');
        } else if (!isLoading && loading) {
          setLoading(false);
        }
      } else if (loading) {
        // If sessionStorage was cleared but we're still loading locally, sync it
        setLoading(false);
        setShowNotification(false);
      }

      // Check loading state for hit rate
      const savedHitRateLoadingState = sessionStorage.getItem(HIT_RATE_LOADING_STATE_KEY);
      if (savedHitRateLoadingState) {
        const { loading: isLoading } = JSON.parse(savedHitRateLoadingState);
        if (isLoading && !hitRateLoading) {
          setHitRateLoading(true);
          setShowHitRateNotification(true);
          setHitRateNotificationMessage('Loading hit rate statistics in background...');
        } else if (!isLoading && hitRateLoading) {
          setHitRateLoading(false);
        }
      } else if (hitRateLoading) {
        setHitRateLoading(false);
        setShowHitRateNotification(false);
      }

      // Check for data updates
      const savedData = sessionStorage.getItem(DATA_STATE_KEY);
      if (savedData) {
        const { stats, hasLoaded: dataHasLoaded } = JSON.parse(savedData);
        // Only update if the data has changed
        if (JSON.stringify(stats) !== JSON.stringify(dueDateStats)) {
          setDueDateStats(stats);
        }
        if (dataHasLoaded !== hasLoaded) {
          setHasLoaded(dataHasLoaded);
        }
      }

      // Check for hit rate data updates
      const savedHitRateData = sessionStorage.getItem(HIT_RATE_DATA_KEY);
      if (savedHitRateData) {
        const { stats, hasLoaded: dataHasLoaded } = JSON.parse(savedHitRateData);
        if (JSON.stringify(stats) !== JSON.stringify(hitRateStats)) {
          setHitRateStats(stats);
        }
        if (dataHasLoaded !== hitRateHasLoaded) {
          setHitRateHasLoaded(dataHasLoaded);
        }
      }
    };

    // Check immediately on mount
    checkState();

    // Poll every 500ms to detect changes
    const interval = setInterval(checkState, 500);

    return () => clearInterval(interval);
  }, [loading, dueDateStats, hasLoaded, hitRateLoading, hitRateStats, hitRateHasLoaded]);

  // Persist filter selections to sessionStorage whenever they change
  useEffect(() => {
    const filters = {
      selectedDeveloper,
      timeFrame,
      customFromDate,
      customToDate
    };
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filters));
  }, [selectedDeveloper, timeFrame, customFromDate, customToDate]);

  // Persist data and hasLoaded state to sessionStorage
  useEffect(() => {
    const data = {
      stats: dueDateStats,
      hasLoaded
    };
    sessionStorage.setItem(DATA_STATE_KEY, JSON.stringify(data));
  }, [dueDateStats, hasLoaded]);

  // Persist hit rate data to sessionStorage
  useEffect(() => {
    const data = {
      stats: hitRateStats,
      hasLoaded: hitRateHasLoaded
    };
    sessionStorage.setItem(HIT_RATE_DATA_KEY, JSON.stringify(data));
  }, [hitRateStats, hitRateHasLoaded]);

  const fetchDueDateStats = async () => {
    setLoading(true);
    setError(null);
    setShowNotification(true);
    setNotificationMessage('Loading statistics in background...');
    
    // Store loading state in sessionStorage
    sessionStorage.setItem(LOADING_STATE_KEY, JSON.stringify({ loading: true, timestamp: Date.now() }));
    
    try {
      // Calculate date range based on time frame
      let fromDate = '';
      let toDate = new Date().toISOString().split('T')[0];
      
      if (timeFrame === 'custom') {
        fromDate = customFromDate;
        toDate = customToDate;
      } else {
        const daysBack = parseInt(timeFrame);
        const from = new Date();
        from.setDate(from.getDate() - daysBack);
        fromDate = from.toISOString().split('T')[0];
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (selectedDeveloper !== 'all') params.append('developer', selectedDeveloper);
      // Note: project and areaPath are not sent - stats pull from hardcoded teams on server
      
      const response = await fetch(`/api/due-date-stats?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch due date statistics');
      }
      const data = await response.json();
      
      console.log('DevStats - API returned data:', {
        count: data.length,
        developers: data.map((s: any) => s.developer)
      });
      
      // Save to sessionStorage immediately (works even if component unmounts)
      sessionStorage.setItem(DATA_STATE_KEY, JSON.stringify({ 
        stats: data, 
        hasLoaded: true 
      }));
      
      // Update component state (only works if still mounted)
      setDueDateStats(data);
      setHasLoaded(true);
      setNotificationMessage('Statistics loaded successfully!');
      
      // Auto-hide success notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    } catch (err) {
      console.error('Error fetching due date stats:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setNotificationMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
      // Update loading state to false instead of removing
      sessionStorage.setItem(LOADING_STATE_KEY, JSON.stringify({ loading: false, timestamp: Date.now() }));
    }
  };

  const fetchDueDateHitRate = async () => {
    setHitRateLoading(true);
    setHitRateError(null);
    setShowHitRateNotification(true);
    setHitRateNotificationMessage('Loading hit rate statistics in background...');
    
    // Store loading state in sessionStorage
    sessionStorage.setItem(HIT_RATE_LOADING_STATE_KEY, JSON.stringify({ loading: true, timestamp: Date.now() }));
    
    try {
      // Calculate date range based on time frame
      let fromDate = '';
      let toDate = new Date().toISOString().split('T')[0];
      
      if (timeFrame === 'custom') {
        fromDate = customFromDate;
        toDate = customToDate;
      } else {
        const daysBack = parseInt(timeFrame);
        const from = new Date();
        from.setDate(from.getDate() - daysBack);
        fromDate = from.toISOString().split('T')[0];
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (selectedDeveloper !== 'all') params.append('developer', selectedDeveloper);
      
      const response = await fetch(`/api/due-date-hit-rate?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch due date hit rate statistics');
      }
      const data = await response.json();
      
      console.log('DevStats - Hit rate API returned data:', data);
      
      // Save to sessionStorage immediately (works even if component unmounts)
      sessionStorage.setItem(HIT_RATE_DATA_KEY, JSON.stringify({ 
        stats: data, 
        hasLoaded: true 
      }));
      
      // Update component state (only works if still mounted)
      setHitRateStats(data);
      setHitRateHasLoaded(true);
      setHitRateNotificationMessage('Hit rate statistics loaded successfully!');
      
      // Auto-hide success notification after 3 seconds
      setTimeout(() => {
        setShowHitRateNotification(false);
      }, 3000);
    } catch (err) {
      console.error('Error fetching due date hit rate stats:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setHitRateError(errorMsg);
      setHitRateNotificationMessage(`Error: ${errorMsg}`);
    } finally {
      setHitRateLoading(false);
      // Update loading state to false instead of removing
      sessionStorage.setItem(HIT_RATE_LOADING_STATE_KEY, JSON.stringify({ loading: false, timestamp: Date.now() }));
    }
  };

  // Filter the results by developer if needed, and by team if selected
  const filteredStats = useMemo(() => {
    let stats = dueDateStats;
    
    console.log('DevStats - Filtering:', {
      totalStats: dueDateStats.length,
      selectedTeam,
      teamMembersCount: teamMembers.length,
      allTeamMembersCount: allTeamMembers.length,
      selectedDeveloper
    });
    
    // Filter by team members if a specific team is selected
    if (selectedTeam !== 'all' && teamMembers.length > 0) {
      stats = stats.filter(stat => teamMembers.includes(stat.developer));
      console.log('DevStats - After team filter:', stats.length);
    } else if (selectedTeam === 'all' && allTeamMembers.length > 0) {
      // Filter by all team members when "All Teams" is selected
      stats = stats.filter(stat => allTeamMembers.includes(stat.developer));
      console.log('DevStats - After all teams filter:', stats.length);
    }
    
    // Further filter by specific developer if selected
    if (selectedDeveloper !== 'all') {
      stats = stats.filter(stat => stat.developer === selectedDeveloper);
      console.log('DevStats - After developer filter:', stats.length);
    }
    
    console.log('DevStats - Final filtered stats:', stats.length);
    return stats;
  }, [dueDateStats, selectedDeveloper, selectedTeam, teamMembers, allTeamMembers]);

  // Filter hit rate stats similarly
  const filteredHitRateStats = useMemo(() => {
    let stats = hitRateStats;
    
    // Filter by team members if a specific team is selected
    if (selectedTeam !== 'all' && teamMembers.length > 0) {
      stats = stats.filter(stat => teamMembers.includes(stat.developer));
    } else if (selectedTeam === 'all' && allTeamMembers.length > 0) {
      // Filter by all team members when "All Teams" is selected
      stats = stats.filter(stat => allTeamMembers.includes(stat.developer));
    }
    
    // Further filter by specific developer if selected
    if (selectedDeveloper !== 'all') {
      stats = stats.filter(stat => stat.developer === selectedDeveloper);
    }
    
    return stats;
  }, [hitRateStats, selectedDeveloper, selectedTeam, teamMembers, allTeamMembers]);

  return (
    <div className="dev-stats-container">
      <h2>Developer Statistics</h2>
      
      <div className="filter-controls">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="team-filter">Team:</label>
            <select 
              id="team-filter"
              value={selectedTeam} 
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setSelectedDeveloper('all'); // Reset developer filter when team changes
              }}
              className="filter-select"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="developer-filter">Developer:</label>
            <select 
              id="developer-filter"
              value={selectedDeveloper} 
              onChange={(e) => setSelectedDeveloper(e.target.value)}
              className="filter-select"
              disabled={loadingMembers}
            >
              <option value="all">
                {selectedTeam === 'all' ? 'All Developers' : 'All Team Members'}
              </option>
              {(selectedTeam === 'all' ? allTeamMembers : teamMembers).map(dev => (
                <option key={dev} value={dev}>{dev}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="timeframe-filter">Time Frame:</label>
            <select 
              id="timeframe-filter"
              value={timeFrame} 
              onChange={(e) => setTimeFrame(e.target.value)}
              className="filter-select"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>
        
        {timeFrame === 'custom' && (
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="from-date">From:</label>
              <input 
                id="from-date"
                type="date" 
                value={customFromDate} 
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="filter-input"
              />
            </div>
            
            <div className="filter-group">
              <label htmlFor="to-date">To:</label>
              <input 
                id="to-date"
                type="date" 
                value={customToDate} 
                onChange={(e) => setCustomToDate(e.target.value)}
                className="filter-input"
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="stats-section">
        <h3>          <button 
            className="collapse-button"
            onClick={() => setIsChangesCollapsed(!isChangesCollapsed)}
            aria-label={isChangesCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isChangesCollapsed ? '▶' : '▼'}
          </button>          Due Date Changes by Developer
          <div 
            className="info-icon" 
            onClick={() => setShowChangesInfo(!showChangesInfo)}
            role="button"
            aria-label="Show information about this section"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </div>
        </h3>
        
        {showChangesInfo && (
          <div className="info-tooltip">
            <button 
              className="info-close" 
              onClick={() => setShowChangesInfo(false)}
              aria-label="Close information"
            >
              ×
            </button>
            <p>
              <strong>What this section shows:</strong><br />
              Statistics on how often developers changed due dates on their work items. 
              Each time a due date is modified, it counts as a change and the reason is tracked.
            </p>
            <p>
              <strong>How to interpret:</strong><br />
              • <strong>Total Changes:</strong> Number of times the developer modified due dates<br />
              • <strong>Reasons:</strong> Breakdown of why due dates were changed
            </p>
          </div>
        )}
        
        {!isChangesCollapsed && (
          <div className="filter-actions">
            <button 
              onClick={fetchDueDateStats} 
              disabled={loading || (timeFrame === 'custom' && (!customFromDate || !customToDate))}
              className="load-stats-button"
            >
              {loading ? 'Loading...' : hasLoaded ? 'Refresh Statistics' : 'Load Statistics'}
            </button>
          </div>
        )}
        
        {!isChangesCollapsed && (showNotification || loading) && (
          <div className={`background-notification ${loading ? 'loading' : error ? 'error' : 'success'}`}>
            {loading && <div className="notification-spinner"></div>}
            <span className="notification-text">{loading ? 'Loading statistics in background...' : notificationMessage}</span>
            {!loading && (
              <button 
                className="notification-close" 
                onClick={() => setShowNotification(false)}
                aria-label="Close notification"
              >
                ×
              </button>
            )}
          </div>
        )}
        
        {!isChangesCollapsed && !hasLoaded && !loading && (
          <p className="placeholder-text">Select filters and click "Load Statistics" to view due date change statistics.</p>
        )}
        
        {!isChangesCollapsed && hasLoaded && !loading && filteredStats.length === 0 && (
          <p className="placeholder-text">No due date changes found for the selected filters.</p>
        )}
        
        {!isChangesCollapsed && hasLoaded && !loading && filteredStats.length > 0 && (
          <div className="developer-stats-list">
            {filteredStats.map((devStats, index) => {
              const devKey = `changes-${devStats.developer}`;
              const isCollapsed = collapsedReasons.has(devKey);
              
              return (
                <div key={index} className="developer-stat-card">
                  <div className="developer-header">
                    <span className="developer-name">{devStats.developer}</span>
                    <span className="total-changes">{devStats.totalChanges} changes</span>
                  </div>
                  
                  <div className="reason-breakdown">
                    <h4>
                      <button 
                        className="collapse-button-small"
                        onClick={() => {
                          const newSet = new Set(collapsedReasons);
                          if (isCollapsed) {
                            newSet.delete(devKey);
                          } else {
                            newSet.add(devKey);
                          }
                          setCollapsedReasons(newSet);
                        }}
                        aria-label={isCollapsed ? 'Expand reasons' : 'Collapse reasons'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                      Reasons:
                    </h4>
                    {!isCollapsed && (
                      <ul className="reason-list">
                        {Object.entries(devStats.reasonBreakdown)
                          .sort(([, a], [, b]) => b - a)
                          .map(([reason, count], idx) => (
                            <li key={idx} className="reason-item">
                              <span className="reason-text">{reason}</span>
                              <span className="reason-count">{count}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="stats-section">
        <h3>
          <button 
            className="collapse-button"
            onClick={() => setIsHitRateCollapsed(!isHitRateCollapsed)}
            aria-label={isHitRateCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isHitRateCollapsed ? '▶' : '▼'}
          </button>
          Due Date Hit Rate
          <div 
            className="info-icon" 
            onClick={() => setShowHitRateInfo(!showHitRateInfo)}
            role="button"
            aria-label="Show information about this section"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </div>
        </h3>
        
        {showHitRateInfo && (
          <div className="info-tooltip">
            <button 
              className="info-close" 
              onClick={() => setShowHitRateInfo(false)}
              aria-label="Close information"
            >
              ×
            </button>
            <p>
              <strong>What this section shows:</strong><br />
              Whether developers completed work items on or before their due dates without changing the due date.
            </p>
            <p>
              <strong>How to interpret:</strong><br />
              • <strong>No Changes (Hit):</strong> Work items that transitioned from working states (In Progress, Committed, In Pull Request) to completion 
              (Ready for Test, In Test, or Done) on or before the due date with no due date changes<br />
              • <strong>Missed Due Date:</strong> Work items that had due date changes OR completed after the due date<br />
              • <strong>Hit Rate %:</strong> Percentage of work items completed on time without date changes
            </p>
            <p>
              <strong>Note:</strong> Work items still in progress with future due dates and no changes are not counted 
              as hits or misses - they're included in total work items but are pending completion.
            </p>
          </div>
        )}
        
        {!isHitRateCollapsed && (
          <div className="filter-actions">
            <button 
              onClick={fetchDueDateHitRate} 
              disabled={hitRateLoading || (timeFrame === 'custom' && (!customFromDate || !customToDate))}
              className="load-stats-button"
            >
              {hitRateLoading ? 'Loading...' : hitRateHasLoaded ? 'Refresh Hit Rate' : 'Load Hit Rate'}
            </button>
          </div>
        )}
        
        {!isHitRateCollapsed && (showHitRateNotification || hitRateLoading) && (
          <div className={`background-notification ${hitRateLoading ? 'loading' : hitRateError ? 'error' : 'success'}`}>
            {hitRateLoading && <div className="notification-spinner"></div>}
            <span className="notification-text">{hitRateLoading ? 'Loading hit rate statistics in background...' : hitRateNotificationMessage}</span>
            {!hitRateLoading && (
              <button 
                className="notification-close" 
                onClick={() => setShowHitRateNotification(false)}
                aria-label="Close notification"
              >
                ×
              </button>
            )}
          </div>
        )}
        
        {!isHitRateCollapsed && !hitRateHasLoaded && !hitRateLoading && (
          <p className="placeholder-text">Click "Load Hit Rate" to view statistics on due date changes per developer.</p>
        )}
        
        {!isHitRateCollapsed && hitRateHasLoaded && !hitRateLoading && filteredHitRateStats.length === 0 && (
          <p className="placeholder-text">No work items with due dates found for the selected filters.</p>
        )}
        
        {!isHitRateCollapsed && hitRateHasLoaded && !hitRateLoading && filteredHitRateStats.length > 0 && (
          <div className="developer-stats-list">
            {filteredHitRateStats.map((stats, index) => {
              const devKey = `hitrate-${stats.developer}`;
              const isCollapsed = collapsedHitRate.has(devKey);
              
              return (
                <div key={index} className="developer-stat-card">
                  <div className="developer-header">
                    <span className="developer-name">{stats.developer}</span>
                    <span className="total-changes">{stats.totalWorkItems} work items</span>
                  </div>
                  
                  <div className="hit-rate-summary">
                    <div className="hit-rate-bar-container">
                      <div 
                        className="hit-rate-bar hit"
                        style={{ width: `${stats.hitRate}%` }}
                      >
                        {stats.hitRate > 15 && `${stats.hitRate.toFixed(1)}%`}
                      </div>
                      <div 
                        className="hit-rate-bar miss"
                        style={{ width: `${stats.missedDueDate > 0 ? ((stats.missedDueDate / (stats.hitDueDate + stats.missedDueDate)) * 100) : 0}%` }}
                      >
                        {((stats.missedDueDate / (stats.hitDueDate + stats.missedDueDate || 1)) * 100) > 15 && `${((stats.missedDueDate / (stats.hitDueDate + stats.missedDueDate)) * 100).toFixed(1)}%`}
                      </div>
                      <div 
                        className="hit-rate-bar in-progress"
                        style={{ width: `${100 - stats.hitRate - ((stats.missedDueDate / (stats.hitDueDate + stats.missedDueDate || 1)) * 100)}%` }}
                      >
                      </div>
                    </div>
                    
                    <div className="hit-rate-details">
                      <div className="hit-rate-stat">
                        <span className="stat-label hit">No Changes (Hit):</span>
                        <span className="stat-value">{stats.hitDueDate}</span>
                      </div>
                      <div className="hit-rate-stat">
                        <span className="stat-label miss">Missed Due Date:</span>
                        <span className="stat-value">{stats.missedDueDate}</span>
                      </div>
                    </div>
                  </div>
                  
                  {stats.workItemDetails.length > 0 && (
                    <details className="work-item-details">
                      <summary>View Work Items ({stats.workItemDetails.length})</summary>
                      <ul className="work-item-list">
                        {stats.workItemDetails.map((item, idx) => {
                          const fullWorkItem = workItems.find(wi => wi.id === item.id);
                          return (
                            <li 
                              key={idx} 
                              className={`work-item ${item.status}${onSelectItem && fullWorkItem ? ' clickable' : ''}`}
                              onClick={() => {
                                if (onSelectItem && fullWorkItem) {
                                  onSelectItem(fullWorkItem);
                                }
                              }}
                              role={onSelectItem && fullWorkItem ? 'button' : undefined}
                              tabIndex={onSelectItem && fullWorkItem ? 0 : undefined}
                            >
                              <span className="work-item-id">#{item.id}</span>
                              <span className="work-item-title">{item.title}</span>
                              <span className="work-item-dates">
                                Due: {item.dueDate} | 
                                {item.completionDate}
                              </span>
                              <span className={`work-item-status ${item.status}`}>
                                {item.status === 'hit' ? '✓ Hit' : item.status === 'in-progress' ? `⏳ ${item.completionDate}` : `✗ ${item.completionDate}`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
