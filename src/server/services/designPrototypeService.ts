import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/drizzle';
import { designPrototypes, designPrototypeComments, prds } from '../db/schema';
import { sanitizeMockHtml } from '../utils/htmlSanitizer';
import type {
  DesignPrototypeSummary,
  DesignPrototype,
  DesignPrototypeComment,
  DesignPrototypeHistoryEntry,
  PbiRequirement,
} from '../../shared/types/designPrototype';

interface BacklogItem {
  id?: string;
  type?: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string | string[];
  definitionOfDone?: string[];
  userStory?: {
    persona?: string;
    iWant?: string;
    soThat?: string;
  };
}

interface BacklogFeature {
  title: string;
  description?: string;
  items?: BacklogItem[];
  pbis?: BacklogItem[];
}

interface BacklogJson {
  epics?: Array<{
    features?: BacklogFeature[];
  }>;
  features?: BacklogFeature[];
}

function extractFeatures(backlogJson: unknown): BacklogFeature[] {
  const bj = backlogJson as BacklogJson | null;
  if (!bj) return [];

  const features: BacklogFeature[] = [];

  if (bj.features) {
    features.push(...bj.features);
  }

  if (bj.epics) {
    for (const epic of bj.epics) {
      if (epic.features) {
        features.push(...epic.features);
      }
    }
  }

  return features;
}

function extractPbiRequirements(feature: BacklogFeature): PbiRequirement[] {
  const items = feature.items ?? feature.pbis ?? [];
  return items.map(item => {
    let ac: string | undefined;
    if (item.acceptanceCriteria) {
      ac = Array.isArray(item.acceptanceCriteria)
        ? item.acceptanceCriteria.join('\n- ')
        : item.acceptanceCriteria;
    } else if (item.definitionOfDone?.length) {
      ac = item.definitionOfDone.join('\n- ');
    }

    let description = item.description;
    if (!description && item.userStory) {
      const us = item.userStory;
      description = `As a ${us.persona ?? 'user'}, I want to ${us.iWant ?? '...'} so that ${us.soThat ?? '...'}`;
    }

    return { title: item.title, description, acceptanceCriteria: ac };
  });
}

function resolveUserName(_userId: string): string | undefined {
  return undefined;
}

