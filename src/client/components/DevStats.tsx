import { WorkItem, DeveloperDueDateStats } from '../types/workitem';
import './DevStats.css';
import { useState, useMemo } from 'react';

interface DevStatsProps {
  workItems: WorkItem[];
}

export const DevStats: React.FC<DevStatsProps> = ({ workItems }) => {
  const [dueDateStats, setDueDateStats] = useState<DeveloperDueDateStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  
  // Filter states
  const [selectedDeveloper, setSelectedDeveloper] = useState<string>('all');
  const [timeFrame, setTimeFrame] = useState<string>('30');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Get unique developers from work items
  const developers = useMemo(() => {
    const devSet = new Set<string>();
    workItems.forEach(item => {
      if (item.assignedTo) {
        devSet.add(item.assignedTo);
      }
    });
    return Array.from(devSet).sort();
  }, [workItems]);

  const fetchDueDateStats = async () => {
    setLoading(true);
    setError(null);
    setShowNotification(true);
    setNotificationMessage('Loading statistics in background...');
    
    // Use setTimeout to ensure the loading state is shown before the async work begins
    setTimeout(async () => {
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
        
        const response = await fetch(`/api/due-date-stats?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch due date statistics');
        }
        const data = await response.json();
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
      }
    }, 100);
  };

  // Filter the results by developer if needed
  const filteredStats = useMemo(() => {
    if (selectedDeveloper === 'all') return dueDateStats;
    return dueDateStats.filter(stat => stat.developer === selectedDeveloper);
  }, [dueDateStats, selectedDeveloper]);

  return (
    <div className="dev-stats-container">
      <h2>Developer Statistics</h2>
      
      <div className="stats-section">
        <h3>Due Date Changes by Developer</h3>
        
        <div className="filter-controls">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="developer-filter">Developer:</label>
              <select 
                id="developer-filter"
                value={selectedDeveloper} 
                onChange={(e) => setSelectedDeveloper(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Developers</option>
                {developers.map(dev => (
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
          
          <div className="filter-actions">
            <button 
              onClick={fetchDueDateStats} 
              disabled={loading || (timeFrame === 'custom' && (!customFromDate || !customToDate))}
              className="load-stats-button"
            >
              {loading ? 'Loading...' : hasLoaded ? 'Refresh Statistics' : 'Load Statistics'}
            </button>
          </div>
        </div>
        
        {(showNotification || loading) && (
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
        
        {!hasLoaded && !loading && (
          <p className="placeholder-text">Select filters and click "Load Statistics" to view due date change statistics.</p>
        )}
        
        {hasLoaded && !loading && filteredStats.length === 0 && (
          <p className="placeholder-text">No due date changes found for the selected filters.</p>
        )}
        
        {hasLoaded && !loading && filteredStats.length > 0 && (
          <div className="developer-stats-list">
            {filteredStats.map((devStats, index) => (
              <div key={index} className="developer-stat-card">
                <div className="developer-header">
                  <span className="developer-name">{devStats.developer}</span>
                  <span className="total-changes">{devStats.totalChanges} changes</span>
                </div>
                
                <div className="reason-breakdown">
                  <h4>Reasons:</h4>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
