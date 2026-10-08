import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { SCHOOL_SORT_COLUMNS, type School } from '@servisapp/shared';
import { api } from '@/api/client';
import { useSchools, useResourceMutation, keys } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput, StatusFilter } from '@/components/ListFilters';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SchoolDialog } from './SchoolDialog';
import { t } from '@/i18n';

/**
 * FR-CMP-010 — schools, with their bell times and the point the Admin placed.
 *
 * A school is never geocoded: FR-CMP-010 has the Admin enter the coordinates, which is
 * why `schools.geo` is NOT NULL while a student address's is not, and why this form
 * carries a map picker rather than an address lookup.
 */
export function SchoolsPage() {
  const list = useListState({
    initialFilters: { search: undefined as string | undefined, status: undefined as
      | 'ACTIVE'
      | 'INACTIVE'
      | undefined },
    sortableColumns: SCHOOL_SORT_COLUMNS,
    defaultSort: { column: 'name', direction: 'asc' },
  });

  const query = useSchools(list.query);
  const [editing, setEditing] = useState<School | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useResourceMutation(
    (id: string) => api.schools.remove(id),
    [keys.schools, keys.students, keys.routeTemplates],
  );

  const confirm = useConfirm<School>({
    title: (school) => t('confirm.deleteTitle', { name: school.name }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (school) => remove.mutateAsync(school.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<School, unknown>[] = [
    { id: 'name', accessorKey: 'name', header: t('school.name') },
    { id: 'textAddress', accessorKey: 'textAddress', header: t('school.textAddress') },
    {
      id: 'morningBell',
      header: t('school.morningBell'),
      cell: ({ row }) => row.original.morningBell,
    },
    {
      id: 'afternoonDismissal',
      header: t('school.afternoonDismissal'),
      cell: ({ row }) => row.original.afternoonDismissal,
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
        title={t('school.title')}
        actions={
          <MutatingButton onClick={() => setCreating(true)} className="gap-1.5">
            <Plus aria-hidden className="h-4 w-4" />
            {t('school.create')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={list.filters.search}
          onChange={(search) => list.setFilters({ search })}
        />
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
        emptyTitle={t('school.emptyTitle')}
        emptyBody={t('school.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={setEditing}
      />

      {confirm.dialog}

      {creating ? <SchoolDialog school={null} onClose={() => setCreating(false)} /> : null}
      {editing ? <SchoolDialog school={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
