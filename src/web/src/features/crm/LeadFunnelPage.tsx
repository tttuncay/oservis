import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { LeadFunnelRow, LeadSource } from '@servisapp/shared';
import { useLeadFunnel, useMeTenant } from '@/api/hooks';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';

/**
 * FR-MKT-060 — *"lead volume and conversion rate by month and source"*.
 *
 * ## The rate is the server's string and is rendered as it arrives
 *
 * `conversionRate` comes back as `"33.3"` or `null`, already rounded. Nothing here divides
 * anything: a second implementation of the arithmetic is how a screen and an export come
 * to disagree, and the export is the one an owner takes to their accountant.
 *
 * `null` renders as *"nothing settled yet"* rather than as `0.0%`. A rate over no
 * decisions is unknown, and zero reads as a catastrophe.
 *
 * ## The public page's link lives here
 *
 * FR-MKT-010's page is reachable only if the tenant has a slug, and the Admin's own tenant
 * record carries it (`GET /me/tenant`). Putting the link beside the funnel is the one
 * place an Admin looks at *"where are my leads coming from"* — and the answer to a month
 * of zeroes is usually that nobody has shared the link.
 */
export function LeadFunnelPage() {
  // FR-MKT-010's link needs the tenant's own slug, which lives on `GET /me/tenant` rather
  // than on `MeResponse` — memberships name a company, not its public page.
  const tenant = useMeTenant();
  const [range, setRange] = useState(defaultRange);

  const query = useLeadFunnel(range);

  const columns: ColumnDef<LeadFunnelRow, unknown>[] = [
    { id: 'month', accessorKey: 'month', header: t('crm.month') },
    {
      id: 'source',
      header: t('crm.source'),
      cell: ({ row }) => t(`leadSource.${row.original.source as LeadSource}`),
    },
    { id: 'total', accessorKey: 'total', header: t('crm.total') },
    { id: 'won', accessorKey: 'won', header: t('crm.won') },
    { id: 'lost', accessorKey: 'lost', header: t('crm.lost') },
    { id: 'open', accessorKey: 'open', header: t('crm.open') },
    {
      id: 'conversionRate',
      header: t('crm.conversionRate'),
      cell: ({ row }) =>
        row.original.conversionRate === null
          ? t('crm.noRate')
          : `%${row.original.conversionRate}`,
    },
  ];

  const totals = query.data?.totals;

  return (
    <>
      <PageHeader title={t('crm.funnel')} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateField
          label={t('common.from')}
          value={range.from}
          onChange={(from) => setRange((current) => ({ ...current, from }))}
        />
        <DateField
          label={t('common.to')}
          value={range.to}
          onChange={(to) => setRange((current) => ({ ...current, to }))}
        />
      </div>

      {totals ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label={t('crm.total')} value={String(totals.total)} />
          <Stat label={t('crm.won')} value={String(totals.won)} />
          <Stat label={t('crm.lost')} value={String(totals.lost)} />
          <Stat label={t('crm.open')} value={String(totals.open)} />
          <Stat
            label={t('crm.conversionRate')}
            value={totals.conversionRate === null ? t('crm.noRate') : `%${totals.conversionRate}`}
          />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('crm.funnel')}
        emptyBody={t('crm.empty')}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t('crm.publicPage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {tenant.data?.publicSlug ? (
            <>
              <p className="text-muted-foreground">{t('crm.publicPageHint')}</p>
              <code className="block rounded bg-muted px-2 py-1">
                {`${window.location.origin}/teklif/${tenant.data.publicSlug}`}
              </code>
            </>
          ) : (
            <p className="text-muted-foreground">{t('crm.publicPageDisabled')}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="date"
        aria-label={label}
        className="h-9 rounded-md border bg-background px-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/**
 * The last twelve months, ending today.
 *
 * A year is what makes *"this September against last September"* possible, which is the
 * comparison FR-MKT-060 exists for — school transport is a seasonal business and a
 * three-month default would hide the only pattern in the data.
 */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setUTCMonth(from.getUTCMonth() - 11);
  from.setUTCDate(1);

  return { from: iso(from), to: iso(today) };
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
