import * as fs from 'fs';
import * as path from 'path';

const readWorkspaceFile = (relativePath: string) => {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, 'utf8');
};

describe('Planning rename (static checks)', () => {
  it('App.tsx uses Planning and planningTab (not Analytics)', () => {
    const content = readWorkspaceFile('src/client/App.tsx');

    expect(content).toContain("'planning'");
    expect(content).toContain('Planning');
    expect(content).toContain('planningTab');

    // These should be fully removed from the app code
    expect(content).not.toContain("'analytics'");
    expect(content).not.toContain('analyticsTab');
  });

  it('App.tsx contains standardized Planning tab labels', () => {
    const content = readWorkspaceFile('src/client/App.tsx');

    expect(content).toContain('Cycle Time');
    expect(content).toContain('Developer Stats');
    expect(content).toContain('QA Metrics');
    expect(content).toContain('Roadmap');
    expect(content).toContain('Releases');
  });

  it('App.css uses planning-* classes (not analytics-*)', () => {
    const content = readWorkspaceFile('src/client/App.css');

    expect(content).toContain('.planning-view');
    expect(content).toContain('.planning-tabs');
    expect(content).toContain('.planning-content');

    expect(content).not.toContain('.analytics-view');
    expect(content).not.toContain('.analytics-tabs');
    expect(content).not.toContain('.analytics-content');
  });
});
