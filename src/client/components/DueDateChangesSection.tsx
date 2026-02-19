import React, { useState } from 'react';
import type { DeveloperDueDateStats } from '../types/workitem';

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
  </svg>
);

interface DueDateChangesSectionProps {
  stats: DeveloperDueDateStats[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  isCustomDateInvalid: boolean;
  onLoad: () => void;
}

export const DueDateChangesSection: React.FC<DueDateChangesSectionProps> = ({
  stats,
  isLoading,
  error,
  hasLoaded,
  isCustomDateInvalid,
  onLoad,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [collapsedReasons, setCollapsedReasons] = useState<Set<string>>(new Set());

  const toggleReason = (key: string) => {
    const next = new Set(collapsedReasons);
    if (next.has(key)) next.delete(key); else next.add(key);
    setCollapsedReasons(next);
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
        Due Date Changes by Developer
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

      {!isCollapsed && (
        <div className="filter-actions">
          <button
            onClick={onLoad}
            disabled={isLoading || isCustomDateInvalid}
            className="load-stats-button"
          >
            {isLoading ? 'Loading...' : hasLoaded ? 'Refresh Statistics' : 'Load Statistics'}
          </button>
        </div>
      )}

      {!isCollapsed && isLoading && (
        <div className="background-notification loading">
          <div className="notification-spinner"></div>
          <span className="notification-text">Loading statistics in background...</span>
        </div>
      )}

      {!isCollapsed && !isLoading && error && (
        <div className="background-notification error">
          <span className="notification-text">Error: {error}</span>
        </div>
      )}

      {!isCollapsed && !hasLoaded && !isLoading && (
        <p className="placeholder-text">Select filters and click "Load Statistics" to view due date change statistics.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length === 0 && (
        <p className="placeholder-text">No due date changes found for the selected filters.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length > 0 && (
        <div className="developer-stats-list">
          {stats.map((devStats, index) => {
            const devKey = `changes-${devStats.developer}`;
            const isReasonCollapsed = collapsedReasons.has(devKey);
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
                      onClick={() => toggleReason(devKey)}
                      aria-label={isReasonCollapsed ? 'Expand reasons' : 'Collapse reasons'}
                    >
                      {isReasonCollapsed ? '▶' : '▼'}
                    </button>
                    Reasons:
                  </h4>
                  {!isReasonCollapsed && (
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
  );
};
