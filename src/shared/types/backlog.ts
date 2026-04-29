export type BacklogStatus = 'Draft' | 'Approved' | 'Rejected' | string;

/* ── Structured clarification types ────────────────────────── */

export interface ClarificationQuestion {
  title: string;
  answers: string[];
}

/** A single answered question: the selected answer label and optional freeform text for "Other" answers. */
export interface ClarificationAnswer {
  questionTitle: string;
  selectedAnswer: string;
  freeformText?: string;
}

export interface ClarificationResponses {
  businessClarifications?: ClarificationAnswer[];
  uiUxClarifications?: ClarificationAnswer[];
}

/* ── UI Surface Plan types ─────────────────────────────────── */

/** The broad visual/layout category for a page or widget. */
export type UiLayoutPattern =
  | 'table' | 'calendar' | 'dashboard' | 'form' | 'detail-page'
  | 'wizard' | 'modal' | 'drawer' | 'widget';

/** How a single PBI contributes to the shared UI surface. */
export type PbiContributionType =
  | 'new-section' | 'new-tab' | 'table-column' | 'filter'
  | 'action' | 'state' | 'modal' | 'drawer' | 'no-ui';

/** The planned contribution of one PBI to its parent feature/epic UI surface. */
export interface PbiContribution {
  pbiId: string;
  pbiTitle: string;
  contributionType: PbiContributionType;
  /** The area of the page this contribution targets, e.g. "toolbar", "Schedule tab", "row actions". */
  targetArea: string;
  /** One-line summary of the delta, e.g. "Add a date-range filter to the toolbar". */
  summary: string;
}

/**
 * A structured UI surface plan generated at the epic or feature level.
 * Acts as the shared page-level contract that PBI mocks must stay within.
 * Persisted alongside the backlog draft so it survives between sessions.
 */
export interface UiSurfacePlan {
  scope: 'epic' | 'feature';
  /** Mirrors UiMockDecision: whether this is a new page, update to existing, or no UI. */
  decision: UiMockDecision;
  targetPageRoute?: string;
  targetPageTitle?: string;
  subTabs: string[];
  activeSubTab?: string;
  layoutPattern?: UiLayoutPattern;
  /** MWx Design System component names recommended for this surface, e.g. ['DataTable', 'StatusChip']. */
  primaryComponents: string[];
  rationale: string;
  /** One entry per child PBI describing its planned contribution to this surface. */
  pbiContributions: PbiContribution[];
  /** Set when this feature plan was derived from a parent epic plan. */
  inheritedFromEpicId?: string;
  planVersion: number;
  status: 'draft' | 'approved';
  createdAt: string;
  updatedAt: string;
}

/* ── UI Mock types ─────────────────────────────────────────── */

export type UiMockDecision = 'new-page' | 'update-page' | 'no-ui';

export interface UiMockHistoryEntry {
  version: number;
  decision: UiMockDecision;
  rationale: string;
  targetPageRoute?: string;
  targetPageTitle?: string;
  mockHtml?: string;
  feedback?: string;
  createdAt: string;
}

export interface UiMock {
  decision: UiMockDecision;
  rationale: string;
  targetPageRoute?: string;
  targetPageTitle?: string;
  mockHtml?: string;
  mockVersion: number;
  status: 'draft' | 'approved';
  history: UiMockHistoryEntry[];
  /** Sub-tab labels defined for this page, e.g. ["Recurring Requests", "Calendar View"].
   *  Persisted so PBI-view generation can read the established tab structure. */
  targetPageSubTabs?: string[];
  /** Which version number was explicitly approved. When set, mockHtml holds that version's HTML. */
  approvedVersion?: number;
  /** Set to true on approval so the Cursor agent can auto-push to Figma */
  pendingFigmaExport?: boolean;
  /** Figma page URL created by generate_figma_design after export */
  figmaUrl?: string;
  /** ISO timestamp of when the Figma design was created */
  figmaCreatedAt?: string;
  /** Set to true by the UX designer once the Figma design is polished and ready for dev */
  designReady?: boolean;
  /** ISO timestamp of when the design was marked ready */
  designReadyAt?: string;
  /** Per-PBI view mocks — each PBI that requires a distinct screen gets its own entry */
  views?: UiMockView[];
}

