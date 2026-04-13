import React, { useState } from 'react';
import { AIWorkItemHealthSummary } from '../types/workitem';
import styles from './WorkItemHealthSection.module.css';

interface WorkItemHealthSectionProps {
  summary: AIWorkItemHealthSummary;
  onSelectItem?: (id: number) => void;
}

// ── Score helpers ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#4caf50';
  if (score >= 50) return '#ff9800';
  return '#f44336';
}

function scoreGrade(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

function metricRating(value: number, thresholds: [number, number]): 'good' | 'warn' | 'bad' {
  const [good, warn] = thresholds;
  if (value <= good) return 'good';
  if (value <= warn) return 'warn';
  return 'bad';
}

function rateRating(rate: number, thresholds: [number, number]): 'good' | 'warn' | 'bad' {
  const [bad, warn] = thresholds;
  if (rate >= warn) return 'good';
  if (rate >= bad) return 'warn';
  return 'bad';
}

// Computes individual sub-scores used to build the aggregate (mirrors server logic)
function computeSubScores(s: AIWorkItemHealthSummary) {
  const scoreDevTime = s.avgDevTimeDays > 0
    ? Math.max(0, Math.min(100, 100 - Math.max(0, s.avgDevTimeDays - 2) * (100 / 13)))
    : 50;
  const scoreBugs = Math.max(0, 100 - s.avgBugCount * 20);
  const scorePRMods = Math.max(0, 100 - s.avgPRModifications * 33);
  const scoreCycleTime = s.avgFullCycleTimeDays > 0
    ? Math.max(0, Math.min(100, 100 - Math.max(0, s.avgFullCycleTimeDays - 5) * (100 / 25)))
    : 50;
  const scoreRework = Math.round((1 - s.reworkRate) * 100);
  const scoreFirstPass = Math.round(s.firstPassRate * 100);
  return { scoreDevTime, scoreBugs, scorePRMods, scoreCycleTime, scoreRework, scoreFirstPass };
}

// ── Aggregate score ring ──────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
}

const ScoreRing: React.FC<ScoreRingProps> = ({ score }) => {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <div className={styles['scoreRing']}>
      <svg className={styles['scoreRingSvg']} width="96" height="96" viewBox="0 0 96 96">
        <circle className={styles['scoreRingTrack']} cx="48" cy="48" r={r} />
        <circle
          className={styles['scoreRingFill']}
          cx="48"
          cy="48"
          r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles['scoreLabel']}>
        <span className={styles['scoreValue']}>{score}</span>
        <span className={styles['scoreGrade']} style={{ color }}>
          {scoreGrade(score)}
        </span>
      </div>
    </div>
  );
};

// ── Individual metric card ────────────────────────────────────────────────────

