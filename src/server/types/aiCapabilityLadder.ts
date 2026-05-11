// AI Capability Ladder scorecard types

export type CriterionStatus = 'met' | 'at-risk' | 'not-met' | 'unknown';
export type EvidenceQuality = 'definitive' | 'configured' | 'inferred';
export type BarLabel = 'bar1' | 'bar2' | 'bar3';

export interface DeveloperGap {
  name: string;
  email: string;
  /** Current measured value (e.g. 0.35 for 35%) */
  currentValue: number | null;
  /** Human-readable current value string */
  currentDisplay: string;
  /** Recommended action */
  action: string;
}

export interface AiCodeWorkItemDeveloperAdoption {
  developer: string;
  totalAssignedWorkItems: number;
  aiCodeWorkItems: number;
  adoptionRate: number;
}

export interface AiCodeWorkItemAdoptionSummary {
  totalAssignedWorkItems: number;
  aiCodeWorkItems: number;
  adoptionRate: number | null;
  developerAdoption: AiCodeWorkItemDeveloperAdoption[];
}

export interface LadderCriterion {
  id: string;
  label: string;
  /** Row category matching the screenshot */
  category: 'adoption' | 'practice' | 'outcomes' | 'contribution';
  status: CriterionStatus;
  evidenceQuality: EvidenceQuality;
  /** Threshold description, e.g. ">=50% Cursor DAU sustained 2+ weeks" */
  threshold: string;
  /** The numeric target value (0–1 fractions, or absolute counts) */
  targetValue: number;
  /** The current measured value */
  currentValue: number | null;
  /** Human-readable current value */
  currentDisplay: string;
  /** Human-readable target */
  targetDisplay: string;
  /** Gap description */
  gapDisplay: string | null;
  /** Evidence source description */
  evidenceSource: string;
  /** Developers who are below threshold for this criterion */
  developersNeedingLift: DeveloperGap[];
}

export interface LadderBar {
  bar: BarLabel;
  title: string;
  /** Overall bar status — worst of all criteria */
  status: CriterionStatus;
  criteria: LadderCriterion[];
}

export interface AiCapabilityLadderResult {
  evaluatedAt: string;
  fromDate: string;
  toDate: string;
  /** Team roster size from ADO */
  adoTeamSize: number;
  /** Licensed Cursor seats */
  cursorSeats: number;
  bars: LadderBar[];
  /** Developers not yet using Cursor at all */
  developersWithoutCursorActivity: DeveloperGap[];
  /** Summary of top gaps across all bars */
  topGaps: LadderCriterion[];
  /** Set when Cursor API could not be reached; Cursor-based criteria will show unknown */
  cursorApiError: string | null;
}

export interface AiCapabilityBaseline {
  /** ISO date this baseline was captured */
  capturedAt: string;
  prCycleTimeDays: number | null;
  leadTimeDays: number | null;
  defectRatePerPbi: number | null;
  deploysPerMonth: number | null;
  trainingCompletionByDeveloper: Record<string, boolean>;
  identifiedUseCases: string[];
  skillContributions: Array<{ developer: string; skillName: string; sharedRegistry: boolean }>;
  crossTeamDemoEvidence: string[];
}
