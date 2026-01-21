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
  cycleTime?: CycleTimeData;
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
  assignedTo?: string;
  uatReadyDate?: string;
  qaCycleTimeDays?: number;
  qaAssignedTo?: string;
}

export interface WorkItemsQuery {
  from?: string;
  to?: string;
}

export interface UpdateDueDateRequest {
  dueDate: string | null;
  reason?: string;
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
  }>;
}
