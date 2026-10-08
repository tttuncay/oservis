import type { GenerationRunDto } from '@servisapp/shared';
import { useGenerationRuns } from '@/api/routing-hooks';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';
import { formatClock } from './format';

/**
 * FR-RTE-070, FR-RTE-080 and FR-RTE-090's *"…and notify the Admin"* — as a panel, until
 * the notification module lands in Phase 8 (SDD §12).
 *
 * ## Why the mapping figures are on the operations screen
 *
 * SDD §18.5 calls an uncached implementation *"the single most expensive mistake
 * available in this design"*, and §8.3 requires a quota alarm. A cost that is only
 * visible on an invoice is discovered a month late; a cost that sits next to the routes
 * that caused it is discovered the same morning. Three numbers — billable calls, cache
 * hits, fallbacks — say whether the caching is working, and the person looking at this
 * screen is the person who would notice them change.
 */
export function GenerationRunsPanel({ date }: { date: string }) {
  const query = useGenerationRuns({ from: date, to: date, limit: 10 });

  if (query.isLoading) return null;
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const runs = query.data ?? [];

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{t('trip.generationRuns')}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t('trip.runsSubtitle')}</p>

      {runs.length === 0 ? (
        <EmptyState title={t('trip.runsEmptyTitle')} body={t('trip.runsEmptyBody')} />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}

function RunCard({ run }: { run: GenerationRunDto }) {
  return (
    <article className="rounded-lg border p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-medium">{t(`direction.${run.direction}`)}</span>
        <span className="text-sm text-muted-foreground">
          {formatClock(run.startedAt)}
          {run.finishedAt ? ` – ${formatClock(run.finishedAt)}` : ''}
        </span>
        <Badge variant={run.status === 'FAILED' ? 'destructive' : 'secondary'}>
          {run.status === 'FAILED' ? t('error.INTERNAL_ERROR') : t(`tripState.FINISHED`)}
        </Badge>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4 lg:grid-cols-7">
        <Figure label={t('trip.runTemplates')} value={run.templatesTotal} />
        <Figure label={t('trip.runCreated')} value={run.tripsCreated} />
        <Figure label={t('trip.runBlocked')} value={run.tripsBlocked} emphasise={run.tripsBlocked > 0} />
        <Figure label={t('trip.runSkipped')} value={run.templatesSkipped} />
        <Figure label={t('trip.runProviderCalls')} value={run.providerCalls} />
        <Figure label={t('trip.runCacheHits')} value={run.cacheHits} />
        <Figure
          label={t('trip.runFallbacks')}
          value={run.fallbacks}
          emphasise={run.fallbacks > 0}
        />
      </dl>

      {run.issues.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
          {run.issues.map((issue, index) => (
            <li key={`${issue.templateId ?? 'run'}-${index}`}>
              {t(`generationIssue.${issue.code}`)}
              {issue.detail ? <span className="ml-1 opacity-70">({issue.detail})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function Figure({
  label,
  value,
  emphasise = false,
}: {
  label: string;
  value: number;
  emphasise?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={emphasise ? 'font-semibold text-destructive' : 'font-medium'}>{value}</dd>
    </div>
  );
}
