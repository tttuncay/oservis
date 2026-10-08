import type { ColumnDef } from '@tanstack/react-table';
import type { VehicleDocumentAlert } from '@servisapp/shared';
import { useVehicleAlerts } from '@/api/hooks';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';

/**
 * FR-CMP-030 — *"30 days before, and daily after, the expiry"*.
 *
 * The server returns these already ordered by urgency, and nothing here re-sorts them.
 * `daysRemaining` goes negative once the date has passed, which is what lets one field
 * express both halves of the requirement and lets this table say "42 days overdue"
 * without knowing today's date.
 */
export function VehicleAlertsPage() {
  const query = useVehicleAlerts();

  const columns: ColumnDef<VehicleDocumentAlert, unknown>[] = [
    {
      id: 'plate',
      header: t('vehicle.plate'),
      cell: ({ row }) => <span className="font-medium">{row.original.plate}</span>,
    },
    {
      id: 'kind',
      header: t('common.details'),
      cell: ({ row }) => t(`alert.kind${row.original.kind}`),
    },
    { id: 'dueDate', header: t('common.dueDate'), cell: ({ row }) => row.original.dueDate },
    {
      id: 'daysRemaining',
      header: t('common.status'),
      cell: ({ row }) => <UrgencyBadge alert={row.original} />,
    },
  ];

  return (
    <>
      <PageHeader title={t('alert.title')} description={t('alert.description')} />
      <DataTable
        columns={columns}
        rows={query.data ?? []}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('alert.emptyTitle')}
        emptyBody={t('alert.emptyBody')}
      />
    </>
  );
}

function UrgencyBadge({ alert }: { alert: VehicleDocumentAlert }) {
  if (alert.expired) {
    return (
      <Badge variant="destructive">
        {t('alert.expiredDays', { days: Math.abs(alert.daysRemaining) })}
      </Badge>
    );
  }

  if (alert.daysRemaining === 0) {
    return <Badge variant="destructive">{t('alert.dueToday')}</Badge>;
  }

  return <Badge variant="secondary">{t('alert.daysRemaining', { days: alert.daysRemaining })}</Badge>;
}
