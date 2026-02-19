export type {
  WorkItem,
  StateTransition,
  CycleTimeData,
  DueDateChange,
  DeveloperDueDateStats,
  DueDateHitRateStats,
  PullRequestTimeStats,
  QABugStats,
  DeploymentEnvironment,
  Deployment,
  Release,
  ReleaseMetrics,
} from '../../shared/types/workitem';

// Server-only request/response types

export interface WorkItemsQuery {
  from?: string;
  to?: string;
}

export interface UpdateDueDateRequest {
  dueDate: string | null;
  reason?: string;
}

export interface CreateDeploymentRequest {
  releaseVersion: string;
  environment: import('../../shared/types/workitem').DeploymentEnvironment;
  workItemIds: number[];
  notes?: string;
}
