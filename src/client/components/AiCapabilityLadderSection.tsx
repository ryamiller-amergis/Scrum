import React, { useState, useCallback } from 'react';
import type { AiCapabilityLadderResult, LadderBar, LadderCriterion, CriterionStatus } from '../types/aiCapabilityLadder';

interface AiCapabilityLadderSectionProps {
  fromDate: string;
  toDate: string;
  areaPath?: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CriterionStatus }) {
  const config: Record<CriterionStatus, { label: string; cls: string }> = {
    met:       { label: 'Met',     cls: 'ladder-status-met' },
    'at-risk': { label: 'At Risk', cls: 'ladder-status-at-risk' },
    'not-met': { label: 'Not Met', cls: 'ladder-status-not-met' },
    unknown:   { label: 'Unknown', cls: 'ladder-status-unknown' },
  };
  const { label, cls } = config[status];
  return <span className={`ladder-status-badge ${cls}`}>{label}</span>;
}

function EvidencePill({ quality }: { quality: string }) {
  const cls =
    quality === 'definitive' ? 'ladder-evidence-definitive' :
    quality === 'configured' ? 'ladder-evidence-configured' :
    'ladder-evidence-inferred';
  const label =
    quality === 'definitive' ? 'Definitive' :
    quality === 'configured' ? 'Configured' :
    'Inferred';
  return <span className={`ladder-evidence-pill ${cls}`}>{label}</span>;
}

// ── Criterion row ──────────────────────────────────────────────────────────────

