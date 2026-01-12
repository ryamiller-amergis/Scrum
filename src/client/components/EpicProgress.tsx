import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem } from '../types/workitem';
import './EpicProgress.css';

interface EpicProgressProps {
  epicId: number;
  project: string;
  areaPath: string;
  onSelectChild?: (workItem: WorkItem) => void;
}

export const EpicProgress: React.FC<EpicProgressProps> = ({ epicId, project, areaPath, onSelectChild }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when epicId changes
  useEffect(() => {
    setChildren([]);
    setError(null);
    if (isExpanded) {
      fetchChildren();
    }
  }, [epicId]);

  useEffect(() => {
    if (isExpanded && children.length === 0 && !loading) {
      fetchChildren();
    }
  }, [isExpanded, epicId]);

  const fetchChildren = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/epics/${epicId}/children?project=${encodeURIComponent(project)}&areaPath=${encodeURIComponent(areaPath)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Epic children');
      }
      const data = await response.json();
      setChildren(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const notStartedStates = ['New', 'Approved', 'Grooming', 'Grooming Complete', 'Requirement Gathering', 'Requirements Gathering'];
    const developmentStates = ['Committed', 'In Progress', 'In Pull Request'];
    const qaStates = ['Ready For Test', 'In Test', 'Blocked'];
    const uatStates = ['UAT - Ready For Test'];
    const doneStates = ['UAT - Test Done', 'Done', 'Closed'];
    const completedStates = ['UAT - Test Done', 'Done', 'Closed'];

    const notStarted = children.filter(item => notStartedStates.includes(item.state));
    const inDevelopment = children.filter(item => developmentStates.includes(item.state));
    const inQA = children.filter(item => qaStates.includes(item.state));
    const inUAT = children.filter(item => uatStates.includes(item.state));
    const done = children.filter(item => doneStates.includes(item.state));
    const completed = children.filter(item => completedStates.includes(item.state));
    const remaining = children.filter(item => !completedStates.includes(item.state));

    const total = children.length;

    return {
      total,
      remaining: {
        count: remaining.length,
        percentage: total > 0 ? Math.round((remaining.length / total) * 100) : 0,
        items: remaining
      },
      completed: {
        count: completed.length,
        percentage: total > 0 ? Math.round((completed.length / total) * 100) : 0,
        items: completed
      },
      notStarted: {
        count: notStarted.length,
        percentage: total > 0 ? Math.round((notStarted.length / total) * 100) : 0,
        items: notStarted
      },
      development: {
        count: inDevelopment.length,
        percentage: total > 0 ? Math.round((inDevelopment.length / total) * 100) : 0,
        items: inDevelopment
      },
      qa: {
        count: inQA.length,
        percentage: total > 0 ? Math.round((inQA.length / total) * 100) : 0,
        items: inQA
      },
      uat: {
        count: inUAT.length,
        percentage: total > 0 ? Math.round((inUAT.length / total) * 100) : 0,
        items: inUAT
      },
      done: {
        count: done.length,
        percentage: total > 0 ? Math.round((done.length / total) * 100) : 0,
        items: done
      }
    };
  }, [children]);

  return (
    <div className="epic-progress">
      <div className="epic-progress-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="epic-progress-icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="epic-progress-title">Epic Progress</span>
        {children.length > 0 && (
          <span className="epic-progress-count">({children.length} items)</span>
        )}
      </div>

      {isExpanded && (
        <div className="epic-progress-content">
          {loading && <div className="epic-progress-loading">Loading...</div>}
          {error && <div className="epic-progress-error">{error}</div>}
          
          {!loading && !error && children.length === 0 && (
            <div className="epic-progress-empty">No child items found</div>
          )}

          {!loading && !error && children.length > 0 && (
            <>
              <div className="epic-summary">
                <div className="epic-summary-item">
                  <div className="epic-summary-label">Work Remaining</div>
                  <div className="epic-summary-value">{stats.remaining.count} of {stats.total} items ({stats.remaining.percentage}%)</div>
                  <div className="epic-summary-bar">
                    <div 
                      className="epic-summary-bar-fill remaining" 
                      style={{ width: `${stats.remaining.percentage}%` }}
                    />
                    <div 
                      className="epic-summary-bar-fill completed" 
                      style={{ width: `${stats.completed.percentage}%`, marginLeft: `${stats.remaining.percentage}%` }}
                    />
                  </div>
                  <div className="epic-summary-legend">
                    <span className="legend-item">
                      <span className="legend-color remaining"></span>
                      Remaining: {stats.remaining.count}
                    </span>
                    <span className="legend-item">
                      <span className="legend-color completed"></span>
                      Completed: {stats.completed.count}
                    </span>
                  </div>
                </div>
              </div>

              <div className="epic-stats">
                <div className="epic-stat-item">
                  <div className="epic-stat-header">
                    <div className="epic-stat-label">Not Started</div>
                    <div className="epic-stat-value">{stats.notStarted.count} items ({stats.notStarted.percentage}%)</div>
                  </div>
                  <div className="epic-stat-bar">
                    <div 
                      className="epic-stat-bar-fill not-started" 
                      style={{ width: `${stats.notStarted.percentage}%` }}
                    >
                      {stats.notStarted.percentage > 0 && `${stats.notStarted.percentage}%`}
                    </div>
                  </div>
                </div>

                <div className="epic-stat-item">
                  <div className="epic-stat-header">
                    <div className="epic-stat-label">Development Remaining</div>
                    <div className="epic-stat-value">{stats.development.count} items ({stats.development.percentage}%)</div>
                  </div>
                  <div className="epic-stat-bar">
                    <div 
                      className="epic-stat-bar-fill development" 
                      style={{ width: `${stats.development.percentage}%` }}
                    >
                      {stats.development.percentage > 0 && `${stats.development.percentage}%`}
                    </div>
                  </div>
                </div>

                <div className="epic-stat-item">
                  <div className="epic-stat-header">
                    <div className="epic-stat-label">QA Remaining</div>
                    <div className="epic-stat-value">{stats.qa.count} items ({stats.qa.percentage}%)</div>
                  </div>
                  <div className="epic-stat-bar">
                    <div 
                      className="epic-stat-bar-fill qa" 
                      style={{ width: `${stats.qa.percentage}%` }}
                    >
                      {stats.qa.percentage > 0 && `${stats.qa.percentage}%`}
                    </div>
                  </div>
                </div>

                <div className="epic-stat-item">
                  <div className="epic-stat-header">
                    <div className="epic-stat-label">UAT Ready</div>
                    <div className="epic-stat-value">{stats.uat.count} items ({stats.uat.percentage}%)</div>
                  </div>
                  <div className="epic-stat-bar">
                    <div 
                      className="epic-stat-bar-fill uat" 
                      style={{ width: `${stats.uat.percentage}%` }}
                    >
                      {stats.uat.percentage > 0 && `${stats.uat.percentage}%`}
                    </div>
                  </div>
                </div>

                <div className="epic-stat-item">
                  <div className="epic-stat-header">
                    <div className="epic-stat-label">Done</div>
                    <div className="epic-stat-value">{stats.done.count} items ({stats.done.percentage}%)</div>
                  </div>
                  <div className="epic-stat-bar">
                    <div 
                      className="epic-stat-bar-fill done" 
                      style={{ width: `${stats.done.percentage}%` }}
                    >
                      {stats.done.percentage > 0 && `${stats.done.percentage}%`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="epic-children-list">
                <div className="epic-children-header">Child Items ({children.length})</div>
                {children.map(child => (
                  <div 
                    key={child.id} 
                    className="epic-child-item"
                    onClick={() => onSelectChild?.(child)}
                  >
                    <div className="epic-child-header">
                      <span className="epic-child-id">#{child.id}</span>
                      <span className="epic-child-title">{child.title}</span>
                    </div>
                    <span className={`epic-child-state state-${child.state.toLowerCase().replace(/\s+/g, '-')}`}>
                      {child.state}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
