export interface AgentModel {
  id: string;
  label: string;
  badge: string;
}

export const AGENT_MODELS: AgentModel[] = [
  { id: 'claude-opus-4-6',   label: 'Claude Opus 4.6',   badge: 'Opus'   },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', badge: 'Sonnet' },
  { id: 'composer-2',        label: 'Cursor Composer 2', badge: 'Fast'   },
];

export const DEFAULT_MODEL_ID = 'claude-opus-4-6';

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
