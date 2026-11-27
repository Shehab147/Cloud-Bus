import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { api, ApiError, queryString } from '../lib/api';
import type { AdminUser, Role } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../app/AuthContext';
import { Button, Card, CardContent, CardHeader, ConfirmDialog, Empty, ErrorState, Loading, PageHeader, Pagination, SearchBox, Select, SuccessState } from '../components/ui';

type PendingChange = { user: AdminUser; role?: Role; disabled?: boolean };

const describe = (change: PendingChange) => {
  if (change.role === 'admin') return { title: 'Make this user an administrator?', text: `${change.user.name} will be able to change routes, timetables and notices, view audit logs and manage other users.`, confirm: 'Make administrator' };
  if (change.role === 'student') return { title: 'Remove administrator access?', text: `${change.user.name} will become a student and lose access to every administration page immediately.`, confirm: 'Make student' };
  if (change.disabled) return { title: 'Disable this account?', text: `${change.user.name} will be signed out immediately and will not be able to log in until the account is enabled again. Their saved favourites are kept.`, confirm: 'Disable account' };
  return { title: 'Enable this account?', text: `${change.user.name} will be able to log in again.`, confirm: 'Enable account' };
};

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingChange | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ['admin', 'users', { q: debounced, role, page }],
    queryFn: () => api<AdminUser[]>(`/admin/users?${queryString({ q: debounced, role, page, limit: 20 })}`),
    placeholderData: keepPreviousData
  });

  const update = useMutation({
    mutationFn: (change: PendingChange) => api<AdminUser>(`/admin/users/${change.user.id}`, { method: 'PATCH', body: JSON.stringify({ ...(change.role !== undefined ? { role: change.role } : {}), ...(change.disabled !== undefined ? { disabled: change.disabled } : {}) }) }),
    onSuccess: () => {
      setPending(null);
      void client.invalidateQueries({ queryKey: ['admin', 'users'] });
      void client.invalidateQueries({ queryKey: ['admin', 'stats'] });
    }
  });

  const choose = (change: PendingChange) => { update.reset(); setPending(change); };
  const rows = query.data?.data ?? [];
  const copy = pending ? describe(pending) : null;
  const mutationError = update.error instanceof ApiError ? update.error.message : update.isError ? 'Please try again.' : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Users" subtitle="Review accounts, change roles and disable access. Every change is written to the audit log." />
      <Card>
        <CardHeader icon={<UserCog className="h-5 w-5" />} title="Accounts" description="You cannot change your own role or disable your own account." />
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email" />
            <Select aria-label="Filter by role" value={role} onChange={(event) => { setRole(event.target.value as '' | Role); setPage(1); }}>
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="admin">Administrators</option>
            </Select>
          </div>

          {update.isSuccess && !pending ? <SuccessState message="User updated." /> : null}
          {mutationError && !pending ? <p className="text-sm font-medium text-destructive" role="alert">{mutationError}</p> : null}

          {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={query.error instanceof ApiError ? query.error.message : 'Please try again.'} onRetry={() => void query.refetch()} /> : rows.length === 0 ? (
            <Empty title="No users found" description="Try a different search or role filter." />
          ) : (
            <div className={`overflow-x-auto rounded-lg border ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr><th className="p-3 font-medium">User</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Favourites</th><th className="p-3 font-medium">Joined</th><th className="p-3 font-medium"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((account) => {
                    const isSelf = account.id === me?.id;
                    return (
                      <tr key={account.id} className="border-t border-border/50">
                        <td className="p-3"><p className="font-medium">{account.name}{isSelf ? ' (you)' : ''}</p><p className="text-xs text-muted-foreground">{account.email}</p></td>
                        <td className="p-3">
                          <Select aria-label={`Role for ${account.name}`} className="h-9 w-36" value={account.role} disabled={isSelf || update.isPending} onChange={(event) => choose({ user: account, role: event.target.value as Role })}>
                            <option value="student">Student</option>
                            <option value="admin">Administrator</option>
                          </Select>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${account.disabled ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>{account.disabled ? 'Disabled' : 'Active'}</span>
                        </td>
                        <td className="p-3 tabular-nums">{account.favorites_count ?? 0}</td>
                        <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDateTime(account.created_at)}</td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="outline" disabled={isSelf || update.isPending} onClick={() => choose({ user: account, disabled: !account.disabled })}>{account.disabled ? 'Enable' : 'Disable'}</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {query.data?.pagination && <Pagination value={query.data.pagination} onPage={setPage} />}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pending}
        title={copy?.title ?? ''}
        description={mutationError ? `${copy?.text ?? ''} Error: ${mutationError}` : copy?.text ?? ''}
        confirmLabel={copy?.confirm}
        busy={update.isPending}
        onCancel={() => { setPending(null); if (update.isError) update.reset(); }}
        onConfirm={() => pending && update.mutate(pending)}
      />
    </div>
  );
}
