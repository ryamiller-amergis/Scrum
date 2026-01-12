// Generate a consistent color for each assignee
const ASSIGNEE_COLORS = [
  { bg: 'rgba(79, 70, 229, 0.1)', border: '#4f46e5', text: '#4f46e5' },      // Indigo
  { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' },      // Emerald
  { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#f59e0b' },      // Amber
  { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' },       // Red
  { bg: 'rgba(168, 85, 247, 0.1)', border: '#a855f7', text: '#a855f7' },      // Purple
  { bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899', text: '#ec4899' },      // Pink
  { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#3b82f6' },      // Blue
  { bg: 'rgba(20, 184, 166, 0.1)', border: '#14b8a6', text: '#14b8a6' },      // Teal
  { bg: 'rgba(132, 204, 22, 0.1)', border: '#84cc16', text: '#84cc16' },      // Lime
  { bg: 'rgba(249, 115, 22, 0.1)', border: '#f97316', text: '#f97316' },      // Orange
  { bg: 'rgba(6, 182, 212, 0.1)', border: '#06b6d4', text: '#06b6d4' },       // Cyan
  { bg: 'rgba(217, 70, 239, 0.1)', border: '#d946ef', text: '#d946ef' },      // Fuchsia
];

// Hash function to get a consistent index for a string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getAssigneeColor(assignee: string | undefined): { bg: string; border: string; text: string } {
  if (!assignee) {
    return { bg: 'var(--bg-secondary)', border: 'var(--border-color)', text: 'var(--text-primary)' };
  }

  const index = hashString(assignee) % ASSIGNEE_COLORS.length;
  return ASSIGNEE_COLORS[index];
}
