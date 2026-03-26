import { useState, useMemo, useEffect } from 'react';
import { WorkItem, QACycleTimeStats, UATCycleTimeStats, UATSittingItem } from '../types/workitem';
import './DevStats.css';

interface QAMetricsProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
  onSelectItem?: (item: WorkItem) => void;
}

const QA_CYCLE_DATA_KEY      = 'qaMetricsCycleData';
const QA_CYCLE_LOADING_KEY   = 'qaMetricsCycleLoading';
const UAT_CYCLE_DATA_KEY     = 'qaMetricsUATCycleData';
const UAT_CYCLE_LOADING_KEY  = 'qaMetricsUATCycleLoading';
const UAT_SITTING_DATA_KEY   = 'qaMetricsUATSittingData';
const UAT_SITTING_LOADING_KEY = 'qaMetricsUATSittingLoading';
const QA_METRICS_FILTER_KEY  = 'qaMetricsFilters';
const QA_METRICS_SESSION_KEY = 'qaMetricsSessionInitialized';

const checkAndClearOnRefresh = () => {
  const wasInitialized = sessionStorage.getItem(QA_METRICS_SESSION_KEY);
  if (!wasInitialized) {
    [
      QA_CYCLE_DATA_KEY, QA_CYCLE_LOADING_KEY,
      UAT_CYCLE_DATA_KEY, UAT_CYCLE_LOADING_KEY,
      UAT_SITTING_DATA_KEY, UAT_SITTING_LOADING_KEY,
      QA_METRICS_FILTER_KEY,
    ].forEach(k => sessionStorage.removeItem(k));
    sessionStorage.setItem(QA_METRICS_SESSION_KEY, 'true');
    return true;
  }
  return false;
};

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
  </svg>
);

const cycleBadgeClass = (days: number) => days <= 1 ? 'low' : days <= 3 ? 'medium' : 'high';
const sittingBadgeClass = (days: number) => days <= 3 ? 'low' : days <= 7 ? 'medium' : 'high';

