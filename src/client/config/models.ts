export interface AgentModel {
  id: string;
  label: string;
  badge: string;
}

export const AGENT_MODELS: AgentModel[] = [
  { id: 'composer-2', label: 'Cursor Composer 2', badge: 'Fast' },
  { id: 'auto',       label: 'Auto',              badge: 'Auto' },
];

export const DEFAULT_MODEL_ID = 'composer-2';

/** Return the model ID declared in a skill's frontmatter, or the default. */
export function getDefaultModelForSkill(frontmatter?: Record<string, unknown>): string {
  const declared = frontmatter?.['model'];
  if (typeof declared === 'string' && AGENT_MODELS.some((m) => m.id === declared)) {
    return declared;
  }
  return DEFAULT_MODEL_ID;
}

export function modelLabel(id: string): string {
  return AGENT_MODELS.find((m) => m.id === id)?.label ?? id;
}

export function modelBadge(id: string): string {
  return AGENT_MODELS.find((m) => m.id === id)?.badge ?? id;
}
