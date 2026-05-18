import { Router, Request, Response } from 'express';
import {
  listProjects,
  listRepos,
  listBranches,
  listSkills,
  getSkill,
  getSkillFile,
  searchSkills,
  invalidateCache,
} from '../services/skillCatalog';

const router = Router();

/**
 * GET /api/skills/projects
 * List all ADO projects the PAT can see.
 */
router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const projects = await listProjects();
    res.json(projects);
  } catch (err: any) {
    console.error('[skills] listProjects error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to list projects' });
  }
});

/**
 * GET /api/skills/repos?project=<name>
 * List repos in a project.
 */
router.get('/repos', async (req: Request, res: Response) => {
  const { project } = req.query as { project?: string };
  if (!project) return res.status(400).json({ error: 'project is required' });

  try {
    const repos = await listRepos(project);
    res.json(repos);
  } catch (err: any) {
    console.error('[skills] listRepos error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to list repos' });
  }
});

/**
 * GET /api/skills/branches?project=<name>&repo=<name>
 * List branch names for a repo, sorted with defaultBranch first.
 */
router.get('/branches', async (req: Request, res: Response) => {
  const { project, repo } = req.query as { project?: string; repo?: string };
  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!repo) return res.status(400).json({ error: 'repo is required' });

  try {
    const branches = await listBranches(project, repo);
    res.json(branches);
  } catch (err: any) {
    console.error('[skills] listBranches error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to list branches' });
  }
});

/**
 * GET /api/skills/list?project=<name>&repo=<name>&branch=<name>
 * List all skills (SKILL.md files) in a repo.
 */
router.get('/list', async (req: Request, res: Response) => {
  const { project, repo, branch } = req.query as {
    project?: string;
    repo?: string;
    branch?: string;
  };

  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!repo) return res.status(400).json({ error: 'repo is required' });

  try {
    const skills = await listSkills(project, repo, branch);
    res.json(skills);
  } catch (err: any) {
    console.error('[skills] listSkills error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to list skills' });
  }
});

/**
 * GET /api/skills/get?project=<name>&repo=<name>&path=<path>&branch=<name>
 * Get full skill detail (content + frontmatter + supporting files).
 */
router.get('/get', async (req: Request, res: Response) => {
  const { project, repo, path, branch } = req.query as {
    project?: string;
    repo?: string;
    path?: string;
    branch?: string;
  };

  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!repo) return res.status(400).json({ error: 'repo is required' });
  if (!path) return res.status(400).json({ error: 'path is required' });

  try {
    const skill = await getSkill(project, repo, path, branch);
    res.json(skill);
  } catch (err: any) {
    console.error('[skills] getSkill error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to get skill' });
  }
});

/**
 * GET /api/skills/file?project=<name>&repo=<name>&path=<path>&branch=<name>
 * Get raw content of a skill supporting file.
 */
router.get('/file', async (req: Request, res: Response) => {
  const { project, repo, path, branch } = req.query as {
    project?: string;
    repo?: string;
    path?: string;
    branch?: string;
  };

  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!repo) return res.status(400).json({ error: 'repo is required' });
  if (!path) return res.status(400).json({ error: 'path is required' });

  try {
    const content = await getSkillFile(project, repo, path, branch);
    res.type('text/markdown').send(content);
  } catch (err: any) {
    console.error('[skills] getSkillFile error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to get skill file' });
  }
});

/**
 * GET /api/skills/search?q=<query>&project=<name>&repo=<name>&limit=<n>
 * Search skills by name/description across a repo (or all loaded skills if no repo given).
 */
router.get('/search', async (req: Request, res: Response) => {
  const { q, project, repo, branch, limit } = req.query as {
    q?: string;
    project?: string;
    repo?: string;
    branch?: string;
    limit?: string;
  };

  if (!q) return res.status(400).json({ error: 'q is required' });
  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!repo) return res.status(400).json({ error: 'repo is required' });

  try {
    const allSkills = await listSkills(project, repo, branch);
    const results = searchSkills(allSkills, q, limit ? parseInt(limit, 10) : 10);
    res.json(results);
  } catch (err: any) {
    console.error('[skills] searchSkills error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to search skills' });
  }
});

/**
 * POST /api/skills/refresh?project=<name>&repo=<name>
 * Manually invalidate the skill cache for a project/repo.
 */
router.post('/refresh', (req: Request, res: Response) => {
  const { project, repo } = req.query as { project?: string; repo?: string };
  invalidateCache(project, repo);
  res.json({ ok: true });
});

export default router;
