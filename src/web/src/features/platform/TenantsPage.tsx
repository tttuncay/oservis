import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { TENANT_STATUSES, type TenantStatus, type TenantSummary } from '@servisapp/shared';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/money';
import { t } from '@/i18n';
import { usePlans, useTenants } from './use-platform';

/**
 * FR-SYS-010 — every company on the platform, as a list.
 *
 * ## Filtered by status, and by nothing else
 *
 * `tenantQuerySchema` takes a status and a cursor. There is no search box because there
 * is nothing to search: a platform with a hundred customers fits on two pages, and a
 * filter an operator actually reaches for is *"who is in `GRACE` this morning"* — which
 * is the status filter, and which is the screen's whole job.
 *
 * ## The status badge is the point of the row
 *
 * Every other column is identity. The status is what an operator is here to see, so it
 * is coloured: `SUSPENDED` and `READ_ONLY` are the two that mean a customer cannot work.
 */
export function TenantsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TenantStatus | undefined>(undefined);

  const query = useTenants({ limit: 50, ...(status ? { status } : {}) });
  const plans = usePlans(true);

  const planName = (id: string | null): string =>
    id === null
      ? t('sysadmin.tenants.noPlan')
      : (plans.data?.find((plan) => plan.id === id)?.name ?? id);

  const columns: ColumnDef<TenantSummary, unknown>[] = [
    { id: 'legalName', accessorKey: 'legalName', header: t('sysadmin.tenants.legalName') },
    {
      id: 'status',
      header: t('sysadmin.tenants.status'),
      cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
    },
    {
      id: 'plan',
      header: t('sysadmin.tenants.plan'),
      cell: ({ row }) => (
        <span className={row.original.planId === null ? 'text-muted-foreground' : undefined}>
          {planName(row.original.planId)}
        </span>
      ),
    },
    {
      id: 'taxNo',
      header: t('sysadmin.tenants.taxNo'),
      cell: ({ row }) => row.original.taxNo ?? '—',
    },
    {
      id: 'trialEndsAt',
      header: t('sysadmin.tenants.trialEndsAt'),
      cell: ({ row }) => date(row.original.trialEndsAt),
    },
    {
      id: 'createdAt',
      header: t('sysadmin.tenants.createdAt'),
      cell: ({ row }) => date(row.original.createdAt),
    },
  ];

  return (
    <>
      <PageHeader title={t('sysadmin.tenants.title')} description={t('sysadmin.tenants.subtitle')} />

      <div className="mb-4 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('sysadmin.tenants.filterStatus')}</span>
          <Select
            value={status ?? 'ALL'}
            onValueChange={(value) => setStatus(value === 'ALL' ? undefined : (value as TenantStatus))}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('sysadmin.tenants.allStatuses')}</SelectItem>
              {TENANT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sysadmin.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={query.data ?? []}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('sysadmin.tenants.empty')}
        emptyBody={t('sysadmin.tenants.subtitle')}
        filtered={status !== undefined}
        onRowClick={(row) => navigate(`/sysadmin/tenants/${row.id}`)}
      />
    </>
  );
}

/**
 * The lifecycle rung, coloured by what it means for the customer.
 *
 * `SUSPENDED` is destructive-red because the company cannot sign in; `READ_ONLY` and
 * `GRACE` are warnings because they can still work, or still work partly. `TRIAL` is
 * neutral rather than green: a trial is not a paying customer, and colouring it as one
 * would make the list read as healthier than it is.
 */
export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const variant =
    status === 'SUSPENDED'
      ? 'destructive'
      : status === 'READ_ONLY' || status === 'GRACE'
        ? 'warning'
        : status === 'ACTIVE'
          ? 'success'
          : 'secondary';

  return <Badge variant={variant}>{t(`sysadmin.status.${status}`)}</Badge>;
}

function date(value: string | null): string {
  return value === null ? '—' : formatDate(value.slice(0, 10));
}
