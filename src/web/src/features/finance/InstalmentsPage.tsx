import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  INSTALMENT_SORT_COLUMNS,
  INSTALMENT_STATUSES,
  type Instalment,
  type InstalmentStatus,
} from '@servisapp/shared';
import { useInstalments } from '@/api/finance-hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney } from '@/lib/money';
import { InstalmentActionsDialog } from './InstalmentActionsDialog';
import { PaymentDialog } from './PaymentDialog';
import { t } from '@/i18n';

/** The visual weight each status carries. Overdue is the one an Admin is scanning for. */
const STATUS_VARIANT: Readonly<
  Record<InstalmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'>
> = {
  PENDING: 'outline',
  PARTIAL: 'secondary',
  PAID: 'default',
  OVERDUE: 'destructive',
  WAIVED: 'secondary',
  CANCELLED: 'outline',
};

/** FR-FIN-240 — the instalment list with status filters, and the collection actions. */
export function InstalmentsPage() {
  const list = useListState({
    initialFilters: {
      status: undefined as InstalmentStatus | undefined,
      outstanding: undefined as boolean | undefined,
    },
    sortableColumns: INSTALMENT_SORT_COLUMNS,
    defaultSort: { column: 'dueDate', direction: 'asc' },
  });

  const query = useInstalments(list.query);
  const [paying, setPaying] = useState<Instalment | null>(null);
  const [acting, setActing] = useState<Instalment | null>(null);

  const columns: ColumnDef<Instalment, unknown>[] = [
    {
      id: 'studentName',
      header: t('finance.student'),
      cell: ({ row }) => <span className="font-medium">{row.original.studentName}</span>,
    },
    {
      id: 'sequence',
      header: t('finance.instalment.sequence'),
      cell: ({ row }) => <span className="tabular-nums">{row.original.sequence}.</span>,
    },
    {
      id: 'dueDate',
      header: t('common.dueDate'),
      cell: ({ row }) => formatDate(row.original.dueDate),
    },
    {
      id: 'daysOverdue',
      header: t('finance.instalment.daysOverdue'),
      cell: ({ row }) =>
        row.original.daysOverdue > 0 ? (
          <span className="tabular-nums text-destructive">
            {t('finance.instalment.daysOverdueValue', { count: row.original.daysOverdue })}
          </span>
        ) : (
          <span className="text-muted-foreground">{t('finance.instalment.notOverdue')}</span>
        ),
    },
    {
      id: 'amount',
      header: t('common.amount'),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatMoney(row.original.amount, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'paidAmount',
      header: t('finance.instalment.paidAmount'),
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatMoney(row.original.paidAmount, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: t('common.balance'),
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatMoney(row.original.balance, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {t(`finance.instalment.statuses.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        // A waived or cancelled instalment takes no money — the server refuses it, and
        // offering the button anyway would be an invitation to a 409.
        const collectable =
          row.original.status !== 'WAIVED' &&
          row.original.status !== 'CANCELLED' &&
          row.original.status !== 'PAID';

        return (
          <div className="flex justify-end gap-1">
            <MutatingButton
              variant="ghost"
              size="sm"
              disabled={!collectable}
              onClick={() => setPaying(row.original)}
            >
              {t('finance.payment.record')}
            </MutatingButton>
            <MutatingButton variant="ghost" size="sm" onClick={() => setActing(row.original)}>
              {t('common.details')}
            </MutatingButton>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('finance.instalment.title')}
        description={t('finance.instalment.subtitle')}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <ChoiceFilter
          label={t('common.status')}
          value={list.filters.status}
          onChange={(status) => list.setFilters({ status: status as InstalmentStatus | undefined })}
          options={INSTALMENT_STATUSES.map((status) => ({
            value: status,
            label: t(`finance.instalment.statuses.${status}`),
          }))}
        />
        <ChoiceFilter
          label={t('finance.instalment.outstandingOnly')}
          value={list.filters.outstanding === true ? 'true' : undefined}
          onChange={(value) =>
            list.setFilters({ outstanding: value === 'true' ? true : undefined })
          }
          options={[{ value: 'true', label: t('common.yes') }]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={INSTALMENT_SORT_COLUMNS}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('finance.instalment.title')}
        emptyBody={t('finance.instalment.empty')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />

      {paying ? <PaymentDialog instalment={paying} onClose={() => setPaying(null)} /> : null}
      {acting ? (
        <InstalmentActionsDialog instalment={acting} onClose={() => setActing(null)} />
      ) : null}
    </>
  );
}
