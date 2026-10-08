import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { VEHICLE_SORT_COLUMNS, type Vehicle } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useVehicles } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter, SearchInput, StatusFilter } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VehicleDialog } from './VehicleDialog';
import { t } from '@/i18n';

/** FR-CMP-020 — vehicles, with FR-CMP-030's expiry window as a filter. */
export function VehiclesPage() {
  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      status: undefined as 'ACTIVE' | 'INACTIVE' | undefined,
      expiringWithinDays: undefined as number | undefined,
    },
    sortableColumns: VEHICLE_SORT_COLUMNS,
    defaultSort: { column: 'plate', direction: 'asc' },
  });

  const query = useVehicles(list.query);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useResourceMutation(
    (id: string) => api.vehicles.remove(id),
    [keys.vehicles, keys.routeTemplates],
  );

  const confirm = useConfirm<Vehicle>({
    title: (vehicle) => t('confirm.deleteTitle', { name: vehicle.plate }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (vehicle) => remove.mutateAsync(vehicle.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<Vehicle, unknown>[] = [
    {
      id: 'plate',
      header: t('vehicle.plate'),
      cell: ({ row }) => <span className="font-medium">{row.original.plate}</span>,
    },
    {
      id: 'capacity',
      header: t('vehicle.capacity'),
      cell: ({ row }) => t('vehicle.capacityUnit', { count: row.original.capacity }),
    },
    {
      id: 'makeModel',
      header: t('vehicle.makeModel'),
      cell: ({ row }) => row.original.makeModel ?? t('common.notSet'),
    },
    {
      id: 'inspectionDue',
      header: t('vehicle.inspectionDue'),
      cell: ({ row }) => row.original.inspectionDue ?? t('common.notSet'),
    },
    {
      id: 'insuranceDue',
      header: t('vehicle.insuranceDue'),
      cell: ({ row }) => row.original.insuranceDue ?? t('common.notSet'),
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
        title={t('vehicle.title')}
        actions={
          <MutatingButton onClick={() => setCreating(true)} className="gap-1.5">
            <Plus aria-hidden className="h-4 w-4" />
            {t('vehicle.create')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} />
        <StatusFilter
          value={list.filters.status}
          onChange={(status) => list.setFilters({ status })}
        />
        <ChoiceFilter
          label={t('vehicle.expiringFilter')}
          value={
            list.filters.expiringWithinDays === undefined
              ? undefined
              : String(list.filters.expiringWithinDays)
          }
          onChange={(days) =>
            list.setFilters({ expiringWithinDays: days === undefined ? undefined : Number(days) })
          }
          options={[0, 30, 90].map((days) => ({
            value: String(days),
            // Zero is "already expired" and reads badly as "within 0 days".
            label: days === 0 ? t('alert.dueToday') : t('vehicle.expiringWithin', { days }),
          }))}
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
        emptyTitle={t('vehicle.emptyTitle')}
        emptyBody={t('vehicle.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={setEditing}
      />

      {confirm.dialog}
      {creating ? <VehicleDialog vehicle={null} onClose={() => setCreating(false)} /> : null}
      {editing ? <VehicleDialog vehicle={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