function toSummary(row: typeof designPrototypes.$inferSelect): DesignPrototypeSummary {
  return {
    id: row.id,
    prdId: row.prdId,
    featureName: row.featureName,
    featureIndex: row.featureIndex,
    authorId: row.authorId,
    authorName: resolveUserName(row.authorId),
    status: row.status as DesignPrototypeSummary['status'],
    mockVersion: row.mockVersion,
    reviewerId: row.reviewerId ?? undefined,
    reviewerName: row.reviewerId ? resolveUserName(row.reviewerId) : undefined,
    reviewComment: row.reviewComment ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    generationError: row.generationError ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Generation ──────────────────────────────────────────────────────────────

export async function generatePrototypesForPrd(prdId: string): Promise<string[]> {
  const prd = await db.query.prds.findFirst({ where: eq(prds.id, prdId) });
  if (!prd) throw new Error(`PRD ${prdId} not found`);

  const features = extractFeatures(prd.backlogJson);
  if (features.length === 0) {
    console.warn(`[designPrototypeService] No features found in PRD ${prdId} backlogJson`);
    return [];
  }

  const ids: string[] = [];

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const [row] = await db
      .insert(designPrototypes)
      .values({
        prdId,
        featureName: feature.title,
        featureIndex: i,
        authorId: prd.authorId,
        status: 'generating',
      })
      .returning({ id: designPrototypes.id });
    ids.push(row.id);

    generateSinglePrototype(row.id, feature).catch(err => {
      console.error(`[designPrototypeService] Background generation failed for ${row.id}:`, err);
    });
  }

  return ids;
}

async function generateSinglePrototype(prototypeId: string, feature: BacklogFeature): Promise<void> {
  try {
    const { generateDesignPrototypeHtml } = await import('./bedrockService');

    const pbis = extractPbiRequirements(feature);

    const rawHtml = await generateDesignPrototypeHtml({
      featureName: feature.title,
      featureDescription: feature.description,
      pbis,
    });

    const html = sanitizeMockHtml(rawHtml);
    const now = new Date().toISOString();
    const historyEntry: DesignPrototypeHistoryEntry = {
      version: 1,
      html,
      createdAt: now,
    };

    await db
      .update(designPrototypes)
      .set({
        mockHtml: html,
        mockVersion: 1,
        history: [historyEntry],
        status: 'pending_review',
        generationError: null,
        updatedAt: now,
      })
      .where(eq(designPrototypes.id, prototypeId));
  } catch (err: any) {
    console.error(`[designPrototypeService] Generation error for ${prototypeId}:`, err);
    await db
      .update(designPrototypes)
      .set({
        status: 'generation_failed',
        generationError: err.message ?? 'Unknown error',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(designPrototypes.id, prototypeId));
  }
}

// ── Regeneration ────────────────────────────────────────────────────────────

export async function regeneratePrototype(prototypeId: string, feedback: string): Promise<void> {
  const proto = await db.query.designPrototypes.findFirst({
    where: eq(designPrototypes.id, prototypeId),
  });
  if (!proto) throw new Error(`Prototype ${prototypeId} not found`);
  if (!proto.mockHtml) throw new Error('No existing HTML to regenerate from');

  await db
    .update(designPrototypes)
    .set({ status: 'regenerating', updatedAt: new Date().toISOString() })
    .where(eq(designPrototypes.id, prototypeId));

  try {
    const { regenerateDesignPrototypeHtml } = await import('./bedrockService');

    const comments = await db
      .select()
      .from(designPrototypeComments)
      .where(
        and(
          eq(designPrototypeComments.prototypeId, prototypeId),
          eq(designPrototypeComments.resolved, false),
        )
      );
    const unresolvedTexts = comments.map(c => c.text);

    const rawHtml = await regenerateDesignPrototypeHtml(
      proto.mockHtml,
      feedback,
      unresolvedTexts,
    );

    const html = sanitizeMockHtml(rawHtml);
    const newVersion = proto.mockVersion + 1;
    const now = new Date().toISOString();

    const currentEntry: DesignPrototypeHistoryEntry = {
      version: proto.mockVersion,
      html: proto.mockHtml,
      feedback,
      createdAt: now,
    };

    const newEntry: DesignPrototypeHistoryEntry = {
      version: newVersion,
      html,
      createdAt: now,
    };

    const updatedHistory = [...proto.history];
    const existingIdx = updatedHistory.findIndex(h => h.version === proto.mockVersion);
    if (existingIdx >= 0) {
      updatedHistory[existingIdx] = { ...updatedHistory[existingIdx], feedback };
    } else {
      updatedHistory.push(currentEntry);
    }
    updatedHistory.push(newEntry);

    await db
      .update(designPrototypes)
      .set({
        mockHtml: html,
        mockVersion: newVersion,
        history: updatedHistory,
        status: 'pending_review',
        reviewerId: null,
        reviewComment: null,
        reviewedAt: null,
        generationError: null,
        updatedAt: now,
      })
      .where(eq(designPrototypes.id, prototypeId));
  } catch (err: any) {
    console.error(`[designPrototypeService] Regeneration error for ${prototypeId}:`, err);
    await db
      .update(designPrototypes)
      .set({
        status: 'generation_failed',
        generationError: err.message ?? 'Unknown error',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(designPrototypes.id, prototypeId));
  }
}

export async function retryPrototype(prototypeId: string): Promise<void> {
  const proto = await db.query.designPrototypes.findFirst({
    where: eq(designPrototypes.id, prototypeId),
  });
  if (!proto) throw new Error(`Prototype ${prototypeId} not found`);

  const prd = await db.query.prds.findFirst({ where: eq(prds.id, proto.prdId) });
  if (!prd) throw new Error(`PRD ${proto.prdId} not found`);

  const features = extractFeatures(prd.backlogJson);
  const feature = features[proto.featureIndex];
  if (!feature) throw new Error(`Feature at index ${proto.featureIndex} not found`);

  await db
    .update(designPrototypes)
    .set({ status: 'generating', generationError: null, updatedAt: new Date().toISOString() })
    .where(eq(designPrototypes.id, prototypeId));

  generateSinglePrototype(prototypeId, feature).catch(err => {
    console.error(`[designPrototypeService] Retry generation failed for ${prototypeId}:`, err);
  });
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listPrototypesForPrd(prdId: string): Promise<DesignPrototypeSummary[]> {
  const rows = await db
    .select()
    .from(designPrototypes)
    .where(eq(designPrototypes.prdId, prdId))
    .orderBy(asc(designPrototypes.featureIndex));

  return rows.map(toSummary);
}

export async function getPrototype(id: string): Promise<DesignPrototype | null> {
  const row = await db.query.designPrototypes.findFirst({
    where: eq(designPrototypes.id, id),
  });
  if (!row) return null;

  const prd = await db.query.prds.findFirst({ where: eq(prds.id, row.prdId) });
  const features = prd ? extractFeatures(prd.backlogJson) : [];
  const feature = features[row.featureIndex];
  const pbiRequirements = feature ? extractPbiRequirements(feature) : [];

  return {
    ...toSummary(row),
    mockHtml: row.mockHtml,
    history: row.history ?? [],
    pbiRequirements,
  };
}

// ── Review ──────────────────────────────────────────────────────────────────

export async function reviewPrototype(
  prototypeId: string,
  reviewerId: string,
  action: 'approve' | 'revision_requested',
  comment?: string,
): Promise<void> {
  const proto = await db.query.designPrototypes.findFirst({
    where: eq(designPrototypes.id, prototypeId),
  });
  if (!proto) throw new Error(`Prototype ${prototypeId} not found`);
  if (proto.status !== 'pending_review') throw Object.assign(new Error(`Cannot review a prototype in status '${proto.status}'`), { status: 409 });

  const now = new Date().toISOString();
  await db
    .update(designPrototypes)
    .set({
      status: action === 'approve' ? 'approved' : 'revision_requested',
      reviewerId,
      reviewComment: comment ?? null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(designPrototypes.id, prototypeId));

  if (action === 'approve') {
    await checkAllApprovedAndProceed(proto.prdId);
  }
}

export async function checkAllApprovedAndProceed(prdId: string): Promise<boolean> {
  const all = await db
    .select()
    .from(designPrototypes)
    .where(eq(designPrototypes.prdId, prdId));

  const allApproved = all.length > 0 && all.every(p => p.status === 'approved');

  if (allApproved) {
    console.log(`[designPrototypeService] All prototypes approved for PRD ${prdId} — ready for design doc + ADO items`);
    // Future: trigger Design Doc generation and ADO work item creation here
  }

  return allApproved;
}

// ── Comments ────────────────────────────────────────────────────────────────

export async function listComments(prototypeId: string): Promise<DesignPrototypeComment[]> {
  const rows = await db
    .select()
    .from(designPrototypeComments)
    .where(eq(designPrototypeComments.prototypeId, prototypeId))
    .orderBy(asc(designPrototypeComments.createdAt));

  return rows.map(r => ({
    id: r.id,
    prototypeId: r.prototypeId,
    authorId: r.authorId,
    authorName: resolveUserName(r.authorId),
    text: r.text,
    pinX: r.pinX,
    pinY: r.pinY,
    mockVersion: r.mockVersion,
    resolved: r.resolved,
    resolvedBy: r.resolvedBy,
    createdAt: r.createdAt,
  }));
}

export async function addComment(
  prototypeId: string,
  authorId: string,
  text: string,
  mockVersion: number,
  pinX?: number,
  pinY?: number,
): Promise<DesignPrototypeComment> {
  const [row] = await db
    .insert(designPrototypeComments)
    .values({
      prototypeId,
      authorId,
      text,
      mockVersion,
      pinX: pinX ?? null,
      pinY: pinY ?? null,
    })
    .returning();

  return {
    id: row.id,
    prototypeId: row.prototypeId,
    authorId: row.authorId,
    authorName: resolveUserName(row.authorId),
    text: row.text,
    pinX: row.pinX,
    pinY: row.pinY,
    mockVersion: row.mockVersion,
    resolved: row.resolved,
    resolvedBy: row.resolvedBy,
    createdAt: row.createdAt,
  };
}

export async function resolveComment(commentId: string, resolvedBy: string): Promise<void> {
  await db
    .update(designPrototypeComments)
    .set({ resolved: true, resolvedBy })
    .where(eq(designPrototypeComments.id, commentId));
}
