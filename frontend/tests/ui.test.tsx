import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, ErrorState, Pagination } from '../src/components/ui';

describe('shared interface states', () => {
  it('prevents duplicate busy submissions and names the active action', () => {
    render(<Button busy busyLabel="Adding…">Add</Button>);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('keeps pagination boundaries disabled and changes valid pages', async () => {
    const onPage = vi.fn();
    const { rerender } = render(<Pagination value={{ page: 1, limit: 20, total: 42, totalPages: 3 }} onPage={onPage}/>);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPage).toHaveBeenCalledWith(2);
    rerender(<Pagination value={{ page: 3, limit: 20, total: 42, totalPages: 3 }} onPage={onPage}/>);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('uses an urgent accessible error role and supports retry', async () => {
    const retry = vi.fn();
    render(<ErrorState message="Service unavailable" onRetry={retry}/>);
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
