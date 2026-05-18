export type InterviewStatus = 'in_progress' | 'complete' | 'archived';

export interface InterviewSummary {
  id: string;
  chatThreadId: string;
  authorId: string;
  authorName?: string;
  title: string;
  project: string;
  repo: string;
  status: InterviewStatus;
  prdCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Interview extends InterviewSummary {
  prds: PrdSummary[];
}

export type PrdStatus = 'generating' | 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revision_requested';

export interface PrdSummary {
  id: string;
  interviewId: string | null;
  chatThreadId: string;
  authorId: string;
  authorName?: string;
  title: string;
  status: PrdStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewComment?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Prd extends PrdSummary {
  content: string;
  backlogJson?: unknown;
}

export interface CreateInterviewRequest {
  project: string;
  repo: string;
  title?: string;
  model?: string;
}

export interface CreateInterviewResponse {
  interviewId: string;
  threadId: string;
}

export interface CreatePrdRequest {
  model?: string;
}

export interface CreatePrdResponse {
  prdId: string;
  threadId: string;
}

export interface ReviewPrdRequest {
  action: 'approve' | 'reject' | 'request_revision';
  comment?: string;
}

export function prdStatusLabel(status: PrdStatus): string {
  switch (status) {
    case 'generating': return 'Generating';
    case 'draft': return 'Draft';
    case 'pending_review': return 'Pending Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'revision_requested': return 'Revision Requested';
  }
}

export function prdBadgeClass(status: PrdStatus): string {
  switch (status) {
    case 'generating': return 'generating';
    case 'draft': return 'draft';
    case 'pending_review': return 'pending-review';
    case 'approved': return 'approved';
    case 'rejected': return 'rejected';
    case 'revision_requested': return 'revision-requested';
  }
}
