import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WorkItem } from '../types/workitem';
import { workItemService } from '../services/workItemService';
import './CycleTimeAnalytics.css';

interface CycleTimeAnalyticsProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
}

export interface CycleTimeData {
  id: number;
  title: string;
  assignedTo?: string;
  iterationPath: string;
  state: string;
  developer?: string;
  cycleTimeDays?: number;
  inProgressDate?: string;
  qaReadyDate?: string;
  qaTester?: string;
  uatReadyDate?: string;
  qaCycleTimeDays?: number;
}

export const CycleTimeAnalytics: React.FC<CycleTimeAnalyticsProps> = ({ workItems, project, areaPath }) => {
  const [selectedIterations, setSelectedIterations] = useState<string[]>([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState<string>('');
  const [selectedQa, setSelectedQa] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showDevSection, setShowDevSection] = useState(true);
  const [showQaSection, setShowQaSection] = useState(true);
  const [queryEnabled, setQueryEnabled] = useState(false);

  // Stable query key derived from user-selected iterations
  const iterationsKey = useMemo(
    () => [...selectedIterations].sort().join(','),
    [selectedIterations]
  );

  const filteredWorkItemIds = useMemo(
    () => workItems.filter(item => selectedIterations.includes(item.iterationPath)).map(item => item.id),
    [workItems, selectedIterations]
  );

  const {
    data: cycleTimeMap = {},
    isFetching: loading,
    isSuccess: hasLoaded,
    refetch,
  } = useQuery<Record<number, any>>({
    queryKey: ['cycleTime', project, areaPath, iterationsKey],
    queryFn: () => workItemService.calculateCycleTime(filteredWorkItemIds, project, areaPath),
    enabled: queryEnabled && filteredWorkItemIds.length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  // Extract unique iterations from work items
  const availableIterations = useMemo(() => {
    const iterations = new Set<string>();
    workItems.forEach(item => {
      if (item.iterationPath) {
        iterations.add(item.iterationPath);
      }
    });
    return Array.from(iterations).sort();
  }, [workItems]);

  // Extract unique developers from cycle time data
  const availableDevelopers = useMemo(() => {
    const developers = new Set<string>();
    Object.values(cycleTimeMap).forEach((data: any) => {
      if (data?.assignedTo) {
        developers.add(data.assignedTo);
      }
    });
    return Array.from(developers).sort();
  }, [cycleTimeMap]);

  // Extract unique QA testers from cycle time data
  const availableQaTesters = useMemo(() => {
    const testers = new Set<string>();
    Object.values(cycleTimeMap).forEach((data: any) => {
      if (data?.qaAssignedTo) {
        testers.add(data.qaAssignedTo);
      }
    });
    return Array.from(testers).sort();
  }, [cycleTimeMap]);

  // Auto-select first iteration on load
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (availableIterations.length > 0 && selectedIterations.length === 0) {
      setSelectedIterations([availableIterations[0]]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableIterations]);

  const toggleIteration = (iteration: string) => {
    setSelectedIterations(prev => 
      prev.includes(iteration)
        ? prev.filter(i => i !== iteration)
        : [...prev, iteration]
    );
  };

  const selectAll = () => {
    setSelectedIterations(availableIterations);
  };

  const clearAll = () => {
    setSelectedIterations([]);
  };

  const handleCalculateCycleTime = () => {
    if (selectedIterations.length === 0) {
      setError('Please select at least one iteration');
      return;
    }
    setError(null);
    setShowNotification(true);
    setNotificationMessage('Loading cycle time data in background...');
    setQueryEnabled(true);
    refetch().then(() => {
      setNotificationMessage('Cycle time data loaded successfully!');
    }).catch((err: any) => {
      setError(err.message || 'Failed to calculate cycle time');
      setNotificationMessage('Failed to load cycle time data');
    });
  };

  // Get all dev cycle time data (unfiltered for visibility check)
  const allDevCycleTimeData = useMemo(() => {
    const filteredItems = workItems.filter(item => 
      selectedIterations.includes(item.iterationPath) &&
      cycleTimeMap[item.id]?.cycleTimeDays !== undefined
    );

    return filteredItems.map(item => ({
      id: item.id,
      title: item.title,
      assignedTo: item.assignedTo,
      iterationPath: item.iterationPath,
      state: item.state,
      developer: cycleTimeMap[item.id].assignedTo,
      cycleTimeDays: cycleTimeMap[item.id].cycleTimeDays,
      inProgressDate: cycleTimeMap[item.id].inProgressDate,
      qaReadyDate: cycleTimeMap[item.id].qaReadyDate,
      qaTester: cycleTimeMap[item.id].qaAssignedTo,
      uatReadyDate: cycleTimeMap[item.id].uatReadyDate,
      qaCycleTimeDays: cycleTimeMap[item.id].qaCycleTimeDays,
    })).sort((a, b) => {
      if (!a.qaReadyDate || !b.qaReadyDate) return 0;
      return new Date(b.qaReadyDate).getTime() - new Date(a.qaReadyDate).getTime();
    });
  }, [workItems, selectedIterations, cycleTimeMap]);

  const devCycleTimeData = useMemo(() => {
    // Apply developer filter if one is selected
    if (selectedDeveloper) {
      return allDevCycleTimeData.filter(item => item.developer === selectedDeveloper);
    }
    return allDevCycleTimeData;
  }, [allDevCycleTimeData, selectedDeveloper]);

  // Get all QA cycle time data (unfiltered for visibility check)
  const allQaCycleTimeData = useMemo(() => {
    // Filter items with QA cycle time data
    const filteredItems = workItems.filter(item => 
      selectedIterations.includes(item.iterationPath) &&
      cycleTimeMap[item.id]?.qaCycleTimeDays !== undefined
    );
    
    return filteredItems.map(item => ({
      id: item.id,
      title: item.title,
      assignedTo: item.assignedTo,
      iterationPath: item.iterationPath,
      state: item.state,
      developer: cycleTimeMap[item.id].assignedTo,
      cycleTimeDays: cycleTimeMap[item.id].cycleTimeDays,
      inProgressDate: cycleTimeMap[item.id].inProgressDate,
      qaReadyDate: cycleTimeMap[item.id].qaReadyDate,
      qaTester: cycleTimeMap[item.id].qaAssignedTo,
      uatReadyDate: cycleTimeMap[item.id].uatReadyDate,
      qaCycleTimeDays: cycleTimeMap[item.id].qaCycleTimeDays,
    })).sort((a, b) => {
      // Sort by UAT Ready date, most recent first
      if (!a.uatReadyDate || !b.uatReadyDate) return 0;
      return new Date(b.uatReadyDate).getTime() - new Date(a.uatReadyDate).getTime();
    });
  }, [workItems, selectedIterations, cycleTimeMap]);

  const qaCycleTimeData = useMemo(() => {
    // Apply QA filter if selected
    if (selectedQa) {
      return allQaCycleTimeData.filter(item => item.qaTester === selectedQa);
    }
    return allQaCycleTimeData;
  }, [allQaCycleTimeData, selectedQa]);

  const devStats = useMemo(() => {
    if (devCycleTimeData.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    const times = devCycleTimeData.map(item => item.cycleTimeDays).filter(t => t !== undefined) as number[];
    const sum = times.reduce((acc, time) => acc + time, 0);
    const average = sum / times.length;
    
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const min = Math.min(...times);
    const max = Math.max(...times);

    return { average, median, min, max };
  }, [devCycleTimeData]);

  const qaStats = useMemo(() => {
    if (qaCycleTimeData.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    const times = qaCycleTimeData.map(item => item.qaCycleTimeDays).filter(t => t !== undefined) as number[];
    const sum = times.reduce((acc, time) => acc + time, 0);
    const average = sum / times.length;
    
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const min = Math.min(...times);
    const max = Math.max(...times);

    return { average, median, min, max };
  }, [qaCycleTimeData]);

  return (
    <div className="cycle-time-analytics">
      <h2>Cycle Time Analytics</h2>

      <div className="iteration-selector">
        <div className="selector-header">
          <h4>Select Iterations to Analyze</h4>
          <div className="selector-actions">
            <button onClick={selectAll} className="btn-link">Select All</button>
            <button onClick={clearAll} className="btn-link">Clear All</button>
          </div>
        </div>
        <div className="iteration-list">
          {availableIterations.map(iteration => (
            <label key={iteration} className="iteration-checkbox">
              <input
                type="checkbox"
                checked={selectedIterations.includes(iteration)}
                onChange={() => toggleIteration(iteration)}
              />
              <span>{iteration}</span>
            </label>
          ))}
        </div>
        <button 
          onClick={handleCalculateCycleTime} 
          className="calculate-btn"
          disabled={loading || selectedIterations.length === 0}
        >
          {loading ? 'Calculating...' : hasLoaded ? `Recalculate (${selectedIterations.length} iterations)` : `Calculate Cycle Time (${selectedIterations.length} iterations)`}
        </button>
      </div>

      {(showNotification || loading) && (
        <div className={`background-notification ${loading ? 'loading' : error ? 'error' : 'success'}`}>
          {loading && <div className="notification-spinner"></div>}
          <span className="notification-text">{loading ? 'Calculating cycle time in background...' : notificationMessage}</span>
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

      {error && <div className="error-message">{error}</div>}

      <div className="filter-container">
        {availableDevelopers.length > 0 && (
          <div className="developer-filter">
            <label htmlFor="developer-select">Filter by Devs (at In Progress):</label>
            <select
              id="developer-select"
              value={selectedDeveloper}
              onChange={(e) => setSelectedDeveloper(e.target.value)}
              className="developer-select"
            >
              <option value="">All Devs</option>
              {availableDevelopers.map(developer => (
                <option key={developer} value={developer}>{developer}</option>
              ))}
            </select>
            {selectedDeveloper && (
              <button 
                className="clear-developer-btn"
                onClick={() => setSelectedDeveloper('')}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Developer Cycle Time Section */}
      {allDevCycleTimeData.length > 0 && (
        <div className="analytics-section">
          <div className="section-header" onClick={() => setShowDevSection(!showDevSection)}>
            <h4>
              <span className={`collapse-icon ${showDevSection ? 'expanded' : ''}`}>▶</span>
              Developer Cycle Time (In Progress → Ready for Test)
            </h4>
            <span className="section-count">{devCycleTimeData.length} items</span>
          </div>
          
          {showDevSection && (
            <>
              {devCycleTimeData.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>No items match the selected developer filter.</p>
                </div>
              ) : (
                <>
                  <div className="cycle-time-stats">
                <div className="stat-card">
                  <div className="stat-label">Average</div>
                  <div className="stat-value">{devStats.average.toFixed(1)} days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Median</div>
                  <div className="stat-value">{devStats.median.toFixed(1)} days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Min</div>
                  <div className="stat-value">{devStats.min} days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Max</div>
                  <div className="stat-value">{devStats.max} days</div>
                </div>
              </div>

              <div className="cycle-time-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Iteration</th>
                      <th>Developer</th>
                      <th>Current Assigned To</th>
                      <th>Current Status</th>
                      <th>In Progress</th>
                      <th>Ready for Test</th>
                      <th>Cycle Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devCycleTimeData.map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td className="title-cell">{item.title}</td>
                        <td className="iteration-cell">{item.iterationPath.split('\\\\').pop()}</td>
                        <td><strong>{item.developer || '-'}</strong></td>
                        <td>{item.assignedTo || '-'}</td>
                        <td><span className="status-badge">{item.state}</span></td>
                        <td>{item.inProgressDate || '-'}</td>
                        <td>{item.qaReadyDate || '-'}</td>
                        <td className="cycle-time-cell">
                          {item.cycleTimeDays !== undefined ? (
                            <span className={`cycle-time-badge ${
                              item.cycleTimeDays <= devStats.median ? 'good' : 
                              item.cycleTimeDays <= devStats.average ? 'average' : 'slow'
                            }`}>
                              {item.cycleTimeDays} {item.cycleTimeDays === 1 ? 'day' : 'days'}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* QA Filter */}
      {availableQaTesters.length > 0 && (
        <div className="filter-container">
          <div className="developer-filter">
            <label htmlFor="qa-select">Filter by QA (at Ready for Test):</label>
            <select
              id="qa-select"
              value={selectedQa}
              onChange={(e) => setSelectedQa(e.target.value)}
              className="developer-select"
            >
              <option value="">All QA</option>
              {availableQaTesters.map(qa => (
                <option key={qa} value={qa}>{qa}</option>
              ))}
            </select>
            {selectedQa && (
              <button 
                className="clear-developer-btn"
                onClick={() => setSelectedQa('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* QA Cycle Time Section */}
      {allQaCycleTimeData.length > 0 && (
        <div className="analytics-section">
          <div className="section-header" onClick={() => setShowQaSection(!showQaSection)}>
            <h4>
              <span className={`collapse-icon ${showQaSection ? 'expanded' : ''}`}>▶</span>
              QA Cycle Time (Ready for Test → UAT - Ready for Test)
            </h4>
            <span className="section-count">{qaCycleTimeData.length} items</span>
          </div>
          
          {showQaSection && (
            <>
              {qaCycleTimeData.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <p>No items match the selected QA filter.</p>
                </div>
              ) : (
                <>
                  <div className="cycle-time-stats">
                <div className="stat-card">
                  <div className="stat-label">Average</div>
                  <div className="stat-value">{qaStats.average.toFixed(1)} days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Median</div>
                  <div className="stat-value">{qaStats.median.toFixed(1)} days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Min</div>
                  <div className="stat-value">{qaStats.min} days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Max</div>
                  <div className="stat-value">{qaStats.max} days</div>
                </div>
              </div>

              <div className="cycle-time-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Iteration</th>
                      <th>QA Tester</th>
                      <th>Current Assigned To</th>
                      <th>Current Status</th>
                      <th>Ready for Test</th>
                      <th>UAT Ready</th>
                      <th>QA Cycle Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qaCycleTimeData.map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td className="title-cell">{item.title}</td>
                        <td className="iteration-cell">{item.iterationPath.split('\\\\').pop()}</td>
                        <td><strong>{item.qaTester || '-'}</strong></td>
                        <td>{item.assignedTo || '-'}</td>
                        <td><span className="status-badge">{item.state}</span></td>
                        <td>{item.qaReadyDate || '-'}</td>
                        <td>{item.uatReadyDate || '-'}</td>
                        <td className="cycle-time-cell">
                          {item.qaCycleTimeDays !== undefined ? (
                            <span className={`cycle-time-badge ${
                              item.qaCycleTimeDays <= qaStats.median ? 'good' : 
                              item.qaCycleTimeDays <= qaStats.average ? 'average' : 'slow'
                            }`}>
                              {item.qaCycleTimeDays} {item.qaCycleTimeDays === 1 ? 'day' : 'days'}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {!loading && Object.keys(cycleTimeMap).length === 0 && (
        <div className="empty-state">
          <p>Select iterations and click "Calculate Cycle Time" to view analytics</p>
        </div>
      )}

      {!loading && Object.keys(cycleTimeMap).length > 0 && devCycleTimeData.length === 0 && qaCycleTimeData.length === 0 && (
        <div className="empty-state">
          <p>No cycle time data found. Work items must have transitioned through the tracked states.</p>
          <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Analyzed {Object.keys(cycleTimeMap).length} work item(s) in {selectedIterations.length} iteration(s)
          </p>
        </div>
      )}
    </div>
  );
};


