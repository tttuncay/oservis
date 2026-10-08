import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Info } from 'lucide-react';
import type { DashboardAlert } from '@servisapp/shared';
import { useDashboard } from '@/api/hooks';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/money';
import { t } from '@/i18n';

/**
 * FR-RPT-010 and FR-RPT-020 — the Admin's first screen (SDD §15.3).
 *
 * ## One request, which is the requirement rather than an optimisation
 *
 * Phase 3 left this screen deliberately inert: *"the tempting interim is to fetch
 * students, vehicles and routes here and count them. That is precisely the shape §15.3
 * exists to forbid, and by the time the real endpoint arrived the fan-out would be
 * load-bearing."* It never became load-bearing, and this screen makes exactly one call.
 *
 * ## Nothing is computed here
 *
 * Every figure arrives decided — counts as integers, money as decimal strings, the
 * alerts already classified and ordered. `formatMoney` places a thousands separator and a
 * symbol; it does not add anything up. A browser that summed a column would be a second
 * implementation of a number the server already produced (SDD §1.2 P2).
 *
 * ## The alerts carry data, not sentences
 *
 * The server writes no Turkish (CLAUDE.md), so each alert arrives as a `kind` and the
 * values its sentence interpolates. The sentence is rendered here from
 * `packages/i18n` — which is also what makes the dashboard say the same words as the push
 * notification about the same condition.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState<string | undefined>(undefined);

  const query = useDashboard(date ? { date } : {});

  if (query.isError) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const data = query.data;

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('dashboard.date')}</span>
            <input
              type="date"
              aria-label={t('dashboard.date')}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={date ?? data?.date ?? ''}
              onChange={(event) => setDate(event.target.value || undefined)}
            />
          </label>
        }
      />

      {/*
        SDD §15.3 caches the aggregate for sixty seconds, so a reader may be looking at a
        figure up to a minute old. Saying so is the difference between a stale number and
        a lie — an Admin watching a morning run has to be able to tell the two apart.
      */}
      {data ? (
        <p className="mb-4 text-xs text-muted-foreground">
          {t('dashboard.computedAt', { time: clock(data.computedAt) })}
        </p>
      ) : null}

      <section aria-label={t('dashboard.trips')} className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {t('dashboard.trips')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('dashboard.tripsPlanned')} value={data?.trips.planned} />
          <Stat label={t('dashboard.tripsInProgress')} value={data?.trips.inProgress} />
          <Stat label={t('dashboard.tripsCompleted')} value={data?.trips.completed} />
          <Stat label={t('dashboard.tripsCancelled')} value={data?.trips.cancelled} />
        </div>
      </section>

      <section aria-label={t('dashboard.students')} className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {t('dashboard.students')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label={t('dashboard.studentsExpected')} value={data?.students.expected} />
          <Stat label={t('dashboard.studentsBoarded')} value={data?.students.boarded} />
          <Stat label={t('dashboard.studentsDroppedOff')} value={data?.students.droppedOff} />
          <Stat label={t('dashboard.studentsAbsent')} value={data?.students.absent} />
          <Stat label={t('dashboard.studentsNoShow')} value={data?.students.noShow} />
        </div>
      </section>

      <section aria-label={t('dashboard.sweeps')} className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {t('dashboard.sweeps')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label={t('dashboard.sweepsOutstanding')} value={data?.sweeps.outstanding} />
          {/* An overdue sweep is a child possibly still on a vehicle (FR-ATT-100). It is
              the one count on this screen that is rendered in the destructive colour. */}
          <Stat
            label={t('dashboard.sweepsOverdue')}
            value={data?.sweeps.overdue}
            tone={data && data.sweeps.overdue > 0 ? 'danger' : 'default'}
          />
        </div>
      </section>

      <section aria-label={t('dashboard.finance')} className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {t('dashboard.finance')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t('dashboard.collected')}
            value={money(data?.finance.collected, data?.finance.currency)}
          />
          <Stat
            label={t('dashboard.outstanding')}
            value={money(data?.finance.outstanding, data?.finance.currency)}
          />
          <Stat
            label={t('dashboard.overdue')}
            value={money(data?.finance.overdue, data?.finance.currency)}
            tone={data && data.finance.overdue !== '0.00' ? 'danger' : 'default'}
          />
          <Stat
            label={t('dashboard.expenses')}
            value={money(data?.finance.expenses, data?.finance.currency)}
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.alerts')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.alertsEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {data.alerts.map((alert) => (
                <li
                  key={`${alert.kind}:${alert.tripId ?? ''}:${alert.studentId ?? ''}`}
                  className="flex items-start gap-3 rounded-md border p-3 text-sm"
                >
                  {alert.severity === 'CRITICAL' ? (
                    <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 text-destructive" />
                  ) : (
                    <Info aria-hidden className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  )}

                  <div className="flex-1">
                    <p>{describe(alert)}</p>
                    <p className="text-xs text-muted-foreground">{clock(alert.at)}</p>
                  </div>

                  {alert.tripId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/trips/${alert.tripId}`)}
                    >
                      {t('dashboard.openTrip')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string | undefined;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={
            tone === 'danger' ? 'text-2xl font-semibold text-destructive' : 'text-2xl font-semibold'
          }
        >
          {/* An em dash while loading rather than a zero: an Admin glancing at a screen
              must not read "0 trips today" from a request that has not answered. */}
          {value === undefined ? '—' : value}
        </p>
      </CardContent>
    </Card>
  );
}

/** One alert as a sentence, from the catalogue. Never assembled on the server. */
function describe(alert: DashboardAlert): string {
  return t(`dashboardAlert.${alert.kind}`, alert.context);
}

function money(amount: string | undefined, currency: string | undefined): string | undefined {
  return amount === undefined ? undefined : formatMoney(amount, currency ?? 'TRY');
}

/** `HH:mm` in the company's zone (SDD §13). Every tenant is Istanbul in V1. */
function clock(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