export const QAMetrics: React.FC<QAMetricsProps> = ({ workItems, onSelectItem }) => {
  const [isPageRefresh] = useState(() => checkAndClearOnRefresh());

  // ── QA Cycle Time state ──────────────────────────────────────────────────
  const [cycleStats, setCycleStats] = useState<QACycleTimeStats[]>(() => {
    if (isPageRefresh) return [];
    const saved = sessionStorage.getItem(QA_CYCLE_DATA_KEY);
    return saved ? JSON.parse(saved).stats : [];
  });
  const [cycleLoading, setCycleLoading] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(QA_CYCLE_LOADING_KEY);
    return saved ? JSON.parse(saved).loading : false;
  });
  const [cycleHasLoaded, setCycleHasLoaded] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(QA_CYCLE_DATA_KEY);
    return saved ? JSON.parse(saved).hasLoaded : false;
  });
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [showCycleNotif, setShowCycleNotif] = useState(false);
  const [cycleNotifMsg, setCycleNotifMsg] = useState('');
  const [isCycleCollapsed, setIsCycleCollapsed] = useState(true);
  const [showCycleInfo, setShowCycleInfo] = useState(false);

  // ── UAT Cycle Time state ─────────────────────────────────────────────────
  const [uatCycleStats, setUatCycleStats] = useState<UATCycleTimeStats[]>(() => {
    if (isPageRefresh) return [];
    const saved = sessionStorage.getItem(UAT_CYCLE_DATA_KEY);
    return saved ? JSON.parse(saved).stats : [];
  });
  const [uatCycleLoading, setUatCycleLoading] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(UAT_CYCLE_LOADING_KEY);
    return saved ? JSON.parse(saved).loading : false;
  });
  const [uatCycleHasLoaded, setUatCycleHasLoaded] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(UAT_CYCLE_DATA_KEY);
    return saved ? JSON.parse(saved).hasLoaded : false;
  });
  const [uatCycleError, setUatCycleError] = useState<string | null>(null);
  const [showUatCycleNotif, setShowUatCycleNotif] = useState(false);
  const [uatCycleNotifMsg, setUatCycleNotifMsg] = useState('');
  const [isUatCycleCollapsed, setIsUatCycleCollapsed] = useState(true);
  const [showUatCycleInfo, setShowUatCycleInfo] = useState(false);

  // ── UAT Sitting state ────────────────────────────────────────────────────
  const [uatSitting, setUatSitting] = useState<UATSittingItem[]>(() => {
    if (isPageRefresh) return [];
    const saved = sessionStorage.getItem(UAT_SITTING_DATA_KEY);
    return saved ? JSON.parse(saved).items : [];
  });
  const [uatSittingLoading, setUatSittingLoading] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(UAT_SITTING_LOADING_KEY);
    return saved ? JSON.parse(saved).loading : false;
  });
  const [uatSittingHasLoaded, setUatSittingHasLoaded] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(UAT_SITTING_DATA_KEY);
    return saved ? JSON.parse(saved).hasLoaded : false;
  });
  const [uatSittingError, setUatSittingError] = useState<string | null>(null);
  const [showUatSittingNotif, setShowUatSittingNotif] = useState(false);
  const [uatSittingNotifMsg, setUatSittingNotifMsg] = useState('');
  const [isUatSittingCollapsed, setIsUatSittingCollapsed] = useState(true);
  const [showUatSittingInfo, setShowUatSittingInfo] = useState(false);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [selectedMember, setSelectedMember] = useState<string>(() => {
    if (isPageRefresh) return 'all';
    const saved = sessionStorage.getItem(QA_METRICS_FILTER_KEY);
    return saved ? JSON.parse(saved).selectedMember : 'all';
  });
  const [timeFrame, setTimeFrame] = useState<string>(() => {
    if (isPageRefresh) return '30';
    const saved = sessionStorage.getItem(QA_METRICS_FILTER_KEY);
    return saved ? JSON.parse(saved).timeFrame : '30';
  });
  const [customFromDate, setCustomFromDate] = useState(() => {
    if (isPageRefresh) return '';
    const saved = sessionStorage.getItem(QA_METRICS_FILTER_KEY);
    return saved ? JSON.parse(saved).customFromDate : '';
  });
  const [customToDate, setCustomToDate] = useState(() => {
    if (isPageRefresh) return '';
    const saved = sessionStorage.getItem(QA_METRICS_FILTER_KEY);
    return saved ? JSON.parse(saved).customToDate : '';
  });
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const teams = [
    { id: 'all',           name: 'All Teams',         areaPath: '' },
    { id: 'maxview-qa',    name: 'MaxView - QA',       teamName: 'MaxView - QA',       project: 'MaxView', areaPath: 'MaxView' },
    { id: 'maxview-dev',   name: 'MaxView - Dev',      teamName: 'MaxView - Dev',      project: 'MaxView', areaPath: 'MaxView' },
    { id: 'maxview-infra', name: 'MaxView Infra Team', teamName: 'MaxView Infra Team', project: 'MaxView', areaPath: 'MaxView\\MaxView Infra Team' },
    { id: 'mobile-dev',    name: 'Mobile - Dev',       teamName: 'Mobile - Dev',       project: 'MaxView', areaPath: 'MaxView\\Mobile - Team' },
  ];

  type NamedTeam = { id: string; name: string; teamName: string; project: string; areaPath: string };
  const namedTeams = teams.filter((t): t is NamedTeam => 'teamName' in t && 'project' in t);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (selectedTeam === 'all') {
        try {
          setLoadingMembers(true);
          const memberSet = new Set<string>();
          await Promise.allSettled(
            namedTeams.map(async (t) => {
              const params = new URLSearchParams({ project: t.project, teamName: t.teamName });
              const res = await fetch(`/api/team-members?${params.toString()}`, { credentials: 'include' });
              if (res.ok) {
                const members: string[] = await res.json();
                members.forEach(m => memberSet.add(m));
              }
            })
          );
          setAllTeamMembers(Array.from(memberSet).sort());
          setTeamMembers([]);
        } catch {
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
        const params = new URLSearchParams({ project: team.project, teamName: team.teamName });
        const response = await fetch(`/api/team-members?${params.toString()}`, { credentials: 'include' });
        if (response.ok) {
          setTeamMembers(await response.json());
          setAllTeamMembers([]);
        }
      } catch {
        setTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [selectedTeam]);

  useEffect(() => {
    sessionStorage.setItem(QA_METRICS_FILTER_KEY, JSON.stringify({
      selectedMember, timeFrame, customFromDate, customToDate,
    }));
  }, [selectedMember, timeFrame, customFromDate, customToDate]);

  const activeMemberSet = useMemo((): Set<string> | null => {
    const list = selectedTeam === 'all' ? allTeamMembers : teamMembers;
    return list.length > 0 ? new Set(list) : null;
  }, [selectedTeam, teamMembers, allTeamMembers]);

  const dropdownMembers = useMemo(() => {
    const base = selectedTeam === 'all' ? allTeamMembers : teamMembers;
    const memberSet = new Set(base);
    const combined = new Set<string>(base);
    if (memberSet.size > 0) {
      cycleStats.forEach(s => { if (memberSet.has(s.qaAssignee)) combined.add(s.qaAssignee); });
      uatCycleStats.forEach(s => { if (memberSet.has(s.assignee)) combined.add(s.assignee); });
    }
    return Array.from(combined).sort();
  }, [selectedTeam, allTeamMembers, teamMembers, cycleStats, uatCycleStats]);

  // Filtered data
  const filteredCycleStats = useMemo(() => {
    let stats = activeMemberSet ? cycleStats.filter(s => activeMemberSet.has(s.qaAssignee)) : cycleStats;
    if (selectedMember !== 'all') stats = stats.filter(s => s.qaAssignee === selectedMember);
    return stats;
  }, [cycleStats, selectedMember, activeMemberSet]);

  const filteredUatCycleStats = useMemo(() => {
    let stats = activeMemberSet ? uatCycleStats.filter(s => activeMemberSet.has(s.assignee)) : uatCycleStats;
    if (selectedMember !== 'all') stats = stats.filter(s => s.assignee === selectedMember);
    return stats;
  }, [uatCycleStats, selectedMember, activeMemberSet]);

  const filteredUatSitting = useMemo(() => {
    let items = activeMemberSet ? uatSitting.filter(i => activeMemberSet.has(i.assignedTo)) : uatSitting;
    if (selectedMember !== 'all') items = items.filter(i => i.assignedTo === selectedMember);
    return items;
  }, [uatSitting, selectedMember, activeMemberSet]);

  const isCustomDateInvalid = timeFrame === 'custom' && (!customFromDate || !customToDate);

  const buildDateRange = () => {
    if (timeFrame === 'custom') return { fromDate: customFromDate, toDate: customToDate };
    const from = new Date();
    from.setDate(from.getDate() - parseInt(timeFrame));
    return { fromDate: from.toISOString().split('T')[0], toDate: new Date().toISOString().split('T')[0] };
  };

  const selectedTeamDef = teams.find(t => t.id === selectedTeam);

  // ── Fetch functions ───────────────────────────────────────────────────────
  const fetchCycleTimeStats = async () => {
    setCycleLoading(true);
    setCycleError(null);
    setShowCycleNotif(true);
    setCycleNotifMsg('Loading QA cycle time statistics...');
    sessionStorage.setItem(QA_CYCLE_LOADING_KEY, JSON.stringify({ loading: true }));
    try {
      const { fromDate, toDate } = buildDateRange();
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (selectedMember !== 'all') params.append('qaAssignee', selectedMember);
      if (selectedTeamDef?.areaPath) params.append('areaPath', selectedTeamDef.areaPath);

      const res = await fetch(`/api/qa-cycle-time-stats?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch QA cycle time statistics');
      const data: QACycleTimeStats[] = await res.json();
      sessionStorage.setItem(QA_CYCLE_DATA_KEY, JSON.stringify({ stats: data, hasLoaded: true }));
      setCycleStats(data);
      setCycleHasLoaded(true);
      setCycleNotifMsg('QA cycle time statistics loaded successfully!');
      setTimeout(() => setShowCycleNotif(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setCycleError(msg);
      setCycleNotifMsg(`Error: ${msg}`);
    } finally {
      setCycleLoading(false);
      sessionStorage.setItem(QA_CYCLE_LOADING_KEY, JSON.stringify({ loading: false }));
    }
  };

  const fetchUATCycleTimeStats = async () => {
    setUatCycleLoading(true);
    setUatCycleError(null);
    setShowUatCycleNotif(true);
    setUatCycleNotifMsg('Loading UAT cycle time statistics...');
    sessionStorage.setItem(UAT_CYCLE_LOADING_KEY, JSON.stringify({ loading: true }));
    try {
      const { fromDate, toDate } = buildDateRange();
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (selectedMember !== 'all') params.append('assignee', selectedMember);
      if (selectedTeamDef?.areaPath) params.append('areaPath', selectedTeamDef.areaPath);

      const res = await fetch(`/api/uat-cycle-time-stats?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch UAT cycle time statistics');
      const data: UATCycleTimeStats[] = await res.json();
      sessionStorage.setItem(UAT_CYCLE_DATA_KEY, JSON.stringify({ stats: data, hasLoaded: true }));
      setUatCycleStats(data);
      setUatCycleHasLoaded(true);
      setUatCycleNotifMsg('UAT cycle time statistics loaded successfully!');
      setTimeout(() => setShowUatCycleNotif(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setUatCycleError(msg);
      setUatCycleNotifMsg(`Error: ${msg}`);
    } finally {
      setUatCycleLoading(false);
      sessionStorage.setItem(UAT_CYCLE_LOADING_KEY, JSON.stringify({ loading: false }));
    }
  };

  const fetchUATSittingStats = async () => {
    setUatSittingLoading(true);
    setUatSittingError(null);
    setShowUatSittingNotif(true);
    setUatSittingNotifMsg('Loading UAT sitting statistics...');
    sessionStorage.setItem(UAT_SITTING_LOADING_KEY, JSON.stringify({ loading: true }));
    try {
      const params = new URLSearchParams();
      if (selectedTeamDef?.areaPath) params.append('areaPath', selectedTeamDef.areaPath);

      const res = await fetch(`/api/uat-sitting-stats?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch UAT sitting statistics');
      const data: UATSittingItem[] = await res.json();
      sessionStorage.setItem(UAT_SITTING_DATA_KEY, JSON.stringify({ items: data, hasLoaded: true }));
      setUatSitting(data);
      setUatSittingHasLoaded(true);
      setUatSittingNotifMsg('UAT sitting statistics loaded successfully!');
      setTimeout(() => setShowUatSittingNotif(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setUatSittingError(msg);
      setUatSittingNotifMsg(`Error: ${msg}`);
    } finally {
      setUatSittingLoading(false);
      sessionStorage.setItem(UAT_SITTING_LOADING_KEY, JSON.stringify({ loading: false }));
    }
  };

  // ── Reusable sub-components ───────────────────────────────────────────────
  const SectionNotification = ({
    loading, show, message, error, onClose,
  }: { loading: boolean; show: boolean; message: string; error: string | null; onClose: () => void }) => {
    if (!show && !loading) return null;
    return (
      <div className={`background-notification ${loading ? 'loading' : error ? 'error' : 'success'}`}>
        {loading && <div className="notification-spinner"></div>}
        <span className="notification-text">{loading ? message : message}</span>
        {!loading && (
          <button className="notification-close" onClick={onClose} aria-label="Close notification">×</button>
        )}
      </div>
    );
  };

  return (
    <div className="dev-stats-container">
      <h2>QA Metrics</h2>

      {/* ── Filter Controls ─────────────────────────────────────────────── */}
      <div className="filter-controls">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="qa-team-filter">Team:</label>
            <select
              id="qa-team-filter"
              value={selectedTeam}
              onChange={(e) => { setSelectedTeam(e.target.value); setSelectedMember('all'); }}
              className="filter-select"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="qa-member-filter">Member:</label>
            <select
              id="qa-member-filter"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="filter-select"
              disabled={loadingMembers}
            >
              <option value="all">{selectedTeam === 'all' ? 'All Members' : 'All Team Members'}</option>
              {dropdownMembers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="qa-timeframe-filter">Time Frame:</label>
            <select
              id="qa-timeframe-filter"
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
              <label htmlFor="qa-from-date">From:</label>
              <input id="qa-from-date" type="date" value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)} className="filter-date-input" />
            </div>
            <div className="filter-group">
              <label htmlFor="qa-to-date">To:</label>
              <input id="qa-to-date" type="date" value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)} className="filter-date-input" />
            </div>
            {isCustomDateInvalid && (
              <span className="date-validation-error">Both From and To dates are required for custom range.</span>
            )}
          </div>
        )}
      </div>

      {/* ── QA Cycle Time Section ────────────────────────────────────────── */}
      <div className="stats-section">
        <h3>
          <button className="collapse-button" onClick={() => setIsCycleCollapsed(!isCycleCollapsed)}
            aria-label={isCycleCollapsed ? 'Expand section' : 'Collapse section'}>
            {isCycleCollapsed ? '▶' : '▼'}
          </button>
          QA Cycle Time (In Test → Done / UAT Ready)
          <div className="info-icon" onClick={() => setShowCycleInfo(!showCycleInfo)}
            role="button" aria-label="Show information about this section">
            <InfoIcon />
          </div>
        </h3>

        {showCycleInfo && (
          <div className="info-tooltip">
            <button className="info-close" onClick={() => setShowCycleInfo(false)} aria-label="Close">×</button>
            <p><strong>What this section shows:</strong><br />
              How long each QA member takes to move a work item from <strong>In Test</strong> to
              either <strong>Done</strong> or <strong>UAT - Ready For Test</strong>.</p>
            <p><strong>How to interpret:</strong><br />
              • <strong>Avg Cycle Time:</strong> Average days in &ldquo;In Test&rdquo; per item<br />
              • The date range applies to when the item <em>exited</em> In Test<br />
              • Items still in &ldquo;In Test&rdquo; are excluded until they exit</p>
          </div>
        )}

        {!isCycleCollapsed && (
          <div className="filter-actions">
            <button onClick={fetchCycleTimeStats} disabled={cycleLoading || isCustomDateInvalid}
              className="load-stats-button">
              {cycleLoading ? 'Loading...' : cycleHasLoaded ? 'Refresh QA Cycle Time' : 'Load QA Cycle Time'}
            </button>
          </div>
        )}

        {!isCycleCollapsed && (
          <SectionNotification loading={cycleLoading} show={showCycleNotif} message={cycleNotifMsg}
            error={cycleError} onClose={() => setShowCycleNotif(false)} />
        )}

        {!isCycleCollapsed && !cycleHasLoaded && !cycleLoading && (
          <p className="placeholder-text">Click &ldquo;Load QA Cycle Time&rdquo; to view how long each QA member spends in In Test.</p>
        )}
        {!isCycleCollapsed && cycleHasLoaded && !cycleLoading && filteredCycleStats.length === 0 && (
          <p className="placeholder-text">No QA cycle time data found for the selected filters.
            <br /><small style={{ color: 'var(--text-secondary)' }}>Total: {cycleStats.length}, Filtered: {filteredCycleStats.length}</small>
          </p>
        )}
        {!isCycleCollapsed && cycleHasLoaded && !cycleLoading && filteredCycleStats.length > 0 && (
          <div className="developer-stats-list">
            {filteredCycleStats.map((stats, index) => (
              <div key={index} className="developer-stat-card">
                <div className="developer-header">
                  <span className="developer-name">{stats.qaAssignee}</span>
                  <span className="total-changes">{stats.totalItems} {stats.totalItems === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="pr-time-summary">
                  <div className="pr-time-details">
                    <div className="pr-time-stat">
                      <span className="stat-label">Avg Cycle Time:</span>
                      <span className="stat-value">{stats.averageCycleTimeDays.toFixed(1)} days</span>
                    </div>
                    <div className="pr-time-stat">
                      <span className="stat-label">Total Days In Test:</span>
                      <span className="stat-value">{stats.totalCycleTimeDays.toFixed(1)} days</span>
                    </div>
                  </div>
                </div>
                {stats.workItemDetails.length > 0 && (
                  <details className="work-item-details">
                    <summary>View Work Items ({stats.workItemDetails.length})</summary>
                    <ul className="work-item-list">
                      {stats.workItemDetails.map((item, idx) => {
                        const full = workItems.find(wi => wi.id === item.id);
                        return (
                          <li key={idx} className={`work-item${onSelectItem && full ? ' clickable' : ''}`}
                            onClick={() => { if (onSelectItem && full) onSelectItem(full); }}
                            role={onSelectItem && full ? 'button' : undefined}
                            tabIndex={onSelectItem && full ? 0 : undefined}>
                            <span className="work-item-id">#{item.id}</span>
                            <span className="work-item-title">{item.title}</span>
                            <span className="work-item-dates">{item.enteredInTestDate} → {item.exitedInTestDate}</span>
                            <span className="work-item-pr-time">
                              <span className={`bug-count-badge ${cycleBadgeClass(item.cycleTimeDays)}`}>
                                {item.cycleTimeDays.toFixed(1)}d
                              </span>
                              <span style={{ marginLeft: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                → {item.exitState === 'UAT - Ready For Test' ? 'UAT Ready' : item.exitState}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── UAT Cycle Time Section ───────────────────────────────────────── */}
      <div className="stats-section">
        <h3>
          <button className="collapse-button" onClick={() => setIsUatCycleCollapsed(!isUatCycleCollapsed)}
            aria-label={isUatCycleCollapsed ? 'Expand section' : 'Collapse section'}>
            {isUatCycleCollapsed ? '▶' : '▼'}
          </button>
          UAT Cycle Time (UAT Ready For Test → UAT Test Done)
          <div className="info-icon" onClick={() => setShowUatCycleInfo(!showUatCycleInfo)}
            role="button" aria-label="Show information about this section">
            <InfoIcon />
          </div>
        </h3>

        {showUatCycleInfo && (
          <div className="info-tooltip">
            <button className="info-close" onClick={() => setShowUatCycleInfo(false)} aria-label="Close">×</button>
            <p><strong>What this section shows:</strong><br />
              How long each assignee takes to move a work item from <strong>UAT - Ready For Test</strong> to
              <strong> UAT - Test Done</strong>.</p>
            <p><strong>How to interpret:</strong><br />
              • <strong>Avg Cycle Time:</strong> Average days in &ldquo;UAT - Ready For Test&rdquo; per item<br />
              • The date range applies to when the item <em>exited</em> to UAT - Test Done<br />
              • Items still waiting in UAT are covered by the &ldquo;UAT Items Sitting&rdquo; section below</p>
          </div>
        )}

        {!isUatCycleCollapsed && (
          <div className="filter-actions">
            <button onClick={fetchUATCycleTimeStats} disabled={uatCycleLoading || isCustomDateInvalid}
              className="load-stats-button">
              {uatCycleLoading ? 'Loading...' : uatCycleHasLoaded ? 'Refresh UAT Cycle Time' : 'Load UAT Cycle Time'}
            </button>
          </div>
        )}

        {!isUatCycleCollapsed && (
          <SectionNotification loading={uatCycleLoading} show={showUatCycleNotif} message={uatCycleNotifMsg}
            error={uatCycleError} onClose={() => setShowUatCycleNotif(false)} />
        )}

        {!isUatCycleCollapsed && !uatCycleHasLoaded && !uatCycleLoading && (
          <p className="placeholder-text">Click &ldquo;Load UAT Cycle Time&rdquo; to view how long items spend in UAT testing.</p>
        )}
        {!isUatCycleCollapsed && uatCycleHasLoaded && !uatCycleLoading && filteredUatCycleStats.length === 0 && (
          <p className="placeholder-text">No UAT cycle time data found for the selected filters.
            <br /><small style={{ color: 'var(--text-secondary)' }}>Total: {uatCycleStats.length}, Filtered: {filteredUatCycleStats.length}</small>
          </p>
        )}
        {!isUatCycleCollapsed && uatCycleHasLoaded && !uatCycleLoading && filteredUatCycleStats.length > 0 && (
          <div className="developer-stats-list">
            {filteredUatCycleStats.map((stats, index) => (
              <div key={index} className="developer-stat-card">
                <div className="developer-header">
                  <span className="developer-name">{stats.assignee}</span>
                  <span className="total-changes">{stats.totalItems} {stats.totalItems === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="pr-time-summary">
                  <div className="pr-time-details">
                    <div className="pr-time-stat">
                      <span className="stat-label">Avg Cycle Time:</span>
                      <span className="stat-value">{stats.averageCycleTimeDays.toFixed(1)} days</span>
                    </div>
                    <div className="pr-time-stat">
                      <span className="stat-label">Total Days in UAT:</span>
                      <span className="stat-value">{stats.totalCycleTimeDays.toFixed(1)} days</span>
                    </div>
                  </div>
                </div>
                {stats.workItemDetails.length > 0 && (
                  <details className="work-item-details">
                    <summary>View Work Items ({stats.workItemDetails.length})</summary>
                    <ul className="work-item-list">
                      {stats.workItemDetails.map((item, idx) => {
                        const full = workItems.find(wi => wi.id === item.id);
                        return (
                          <li key={idx} className={`work-item${onSelectItem && full ? ' clickable' : ''}`}
                            onClick={() => { if (onSelectItem && full) onSelectItem(full); }}
                            role={onSelectItem && full ? 'button' : undefined}
                            tabIndex={onSelectItem && full ? 0 : undefined}>
                            <span className="work-item-id">#{item.id}</span>
                            <span className="work-item-title">{item.title}</span>
                            <span className="work-item-dates">{item.enteredUATReadyDate} → {item.exitedUATReadyDate}</span>
                            <span className="work-item-pr-time">
                              <span className={`bug-count-badge ${cycleBadgeClass(item.cycleTimeDays)}`}>
                                {item.cycleTimeDays.toFixed(1)}d
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── UAT Items Sitting Section ────────────────────────────────────── */}
      <div className="stats-section">
        <h3>
          <button className="collapse-button" onClick={() => setIsUatSittingCollapsed(!isUatSittingCollapsed)}
            aria-label={isUatSittingCollapsed ? 'Expand section' : 'Collapse section'}>
            {isUatSittingCollapsed ? '▶' : '▼'}
          </button>
          UAT Items Sitting in &ldquo;UAT - Ready For Test&rdquo;
          <div className="info-icon" onClick={() => setShowUatSittingInfo(!showUatSittingInfo)}
            role="button" aria-label="Show information about this section">
            <InfoIcon />
          </div>
        </h3>

        {showUatSittingInfo && (
          <div className="info-tooltip">
            <button className="info-close" onClick={() => setShowUatSittingInfo(false)} aria-label="Close">×</button>
            <p><strong>What this section shows:</strong><br />
              Work items <em>currently</em> in the <strong>UAT - Ready For Test</strong> state and how many days
              they have been waiting there.</p>
            <p><strong>How to interpret:</strong><br />
              • Items are sorted by longest wait first<br />
              • Badge colour: green ≤ 3 days, yellow ≤ 7 days, red &gt; 7 days<br />
              • This section ignores the Time Frame filter — it always shows the live current state<br />
              • The Team filter still applies via area path</p>
          </div>
        )}

        {!isUatSittingCollapsed && (
          <div className="filter-actions">
            <button onClick={fetchUATSittingStats} disabled={uatSittingLoading}
              className="load-stats-button">
              {uatSittingLoading ? 'Loading...' : uatSittingHasLoaded ? 'Refresh UAT Sitting' : 'Load UAT Sitting'}
            </button>
          </div>
        )}

        {!isUatSittingCollapsed && (
          <SectionNotification loading={uatSittingLoading} show={showUatSittingNotif} message={uatSittingNotifMsg}
            error={uatSittingError} onClose={() => setShowUatSittingNotif(false)} />
        )}

        {!isUatSittingCollapsed && !uatSittingHasLoaded && !uatSittingLoading && (
          <p className="placeholder-text">Click &ldquo;Load UAT Sitting&rdquo; to see which items are waiting in UAT - Ready For Test.</p>
        )}
        {!isUatSittingCollapsed && uatSittingHasLoaded && !uatSittingLoading && filteredUatSitting.length === 0 && (
          <p className="placeholder-text">No items currently sitting in UAT - Ready For Test for the selected filters.</p>
        )}
        {!isUatSittingCollapsed && uatSittingHasLoaded && !uatSittingLoading && filteredUatSitting.length > 0 && (() => {
          // Group items by assignedTo for per-member cards
          const byMember = new Map<string, UATSittingItem[]>();
          filteredUatSitting.forEach(item => {
            const key = item.assignedTo || 'Unassigned';
            if (!byMember.has(key)) byMember.set(key, []);
            byMember.get(key)!.push(item);
          });
          // Sort members by their longest-sitting item descending
          const sortedMembers = Array.from(byMember.entries()).sort(
            (a, b) => b[1][0].daysSitting - a[1][0].daysSitting
          );
          return (
            <div className="developer-stats-list">
              {sortedMembers.map(([member, items]) => (
                <div key={member} className="developer-stat-card">
                  <div className="developer-header">
                    <span className="developer-name">{member}</span>
                    <span className="total-changes">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className="pr-time-summary">
                    <div className="pr-time-details">
                      <div className="pr-time-stat">
                        <span className="stat-label">Longest Waiting:</span>
                        <span className="stat-value">{items[0].daysSitting.toFixed(1)} days</span>
                      </div>
                      <div className="pr-time-stat">
                        <span className="stat-label">Avg Wait:</span>
                        <span className="stat-value">
                          {(items.reduce((s, i) => s + i.daysSitting, 0) / items.length).toFixed(1)} days
                        </span>
                      </div>
                    </div>
                  </div>
                  <ul className="work-item-list" style={{ marginTop: '8px' }}>
                    {items.map((item, idx) => {
                      const full = workItems.find(wi => wi.id === item.id);
                      return (
                        <li key={idx} className={`work-item${onSelectItem && full ? ' clickable' : ''}`}
                          onClick={() => { if (onSelectItem && full) onSelectItem(full); }}
                          role={onSelectItem && full ? 'button' : undefined}
                          tabIndex={onSelectItem && full ? 0 : undefined}>
                          <span className="work-item-id">#{item.id}</span>
                          <span className="work-item-title">{item.title}</span>
                          <span className="work-item-dates">Since {item.enteredUATReadyDate}</span>
                          <span className="work-item-pr-time">
                            <span className={`bug-count-badge ${sittingBadgeClass(item.daysSitting)}`}>
                              {item.daysSitting.toFixed(1)}d
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