/**
 * One of N parallel alternative mocks generated for a single PBI in a single Generate All run.
 * Each variant has its own independent regenerate history so refining variant B doesn't affect A.
 */
export interface UiMockVariant {
  variantId: string;
  /** Short human-readable label, e.g. "Variant A", "Variant B". */
  variantLabel: string;
  /** The layout hint that was passed to the model to produce this variant (shown as a tooltip). */
  variantHint: string;
  decision: UiMockDecision;
  rationale: string;
  targetPageRoute?: string;
  targetPageTitle?: string;
  mockHtml?: string;
  mockVersion: number;
  history: UiMockHistoryEntry[];
  approvedVersion?: number;
  pendingFigmaExport?: boolean;
  figmaUrl?: string;
  figmaCreatedAt?: string;
  designReady?: boolean;
  designReadyAt?: string;
}

/** A UI mock scoped to a single PBI — independently generated, versioned, and approved. */
export interface UiMockView {
  pbiId: string;
  pbiTitle: string;
  decision: UiMockDecision;
  rationale: string;
  targetPageRoute?: string;
  targetPageTitle?: string;
  mockHtml?: string;
  mockVersion: number;
  status: 'draft' | 'approved';
  history: UiMockHistoryEntry[];
  /** Which version number was explicitly approved. When set, mockHtml holds that version's HTML. */
  approvedVersion?: number;
  pendingFigmaExport?: boolean;
  figmaUrl?: string;
  figmaCreatedAt?: string;
  designReady?: boolean;
  designReadyAt?: string;
  /**
   * Parallel alternative mocks generated in one Generate All batch.
   * The active variant's fields are mirrored onto the view's top-level fields
   * so all existing readers (preview, version dropdown, Figma export) work unchanged.
   */
  variants?: UiMockVariant[];
  /** Id of the currently selected variant (e.g. "A"). Undefined when variants is absent. */
  activeVariantId?: string;
}

export interface BacklogEpic {
  id: string;
  workItemType: 'Epic';
  status: BacklogStatus;
  title: string;
  description?: string;
  priority?: string;
  tags?: string[];
  confidence?: string;
  sourceEvidence?: string;
  /** @deprecated Use businessClarifications / uiUxClarifications */
  clarificationNeeded?: string;
  businessClarifications?: ClarificationQuestion[];
  uiUxClarifications?: ClarificationQuestion[];
  adoWorkItemId?: number;
  adoWorkItemUrl?: string;
  /** Optional UI surface plan covering all features/PBIs under this epic. */
  uiSurfacePlan?: UiSurfacePlan;
}

export interface FeatureFlag {
  enabled: boolean;
  name?: string;
}

export interface BacklogFeature {
  id: string;
  parentId: string;
  workItemType: 'Feature';
  status: BacklogStatus;
  title: string;
  description?: string;
  priority?: string;
  tags?: string[];
  confidence?: string;
  sourceEvidence?: string;
  /** @deprecated Use businessClarifications / uiUxClarifications */
  clarificationNeeded?: string;
  businessClarifications?: ClarificationQuestion[];
  uiUxClarifications?: ClarificationQuestion[];
  featureFlag?: FeatureFlag;
  adoWorkItemId?: number;
  adoWorkItemUrl?: string;
  uiMock?: UiMock;
  /** UI surface plan that governs all PBI mocks under this feature. */
  uiSurfacePlan?: UiSurfacePlan;
}

export interface BacklogPBI {
  id: string;
  parentId: string;
  workItemType: 'PBI';
  status: BacklogStatus;
  title: string;
  description?: string;
  priority?: string;
  tags?: string[];
  confidence?: string;
  sourceEvidence?: string;
  /** @deprecated Use businessClarifications / uiUxClarifications */
  clarificationNeeded?: string;
  businessClarifications?: ClarificationQuestion[];
  uiUxClarifications?: ClarificationQuestion[];
  acceptanceCriteria?: string[];
  adoWorkItemId?: number;
  adoWorkItemUrl?: string;
}

export type BacklogNode = BacklogEpic | BacklogFeature | BacklogPBI;

export interface BacklogDocumentPayload {
  epics: BacklogEpic[];
  features: BacklogFeature[];
  pbis: BacklogPBI[];
}

export interface BacklogDocument {
  id: number;
  title: string;
  path: string;
  url?: string;
  document: BacklogDocumentPayload;
}
