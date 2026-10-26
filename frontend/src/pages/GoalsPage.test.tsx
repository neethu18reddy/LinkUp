import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentGoal,
  getRoles,
  getQuizQuestions,
  getLatestQuiz,
  saveGoal,
  submitQuiz,
  type CareerRole,
  type CurrentGoal,
  type QuizResult,
} from '@/features/goals/goals.api';
import { GoalsPage } from './GoalsPage';

vi.mock('@/features/goals/goals.api', async (original) => ({
  ...(await original<typeof import('@/features/goals/goals.api')>()),
  getCurrentGoal: vi.fn(),
  getRoles: vi.fn(),
  getQuizQuestions: vi.fn(),
  getLatestQuiz: vi.fn(),
  saveGoal: vi.fn(),
  submitQuiz: vi.fn(),
}));
const roles: CareerRole[] = ['Frontend Developer', 'Backend Developer', 'Data Analyst'].map(
  (title, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index + 1}`,
    slug: title.toLowerCase().replaceAll(' ', '-'),
    title,
    description: `Explore ${title.toLowerCase()}.`,
    requirements: [
      {
        skillId: '00000000-0000-4000-8000-000000000005',
        requiredLevel: 'INTERMEDIATE',
        weight: 2,
        skill: { name: 'React', category: 'Frontend' },
      },
    ],
  }),
);
const questions = [
  'activity',
  'outcome',
  'challenge',
  'curiosity',
  'project',
  'feedback',
  'practice',
].map((id, index) => ({
  id,
  prompt: `What interests you in question ${index + 1}?`,
  options: [
    { id: 'web', label: 'Build interfaces' },
    { id: 'data', label: 'Explore data' },
  ],
}));
const quiz: QuizResult = {
  id: '20000000-0000-4000-8000-000000000001',
  createdAt: new Date().toISOString(),
  answers: questions.map((question) => ({ questionId: question.id, optionId: 'data' })),
  recommendations: roles.map((role) => ({
    roleId: role.id,
    title: role.title,
    description: role.description,
    reasons: ['Your answers show an interest in this work.'],
  })),
};
const makeGoal = (role = roles[0]!): CurrentGoal => ({
  id: '30000000-0000-4000-8000-000000000001',
  targetRole: role.title,
  roleTemplateId: role.id,
  source: 'DIRECT',
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
let current: CurrentGoal | null;
beforeEach(() => {
  vi.resetAllMocks();
  current = null;
  vi.mocked(getRoles).mockResolvedValue(roles);
  vi.mocked(getCurrentGoal).mockImplementation(async () => current);
  vi.mocked(getQuizQuestions).mockResolvedValue(questions);
  vi.mocked(getLatestQuiz).mockResolvedValue(null);
  vi.mocked(submitQuiz).mockResolvedValue(quiz);
  vi.mocked(saveGoal).mockImplementation(async (input) => {
    current =
      input.kind === 'ROLE'
        ? {
            ...makeGoal(roles.find((role) => role.id === input.roleId)!),
            source: input.quizResponseId ? 'QUIZ' : 'DIRECT',
          }
        : { ...makeGoal(), roleTemplateId: null, targetRole: input.targetRole };
    return current;
  });
});
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GoalsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function openQuiz() {
  await userEvent.click(await screen.findByRole('button', { name: 'Take interest quiz' }));
}
async function answerQuiz() {
  for (let index = 0; index < 7; index++) {
    await userEvent.click(await screen.findByRole('radio', { name: 'Explore data' }));
    await userEvent.click(
      screen.getByRole('button', { name: index === 6 ? 'See suggestions' : 'Next question' }),
    );
  }
}

describe('goal selection and quiz', () => {
  it('refreshes a changed goal and requires a new review instead of silently replacing it', async () => {
    current = makeGoal(roles[1]!);
    const changedId = '30000000-0000-4000-8000-000000000002';
    const conflict = new AxiosError('Goal changed');
    conflict.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        error: {
          code: 'GOAL_CHANGED',
          message: 'Your current goal has changed. Review the latest goal and try again.',
        },
      },
    };
    vi.mocked(saveGoal).mockImplementationOnce(async () => {
      current = { ...makeGoal(roles[2]!), id: changedId };
      throw conflict;
    });
    renderPage();
    await screen.findByLabelText('Target role or skill');
    await userEvent.selectOptions(screen.getByLabelText('Target role or skill'), roles[0]!.id);
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByText('Data Analyst', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm goal' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByText('Your goal is now Frontend Developer.')).toBeInTheDocument();
    expect(vi.mocked(saveGoal).mock.calls[1]![0].expectedGoalId).toBe(changedId);
  });
  it('requires a direction and validates a custom skill before confirmation', async () => {
    renderPage();
    await screen.findByText(/No goal yet/);
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a role');
    await userEvent.selectOptions(screen.getByLabelText('Target role or skill'), 'custom');
    await userEvent.type(screen.getByLabelText('What would you like to learn?'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Describe what you want to learn');
    await userEvent.clear(screen.getByLabelText('What would you like to learn?'));
    await userEvent.type(screen.getByLabelText('What would you like to learn?'), ' Learn   Figma ');
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    expect(saveGoal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByText('Your goal is now Learn Figma.')).toBeInTheDocument();
    expect(saveGoal).toHaveBeenCalledWith(
      { kind: 'CUSTOM', targetRole: 'Learn Figma', expectedGoalId: null },
      expect.anything(),
    );
  });
  it('previews starting skills and lets the user cancel review before saving a direct goal', async () => {
    renderPage();
    await screen.findByLabelText('Target role or skill');
    await userEvent.selectOptions(screen.getByLabelText('Target role or skill'), roles[0]!.id);
    expect(screen.getByText('Starting skills for this role')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(saveGoal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByText('Your goal is now Frontend Developer.')).toBeInTheDocument();
    expect(saveGoal).toHaveBeenCalledWith(
      { kind: 'ROLE', roleId: roles[0]!.id, expectedGoalId: null },
      expect.anything(),
    );
  });
  it('warns before replacing an existing goal and supplies its version guard', async () => {
    current = makeGoal(roles[1]!);
    renderPage();
    await screen.findByText('Backend Developer', { selector: 'h3' });
    await userEvent.selectOptions(screen.getByLabelText('Target role or skill'), roles[0]!.id);
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    expect(screen.getByText(/Your previous goal and work will be kept/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    await waitFor(() => expect(saveGoal).toHaveBeenCalled());
    expect(vi.mocked(saveGoal).mock.calls[0]![0].expectedGoalId).toBe(
      '30000000-0000-4000-8000-000000000001',
    );
  });
  it('skips the quiz without submitting answers or changing the goal', async () => {
    renderPage();
    await openQuiz();
    await screen.findByRole('radio', { name: 'Explore data' });
    await userEvent.click(screen.getByRole('button', { name: 'Skip quiz' }));
    expect(await screen.findByLabelText('Target role or skill')).toBeInTheDocument();
    expect(submitQuiz).not.toHaveBeenCalled();
    expect(saveGoal).not.toHaveBeenCalled();
  });
  it('preserves answers when going back and blocks advancing without an answer', async () => {
    renderPage();
    await openQuiz();
    await screen.findByRole('radio', { name: 'Explore data' });
    expect(screen.getByRole('button', { name: 'Next question' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Build interfaces' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: 'Build interfaces' })).toBeChecked();
  });
  it('shows three reasoned suggestions and requires confirmation before saving one', async () => {
    renderPage();
    await openQuiz();
    await answerQuiz();
    expect(await screen.findByText('Three directions to explore')).toBeInTheDocument();
    expect(screen.getAllByText('Your answers show an interest in this work.')).toHaveLength(3);
    expect(saveGoal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Choose Data Analyst' }));
    expect(await screen.findByText('Selected from your quiz suggestions.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByText('Your goal is now Data Analyst.')).toBeInTheDocument();
    expect(saveGoal).toHaveBeenCalledWith(
      { kind: 'ROLE', roleId: roles[2]!.id, quizResponseId: quiz.id, expectedGoalId: null },
      expect.anything(),
    );
  });
  it('restores saved suggestions and lets the user retake the quiz', async () => {
    vi.mocked(getLatestQuiz).mockResolvedValue(quiz);
    renderPage();
    await openQuiz();
    expect(await screen.findByText('Three directions to explore')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retake quiz' }));
    expect(await screen.findByRole('radio', { name: 'Explore data' })).not.toBeChecked();
  });
  it('retains the completed answers when submission fails and permits retry', async () => {
    vi.mocked(submitQuiz).mockRejectedValueOnce(new Error('Offline'));
    renderPage();
    await openQuiz();
    await answerQuiz();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('radio', { name: 'Explore data' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'See suggestions' }));
    expect(await screen.findByText('Three directions to explore')).toBeInTheDocument();
    expect(submitQuiz).toHaveBeenCalledTimes(2);
  });
  it('retries failed role/current-goal queries independently', async () => {
    vi.mocked(getRoles).mockRejectedValueOnce(new Error('Offline'));
    vi.mocked(getCurrentGoal).mockRejectedValueOnce(new Error('Offline'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry roles' }));
    await screen.findByLabelText('Target role or skill');
    expect(screen.getByRole('button', { name: 'Review goal' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry current goal' }));
    expect(await screen.findByText(/No goal yet/)).toBeInTheDocument();
  });
  it('keeps the confirmation available after a failed save', async () => {
    vi.mocked(saveGoal).mockRejectedValueOnce(new Error('Offline'));
    renderPage();
    await screen.findByLabelText('Target role or skill');
    await userEvent.selectOptions(screen.getByLabelText('Target role or skill'), roles[0]!.id);
    await userEvent.click(screen.getByRole('button', { name: 'Review goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm goal' }));
    expect(await screen.findByText('Your goal is now Frontend Developer.')).toBeInTheDocument();
  });
});
