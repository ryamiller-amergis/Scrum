export interface WorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo?: string;
  dueDate?: string;
  workItemType: string;
  changedDate: string;
  areaPath: string;
  iterationPath: string;
}
