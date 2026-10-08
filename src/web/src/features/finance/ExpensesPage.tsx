import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SORT_COLUMNS,
  type Expense,
  type ExpenseCategory,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { useExpenses } from '@/api/finance-hooks';
import { keys, useResourceMutation } from '@/api/hooks';
import { useVehicles } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { useConfirm } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/money';
import { ExpenseDialog } from './ExpenseDialog';
import { t } from '@/i18n';

/** FR-FIN-180 to FR-FIN-200 — expenses, with the attachment preview. */
export function ExpensesPage() {
  const list = useListState({
    initialFilters: {
      category: undefined as ExpenseCategory | undefined,
      vehicleId: undefined as string | undefined,
    },
    sortableColumns: EXPENSE_SORT_COLUMNS,
    defaultSort: { column: 'incurredOn', direction: 'desc' },
  });

  const query = useExpenses(list.query);
  const vehicles = useVehicles({ limit: 100, sort: 'plate', dir: 'asc' });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useResourceMutation(
    (id: string) => api.finance.expenses.remove(id),
    [keys.expenses, keys.financeReports],
  );

  const confirm = useConfirm<Expense>({
    title: (expense) =>
      t('confirm.deleteTitle', { name: t(`finance.expense.categories.${expense.category}`) }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (expense) => remove.mutateAsync(expense.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<Expense, unknown>[] = [
    {
      id: 'incurredOn',
      header: t('finance.expense.incurredOn'),
      cell: ({ row }) => formatDate(row.original.incurredOn),
    },
    {
      id: 'category',
      header: t('finance.expense.category'),
      cell: ({ row }) => (
        <span className="font-medium">
          {t(`finance.expense.categories.${row.original.category}`)}
        </span>
      ),
    },
    {
      id: 'vehicle',
      header: t('finance.vehicle'),
      cell: ({ row }) =>
        row.original.vehiclePlate ?? (
          <span className="text-muted-foreground">{t('finance.expense.overhead')}</span>
        ),
    },
    {
      id: 'amount',
      header: t('common.amount'),
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatMoney(row.original.amount, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'description',
      header: t('finance.expense.description'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description ?? '—'}</span>
      ),
    },
    {
      id: 'attachment',
      header: t('finance.expense.attachment'),
      cell: ({ row }) =>
        row.original.hasAttachment ? (
          <Button variant="ghost" size="sm" onClick={() => void openAttachment(row.original.id)}>
            {t('finance.expense.attachmentView')}
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        // A row the FR-FIN-210 job produced is not editable: its amount would then
        // disagree with the rule that produced it, and next month's row would silently
        // differ from this one. The badge says so rather than leaving a dead button.
        const generated = row.original.recurringRuleId !== null;

        return (
          <div className="flex items-center justify-end gap-1">
            {generated ? (
              <Badge variant="outline" title={t('finance.expense.generatedHelp')}>
                {t('finance.expense.generated')}
              </Badge>
            ) : (
              <>
                <MutatingButton variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
                  {t('common.edit')}
                </MutatingButton>
                <MutatingButton variant="ghost" size="sm" onClick={() => confirm.ask(row.original)}>
                  {t('common.delete')}
                </MutatingButton>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('finance.expense.title')}
        description={t('finance.expense.subtitle')}
        actions={
          <MutatingButton onClick={() => setCreating(true)}>
            <Plus className="mr-2 size-4" />
            {t('finance.expense.create')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <ChoiceFilter
          label={t('finance.expense.category')}
          value={list.filters.category}
          onChange={(category) =>
            list.setFilters({ category: category as ExpenseCategory | undefined })
          }
          options={EXPENSE_CATEGORIES.map((category) => ({
            value: category,
            label: t(`finance.expense.categories.${category}`),
          }))}
        />
        <ChoiceFilter
          label={t('finance.vehicle')}
          value={list.filters.vehicleId}
          onChange={(vehicleId) => list.setFilters({ vehicleId })}
          options={(vehicles.data?.data ?? []).map((vehicle) => ({
            value: vehicle.id,
            label: vehicle.plate,
          }))}
        />
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={EXPENSE_SORT_COLUMNS}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('finance.expense.title')}
        emptyBody={t('finance.expense.empty')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />

      {confirm.dialog}
      {creating ? <ExpenseDialog expense={null} onClose={() => setCreating(false)} /> : null}
      {editing ? <ExpenseDialog expense={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/** NFR-SEC-080 — the attachment is reached through a signed URL that expires. */
async function openAttachment(expenseId: string): Promise<void> {
  const { url } = await api.finance.expenses.attachment(expenseId);
  window.open(url, '_blank', 'noopener,noreferrer');
}
