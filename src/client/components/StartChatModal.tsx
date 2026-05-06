import React, { useState, useEffect } from 'react';
import {
  useSkillProjects,
  useSkillRepos,
  useSkillList,
  useStartChat,
} from '../hooks/useChatThreads';
import { AGENT_MODELS, DEFAULT_MODEL_ID, getDefaultModelForSkill } from '../config/models';
import styles from './StartChatModal.module.css';

interface StartChatModalProps {
  onClose: () => void;
  onStarted: (threadId: string) => void;
}

export const StartChatModal: React.FC<StartChatModalProps> = ({ onClose, onStarted }) => {
  const [project, setProject] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [skillPath, setSkillPath] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [transcript, setTranscript] = useState('');
  const [freeformContext, setFreeformContext] = useState('');

  const { data: projects = [], isLoading: loadingProjects } = useSkillProjects();
  const { data: repos = [], isLoading: loadingRepos } = useSkillRepos(project || null);
  const { data: skills = [], isLoading: loadingSkills } = useSkillList(
    project || null,
    repo || null,
    branch || undefined,
  );
  const startChat = useStartChat();

  // When skill selection changes, apply the skill's declared model if present
  const selectedSkill = skills.find((s) => s.path === skillPath);
  useEffect(() => {
    if (selectedSkill) {
      setModel(getDefaultModelForSkill(selectedSkill as unknown as Record<string, unknown>));
    }
  }, [skillPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRepo = repos.find((r) => r.name === repo);
  const resolvedBranch = branch || selectedRepo?.defaultBranch || 'main';

  const canStart = !!project && !!repo && !startChat.isPending;

  const handleProjectChange = (val: string) => {
    setProject(val);
    setRepo('');
    setBranch('');
    setSkillPath('');
  };

  const handleRepoChange = (val: string) => {
    setRepo(val);
    setBranch('');
    setSkillPath('');
  };

  const handleStart = async () => {
    if (!canStart) return;
    try {
      const result = await startChat.mutateAsync({
        kickoff: {
          project,
          repo,
          branch: resolvedBranch,
          skillPath,
          model,
          transcript: transcript.trim() || undefined,
          freeformContext: freeformContext.trim() || undefined,
        },
      });
      onStarted(result.threadId);
    } catch {
      // error shown via startChat.error
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="start-chat-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title} id="start-chat-title">
            Start Agent Chat
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Project */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sc-project">Project</label>
            <select
              id="sc-project"
              className={styles.select}
              value={project}
              onChange={(e) => handleProjectChange(e.target.value)}
              disabled={loadingProjects}
            >
              <option value="">
                {loadingProjects ? 'Loading…' : '— Select project —'}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Repo */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sc-repo">Repository</label>
            <select
              id="sc-repo"
              className={styles.select}
              value={repo}
              onChange={(e) => handleRepoChange(e.target.value)}
              disabled={!project || loadingRepos}
            >
              <option value="">
                {loadingRepos ? 'Loading…' : '— Select repo —'}
              </option>
              {repos.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Branch (optional override) */}
          {repo && selectedRepo && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="sc-branch">
                Branch <span style={{ fontWeight: 400 }}>(default: {selectedRepo.defaultBranch})</span>
              </label>
              <select
                id="sc-branch"
                className={styles.select}
                value={branch}
                onChange={(e) => { setBranch(e.target.value); setSkillPath(''); }}
              >
                <option value="">Use default ({selectedRepo.defaultBranch})</option>
                {selectedRepo.defaultBranch !== 'tbi/refine-sdlc' && (
                  <option value="tbi/refine-sdlc">tbi/refine-sdlc (test)</option>
                )}
              </select>
            </div>
          )}

          {/* Skill (optional) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sc-skill">
              Skill <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — or invoke later with /)</span>
            </label>
            <select
              id="sc-skill"
              className={styles.select}
              value={skillPath}
              onChange={(e) => setSkillPath(e.target.value)}
              disabled={!repo || loadingSkills}
            >
              <option value="">
                {loadingSkills ? 'Loading skills…' : skills.length === 0 && repo ? 'No skills found' : '— Free chat (no skill) —'}
              </option>
              {skills.map((s) => (
                <option key={s.id} value={s.path} title={s.description}>
                  {s.name}
                </option>
              ))}
            </select>
            {skillPath && skills.find((s) => s.path === skillPath)?.description && (
              <p className={styles.hint}>
                {skills.find((s) => s.path === skillPath)!.description}
              </p>
            )}
            {!skillPath && repo && (
              <p className={styles.hint}>
                Starts an open-ended chat. Type <code style={{ fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border-color-light)' }}>/</code> in the chat input at any time to invoke a skill.
              </p>
            )}
          </div>

          {/* Model */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sc-model">Model</label>
            <select
              id="sc-model"
              className={styles.select}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {AGENT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Transcript */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sc-transcript">
              Prior chat transcript <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="sc-transcript"
              className={styles.textarea}
              placeholder="Paste a prior Cursor chat transcript, meeting notes, or any context the skill should start from…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={5}
            />
          </div>

          {/* Freeform context */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sc-context">
              Additional context <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="sc-context"
              className={styles.textarea}
              placeholder="Any other context, constraints, or notes for the agent…"
              value={freeformContext}
              onChange={(e) => setFreeformContext(e.target.value)}
              rows={3}
            />
          </div>

          {startChat.error && (
            <div className={styles.error}>{startChat.error.message}</div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleStart}
            disabled={!canStart}
          >
            {startChat.isPending ? 'Starting…' : skillPath ? 'Start Chat with Skill' : 'Start Chat'}
          </button>
        </div>
      </div>
    </div>
  );
};
