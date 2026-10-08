import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  STAFF_SORT_COLUMNS,
  type Staff,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useStaff } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { SearchInput, StatusFilter } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StaffEditDialog } from './StaffEditDialog';
import { t } from '@/i18n';

export function HostsPage() {
  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      status: undefined as 'ACTIVE' | 'INACTIVE' | undefined,
      kind: 'HOST' as const,
    },
    sortableColumns: STAFF_SORT_COLUMNS,
    defaultSort: { column: 'fullName', direction: 'asc' },
  });

  const query = useStaff(list.query);
  const [editing, setEditing] = useState<Staff | null>(null);

  const remove = useResourceMutation((id: string) => api.staff.remove(id), [keys.staff]);

  const confirm = useConfirm<Staff>({
    title: (member) => t('confirm.deleteTitle', { name: member.fullName }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (member) => remove.mutateAsync(member.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<Staff, unknown>[] = [
    {
      id: 'fullName',
      header: t('staff.fullName'),
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    {
      id: 'phoneE164',
      header: t('staff.phone'),
      cell: ({ row }) => row.original.phoneE164 ?? t('common.notSet'),
    },
    {
      id: 'recordCertDate',
      header: t('staff.recordCertDate'),
      cell: ({ row }) => row.original.recordCertDate ?? t('common.notSet'),
    },
    {
      id: 'userId',
      header: t('staff.linkedAccount'),
      cell: ({ row }) =>
        row.original.userId ? (
          <Badge variant="secondary">{t('common.yes')}</Badge>
        ) : (
          <span className="text-muted-foreground">{t('staff.notRegistered')}</span>
        ),
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {t(`status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
            {t('common.edit')}
          </Button>
          <MutatingButton
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => confirm.ask(row.original)}
          >
            {t('common.delete')}
          </MutatingButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('hostStaff.title')}
        description={t('hostStaff.description')}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} />
        <StatusFilter
          value={list.filters.status}
          onChange={(status) => list.setFilters({ status })}
        />
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={list.sortableColumns}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('hostStaff.emptyTitle')}
        emptyBody={t('hostStaff.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={setEditing}
      />

      {confirm.dialog}
      {editing ? <StaffEditDialog member={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
