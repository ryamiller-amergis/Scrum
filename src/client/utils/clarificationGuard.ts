import type { BacklogFeature, BacklogPBI } from '../../shared/types/backlog';

/** Returns true if the node has at least one unanswered clarification question. */
export function nodeHasPendingClarifications(
  node: { businessClarifications?: any[]; uiUxClarifications?: any[] }
): boolean {
  return (
    (node.businessClarifications?.length ?? 0) > 0 ||
    (node.uiUxClarifications?.length ?? 0) > 0
  );
}

export interface ClarificationBlocker {
  /** Human-readable item label, e.g. "Feature: Shift Scheduler Filters" */
  itemLabel: string;
  /** Which question groups are outstanding */
  groups: Array<'Business' | 'UI/UX'>;
}

/**
 * Collects all pending clarification blockers for a feature and its child PBIs.
 * Returns an empty array when everything is answered.
 */
export function getFeatureClarificationBlockers(
  feature: BacklogFeature,
  childPBIs: BacklogPBI[]
): ClarificationBlocker[] {
  const blockers: ClarificationBlocker[] = [];

  // Feature-level
  const featureGroups: Array<'Business' | 'UI/UX'> = [];
  if ((feature.businessClarifications?.length ?? 0) > 0) featureGroups.push('Business');
  if ((feature.uiUxClarifications?.length ?? 0) > 0) featureGroups.push('UI/UX');
  if (featureGroups.length > 0) {
    blockers.push({ itemLabel: `Feature: ${feature.title}`, groups: featureGroups });
  }

  // PBI-level
  for (const pbi of childPBIs) {
    const pbiGroups: Array<'Business' | 'UI/UX'> = [];
    if ((pbi.businessClarifications?.length ?? 0) > 0) pbiGroups.push('Business');
    if ((pbi.uiUxClarifications?.length ?? 0) > 0) pbiGroups.push('UI/UX');
    if (pbiGroups.length > 0) {
      blockers.push({ itemLabel: `PBI: ${pbi.title}`, groups: pbiGroups });
    }
  }

  return blockers;
}

/**
 * Collects pending clarification blockers for a single PBI (and optionally its parent feature).
 */
export function getPbiClarificationBlockers(
  pbi: BacklogPBI,
  feature?: BacklogFeature
): ClarificationBlocker[] {
  const blockers: ClarificationBlocker[] = [];

  if (feature) {
    const featureGroups: Array<'Business' | 'UI/UX'> = [];
    if ((feature.businessClarifications?.length ?? 0) > 0) featureGroups.push('Business');
    if ((feature.uiUxClarifications?.length ?? 0) > 0) featureGroups.push('UI/UX');
    if (featureGroups.length > 0) {
      blockers.push({ itemLabel: `Feature: ${feature.title}`, groups: featureGroups });
    }
  }

  const pbiGroups: Array<'Business' | 'UI/UX'> = [];
  if ((pbi.businessClarifications?.length ?? 0) > 0) pbiGroups.push('Business');
  if ((pbi.uiUxClarifications?.length ?? 0) > 0) pbiGroups.push('UI/UX');
  if (pbiGroups.length > 0) {
    blockers.push({ itemLabel: `PBI: ${pbi.title}`, groups: pbiGroups });
  }

  return blockers;
}
