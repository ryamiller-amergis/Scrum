import { db } from '../db/drizzle';
import { projectSkillSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ProjectSkillConfig } from '../../shared/types/projectSettings';

export async function getSkillConfig(project: string): Promise<ProjectSkillConfig | null> {
  const rows = await db
    .select()
    .from(projectSkillSettings)
    .where(eq(projectSkillSettings.project, project))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSkillConfigs(): Promise<ProjectSkillConfig[]> {
  return db.select().from(projectSkillSettings).orderBy(projectSkillSettings.project);
}

export async function upsertSkillConfig(
  project: string,
  skillRepo: string,
  skillBranch: string,
  updatedBy?: string,
): Promise<ProjectSkillConfig> {
  const rows = await db
    .insert(projectSkillSettings)
    .values({ project, skillRepo, skillBranch, updatedBy, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: projectSkillSettings.project,
      set: { skillRepo, skillBranch, updatedBy, updatedAt: new Date().toISOString() },
    })
    .returning();
  return rows[0];
}

export async function deleteSkillConfig(project: string): Promise<void> {
  await db.delete(projectSkillSettings).where(eq(projectSkillSettings.project, project));
}
