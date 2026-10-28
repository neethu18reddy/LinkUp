import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';

vi.mock('gsap', () => ({
  default: { registerPlugin: vi.fn(), matchMedia: () => ({ add: vi.fn(), revert: vi.fn() }) },
}));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));
function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}
describe('public introduction', () => {
  it('explains the product and gives visitors a working starting point', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your next chapter');
    expect(screen.getByRole('link', { name: 'Build my learning path' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('region', { name: 'How linkup works' })).toBeInTheDocument();
  });
  it('labels sample data and explains provider and certificate limitations', () => {
    renderPage();
    expect(screen.getByText('Example roadmap')).toBeInTheDocument();
    expect(screen.getByText(/not an accredited qualification/)).toBeInTheDocument();
    expect(screen.getByText(/configured provider and its quota/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });
});
