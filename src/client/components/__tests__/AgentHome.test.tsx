import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentHome } from '../AgentHome';
import {
  useSkillList,
  useSkillRepos,
  useStartChat,
} from '../../hooks/useChatThreads';

jest.mock('../../hooks/useChatThreads', () => ({
  useSkillRepos: jest.fn(),
  useStartChat: jest.fn(),
  useSkillList: jest.fn(),
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../hooks/useChatStream', () => ({
  useChatStream: jest.fn(() => ({
    messages: [],
    streamingText: '',
    status: 'idle',
    isConnected: true,
  })),
}));

jest.mock('../../hooks/useChatAttachments', () => ({
  formatAttachmentSize: jest.fn((size: number) => `${size} bytes`),
  useChatAttachments: jest.fn(() => ({
    attachments: [],
    attachmentError: null,
    addFiles: jest.fn(),
    removeAttachment: jest.fn(),
    clearAttachments: jest.fn(),
  })),
}));

describe('AgentHome', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = jest.fn();
    global.fetch = jest.fn() as jest.Mock;

    (useSkillRepos as jest.Mock).mockReturnValue({
      data: [{ id: 'repo-1', name: 'MaxView', defaultBranch: 'main' }],
    });
    (useSkillList as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'skill-1',
          name: 'Create PRD',
          description: 'Create a requirements document',
          path: '.cursor/skills/create-prd/SKILL.md',
        },
      ],
    });
    (useStartChat as jest.Mock).mockReturnValue({
      mutateAsync,
    });
    mutateAsync.mockResolvedValue({ threadId: 'thread-123' });
  });

  it('starts the selected home-page skill as kickoff context', async () => {
    render(<AgentHome selectedProject="MaxView" />);

    fireEvent.change(screen.getByPlaceholderText(/Ask me anything/i), {
      target: { value: '/' },
    });

    const skillButton = await screen.findByText('Create PRD');
    fireEvent.mouseDown(skillButton);

    expect(screen.getByPlaceholderText(/Ask me anything/i)).toHaveValue(
      'Run skill: Create PRD (`.cursor/skills/create-prd/SKILL.md`)',
    );

    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        kickoff: {
          project: 'MaxView',
          repo: 'MaxView',
          branch: 'main',
          skillPath: '.cursor/skills/create-prd/SKILL.md',
          freeformContext: 'Run skill: Create PRD (`.cursor/skills/create-prd/SKILL.md`)',
          model: expect.any(String),
        },
      });
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
