import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '@/core/test/axe';
import { App } from './App';

describe('App', () => {
  it('renders the page heading inside the main landmark', () => {
    render(<App />);
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'PC Monitor' }));
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<App />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
