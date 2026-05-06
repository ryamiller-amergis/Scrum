import {
  parseFrontmatter,
  repoDefaultBranch,
  searchSkills,
  invalidateCache,
} from '../services/skillCatalog';
import type { SkillEntry } from '../../shared/types/skills';

// skillCatalog reads ADO_ORG / ADO_PAT into module-level constants at load
// time, so the ADO integration tests use jest.resetModules() + dynamic require
// to force a fresh module load with the correct env values.

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  // Bust the in-memory cache so pure-function tests don't bleed
  invalidateCache();
});

// ── parseFrontmatter ──────────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('parses a well-formed frontmatter block', () => {
    const raw = '---\nname: My Skill\ndescription: Does things\n---\n# Body';
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('My Skill');
    expect(frontmatter.description).toBe('Does things');
    expect(body).toBe('# Body');
  });

  it('returns empty name/description and the full string as body when no frontmatter', () => {
    const raw = '# Just markdown\n\nNo YAML here.';
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('');
    expect(frontmatter.description).toBe('');
    expect(body).toBe(raw);
  });

  it('handles CRLF line endings in frontmatter', () => {
    const raw = '---\r\nname: Win Skill\r\ndescription: CRLF test\r\n---\r\nBody text';
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('Win Skill');
    expect(frontmatter.description).toBe('CRLF test');
  });

  it('preserves extra frontmatter keys as additional properties', () => {
    const raw = '---\nname: Extra\ndescription: Test\nauthor: alice\n---\nBody';
    const { frontmatter } = parseFrontmatter(raw);
    expect((frontmatter as any).author).toBe('alice');
  });

  it('returns empty body string when frontmatter consumes the whole file', () => {
    const raw = '---\nname: N\ndescription: D\n---\n';
    const { body } = parseFrontmatter(raw);
    expect(body).toBe('');
  });

  it('skips lines without a colon in the yaml block', () => {
    const raw = '---\nname: Valid\nno-colon-here\ndescription: Also valid\n---\nBody';
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('Valid');
    expect(frontmatter.description).toBe('Also valid');
  });
});

// ── repoDefaultBranch ─────────────────────────────────────────────────────────

describe('repoDefaultBranch', () => {
  it('strips refs/heads/ prefix', () => {
    expect(repoDefaultBranch('refs/heads/main')).toBe('main');
  });

  it('returns the branch as-is when there is no refs/heads/ prefix', () => {
    expect(repoDefaultBranch('develop')).toBe('develop');
  });

  it('returns "main" when the branch is undefined', () => {
    expect(repoDefaultBranch(undefined)).toBe('main');
  });

  it('returns "main" when the branch is an empty string', () => {
    expect(repoDefaultBranch('')).toBe('main');
  });
});

// ── searchSkills ──────────────────────────────────────────────────────────────

const makeSkill = (name: string, description: string): SkillEntry => ({
  id: `proj/repo/${name}`,
  name,
  description,
  project: 'proj',
  repo: 'repo',
  path: `skills/${name}/SKILL.md`,
  branch: 'main',
  frontmatter: { name, description },
});

