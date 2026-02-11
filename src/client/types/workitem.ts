export interface WorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo?: string;
  dueDate?: string;
  targetDate?: string;
  qaCompleteDate?: string;
  workItemType: string;
  changedDate: string;
  createdDate: string;
  closedDate?: string;
  areaPath: string;
  iterationPath: string;
  tags?: string;
  cycleTime?: CycleTimeData;
  description?: string;
  acceptanceCriteria?: string;
  reproSteps?: string;
  design?: string;
  discussions?: string;
}

export interface StateTransition {
  fromState: string;
  toState: string;
  changedDate: string;
  changedBy?: string;
}

export interface CycleTimeData {
  inProgressDate?: string;
  qaReadyDate?: string;
  cycleTimeDays?: number;
}

export interface DueDateChange {
  changedDate: string;
  changedBy: string;
  oldDueDate?: string;
  newDueDate?: string;
  reason?: string;
}

export interface DeveloperDueDateStats {
  developer: string;
  totalChanges: number;
  reasonBreakdown: { [reason: string]: number };
}

export interface DueDateHitRateStats {
  developer: string;
  totalWorkItems: number;
  hitDueDate: number;
  missedDueDate: number;
  hitRate: number;
  workItemDetails: Array<{
    id: number;
    title: string;
    dueDate: string;
    completionDate: string;
    hit: boolean;
    status: 'hit' | 'miss' | 'in-progress';
  }>;
}

export interface PullRequestTimeStats {
  developer: string;
  totalItemsInPullRequest: number;
  averageTimeInPullRequest: number;
  totalTimeInPullRequest: number;
  workItemDetails: Array<{
    id: number;
    title: string;
    timeInPullRequestDays: number;
    enteredPullRequestDate: string;
    exitedPullRequestDate: string;
  }>;
}

export interface QABugStats {
  developer: string;
  totalPBIs: number;
  totalBugs: number;
  averageBugsPerPBI: number;
  pbiDetails: Array<{
    id: number;
    title: string;
    bugCount: number;
    bugs: Array<{
      id: number;
      title: string;
      state: string;
    }>;
  }>;
}

export type DeploymentEnvironment = 'dev' | 'staging' | 'production';

export interface Deployment {
  id: string;
  releaseVersion: string;
  environment: DeploymentEnvironment;
  workItemIds: number[];
  deployedBy: string;
  deployedAt: string;
  notes?: string;
}

export interface Release {
  version: string;
  name: string;
  targetDate?: string;
  features: WorkItem[];
  status: 'planning' | 'in-progress' | 'ready' | 'deployed' | 'completed';
  completionPercentage: number;
  health: 'on-track' | 'at-risk' | 'blocked';
  deployments: Deployment[];
}

export interface ReleaseMetrics {
  releaseVersion: string;
  totalFeatures: number;
  completedFeatures: number;
  inProgressFeatures: number;
  blockedFeatures: number;
  readyForReleaseFeatures: number;
  averageLeadTime?: number;
  deploymentHistory: Deployment[];
}