function CriterionRow({ criterion }: { criterion: LadderCriterion }) {
  const [expanded, setExpanded] = useState(false);
  const hasGaps = criterion.gapDisplay || criterion.developersNeedingLift.length > 0;

  return (
    <div className={`ladder-criterion${criterion.status === 'not-met' ? ' ladder-criterion-notmet' : criterion.status === 'at-risk' ? ' ladder-criterion-atrisk' : ''}`}>
      <div className="ladder-criterion-header" onClick={() => hasGaps && setExpanded(e => !e)} role={hasGaps ? 'button' : undefined} tabIndex={hasGaps ? 0 : undefined} onKeyDown={e => { if (hasGaps && (e.key === 'Enter' || e.key === ' ')) setExpanded(ex => !ex); }}>
        <span className="ladder-criterion-label">{criterion.label}</span>
        <div className="ladder-criterion-meta">
          <span className="ladder-criterion-current">{criterion.currentDisplay}</span>
          <span className="ladder-criterion-target">Goal: {criterion.targetDisplay}</span>
          <EvidencePill quality={criterion.evidenceQuality} />
          <StatusBadge status={criterion.status} />
          {hasGaps && (
            <span className="ladder-criterion-expand">{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ladder-criterion-detail">
          {criterion.gapDisplay && (
            <div className="ladder-gap-banner">
              <span className="ladder-gap-icon">⚠</span>
              <span>{criterion.gapDisplay}</span>
            </div>
          )}
          <div className="ladder-evidence-source">Source: {criterion.evidenceSource}</div>
          {criterion.developersNeedingLift.length > 0 && (
            <div className="ladder-dev-gaps">
              <div className="ladder-dev-gaps-title">Developers needing lift</div>
              <table className="ladder-dev-table">
                <thead>
                  <tr>
                    <th>Developer</th>
                    <th>Current</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {criterion.developersNeedingLift.map(d => (
                    <tr key={d.email || d.name}>
                      <td>{d.name}{d.email && d.email !== d.name ? <span className="ladder-dev-email"> ({d.email})</span> : null}</td>
                      <td>{d.currentDisplay}</td>
                      <td>{d.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bar card ───────────────────────────────────────────────────────────────────

function BarCard({ bar }: { bar: LadderBar }) {
  const [collapsed, setCollapsed] = useState(false);

  const categories = ['adoption', 'practice', 'outcomes', 'contribution'] as const;
  const categoryLabels: Record<string, string> = {
    adoption: 'Adoption',
    practice: 'Practice',
    outcomes: 'Outcomes',
    contribution: 'Contribution',
  };

  return (
    <div className={`ladder-bar ladder-bar-${bar.status}`}>
      <div className="ladder-bar-header" onClick={() => setCollapsed(c => !c)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(c => !c); }}>
        <span className="ladder-bar-title">{bar.title}</span>
        <div className="ladder-bar-header-right">
          <StatusBadge status={bar.status} />
          <span className="ladder-bar-chevron">{collapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="ladder-bar-body">
          {categories.map(cat => {
            const criteria = bar.criteria.filter(c => c.category === cat);
            if (criteria.length === 0) return null;
            return (
              <div key={cat} className="ladder-category">
                <div className="ladder-category-label">{categoryLabels[cat]}</div>
                {criteria.map(c => <CriterionRow key={c.id} criterion={c} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Top gaps summary ───────────────────────────────────────────────────────────

function TopGapsSummary({ result }: { result: AiCapabilityLadderResult }) {
  if (result.topGaps.length === 0 && result.developersWithoutCursorActivity.length === 0) {
    return (
      <div className="ladder-top-gaps-empty">
        All evaluated criteria are met or at-risk. No critical gaps detected.
      </div>
    );
  }

  return (
    <div className="ladder-top-gaps">
      <div className="ladder-top-gaps-title">Top Gaps</div>
      {result.topGaps.map(g => (
        <div key={g.id} className={`ladder-gap-row ladder-gap-${g.status}`}>
          <StatusBadge status={g.status} />
          <span className="ladder-gap-label">{g.label}</span>
          <span className="ladder-gap-current">{g.currentDisplay}</span>
          {g.gapDisplay && <span className="ladder-gap-detail">{g.gapDisplay}</span>}
        </div>
      ))}
      {result.developersWithoutCursorActivity.length > 0 && (
        <div className="ladder-no-cursor">
          <span className="ladder-no-cursor-title">No Cursor activity detected:</span>
          <span className="ladder-no-cursor-names">
            {result.developersWithoutCursorActivity.map(d => d.name).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main section ───────────────────────────────────────────────────────────────

export const AiCapabilityLadderSection: React.FC<AiCapabilityLadderSectionProps> = ({
  fromDate,
  toDate,
  areaPath,
}) => {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiCapabilityLadderResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (areaPath) params.set('areaPath', areaPath);
      const res = await fetch(`/api/ai-capability-ladder?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AiCapabilityLadderResult = await res.json();
      setResult(data);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, areaPath]);

  return (
    <div className="stats-section ladder-section">
      <h3>
        <button
          className="collapse-button"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand section' : 'Collapse section'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        AI Capability Ladder
        <span className="ladder-section-subtitle">Definitive scoring from Cursor + ADO</span>
      </h3>

      {!collapsed && (
        <>
          <div className="filter-actions">
            <button
              onClick={load}
              disabled={loading}
              className="load-stats-button"
            >
              {loading ? 'Loading…' : loaded ? 'Refresh Scorecard' : 'Load Scorecard'}
            </button>
            {result && (
              <span className="ladder-eval-meta">
                Evaluated {new Date(result.evaluatedAt).toLocaleString()} · {result.adoTeamSize} ADO devs · {result.cursorSeats} Cursor seats · Window: {result.fromDate} → {result.toDate}
              </span>
            )}
          </div>

          {loading && (
            <div className="background-notification loading">
              <div className="notification-spinner" />
              <span className="notification-text">Fetching Cursor analytics and ADO metrics…</span>
            </div>
          )}

          {error && (
            <div className="background-notification error">
              <span className="notification-text">Error: {error}</span>
            </div>
          )}

          {!loaded && !loading && !error && (
            <p className="placeholder-text">
              Click "Load Scorecard" to evaluate AI adoption against Bar 1, 2, and 3 thresholds using Cursor analytics and ADO delivery data.
            </p>
          )}

          {loaded && result && !loading && (
            <>
              {result.cursorApiError && (
                <div className="ladder-cursor-error">
                  <span className="ladder-cursor-error-icon">⚠</span>
                  <div>
                    <strong>Cursor API unavailable</strong> — Cursor-based criteria show as Unknown.
                    <span className="ladder-cursor-error-detail"> {result.cursorApiError}</span>
                  </div>
                </div>
              )}
              <TopGapsSummary result={result} />
              <div className="ladder-bars">
                {result.bars.map(bar => <BarCard key={bar.bar} bar={bar} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