describe('searchSkills', () => {
  const skills: SkillEntry[] = [
    makeSkill('deploy-app', 'Deploys an application to Azure'),
    makeSkill('run-tests', 'Executes test suites and reports results'),
    makeSkill('create-branch', 'Creates a feature branch from a base branch'),
    makeSkill('branch-cleanup', 'Deletes stale branches that are fully merged'),
  ];

  it('returns skills whose name or description contains the query', () => {
    const results = searchSkills(skills, 'branch');
    expect(results.map((s) => s.name)).toEqual(
      expect.arrayContaining(['create-branch', 'branch-cleanup']),
    );
    expect(results.map((s) => s.name)).not.toContain('deploy-app');
  });

  it('ranks name matches higher than description-only matches', () => {
    // 'branch' is in name for 'create-branch' and 'branch-cleanup',
    // but only in description for a skill we inject here
    const descOnlySkill = makeSkill('misc-tool', 'Works with branch strategies');
    const mixed = [...skills, descOnlySkill];

    const results = searchSkills(mixed, 'branch');
    const nameMatches = results.filter((s) => s.name.includes('branch'));
    const descMatch = results.find((s) => s.name === 'misc-tool');

    // All name matches should come before the desc-only match
    if (descMatch) {
      const descIdx = results.indexOf(descMatch);
      nameMatches.forEach((s) => {
        expect(results.indexOf(s)).toBeLessThan(descIdx);
      });
    }
  });

  it('is case-insensitive', () => {
    const results = searchSkills(skills, 'DEPLOY');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('deploy-app');
  });

  it('returns an empty array when no skills match', () => {
    const results = searchSkills(skills, 'kubernetes');
    expect(results).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const manySkills = Array.from({ length: 20 }, (_, i) =>
      makeSkill(`skill-${i}`, `Does something with branch ${i}`),
    );
    const results = searchSkills(manySkills, 'branch', 5);
    expect(results).toHaveLength(5);
  });

  it('defaults to a limit of 10', () => {
    const manySkills = Array.from({ length: 20 }, (_, i) =>
      makeSkill(`branch-skill-${i}`, `Description ${i}`),
    );
    const results = searchSkills(manySkills, 'branch');
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('returns all skills when query is a full name match', () => {
    const results = searchSkills(skills, 'run-tests');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('run-tests');
  });
});

// ── listProjects (mocked ADO) ─────────────────────────────────────────────────
// skillCatalog reads ADO_ORG / ADO_PAT into module-level constants at load
// time, so we use jest.resetModules() + dynamic require to force a fresh
// module load with the correct env values per test.

describe('listProjects', () => {
  type CatalogModule = typeof import('../services/skillCatalog');

  function freshCatalogWithCoreApi(getProjectsImpl: jest.Mock): CatalogModule {
    jest.resetModules();
    process.env.ADO_ORG = 'https://dev.azure.com/test-org';
    process.env.ADO_PAT = 'test-pat';
    jest.mock('azure-devops-node-api', () => ({
      WebApi: jest.fn(() => ({
        getCoreApi: jest.fn().mockResolvedValue({ getProjects: getProjectsImpl }),
      })),
      getPersonalAccessTokenHandler: jest.fn().mockReturnValue({}),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../services/skillCatalog') as CatalogModule;
  }

  it('returns mapped projects from ADO', async () => {
    const getProjects = jest.fn().mockResolvedValue([
      { id: 'p1', name: 'Project One', description: 'First' },
      { id: 'p2', name: 'Project Two', description: undefined },
    ]);
    const { listProjects } = freshCatalogWithCoreApi(getProjects);

    const projects = await listProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0]).toEqual({ id: 'p1', name: 'Project One', description: 'First' });
    expect(projects[1]).toEqual({ id: 'p2', name: 'Project Two', description: undefined });
  });

  it('returns cached result on second call without hitting ADO again', async () => {
    const getProjects = jest
      .fn()
      .mockResolvedValue([{ id: 'p1', name: 'P1', description: undefined }]);
    const { listProjects } = freshCatalogWithCoreApi(getProjects);

    await listProjects();
    await listProjects();

    expect(getProjects).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when ADO returns null', async () => {
    const getProjects = jest.fn().mockResolvedValue(null);
    const { listProjects } = freshCatalogWithCoreApi(getProjects);

    const projects = await listProjects();
    expect(projects).toEqual([]);
  });

  it('throws when ADO_ORG and ADO_PAT are missing', async () => {
    jest.resetModules();
    delete process.env.ADO_ORG;
    delete process.env.ADO_PAT;
    jest.mock('azure-devops-node-api', () => ({
      WebApi: jest.fn(),
      getPersonalAccessTokenHandler: jest.fn().mockReturnValue({}),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { listProjects } = require('../services/skillCatalog') as CatalogModule;
    await expect(listProjects()).rejects.toThrow('ADO_ORG and ADO_PAT must be set');
  });
});

// ── listRepos (mocked ADO) ────────────────────────────────────────────────────

describe('listRepos', () => {
  type CatalogModule = typeof import('../services/skillCatalog');

  function freshCatalogWithGitApi(getRepositoriesImpl: jest.Mock): CatalogModule {
    jest.resetModules();
    process.env.ADO_ORG = 'https://dev.azure.com/test-org';
    process.env.ADO_PAT = 'test-pat';
    jest.mock('azure-devops-node-api', () => ({
      WebApi: jest.fn(() => ({
        getGitApi: jest.fn().mockResolvedValue({ getRepositories: getRepositoriesImpl }),
      })),
      getPersonalAccessTokenHandler: jest.fn().mockReturnValue({}),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../services/skillCatalog') as CatalogModule;
  }

  it('maps repos with normalised default branch', async () => {
    const getRepositories = jest.fn().mockResolvedValue([
      { id: 'r1', name: 'my-repo', defaultBranch: 'refs/heads/main', webUrl: 'https://example.com' },
    ]);
    const { listRepos } = freshCatalogWithGitApi(getRepositories);

    const repos = await listRepos('MyProject');
    expect(repos).toHaveLength(1);
    expect(repos[0].defaultBranch).toBe('main');
    expect(repos[0].project).toBe('MyProject');
  });

  it('returns an empty array when ADO returns null', async () => {
    const getRepositories = jest.fn().mockResolvedValue(null);
    const { listRepos } = freshCatalogWithGitApi(getRepositories);

    const repos = await listRepos('EmptyProject');
    expect(repos).toEqual([]);
  });
});
