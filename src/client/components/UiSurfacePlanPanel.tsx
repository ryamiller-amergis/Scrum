import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  UiSurfacePlan,
  PbiContribution,
  UiLayoutPattern,
  BacklogFeature,
  BacklogDocumentPayload,
} from '../../shared/types/backlog';
import ClarificationBlockerModal from './ClarificationBlockerModal';
import { getFeatureClarificationBlockers } from '../utils/clarificationGuard';
import styles from './UiSurfacePlanPanel.module.css';

/* ── API helpers ─────────────────────────────────────────────── */

async function apiGeneratePlan(
  scope: 'epic' | 'feature',
  epicId: string | undefined,
  featureId: string | undefined,
  document: BacklogDocumentPayload,
  pagePath: string,
  project: string,
  areaPath: string,
  additionalContext?: string
): Promise<UiSurfacePlan> {
  const res = await fetch('/api/backlog/generate-ui-plan', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, epicId, featureId, document, pagePath, project, areaPath, additionalContext }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `Generate plan failed: ${res.status}`);
  }
  return res.json();
}

async function apiSavePlan(
  scope: 'epic' | 'feature',
  epicId: string | undefined,
  featureId: string | undefined,
  plan: UiSurfacePlan,
  pagePath: string,
  project: string,
  areaPath: string
): Promise<UiSurfacePlan> {
  const res = await fetch('/api/backlog/ui-plan', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, epicId, featureId, plan, pagePath, project, areaPath }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `Save plan failed: ${res.status}`);
  }
  return res.json();
}

async function apiDeriveFromEpic(
  epicId: string,
  featureId: string,
  document: BacklogDocumentPayload,
  pagePath: string,
  project: string,
  areaPath: string
): Promise<UiSurfacePlan> {
  const res = await fetch('/api/backlog/derive-feature-plan-from-epic', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epicId, featureId, document, pagePath, project, areaPath }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `Derive plan failed: ${res.status}`);
  }
  return res.json();
}

/* ── Layout pattern labels ──────────────────────────────────── */

const LAYOUT_LABELS: Record<UiLayoutPattern, string> = {
  table: 'Table',
  calendar: 'Calendar',
  dashboard: 'Dashboard',
  form: 'Form',
  'detail-page': 'Detail page',
  wizard: 'Wizard',
  modal: 'Modal',
  drawer: 'Drawer',
  widget: 'Widget',
};

const CONTRIBUTION_LABELS: Record<string, string> = {
  'new-section': 'New section',
  'new-tab': 'New tab',
  'table-column': 'Table column',
  filter: 'Filter',
  action: 'Action',
  state: 'State',
  modal: 'Modal',
  drawer: 'Drawer',
  'no-ui': 'No UI',
};

/* ── PBI contribution row ────────────────────────────────────── */

const ContributionRow: React.FC<{ contribution: PbiContribution }> = ({ contribution }) => (
  <div className={styles.contributionRow}>
    <span className={styles.contributionPbi} title={contribution.pbiTitle}>
      {contribution.pbiTitle}
    </span>
    <span className={styles.contributionType}>
      {CONTRIBUTION_LABELS[contribution.contributionType] ?? contribution.contributionType}
    </span>
    <span className={styles.contributionArea}>{contribution.targetArea}</span>
    <span className={styles.contributionSummary}>{contribution.summary}</span>
  </div>
);

/* ── Props ──────────────────────────────────────────────────── */

interface UiSurfacePlanPanelProps {
  feature: BacklogFeature;
  document: BacklogDocumentPayload;
  pagePath: string;
  project: string;
  areaPath: string;
  /** Called when the plan is generated or updated so the parent can refresh the feature. */
  onPlanChange: (plan: UiSurfacePlan) => void;
  /** Whether a parent-level Generate All is in progress (disables actions). */
  externalBusy?: boolean;
}

/* ── Component ──────────────────────────────────────────────── */

