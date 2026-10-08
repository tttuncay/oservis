import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Settings2 } from 'lucide-react';
import { FEE_PLAN_SORT_COLUMNS, type FeePlan } from '@servisapp/shared';
import { api } from '@/api/client';
import { useFeePlans } from '@/api/finance-hooks';
import { keys, useResourceMutation } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { useConfirm } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/money';
import { FeePlanDialog } from './FeePlanDialog';
import { FinanceSettingsDialog } from './FinanceSettingsDialog';
import { t } from '@/i18n';

/** FR-FIN-010 — fee plans per academic year, plus the tenant's finance settings. */
export function FeePlansPage() {
  const list = useListState({
    initialFilters: { academicYear: undefined as string | undefined },
    sortableColumns: FEE_PLAN_SORT_COLUMNS,
    defaultSort: { column: 'academicYear', direction: 'desc' },
  });

  const query = useFeePlans(list.query);
  const [editing, setEditing] = useState<FeePlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const remove = useResourceMutation(
    (id: string) => api.finance.feePlans.remove(id),
    [keys.feePlans],
  );

  const confirm = useConfirm<FeePlan>({
    title: (plan) => t('confirm.deleteTitle', { name: plan.name }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (plan) => remove.mutateAsync(plan.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<FeePlan, unknown>[] = [
    {
      id: 'name',
      header: t('finance.plan.name'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'academicYear',
      header: t('finance.academicYear'),
      cell: ({ row }) => row.original.academicYear,
    },
    {
      id: 'totalAmount',
      header: t('finance.plan.totalAmount'),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatMoney(row.original.totalAmount, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'instalmentCount',
      header: t('finance.plan.instalmentCount'),
      cell: ({ row }) => <span className="tabular-nums">{row.original.instalmentCount}</span>,
    },
    {
      id: 'firstDueMonth',
      header: t('finance.plan.firstDueMonth'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.firstDueMonth)} · {row.original.dueDay}.
        </span>
      ),
    },
    {
      id: 'assignedStudents',
      header: t('finance.plan.assignedStudents'),
      cell: ({ row }) =>
        row.original.assignedStudents > 0 ? (
          <Badge variant="secondary">{row.original.assignedStudents}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
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
          {/* A plan with students on it cannot be removed — the fees generated from it
              reference it, and a statement must be able to say which plan a charge came
              from years later. The server refuses it too; disabling here explains why. */}
          <MutatingButton
            variant="ghost"
            size="sm"
            disabled={row.original.assignedStudents > 0}
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
        title={t('finance.plan.title')}
        description={t('finance.plan.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-2 size-4" />
              {t('finance.settings.title')}
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 size-4" />
              {t('finance.plan.create')}
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={FEE_PLAN_SORT_COLUMNS}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('finance.plan.title')}
        emptyBody={t('finance.plan.empty')}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />

      {confirm.dialog}
      {creating ? <FeePlanDialog plan={null} onClose={() => setCreating(false)} /> : null}
      {editing ? <FeePlanDialog plan={editing} onClose={() => setEditing(null)} /> : null}
      {settingsOpen ? <FinanceSettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}
