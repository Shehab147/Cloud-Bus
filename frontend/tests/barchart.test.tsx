import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BarChart, niceMax } from '../src/components/BarChart';

const data = [
  { label: '1 Nov', shortLabel: '1 Nov', value: 0 },
  { label: '2 Nov', shortLabel: '2 Nov', value: 3 },
  { label: '3 Nov', shortLabel: '3 Nov', value: 1 }
];

describe('BarChart', () => {
  it('rounds the axis maximum to a clean number', () => {
    expect([0, 1, 3, 7, 12, 120].map(niceMax)).toEqual([1, 1, 5, 10, 20, 200]);
  });

  it('exposes every value to assistive technology and as a table', () => {
    render(<BarChart data={data} ariaLabel="Registrations" unit="registrations" />);
    expect(screen.getByRole('list', { name: 'Registrations' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: '2 Nov: 3 registrations' })).toBeInTheDocument();
    expect(screen.getByText('View as table')).toBeInTheDocument();
  });

  it('shows a tooltip for the focused column', async () => {
    render(<BarChart data={data} ariaLabel="Registrations" unit="registrations" />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('3 registrations');
    expect(screen.getByRole('status')).toHaveTextContent('2 Nov');
  });

  it('explains an empty period instead of drawing an empty chart', () => {
    render(<BarChart data={data.map((item) => ({ ...item, value: 0 }))} ariaLabel="Registrations" unit="registrations" />);
    expect(screen.getByText('No activity in this period')).toBeInTheDocument();
  });
});
