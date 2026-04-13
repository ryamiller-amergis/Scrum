import React, { useState, useMemo, useEffect } from 'react';
import { WorkItem, AIWorkItemHealthSummary } from '../types/workitem';
import { WorkItemHealthSection } from './WorkItemHealthSection';
import './AIAnalysis.css';

interface AIAnalysisProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
  onSelectItem?: (item: WorkItem) => void;
}

const SESSION_INIT_KEY = 'aiAnalysisSessionInitialized';
const DATA_KEY = 'aiAnalysisHealthData';
const LOADING_KEY = 'aiAnalysisLoadingState';
const FILTER_KEY = 'aiAnalysisFilters';

function checkAndClearOnRefresh(): boolean {
  const initialized = sessionStorage.getItem(SESSION_INIT_KEY);
  if (!initialized) {
    sessionStorage.removeItem(DATA_KEY);
    sessionStorage.removeItem(LOADING_KEY);
    sessionStorage.removeItem(FILTER_KEY);
    sessionStorage.setItem(SESSION_INIT_KEY, 'true');
    return true;
  }
  return false;
}

function buildDateRange(timeFrame: string, customFrom: string, customTo: string) {
  const toDate = new Date().toISOString().split('T')[0];
  if (timeFrame === 'custom') {
    return { from: customFrom, to: customTo };
  }
  const from = new Date();
  from.setDate(from.getDate() - parseInt(timeFrame, 10));
  return { from: from.toISOString().split('T')[0], to: toDate };
}

