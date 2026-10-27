import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import type { RetentionRow } from '../../services/stats/types';
import { RetentionMatrix } from './RetentionMatrix';

const row = (over: Partial<RetentionRow>): RetentionRow => ({
  cohortDate: '2026-10-01',
  cohortSize: 200,
  d1: null,
  d3: null,
  d5: null,
  d7: null,
  d14: null,
  d21: null,
  d30: null,
  d60: null,
  d90: null,
  ...over,
});

describe('RetentionMatrix', () => {
  it('shows a dash for a day that has not come yet and 0% for a day with nobody back', () => {
    renderPage(<RetentionMatrix rows={[row({ d1: 50, d3: 0 })]} days={[1, 3, 7]} />);
    expect(screen.getByTestId('cell-2026-10-01-d1')).toHaveTextContent('25%');
    expect(screen.getByTestId('cell-2026-10-01-d3')).toHaveTextContent('0%');
    expect(screen.getByTestId('cell-2026-10-01-d7')).toHaveTextContent('—');
  });

  it('shows dashes for a cohort of size 0, never a percentage', () => {
    renderPage(<RetentionMatrix rows={[row({ cohortSize: 0, d1: 0, d3: 4 })]} days={[1, 3]} />);
    expect(screen.getByTestId('cell-2026-10-01-d1')).toHaveTextContent('—');
    expect(screen.getByTestId('cell-2026-10-01-d3')).toHaveTextContent('—');
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('shows the cohort date and size, one column per requested day', () => {
    renderPage(<RetentionMatrix rows={[row({ cohortSize: 1234 })]} days={[1, 30, 90]} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
    for (const n of [1, 30, 90]) expect(screen.getAllByText(`Day ${n}`).length).toBeGreaterThan(0);
    expect(screen.queryByText('Day 7')).toBeNull();
  });

  it('keeps rows of different platforms and channels with the same cohort date apart', () => {
    renderPage(
      <RetentionMatrix
        rows={[row({ platform: 'ANDROID', d1: 20 }), row({ platform: 'IOS', d1: 40 })]}
        days={[1]}
      />,
    );
    expect(screen.getAllByTestId('cell-2026-10-01-d1').map((e) => e.textContent)).toEqual([
      '20 · 10%',
      '40 · 20%',
    ]);
  });

  it('shows the number of people next to the percentage, and nothing but a dash where there is no value', () => {
    renderPage(
      <RetentionMatrix rows={[row({ cohortSize: 1200, d1: 1234 - 34, d7: null })]} days={[1, 7]} />,
    );
    expect(screen.getByTestId('cell-2026-10-01-d1')).toHaveTextContent('1,200 · 100%');
    expect(screen.getByTestId('cell-2026-10-01-d7').textContent).toBe('—');
  });

  it('tints a cell green in proportion to its share, and leaves a dash cell and a 0% cell without a tint', () => {
    renderPage(
      <RetentionMatrix rows={[row({ d1: 100, d3: 20, d5: 0, d7: null })]} days={[1, 3, 5, 7]} />,
    );
    const tint = (day: number) =>
      (screen.getByTestId(`cell-2026-10-01-d${day}`).closest('td') as HTMLElement).style
        .backgroundColor;
    expect(tint(1)).not.toBe('');
    expect(tint(3)).not.toBe('');
    expect(tint(1)).not.toBe(tint(3));
    expect(tint(5)).toBe('');
    expect(tint(7)).toBe('');
  });
});
