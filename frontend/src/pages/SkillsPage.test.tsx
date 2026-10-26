import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCatalogue,
  getProfileSkills,
  addProfileSkill,
  updateProfileSkill,
  removeProfileSkill,
  type ProfileSkill,
} from '@/features/skills/skills.api';
import { SkillsPage } from './SkillsPage';

vi.mock('@/features/skills/skills.api', async (original) => ({
  ...(await original<typeof import('@/features/skills/skills.api')>()),
  getCatalogue: vi.fn(),
  getProfileSkills: vi.fn(),
  addProfileSkill: vi.fn(),
  updateProfileSkill: vi.fn(),
  removeProfileSkill: vi.fn(),
}));
const reactSkill = {
  id: '00000000-0000-4000-8000-000000000005',
  name: 'React',
  category: 'Frontend',
};
const pythonSkill = {
  id: '00000000-0000-4000-8000-000000000015',
  name: 'Python',
  category: 'Languages',
};
const entry: ProfileSkill = {
  skillId: reactSkill.id,
  level: 'BEGINNER',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  skill: reactSkill,
};
let saved: ProfileSkill[];
beforeEach(() => {
  vi.resetAllMocks();
  saved = [];
  vi.mocked(getCatalogue).mockResolvedValue([reactSkill, pythonSkill]);
  vi.mocked(getProfileSkills).mockImplementation(async () => [...saved]);
  vi.mocked(addProfileSkill).mockImplementation(async (input) => {
    const result = { ...entry, level: input.level };
    saved = [result];
    return result;
  });
  vi.mocked(updateProfileSkill).mockImplementation(async (input) => {
    const result = { ...entry, level: input.level };
    saved = [result];
    return result;
  });
  vi.mocked(removeProfileSkill).mockImplementation(async () => {
    saved = [];
  });
});
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SkillsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('skill profile screen', () => {
  it('shows the empty profile and requires an explicit skill selection', async () => {
    renderPage();
    expect(await screen.findByText(/Add your first skill above/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add skill' })).toBeDisabled();
  });
  it('adds a skill at the selected level and removes it from available choices', async () => {
    renderPage();
    await screen.findByLabelText('Skill');
    await userEvent.selectOptions(screen.getByLabelText('Skill'), reactSkill.id);
    await userEvent.selectOptions(screen.getByLabelText('Your level'), 'INTERMEDIATE');
    await userEvent.click(screen.getByRole('button', { name: 'Add skill' }));
    expect(await screen.findByText('React added to your profile.')).toBeInTheDocument();
    expect(addProfileSkill).toHaveBeenCalledWith(
      { skillId: reactSkill.id, level: 'INTERMEDIATE' },
      expect.anything(),
    );
    expect(await screen.findByLabelText('Level for React')).toHaveValue('INTERMEDIATE');
    expect(screen.queryByRole('option', { name: 'React · Frontend' })).not.toBeInTheDocument();
  });
  it('saves proficiency changes and keeps the stored value after a failure', async () => {
    saved = [entry];
    renderPage();
    const level = await screen.findByLabelText('Level for React');
    await userEvent.selectOptions(level, 'ADVANCED');
    await waitFor(() => expect(level).toHaveValue('ADVANCED'));
    expect(screen.getByText('Level saved.')).toBeInTheDocument();
    vi.mocked(updateProfileSkill).mockRejectedValueOnce(new Error('Unavailable'));
    await userEvent.selectOptions(level, 'BEGINNER');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(level).toHaveValue('ADVANCED');
  });
  it('asks before removal, supports cancel, and restores the skill to the catalogue', async () => {
    saved = [entry];
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove React' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep skill' }));
    expect(removeProfileSkill).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove React' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove skill' }));
    expect(await screen.findByText(/Add your first skill above/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'React · Frontend' })).toBeInTheDocument();
  });
  it('shows an add failure and permits retry', async () => {
    vi.mocked(addProfileSkill).mockRejectedValueOnce(new Error('Unavailable'));
    renderPage();
    await screen.findByLabelText('Skill');
    await userEvent.selectOptions(screen.getByLabelText('Skill'), reactSkill.id);
    await userEvent.click(screen.getByRole('button', { name: 'Add skill' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Add skill' }));
    expect(await screen.findByText('React added to your profile.')).toBeInTheDocument();
  });
  it('retries catalogue and profile fetch errors independently', async () => {
    vi.mocked(getCatalogue).mockRejectedValueOnce(new Error('Offline'));
    vi.mocked(getProfileSkills).mockRejectedValueOnce(new Error('Offline'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry catalogue' }));
    await screen.findByLabelText('Skill');
    expect(screen.getByRole('button', { name: 'Add skill' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry your skills' }));
    expect(await screen.findByText(/Add your first skill above/)).toBeInTheDocument();
  });
  it('debounces catalogue searches and shows an empty search result', async () => {
    vi.mocked(getCatalogue).mockImplementation(async (search) =>
      search === 'unknown' ? [] : [reactSkill, pythonSkill],
    );
    renderPage();
    await screen.findByLabelText('Skill');
    await userEvent.type(screen.getByLabelText('Search the catalogue'), 'unknown');
    expect(
      await screen.findByText('No skills match “unknown”. Try another name.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add skill' })).toBeDisabled();
  });
  it('exposes the initial loading state', () => {
    vi.mocked(getProfileSkills).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading your skills…')).toBeInTheDocument();
  });
});
