import type { ColumnDef } from '@tanstack/react-table';
import { GUARDIAN_SORT_COLUMNS, USER_STATUSES, type Guardian, type UserStatus } from '@servisapp/shared';
import { useGuardians } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter, SearchInput } from '@/components/ListFilters';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';

/**
 * The tenant's parents — SRS §6.1 lists Guardians among the Admin screens.
 *
 * Read-only, and that is the design rather than a gap. A Guardian is created by approving
 * their application (FR-AUTH-040) or by inviting them (FR-AUTH-060), both of which live
 * on the Applications screen; their link to a child is created on that child
 * (FR-CMP-120). Adding a "new guardian" button here would give the same act two doors
 * with different validation behind each.
 */
export function GuardiansPage() {
  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      status: undefined as UserStatus | undefined,
    },
    sortableColumns: GUARDIAN_SORT_COLUMNS,
    defaultSort: { column: 'fullName', direction: 'asc' },
  });

  const query = useGuardians(list.query);

  const columns: ColumnDef<Guardian, unknown>[] = [
    {
      id: 'fullName',
      header: t('guardian.fullName'),
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    {
      id: 'phone',
      header: t('guardian.phone'),
      cell: ({ row }) => row.original.phone ?? t('common.notSet'),
    },
    {
      id: 'email',
      header: t('guardian.email'),
      cell: ({ row }) => row.original.email ?? t('common.notSet'),
    },
    {
      id: 'studentCount',
      header: t('guardian.studentCount'),
      cell: ({ row }) => row.original.studentCount,
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
  ];

  return (
    <>
      <PageHeader title={t('guardian.title')} />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} />
        <ChoiceFilter
          label={t('common.status')}
          value={list.filters.status}
          onChange={(status) => list.setFilters({ status: status as UserStatus | undefined })}
          options={USER_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))}
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
        emptyTitle={t('guardian.emptyTitle')}
        emptyBody={t('guardian.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />
    </>
  );
}