export const UiSurfacePlanPanel: React.FC<UiSurfacePlanPanelProps> = ({
  feature,
  document,
  pagePath,
  project,
  areaPath,
  onPlanChange,
  externalBusy = false,
}) => {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [replanContext, setReplanContext] = useState('');
  const [showReplanInput, setShowReplanInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockerAction, setBlockerAction] = useState<string | null>(null);

  const plan = feature.uiSurfacePlan;
  const parentEpic = document.epics.find(e => e.id === feature.parentId);
  const epicHasPlan = !!parentEpic?.uiSurfacePlan;

  const childPBIs = document.pbis.filter(p => p.parentId === feature.id);

  // Detect sibling features in the same epic that already have a plan targeting
  // the same route — used to show a "shared surface" informational banner.
  const thisRoute =
    plan?.targetPageRoute ??
    feature.uiMock?.targetPageRoute ??
    parentEpic?.uiSurfacePlan?.targetPageRoute;

  const siblingsOnSameRoute = thisRoute
    ? document.features.filter(
        f =>
          f.id !== feature.id &&
          f.parentId === feature.parentId &&
          f.uiSurfacePlan?.targetPageRoute === thisRoute
      )
    : [];
  const hasSiblingsOnSameRoute = siblingsOnSameRoute.length > 0;
  const clarificationBlockers = getFeatureClarificationBlockers(feature, childPBIs);
  const hasClarificationBlockers = clarificationBlockers.length > 0;

  const guardedAction = (action: string, fn: () => void) => {
    if (hasClarificationBlockers) {
      setBlockerAction(action);
    } else {
      fn();
    }
  };

  const generateMutation = useMutation({
    mutationFn: (contextOverride?: string) =>
      apiGeneratePlan(
        'feature',
        parentEpic?.id,
        feature.id,
        document,
        pagePath,
        project,
        areaPath,
        (contextOverride ?? additionalContext).trim() || undefined
      ),
    onSuccess: (newPlan) => {
      setError(null);
      setAdditionalContext('');
      setReplanContext('');
      setShowReplanInput(false);
      onPlanChange(newPlan);
      queryClient.invalidateQueries({ queryKey: ['backlog-drafts'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const deriveMutation = useMutation({
    mutationFn: () => {
      if (!parentEpic) throw new Error('No parent epic');
      return apiDeriveFromEpic(parentEpic.id, feature.id, document, pagePath, project, areaPath);
    },
    onSuccess: (newPlan) => {
      setError(null);
      onPlanChange(newPlan);
      queryClient.invalidateQueries({ queryKey: ['backlog-drafts'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: (updatedPlan: UiSurfacePlan) =>
      apiSavePlan('feature', parentEpic?.id, feature.id, updatedPlan, pagePath, project, areaPath),
    onSuccess: (savedPlan) => {
      setError(null);
      onPlanChange(savedPlan);
      queryClient.invalidateQueries({ queryKey: ['backlog-drafts'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const isBusy = externalBusy || generateMutation.isPending || deriveMutation.isPending || saveMutation.isPending;

  /* ── Empty state ── */
  if (!plan) {
    return (
      <>
        {blockerAction && (
          <ClarificationBlockerModal
            action={blockerAction}
            blockers={clarificationBlockers}
            onClose={() => setBlockerAction(null)}
          />
        )}
        <div className={styles.panel}>
          <div className={styles.emptyHeader}>
            <span className={styles.emptyTitle}>UI Surface Plan</span>
            <span className={styles.emptyHint}>
              Plan the shared page structure before generating PBI mocks.
            </span>
          </div>
          {hasSiblingsOnSameRoute && (
            <div className={styles.sharedSurfaceBanner}>
              <span className={styles.sharedSurfaceIcon}>⇢</span>
              <span>
                <strong>Shared surface detected.</strong>{' '}
                {siblingsOnSameRoute.length === 1
                  ? `Feature "${siblingsOnSameRoute[0].title}" already`
                  : `${siblingsOnSameRoute.length} other features`}{' '}
                target{siblingsOnSameRoute.length === 1 ? 's' : ''}{' '}
                <code className={styles.routeCode}>{thisRoute}</code>.
                Your plan will be generated as an additive delta — the page structure will not be re-planned.
              </span>
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.emptyActions}>
            <textarea
              className={styles.contextInput}
              placeholder="Optional context — e.g. &quot;fits within the Shift Scheduler screen&quot;, &quot;target persona: staffing coordinator&quot;"
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              rows={2}
              disabled={isBusy}
            />
            <div className={styles.emptyButtons}>
              <button
                className={styles.btnGenerate}
                onClick={() => guardedAction('Plan UI Surface', () => { setError(null); generateMutation.mutate(additionalContext); })}
                disabled={isBusy}
              >
                {generateMutation.isPending ? 'Planning…' : 'Plan UI Surface'}
              </button>
              {epicHasPlan && (
                <button
                  className={styles.btnDerive}
                  onClick={() => guardedAction('Derive from Epic Plan', () => { setError(null); deriveMutation.mutate(); })}
                  disabled={isBusy}
                  title="Derive this feature's plan from the parent epic's plan"
                >
                  {deriveMutation.isPending ? 'Deriving…' : 'Derive from Epic Plan'}
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Populated state ── */
  return (
    <>
      {blockerAction && (
        <ClarificationBlockerModal
          action={blockerAction}
          blockers={clarificationBlockers}
          onClose={() => setBlockerAction(null)}
        />
      )}
    <div className={styles.panel}>
      <div className={styles.header}>
        <button
          className={styles.toggleBtn}
          onClick={() => setIsExpanded(e => !e)}
          aria-expanded={isExpanded}
        >
          <span className={styles.toggleIcon}>{isExpanded ? '▾' : '▸'}</span>
          <span className={styles.headerTitle}>UI Surface Plan</span>
          <span className={styles.headerMeta}>
            {plan.decision === 'update-page' && plan.targetPageTitle
              ? `Update: ${plan.targetPageTitle}`
              : plan.decision === 'new-page' && plan.targetPageTitle
                ? `New page: ${plan.targetPageTitle}`
                : plan.decision === 'no-ui'
                  ? 'No UI'
                  : plan.decision}
            {plan.layoutPattern ? ` · ${LAYOUT_LABELS[plan.layoutPattern] ?? plan.layoutPattern}` : ''}
          </span>
          {plan.status === 'approved' && <span className={styles.approvedBadge}>✓ Approved</span>}
        </button>
        <div className={styles.headerActions}>
          <button
            className={`${styles.btnRegenerate}${showReplanInput ? ` ${styles.btnRegenerateActive}` : ''}`}
            onClick={() => {
              if (isBusy) return;
              setShowReplanInput(v => !v);
              setError(null);
            }}
            disabled={isBusy}
            title="Provide reasoning and replan"
          >
            ↻ Replan
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {showReplanInput && (
        <div className={styles.replanBox}>
          <textarea
            className={styles.replanInput}
            placeholder="Optional — describe what should change: e.g. &quot;move this to a modal instead of a new tab&quot;, &quot;the BA confirmed this belongs on the Timecards page&quot;, &quot;add a summary dashboard card&quot;…"
            value={replanContext}
            onChange={e => setReplanContext(e.target.value)}
            rows={3}
            disabled={isBusy}
            autoFocus
          />
          <div className={styles.replanActions}>
            <button
              className={styles.btnCancelReplan}
              onClick={() => { setShowReplanInput(false); setReplanContext(''); setError(null); }}
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              className={styles.btnGenerate}
              onClick={() => guardedAction('Replan UI Surface', () => {
                setError(null);
                generateMutation.mutate(replanContext);
              })}
              disabled={isBusy}
            >
              {generateMutation.isPending ? 'Planning…' : '↻ Replan'}
            </button>
          </div>
        </div>
      )}

      {hasSiblingsOnSameRoute && (
        <div className={styles.sharedSurfaceBanner}>
          <span className={styles.sharedSurfaceIcon}>⇢</span>
          <span>
            <strong>Shared surface.</strong>{' '}
            {siblingsOnSameRoute.length === 1
              ? `Feature "${siblingsOnSameRoute[0].title}" also`
              : `${siblingsOnSameRoute.length} other features`}{' '}
            target{siblingsOnSameRoute.length === 1 ? 's' : ''}{' '}
            <code className={styles.routeCode}>{thisRoute}</code>.
            Replanning will extend the shared surface, not replace it.
          </span>
        </div>
      )}

      {isExpanded && (
        <div className={styles.body}>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Decision</span>
              <span className={styles.metaValue}>{plan.decision}</span>
            </div>
            {plan.targetPageRoute && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Route</span>
                <code className={styles.metaCode}>{plan.targetPageRoute}</code>
              </div>
            )}
            {plan.targetPageTitle && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Page title</span>
                <span className={styles.metaValue}>{plan.targetPageTitle}</span>
              </div>
            )}
            {plan.layoutPattern && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Layout</span>
                <span className={styles.metaValue}>{LAYOUT_LABELS[plan.layoutPattern]}</span>
              </div>
            )}
          </div>

          {plan.subTabs.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Sub-tabs</span>
              <div className={styles.tagList}>
                {plan.subTabs.map(t => (
                  <span key={t} className={t === plan.activeSubTab ? styles.tagActive : styles.tag}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {plan.primaryComponents.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Primary components</span>
              <div className={styles.tagList}>
                {plan.primaryComponents.map(c => (
                  <code key={c} className={styles.componentTag}>{c}</code>
                ))}
              </div>
            </div>
          )}

          {plan.rationale && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Rationale</span>
              <p className={styles.rationale}>{plan.rationale}</p>
            </div>
          )}

          {plan.pbiContributions.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>PBI contributions</span>
              <div className={styles.contributionTable}>
                <div className={styles.contributionHeaderRow}>
                  <span>PBI</span>
                  <span>Type</span>
                  <span>Target area</span>
                  <span>Delta</span>
                </div>
                {plan.pbiContributions.map(c => (
                  <ContributionRow key={c.pbiId} contribution={c} />
                ))}
              </div>
            </div>
          )}

          {plan.inheritedFromEpicId && (
            <p className={styles.inheritedNote}>Derived from epic-level plan.</p>
          )}

          <div className={styles.planFooter}>
            <span className={styles.planVersion}>v{plan.planVersion}</span>
            <button
              className={styles.btnApprove}
              disabled={isBusy || plan.status === 'approved'}
              onClick={() => {
                if (!plan) return;
                saveMutation.mutate({ ...plan, status: 'approved' });
              }}
            >
              {plan.status === 'approved' ? '✓ Approved' : 'Approve Plan'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
