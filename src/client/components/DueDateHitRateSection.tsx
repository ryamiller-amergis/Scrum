import React, { useState } from 'react';
import type { DueDateHitRateStats, WorkItem } from '../types/workitem';

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
  </svg>
);

interface DueDateHitRateSectionProps {
  stats: DueDateHitRateStats[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  isCustomDateInvalid: boolean;
  onLoad: () => void;
  workItems: WorkItem[];
  onSelectItem?: (item: WorkItem) => void;
}

export const DueDateHitRateSection: React.FC<DueDateHitRateSectionProps> = ({
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
        Due Date Hit Rate
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
            Whether developers completed work items on or before their due dates without changing the due date.
          </p>
          <p>
            <strong>How to interpret:</strong><br />
            • <strong>No Changes (Hit):</strong> Work items completed on or before due date with no due date changes<br />
            • <strong>Missed Due Date:</strong> Work items with due date changes OR completed after the due date<br />
            • <strong>Hit Rate %:</strong> Percentage of work items completed on time without date changes
          </p>
          <p>
            <strong>Note:</strong> Work items still in progress with future due dates are not counted as hits or misses.
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
            {isLoading ? 'Loading...' : hasLoaded ? 'Refresh Hit Rate' : 'Load Hit Rate'}
          </button>
        </div>
      )}

      {!isCollapsed && isLoading && (
        <div className="background-notification loading">
          <div className="notification-spinner"></div>
          <span className="notification-text">Loading hit rate statistics in background...</span>
        </div>
      )}

      {!isCollapsed && !isLoading && error && (
        <div className="background-notification error">
          <span className="notification-text">Error: {error}</span>
        </div>
      )}

      {!isCollapsed && !hasLoaded && !isLoading && (
        <p className="placeholder-text">Click "Load Hit Rate" to view statistics on due date changes per developer.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length === 0 && (
        <p className="placeholder-text">No work items with due dates found for the selected filters.</p>
      )}

      {!isCollapsed && hasLoaded && !isLoading && stats.length > 0 && (
        <div className="developer-stats-list">
          {stats.map((devStats, index) => (
            <div key={index} className="developer-stat-card">
              <div className="developer-header">
                <span className="developer-name">{devStats.developer}</span>
                <span className="total-changes">{devStats.totalWorkItems} work items</span>
              </div>

              <div className="hit-rate-summary">
                <div className="hit-rate-bar-container">
                  <div className="hit-rate-bar hit" style={{ width: `${devStats.hitRate}%` }}>
                    {devStats.hitRate > 15 && `${devStats.hitRate.toFixed(1)}%`}
                  </div>
                  <div
                    className="hit-rate-bar miss"
                    style={{
                      width: `${devStats.missedDueDate > 0
                        ? (devStats.missedDueDate / (devStats.hitDueDate + devStats.missedDueDate)) * 100
                        : 0}%`,
                    }}
                  >
                    {((devStats.missedDueDate / (devStats.hitDueDate + devStats.missedDueDate || 1)) * 100) > 15 &&
                      `${((devStats.missedDueDate / (devStats.hitDueDate + devStats.missedDueDate)) * 100).toFixed(1)}%`}
                  </div>
                  <div
                    className="hit-rate-bar in-progress"
                    style={{
                      width: `${100 - devStats.hitRate - ((devStats.missedDueDate / (devStats.hitDueDate + devStats.missedDueDate || 1)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="hit-rate-details">
                  <div className="hit-rate-stat">
                    <span className="stat-label hit">No Changes (Hit):</span>
                    <span className="stat-value">{devStats.hitDueDate}</span>
                  </div>
                  <div className="hit-rate-stat">
                    <span className="stat-label miss">Missed Due Date:</span>
                    <span className="stat-value">{devStats.missedDueDate}</span>
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
                          className={`work-item ${item.status}${onSelectItem && fullWorkItem ? ' clickable' : ''}`}
                          onClick={() => { if (onSelectItem && fullWorkItem) onSelectItem(fullWorkItem); }}
                          role={onSelectItem && fullWorkItem ? 'button' : undefined}
                          tabIndex={onSelectItem && fullWorkItem ? 0 : undefined}
                        >
                          <span className="work-item-id">#{item.id}</span>
                          <span className="work-item-title">{item.title}</span>
                          <span className="work-item-dates">Due: {item.dueDate} | {item.completionDate}</span>
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
          ))}
        </div>
      )}
    </div>
  );
};
