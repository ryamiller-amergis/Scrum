import React, { useState } from 'react';
import type { QABugStats, WorkItem } from '../types/workitem';

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
  </svg>
);

interface QABugStatsSectionProps {
  stats: QABugStats[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  isCustomDateInvalid: boolean;
  onLoad: () => void;
  workItems: WorkItem[];
  onSelectItem?: (item: WorkItem) => void;
}

export const QABugStatsSection: React.FC<QABugStatsSectionProps> = ({
  stats,
  isLoading,
  error,
  hasLoaded,
  isCustomDateInvalid,
  onLoad,
  workItems,
  onSelectItem,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [collapsedPbis, setCollapsedPbis] = useState<Set<string>>(new Set());

  const togglePbi = (key: string) => {
    const next = new Set(collapsedPbis);
    if (next.has(key)) next.delete(key); else next.add(key);
    setCollapsedPbis(next);
  };

  return (
    <div className="stats-section">
      <h3>
        <button
          className="collapse-button"
          onClick={() => setIsCollapsed(v => !v)}
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
        QA Bug Statistics
        <div
          className="info-icon"
          onClick={() => setShowInfo(v => !v)}
          role="button"
          aria-label="Show information about this section"
        >
          <InfoIcon />
        </div>
      </h3>

      {showInfo && (
        <div className="info-tooltip">
          <button className="info-close" onClick={() => setShowInfo(false)} aria-label="Close information">×</button>
          <p>
            <strong>What this section shows:</strong><br />
            Bugs found in QA testing for PBIs created by developers.
          </p>
          <p>
            <strong>How to interpret:</strong><br />
            • <strong>Total PBIs:</strong> Number of Product Backlog Items created by the developer<br />
            • <strong>Total Bugs:</strong> Number of bugs linked to those PBIs<br />
            • <strong>Avg Bugs/PBI:</strong> Average number of bugs per PBI (lower is better)
          </p>
        </div>
      )}

      {!isCollapsed && (
        <div className="filter-actions">
          <button
            onClick={onLoad}
            disabled={isLoading || isCustomDateInvalid}
            className="load-stats-button"
          >
            {isLoading ? 'Loading...' : hasLoaded ? 'Refresh QA Bugs' : 'Load QA Bugs'}
          </button>
        </div>
      )}

      {!isCollapsed && isLoading && (
        <div className="background-notification loading">
          <div className="notification-spinner"></div>
          <span className="notification-text">Loading QA bug statistics in background...</span>
        </div>
      )}

      {!isCollapsed && !isLoading && error && (
        <div className="background-notification error">
          <span className="notification-text">Error: {error}</span>
        </div>
      )}

      {!isCollapsed && !hasLoaded && !isLoading && (
        <p className="placeholder-text">Click "Load QA Bugs" to view QA bug statistics.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length === 0 && (
        <p className="placeholder-text">No QA bug data found for the selected filters.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length > 0 && (
        <div className="developer-stats-list">
          {stats.map((devStats, index) => (
            <div key={index} className="developer-stat-card">
              <div className="developer-header">
                <span className="developer-name">{devStats.developer}</span>
                <span className="total-changes">{devStats.totalPBIs} PBIs</span>
              </div>

              <div className="pr-time-summary">
                <div className="pr-time-details">
                  <div className="pr-time-stat">
                    <span className="stat-label">Total Bugs:</span>
                    <span className="stat-value">{devStats.totalBugs}</span>
                  </div>
                  <div className="pr-time-stat">
                    <span className="stat-label">Avg Bugs/PBI:</span>
                    <span className="stat-value">{devStats.averageBugsPerPBI.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {devStats.pbiDetails.length > 0 && (
                <details className="work-item-details">
                  <summary>View PBIs with Bugs ({devStats.pbiDetails.length})</summary>
                  <div className="qa-bug-pbi-list">
                    {devStats.pbiDetails.map((pbi, idx) => {
                      const fullWorkItem = workItems.find(wi => wi.id === pbi.id);
                      const pbiKey = `qabug-pbi-${devStats.developer}-${pbi.id}`;
                      const isPbiExpanded = !collapsedPbis.has(pbiKey);

                      return (
                        <div key={idx} className="qa-bug-pbi-card">
                          <div className="qa-bug-pbi-header">
                            <div className="qa-bug-pbi-info">
                              <span
                                className={`work-item-id${onSelectItem && fullWorkItem ? ' clickable' : ''}`}
                                onClick={() => { if (onSelectItem && fullWorkItem) onSelectItem(fullWorkItem); }}
                                role={onSelectItem && fullWorkItem ? 'button' : undefined}
                                tabIndex={onSelectItem && fullWorkItem ? 0 : undefined}
                              >
                                #{pbi.id}
                              </span>
                              <span className="qa-bug-pbi-title">{pbi.title}</span>
                            </div>
                            <div className="qa-bug-pbi-actions">
                              <span className={`bug-count-badge ${pbi.bugCount > 3 ? 'high' : pbi.bugCount > 1 ? 'medium' : 'low'}`}>
                                {pbi.bugCount} {pbi.bugCount === 1 ? 'Bug' : 'Bugs'}
                              </span>
                              {pbi.bugs.length > 0 && (
                                <button
                                  className="expand-bugs-btn"
                                  onClick={() => togglePbi(pbiKey)}
                                  aria-label={isPbiExpanded ? 'Hide bugs' : 'Show bugs'}
                                >
                                  {isPbiExpanded ? '▼' : '▶'}
                                </button>
                              )}
                            </div>
                          </div>

                          {pbi.bugs.length > 0 && isPbiExpanded && (
                            <div className="qa-bug-details-list">
                              {pbi.bugs.map((bug, bugIdx) => (
                                <div key={bugIdx} className={`qa-bug-item state-${bug.state.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <div className="qa-bug-icon">🐛</div>
                                  <div className="qa-bug-content">
                                    <div className="qa-bug-id-title">
                                      <span className="qa-bug-id">#{bug.id}</span>
                                      <span className="qa-bug-title">{bug.title}</span>
                                    </div>
                                    <span className={`qa-bug-state state-${bug.state.toLowerCase().replace(/\s+/g, '-')}`}>
                                      {bug.state}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
