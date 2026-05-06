import { Router, Request, Response } from 'express';
import {
  listWikis,
  listWikiPages,
  getWikiPage,
  saveWikiPage,
} from '../services/wikiCatalog';
import type { SaveWikiPageRequest } from '../../shared/types/skills';

const router = Router();

/**
 * GET /api/wiki/wikis?project=<name>
 * List all wikis in a project.
 */
router.get('/wikis', async (req: Request, res: Response) => {
  const { project } = req.query as { project?: string };
  if (!project) return res.status(400).json({ error: 'project is required' });

  try {
    const wikis = await listWikis(project);
    res.json(wikis);
  } catch (err: any) {
    console.error('[wiki] listWikis error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to list wikis' });
  }
});

/**
 * GET /api/wiki/pages?project=<name>&wikiId=<id>&path=<path>
 * List child pages under a path (one level deep).
 */
router.get('/pages', async (req: Request, res: Response) => {
  const { project, wikiId, path } = req.query as {
    project?: string;
    wikiId?: string;
    path?: string;
  };

  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!wikiId) return res.status(400).json({ error: 'wikiId is required' });

  try {
    const pages = await listWikiPages(project, wikiId, path ?? '/');
    res.json(pages);
  } catch (err: any) {
    console.error('[wiki] listWikiPages error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to list wiki pages' });
  }
});

/**
 * GET /api/wiki/page?project=<name>&wikiId=<id>&path=<path>
 * Get a single wiki page with its content.
 */
router.get('/page', async (req: Request, res: Response) => {
  const { project, wikiId, path } = req.query as {
    project?: string;
    wikiId?: string;
    path?: string;
  };

  if (!project) return res.status(400).json({ error: 'project is required' });
  if (!wikiId) return res.status(400).json({ error: 'wikiId is required' });
  if (!path) return res.status(400).json({ error: 'path is required' });

  try {
    const page = await getWikiPage(project, wikiId, path);
    res.json(page);
  } catch (err: any) {
    console.error('[wiki] getWikiPage error:', err.message);
    if (err.message?.includes('404')) {
      return res.status(404).json({ error: 'Wiki page not found' });
    }
    res.status(500).json({ error: err.message ?? 'Failed to get wiki page' });
  }
});

/**
 * POST /api/wiki/page
 * Create or update a wiki page. Used by the "Save to Wiki" button in the chat panel.
 * Body: SaveWikiPageRequest
 */
router.post('/page', async (req: Request, res: Response) => {
  const body = req.body as Partial<SaveWikiPageRequest>;

  if (!body.project) return res.status(400).json({ error: 'project is required' });
  if (!body.wikiId) return res.status(400).json({ error: 'wikiId is required' });
  if (!body.path) return res.status(400).json({ error: 'path is required' });
  if (typeof body.content !== 'string') return res.status(400).json({ error: 'content is required' });

  try {
    const result = await saveWikiPage(body as SaveWikiPageRequest);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[wiki] saveWikiPage error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to save wiki page' });
  }
});

export default router;