export const AIAnalysis: React.FC<AIAnalysisProps> = ({
  project,
  areaPath,
  onSelectItem,
  workItems,
}) => {
  const [isPageRefresh] = useState(() => checkAndClearOnRefresh());

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [timeFrame, setTimeFrame] = useState<string>(() => {
    if (isPageRefresh) return '30';
    const saved = sessionStorage.getItem(FILTER_KEY);
    return saved ? JSON.parse(saved).timeFrame ?? '30' : '30';
  });
  const [customFrom, setCustomFrom] = useState<string>(() => {
    if (isPageRefresh) return '';
    const saved = sessionStorage.getItem(FILTER_KEY);
    return saved ? JSON.parse(saved).customFrom ?? '' : '';
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    if (isPageRefresh) return '';
    const saved = sessionStorage.getItem(FILTER_KEY);
    return saved ? JSON.parse(saved).customTo ?? '' : '';
  });

  // ── Section 1: Work Item Health ───────────────────────────────────────────────
  const [healthSummary, setHealthSummary] = useState<AIWorkItemHealthSummary | null>(() => {
    if (isPageRefresh) return null;
    const saved = sessionStorage.getItem(DATA_KEY);
    return saved ? JSON.parse(saved).summary : null;
  });
  const [loading, setLoading] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(LOADING_KEY);
    return saved ? JSON.parse(saved).loading : false;
  });
  const [hasLoaded, setHasLoaded] = useState(() => {
    if (isPageRefresh) return false;
    const saved = sessionStorage.getItem(DATA_KEY);
    return saved ? JSON.parse(saved).hasLoaded : false;
  });
  const [error, setError] = useState<string | null>(null);

  // ── Date range computed value ─────────────────────────────────────────────────
  const dateRange = useMemo(
    () => buildDateRange(timeFrame, customFrom, customTo),
    [timeFrame, customFrom, customTo]
  );

  // ── Persist filters ───────────────────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ timeFrame, customFrom, customTo }));
  }, [timeFrame, customFrom, customTo]);

  // ── Persist health data ───────────────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.setItem(DATA_KEY, JSON.stringify({ summary: healthSummary, hasLoaded }));
  }, [healthSummary, hasLoaded]);

  // ── Fetch handler ─────────────────────────────────────────────────────────────
  const handleLoad = async () => {
    if (!dateRange.from || !dateRange.to) return;

    setLoading(true);
    setError(null);
    sessionStorage.setItem(LOADING_KEY, JSON.stringify({ loading: true }));

    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        project,
        areaPath,
      });

      const response = await fetch(`/api/ai-work-item-health?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      const data: AIWorkItemHealthSummary = await response.json();
      setHealthSummary(data);
      setHasLoaded(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch AI analysis data');
    } finally {
      setLoading(false);
      sessionStorage.setItem(LOADING_KEY, JSON.stringify({ loading: false }));
    }
  };

  // ── Resolve a work item for the details panel ─────────────────────────────────
  const handleSelectWorkItemById = (id: number) => {
    const match = workItems.find((wi) => wi.id === id);
    if (match && onSelectItem) onSelectItem(match);
  };

  const canLoad = timeFrame !== 'custom' || (customFrom !== '' && customTo !== '');

  return (
    <div className="ai-analysis-container">
      <h2>AI Analysis</h2>

      {/* ── Shared filters (Sections 1 & 2) ──────────────────────────────────── */}
      <div className="ai-analysis-filters">
        <div className="ai-analysis-filter-row">
          <div className="ai-analysis-filter-group">
            <label htmlFor="ai-timeframe">Time Frame</label>
            <select
              id="ai-timeframe"
              className="ai-analysis-select"
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value)}
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="180">Last 6 Months</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {timeFrame === 'custom' && (
            <>
              <div className="ai-analysis-filter-group">
                <label htmlFor="ai-from-date">From</label>
                <input
                  id="ai-from-date"
                  type="date"
                  className="ai-analysis-date-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="ai-analysis-filter-group">
                <label htmlFor="ai-to-date">To</label>
                <input
                  id="ai-to-date"
                  type="date"
                  className="ai-analysis-date-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            className="ai-analysis-load-btn"
            onClick={handleLoad}
            disabled={loading || !canLoad}
          >
            {loading ? 'Loading…' : 'Load Data'}
          </button>
        </div>
      </div>

      {/* ── Loading / error notification ──────────────────────────────────────── */}
      {loading && (
        <div className="ai-analysis-notification loading">
          <div className="ai-notification-spinner" />
          <span className="ai-notification-text">
            Fetching ai-code work items — this may take a moment…
          </span>
        </div>
      )}
      {error && (
        <div className="ai-analysis-notification error">
          <span className="ai-notification-text">Error: {error}</span>
        </div>
      )}

      {/* ── Section 1: Work Item Health ──────────────────────────────────────── */}
      <div className="ai-analysis-section">
        <div className="ai-analysis-section-header">
          <h3>Work Item Health</h3>
          <span className="ai-section-badge active">Active</span>
        </div>

        {!hasLoaded && !loading ? (
          <div className="ai-placeholder-card">
            <span className="ai-placeholder-icon">📊</span>
            <p>
              Select a time frame and click <strong>Load Data</strong> to analyze{' '}
              <strong>ai-code</strong> tagged work items.
            </p>
          </div>
        ) : loading && !healthSummary ? (
          <div className="ai-placeholder-card">
            <span className="ai-placeholder-icon">⏳</span>
            <p>Fetching revision history and bug data for ai-code items…</p>
          </div>
        ) : healthSummary ? (
          <WorkItemHealthSection
            summary={healthSummary}
            onSelectItem={handleSelectWorkItemById}
          />
        ) : null}
      </div>

      {/* ── Section 2: AI Health (coming soon) ───────────────────────────────── */}
      <div className="ai-analysis-section">
        <div className="ai-analysis-section-header">
          <h3>AI Health</h3>
          <span className="ai-section-badge coming-soon">Coming Soon</span>
        </div>
        <div className="ai-placeholder-card">
          <span className="ai-placeholder-icon">🤖</span>
          <p>
            <strong>AI Health</strong> will capture the efficiency and quality of AI workers
            within the orchestration pipeline — cycle throughput, token efficiency, task
            completion rates, and model performance over time.
          </p>
        </div>
      </div>

      {/* ── Section 3: Manual vs AI Agentic (coming soon) ────────────────────── */}
      <div className="ai-analysis-section">
        <div className="ai-analysis-section-header">
          <h3>Manual vs AI Agentic</h3>
          <span className="ai-section-badge coming-soon">Coming Soon</span>
        </div>
        <div className="ai-placeholder-card">
          <span className="ai-placeholder-icon">⚖️</span>
          <p>
            <strong>Manual vs AI Agentic</strong> will compare quality and efficiency of
            work completed by human developers versus AI agents — including cycle time,
            defect rates, rework frequency, and delivery predictability. This section will
            have its own independent time frame selector.
          </p>
        </div>
      </div>
    </div>
  );
};