interface MetricCardProps {
  icon: string;
  title: string;
  description: string;
  primaryValue: string;
  primaryUnit?: string;
  rating: 'good' | 'warn' | 'bad';
  ratingLabel: string;
  secondaries: Array<{ label: string; value: string }>;
  barPercent?: number;
  barColor?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  title,
  description,
  primaryValue,
  primaryUnit,
  rating,
  ratingLabel,
  secondaries,
  barPercent,
  barColor,
}) => (
  <div className={styles['metricCard']}>
    <div className={styles['metricCardHeader']}>
      <span className={styles['metricIcon']}>{icon}</span>
      <div className={styles['metricTitleGroup']}>
        <p className={styles['metricTitle']}>{title}</p>
        <p className={styles['metricDescription']}>{description}</p>
      </div>
      <span className={`${styles['metricBadge']} ${styles[rating]}`}>{ratingLabel}</span>
    </div>

    <div className={styles['metricPrimaryValue']}>
      {primaryValue}
      {primaryUnit && <span className={styles['metricPrimaryUnit']}>{primaryUnit}</span>}
    </div>

    {barPercent !== undefined && (
      <div className={styles['metricBar']}>
        <div
          className={styles['metricBarFill']}
          style={{ width: `${Math.min(100, barPercent)}%`, background: barColor ?? scoreColor(barPercent) }}
        />
      </div>
    )}

    {secondaries.length > 0 && (
      <div className={styles['metricSecondaryRow']}>
        {secondaries.map(({ label, value }) => (
          <div key={label} className={styles['metricSecondary']}>
            <span className={styles['metricSecondaryValue']}>{value}</span>
            <span className={styles['metricSecondaryLabel']}>{label}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Drill-down modal ──────────────────────────────────────────────────────────

interface DrillDownProps {
  summary: AIWorkItemHealthSummary;
  onClose: () => void;
  onSelectItem?: (id: number) => void;
}

const DrillDownPanel: React.FC<DrillDownProps> = ({ summary, onClose, onSelectItem }) => {
  const sub = computeSubScores(summary);

  const subScoreRows: Array<{ label: string; score: number; weight: string }> = [
    { label: 'Dev Time', score: Math.round(sub.scoreDevTime), weight: '20%' },
    { label: 'Bug Count', score: Math.round(sub.scoreBugs), weight: '25%' },
    { label: 'PR Mods', score: Math.round(sub.scorePRMods), weight: '15%' },
    { label: 'Cycle Time', score: Math.round(sub.scoreCycleTime), weight: '15%' },
    { label: 'Rework', score: sub.scoreRework, weight: '10%' },
    { label: 'First-Pass', score: sub.scoreFirstPass, weight: '15%' },
  ];

  return (
    <div className={styles['drillDownOverlay']} onClick={onClose}>
      <div
        className={styles['drillDownPanel']}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Work Item Health Detail"
      >
        <div className={styles['drillDownHeader']}>
          <h3>Work Item Health — Score Breakdown</h3>
          <button className={styles['drillDownClose']} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles['drillDownBody']}>
          {/* Per-dimension score tiles */}
          <div className={styles['drillScoreGrid']}>
            {subScoreRows.map(({ label, score, weight }) => (
              <div key={label} className={styles['drillScoreItem']}>
                <span className={styles['drillScoreLabel']}>{label}</span>
                <span className={styles['drillScoreValue']} style={{ color: scoreColor(score) }}>
                  {score}
                </span>
                <span className={styles['drillScoreWeight']}>Weight: {weight}</span>
              </div>
            ))}
          </div>

          {/* Per-item table */}
          <p className={styles['drillItemsHeader']}>
            All {summary.totalItems} AI-Coded Work Items
          </p>

          {summary.items.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px' }}>
              No work items found for the selected time frame.
            </p>
          ) : (
            <table className={styles['drillItemsTable']}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Assigned To</th>
                  <th>Dev Time</th>
                  <th>Bugs</th>
                  <th>PR Mods</th>
                  <th>Cycle Time</th>
                  <th>First Pass</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => (
                  <tr
                    key={item.id}
                    className={styles['drillItemRow']}
                    onClick={() => onSelectItem?.(item.id)}
                    title={onSelectItem ? 'Click to open work item details' : undefined}
                  >
                    <td className={styles['drillItemId']}>#{item.id}</td>
                    <td className={styles['drillItemTitle']} title={item.title}>
                      {item.title}
                    </td>
                    <td className={styles['drillItemAssignee']} title={item.assignedTo}>
                      {item.assignedTo || '—'}
                    </td>
                    <td>
                      {item.devTimeDays !== null ? `${item.devTimeDays}d` : '—'}
                    </td>
                    <td>{item.bugCount}</td>
                    <td>{item.prModificationRounds}</td>
                    <td>
                      {item.fullCycleTimeDays !== null ? `${item.fullCycleTimeDays}d` : '—'}
                    </td>
                    <td>
                      <span
                        className={`${styles['drillPassBadge']} ${
                          item.isFirstPassSuccess ? styles['pass'] : styles['fail']
                        }`}
                      >
                        {item.isFirstPassSuccess ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main section component ────────────────────────────────────────────────────

export const WorkItemHealthSection: React.FC<WorkItemHealthSectionProps> = ({
  summary,
  onSelectItem,
}) => {
  const [drillOpen, setDrillOpen] = useState(false);

  if (summary.totalItems === 0) {
    return (
      <div className={styles['emptyState']}>
        <span className={styles['emptyIcon']}>🤖</span>
        <p className={styles['emptyText']}>
          No work items tagged <strong>ai-code</strong> were found for the selected time frame.
        </p>
      </div>
    );
  }

  const firstPassPct = Math.round(summary.firstPassRate * 100);
  const reworkPct = Math.round(summary.reworkRate * 100);

  const devTimeRating = metricRating(summary.avgDevTimeDays, [5, 10]);
  const bugRating = metricRating(summary.avgBugCount, [0.5, 2]);
  const prModRating = metricRating(summary.avgPRModifications, [0.5, 1.5]);
  const cycleTimeRating = metricRating(summary.avgFullCycleTimeDays, [10, 20]);
  const reworkRating = rateRating(summary.reworkRate, [0.3, 0.1]);
  const firstPassRating = rateRating(summary.firstPassRate, [0.5, 0.75]);

  const metricCards: MetricCardProps[] = [
    {
      icon: '⚡',
      title: 'Dev Time',
      description: 'Avg days from In Progress → In Pull Request',
      primaryValue: summary.avgDevTimeDays > 0 ? String(summary.avgDevTimeDays) : '—',
      primaryUnit: summary.avgDevTimeDays > 0 ? ' days avg' : '',
      rating: devTimeRating,
      ratingLabel: devTimeRating === 'good' ? 'On Track' : devTimeRating === 'warn' ? 'Slow' : 'Critical',
      secondaries: [
        { label: 'Median', value: summary.medianDevTimeDays > 0 ? `${summary.medianDevTimeDays}d` : '—' },
        { label: 'Items measured', value: String(summary.items.filter(i => i.devTimeDays !== null).length) },
      ],
      barPercent: summary.avgDevTimeDays > 0
        ? Math.max(0, 100 - Math.max(0, summary.avgDevTimeDays - 2) * (100 / 13))
        : undefined,
    },
    {
      icon: '🐛',
      title: 'Bugs to UAT',
      description: 'Avg linked bugs before UAT Ready for Test',
      primaryValue: String(summary.avgBugCount),
      primaryUnit: ' bugs avg',
      rating: bugRating,
      ratingLabel: bugRating === 'good' ? 'Clean' : bugRating === 'warn' ? 'Some Bugs' : 'Bug-Heavy',
      secondaries: [
        { label: 'Total bugs', value: String(summary.items.reduce((s, i) => s + i.bugCount, 0)) },
        { label: 'Zero-bug items', value: `${summary.itemsWithZeroBugs}/${summary.totalItems}` },
      ],
      barPercent: Math.max(0, 100 - summary.avgBugCount * 20),
    },
    {
      icon: '🔄',
      title: 'PR Modifications',
      description: 'Avg re-submissions after initial PR',
      primaryValue: String(summary.avgPRModifications),
      primaryUnit: ' rounds avg',
      rating: prModRating,
      ratingLabel: prModRating === 'good' ? 'Clean Merge' : prModRating === 'warn' ? 'Some Rework' : 'High Churn',
      secondaries: [
        { label: 'Clean merges', value: `${summary.itemsWithCleanPRMerge}/${summary.totalItems}` },
      ],
      barPercent: Math.max(0, 100 - summary.avgPRModifications * 33),
    },
    {
      icon: '⏱️',
      title: 'Full Cycle Time',
      description: 'Avg days from In Progress → UAT Ready for Test',
      primaryValue: summary.avgFullCycleTimeDays > 0 ? String(summary.avgFullCycleTimeDays) : '—',
      primaryUnit: summary.avgFullCycleTimeDays > 0 ? ' days avg' : '',
      rating: cycleTimeRating,
      ratingLabel: cycleTimeRating === 'good' ? 'Fast' : cycleTimeRating === 'warn' ? 'Moderate' : 'Slow',
      secondaries: [
        { label: 'Items measured', value: String(summary.items.filter(i => i.fullCycleTimeDays !== null).length) },
      ],
      barPercent: summary.avgFullCycleTimeDays > 0
        ? Math.max(0, 100 - Math.max(0, summary.avgFullCycleTimeDays - 5) * (100 / 25))
        : undefined,
    },
    {
      icon: '↩️',
      title: 'Rework Rate',
      description: 'Percentage of items with backward state regression',
      primaryValue: `${reworkPct}%`,
      primaryUnit: ' of items',
      rating: reworkRating,
      ratingLabel: reworkRating === 'good' ? 'Low' : reworkRating === 'warn' ? 'Moderate' : 'High',
      secondaries: [
        { label: 'Items with rework', value: String(summary.items.filter(i => i.hasRework).length) },
        { label: 'Clean items', value: String(summary.items.filter(i => !i.hasRework).length) },
      ],
      barPercent: 100 - reworkPct,
      barColor: scoreColor(100 - reworkPct),
    },
    {
      icon: '✅',
      title: 'First-Pass Success',
      description: 'Items reaching UAT with zero bugs and no state regressions',
      primaryValue: `${firstPassPct}%`,
      primaryUnit: ' of items',
      rating: firstPassRating,
      ratingLabel: firstPassRating === 'good' ? 'Strong' : firstPassRating === 'warn' ? 'Average' : 'Low',
      secondaries: [
        { label: 'Clean passes', value: String(summary.items.filter(i => i.isFirstPassSuccess).length) },
        { label: 'Total items', value: String(summary.totalItems) },
      ],
      barPercent: firstPassPct,
      barColor: scoreColor(firstPassPct),
    },
  ];

  return (
    <>
      {/* Aggregate health card — click to drill down */}
      <div className={styles['aggregateCard']} onClick={() => setDrillOpen(true)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setDrillOpen(true)}>
        <ScoreRing score={summary.aggregateScore} />

        <div className={styles['aggregateInfo']}>
          <p className={styles['aggregateTitle']}>Work Item Health Score</p>
          <p className={styles['aggregateSubtitle']}>
            {summary.totalItems} ai-code item{summary.totalItems !== 1 ? 's' : ''} — click to see the full breakdown
          </p>
          <div className={styles['aggregateKpis']}>
            <div className={styles['aggregateKpi']}>
              <span className={styles['aggregateKpiValue']}>{firstPassPct}%</span>
              <span className={styles['aggregateKpiLabel']}>First-Pass</span>
            </div>
            <div className={styles['aggregateKpi']}>
              <span className={styles['aggregateKpiValue']}>{summary.avgBugCount}</span>
              <span className={styles['aggregateKpiLabel']}>Avg Bugs</span>
            </div>
            <div className={styles['aggregateKpi']}>
              <span className={styles['aggregateKpiValue']}>
                {summary.avgDevTimeDays > 0 ? `${summary.avgDevTimeDays}d` : '—'}
              </span>
              <span className={styles['aggregateKpiLabel']}>Avg Dev Time</span>
            </div>
            <div className={styles['aggregateKpi']}>
              <span className={styles['aggregateKpiValue']}>
                {summary.avgFullCycleTimeDays > 0 ? `${summary.avgFullCycleTimeDays}d` : '—'}
              </span>
              <span className={styles['aggregateKpiLabel']}>Avg Cycle</span>
            </div>
          </div>
        </div>

        <span className={styles['aggregateChevron']}>›</span>
      </div>

      {/* Individual metric cards */}
      <div className={styles['metricsGrid']}>
        {metricCards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </div>

      {/* Drill-down modal */}
      {drillOpen && (
        <DrillDownPanel
          summary={summary}
          onClose={() => setDrillOpen(false)}
          onSelectItem={onSelectItem}
        />
      )}
    </>
  );
};
