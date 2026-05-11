// Client-side types for AI Capability Ladder (mirrors server types, no server imports)

export type CriterionStatus = 'met' | 'at-risk' | 'not-met' | 'unknown';
export type EvidenceQuality = 'definitive' | 'configured' | 'inferred';
export type BarLabel = 'bar1' | 'bar2' | 'bar3';

export interface DeveloperGap {
  name: string;
  email: string;
  currentValue: number | null;
  currentDisplay: string;
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
  category: 'adoption' | 'practice' | 'outcomes' | 'contribution';
  status: CriterionStatus;
  evidenceQuality: EvidenceQuality;
  threshold: string;
  targetValue: number;
  currentValue: number | null;
  currentDisplay: string;
  targetDisplay: string;
  gapDisplay: string | null;
  evidenceSource: string;
  developersNeedingLift: DeveloperGap[];
}

export interface LadderBar {
  bar: BarLabel;
  title: string;
  status: CriterionStatus;
  criteria: LadderCriterion[];
}

export interface AiCapabilityLadderResult {
  evaluatedAt: string;
  fromDate: string;
  toDate: string;
  adoTeamSize: number;
  cursorSeats: number;
  bars: LadderBar[];
  developersWithoutCursorActivity: DeveloperGap[];
  topGaps: LadderCriterion[];
  /** Set when the Cursor API could not be reached; Cursor criteria show as unknown */
  cursorApiError: string | null;
}
