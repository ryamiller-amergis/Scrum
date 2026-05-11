/**
 * Reads and writes the AI Capability Baseline config.
 * Stored as a simple JSON file in data/ai-capability-baseline.json.
 */
import fs from 'fs';
import path from 'path';
import type { AiCapabilityBaseline } from '../types/aiCapabilityLadder';

function resolveBaselineFile(): string {
  if (process.env.AI_PILOT_DATA_DIR) {
    return path.join(process.env.AI_PILOT_DATA_DIR, 'ai-capability-baseline.json');
  }
  return path.join(process.cwd(), 'data', 'ai-capability-baseline.json');
}

const EMPTY_BASELINE: AiCapabilityBaseline = {
  capturedAt: '',
  prCycleTimeDays: null,
  leadTimeDays: null,
  defectRatePerPbi: null,
  deploysPerMonth: null,
  trainingCompletionByDeveloper: {},
  identifiedUseCases: [],
  skillContributions: [],
  crossTeamDemoEvidence: [],
};

export function getBaseline(): AiCapabilityBaseline {
  try {
    const raw = fs.readFileSync(resolveBaselineFile(), 'utf-8');
    return { ...EMPTY_BASELINE, ...JSON.parse(raw) } as AiCapabilityBaseline;
  } catch {
    return { ...EMPTY_BASELINE };
  }
}

export function saveBaseline(baseline: AiCapabilityBaseline): void {
  const file = resolveBaselineFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(baseline, null, 2), 'utf-8');
}
