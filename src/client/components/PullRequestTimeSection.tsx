import React, { useState } from 'react';
import type { PullRequestTimeStats, WorkItem } from '../types/workitem';

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
  </svg>
);

interface PullRequestTimeSectionProps {
  stats: PullRequestTimeStats[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  isCustomDateInvalid: boolean;
  onLoad: () => void;
  workItems: WorkItem[];
  onSelectItem?: (item: WorkItem) => void;
}

export const PullRequestTimeSection: React.FC<PullRequestTimeSectionProps> = ({
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
        Pull Request Time
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
            Time spent by developers in the "In Pull Request" state for their work items.
          </p>
          <p>
            <strong>How to interpret:</strong><br />
            • <strong>Total Items in PR:</strong> Number of work items that went through the "In Pull Request" state<br />
            • <strong>Average Time in PR:</strong> Average days spent in pull request state<br />
            • <strong>Total Time in PR:</strong> Sum of all days spent across all items
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
            {isLoading ? 'Loading...' : hasLoaded ? 'Refresh PR Time' : 'Load PR Time'}
          </button>
        </div>
      )}

      {!isCollapsed && isLoading && (
        <div className="background-notification loading">
          <div className="notification-spinner"></div>
          <span className="notification-text">Loading pull request time statistics in background...</span>
        </div>
      )}

      {!isCollapsed && !isLoading && error && (
        <div className="background-notification error">
          <span className="notification-text">Error: {error}</span>
        </div>
      )}

      {!isCollapsed && !hasLoaded && !isLoading && (
        <p className="placeholder-text">Click "Load PR Time" to view pull request state time statistics.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length === 0 && (
        <p className="placeholder-text">No work items in pull request state found for the selected filters.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length > 0 && (
        <div className="developer-stats-list">
          {stats.map((devStats, index) => (
            <div key={index} className="developer-stat-card">
              <div className="developer-header">
                <span className="developer-name">{devStats.developer}</span>
                <span className="total-changes">{devStats.totalItemsInPullRequest} items</span>
              </div>

              <div className="pr-time-summary">
                <div className="pr-time-details">
                  <div className="pr-time-stat">
                    <span className="stat-label">Avg Time in PR:</span>
                    <span className="stat-value">{devStats.averageTimeInPullRequest.toFixed(1)} days</span>
                  </div>
                  <div className="pr-time-stat">
                    <span className="stat-label">Total Time:</span>
                    <span className="stat-value">{devStats.totalTimeInPullRequest.toFixed(1)} days</span>
                  </div>
                </div>
              </div>

              {devStats.workItemDetails.length > 0 && (
                <details className="work-item-details">
                  <summary>View Work Items ({devStats.workItemDetails.length})</summary>
                  <ul className="work-item-list">
                    {devStats.workItemDetails.map((item, idx) => {
                      const fullWorkItem = workItems.find(wi => wi.id === item.id);
                      return (
                        <li
                          key={idx}
                          className={`work-item${onSelectItem && fullWorkItem ? ' clickable' : ''}`}
                          onClick={() => { if (onSelectItem && fullWorkItem) onSelectItem(fullWorkItem); }}
                          role={onSelectItem && fullWorkItem ? 'button' : undefined}
                          tabIndex={onSelectItem && fullWorkItem ? 0 : undefined}
                        >
                          <span className="work-item-id">#{item.id}</span>
                          <span className="work-item-title">{item.title}</span>
                          <span className="work-item-dates">
                            PR: {item.enteredPullRequestDate} → {item.exitedPullRequestDate}
                          </span>
                          <span className="work-item-pr-time">{item.timeInPullRequestDays.toFixed(1)} days</span>
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
  );
};
