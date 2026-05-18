import { Router } from 'express';
import { requirePermission } from '../middleware/rbac';
import { getUserId } from '../utils/requestUser';
import {
  createInterview,
  deleteInterview,
  getInterview,
  listInterviews,
  updateInterviewStatus,
  updateInterviewTitle,
} from '../services/interviewService';
import {
  createPrd,
  deletePrd,
  getPrd,
  listPrds,
  reviewPrd,
  startPrdWatcher,
  submitForReview,
  syncPrdContent,
  updatePrdContent,
  withdrawFromReview,
} from '../services/prdService';
import { readOutputBacklog, readOutputPrd } from '../services/chatAgentService';
import type { InterviewStatus, PrdStatus, ReviewPrdRequest } from '../../shared/types/interview';

const router = Router();

// ── Interviews ────────────────────────────────────────────────────────────────

router.get('/', requirePermission('interviews:view'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const status = req.query.status as InterviewStatus | undefined;
    const project = req.query.project as string | undefined;
    const list = await listInterviews(userId, { ...(status ? { status } : {}), ...(project ? { project } : {}) });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { project, repo, title, chatThreadId } = req.body as {
      project: string;
      repo: string;
      title?: string;
      chatThreadId: string;
    };

    if (!project || !repo || !chatThreadId) {
      res.status(400).json({ error: 'project, repo, and chatThreadId are required' });
      return;
    }

    const result = await createInterview({ userId, project, repo, title, chatThreadId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/prds', requirePermission('interviews:view'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const status = req.query.status as PrdStatus | undefined;
    const project = req.query.project as string | undefined;
    const list = await listPrds({ userId, status, ...(project ? { project } : {}) });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/prds/:prdId', requirePermission('interviews:view'), async (req, res, next) => {
  try {
    const prd = await getPrd(req.params.prdId);
    if (!prd) {
      res.status(404).json({ error: 'PRD not found' });
      return;
    }
    res.json(prd);
  } catch (err) {
    next(err);
  }
});

router.delete('/prds/:prdId', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await deletePrd(req.params.prdId, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put('/prds/:prdId/content', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { content } = req.body as { content: string };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content must be a string' });
      return;
    }
    await updatePrdContent(req.params.prdId, userId, content);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/prds/:prdId/submit', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await submitForReview(req.params.prdId, userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/prds/:prdId/withdraw', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await withdrawFromReview(req.params.prdId, userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/prds/:prdId/review', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const body = req.body as ReviewPrdRequest;
    await reviewPrd(req.params.prdId, userId, body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('interviews:view'), async (req, res, next) => {
  try {
    const interview = await getInterview(req.params.id);
    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }
    res.json(interview);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { status, title } = req.body as { status?: string; title?: string };
    if (status) await updateInterviewStatus(req.params.id, userId, status as InterviewStatus);
    if (title) await updateInterviewTitle(req.params.id, userId, title);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await deleteInterview(req.params.id, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /prds/:prdId/sync — read PRD output from the generation thread and persist to DB
router.post('/prds/:prdId/sync', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const prd = await getPrd(req.params.prdId);
    if (!prd) {
      res.status(404).json({ error: 'PRD not found' });
      return;
    }
    if (!prd.chatThreadId) {
      res.status(400).json({ error: 'PRD has no associated chat thread' });
      return;
    }

    const content = readOutputPrd(prd.chatThreadId);
    const backlogJson = readOutputBacklog(prd.chatThreadId);

    if (!content) {
      res.status(404).json({ error: 'PRD output not yet available from generation thread' });
      return;
    }

    await syncPrdContent(req.params.prdId, content, backlogJson ?? undefined);
    res.json({ ok: true, content });
  } catch (err) {
    next(err);
  }
});

router.post('/:interviewId/prds', requirePermission('interviews:manage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { chatThreadId, title } = req.body as { chatThreadId: string; title?: string };

    if (!chatThreadId) {
      res.status(400).json({ error: 'chatThreadId is required' });
      return;
    }

    const result = await createPrd({
      interviewId: req.params.interviewId,
      userId,
      chatThreadId,
      title,
    });
    startPrdWatcher(result.prdId, chatThreadId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
