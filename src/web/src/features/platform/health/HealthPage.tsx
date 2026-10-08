import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { TENANT_STATUSES, type PlatformHealth } from '@servisapp/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import { t, type TranslationKey } from '@/i18n';
import { usePlatformHealth } from '../use-platform';
import { useHealth, type HealthDependency } from './use-health';

/**
 * FR-SYS-090 — *"error rate, request latency, failed background jobs, push delivery
 * failures, and external API quota consumption."*
 *
 * ## Two endpoints, and they answer different questions
 *
 * `GET /platform/health` is this phase's aggregate: how is the platform *going*, over a
 * window. `GET /health` is Phase 0's liveness probe: can this replica serve, right now.
 * They are rendered on one screen because an operator opens it with one worry, and kept
 * as two sections because a dependency being reachable says nothing about the error rate
 * and vice versa.
 *
 * ## `null` is rendered as *"unknown"*, never as zero
 *
 * The server reports `null` when Redis could not answer (SDD §1.2 P6). A zero error rate
 * displayed because the metrics store is down is the most dangerous number this screen
 * could show, so every figure goes through {@link Figure}, which has no other way to
 * render an absent value.
 */
export function HealthPage() {
  const [windowMinutes, setWindowMinutes] = useState(15);

  const platform = usePlatformHealth(windowMinutes);
  const dependencies = useHealth();

  return (
    <>
      <PageHeader
        title={t('sysadmin.health.title')}
        description={t('sysadmin.health.subtitle', { minutes: windowMinutes })}
        actions={
          <div className="flex items-end gap-2">
            <Select
              value={String(windowMinutes)}
              onValueChange={(value) => setWindowMinutes(Number(value))}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 15, 60, 120].map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {t('sysadmin.health.subtitle', { minutes })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={platform.isFetching}
              onClick={() => void platform.refetch()}
            >
              <RefreshCw className={platform.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {t('health.refresh')}
            </Button>
          </div>
        }
      />

      {platform.data ? <PlatformSummary health={platform.data} /> : null}

      <Card className="mt-4">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-base">{t('sysadmin.health.dependencies')}</CardTitle>
            <CardDescription>{t('health.subtitle')}</CardDescription>
          </div>
          {dependencies.data ? (
            <Badge variant={dependencies.data.status === 'ok' ? 'success' : 'destructive'}>
              {dependencies.data.status === 'ok'
                ? t('health.overallHealthy')
                : t('health.overallDegraded')}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {Object.entries(dependencies.data?.details ?? {}).map(([name, dependency]) => (
            <DependencyRow key={name} name={name} dependency={dependency} />
          ))}
          {dependencies.isError ? (
            <p className="text-sm text-destructive">{t('health.unreachable')}</p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function PlatformSummary({ health }: { health: PlatformHealth }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.health.requests')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label={t('sysadmin.health.requestTotal')} value={health.requests.total} />
          <Figure
            label={t('sysadmin.health.errorRate')}
            value={health.requests.errorRate}
            format={(value) => `${(value * 100).toFixed(2)} %`}
            alarming={health.requests.errorRate !== null && health.requests.errorRate > 0.01}
          />
          <Figure
            label={`${t('sysadmin.health.latency')} p95`}
            value={health.requests.p95Ms}
            format={(value) => `${value} ms`}
          />
          <Figure
            label={`${t('sysadmin.health.latency')} p99`}
            value={health.requests.p99Ms}
            format={(value) => `${value} ms`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.health.push')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Figure label={t('sysadmin.health.pushSent')} value={health.push.sent} />
          <Figure
            label={t('sysadmin.health.pushFailed')}
            value={health.push.failed}
            alarming={(health.push.failed ?? 0) > 0}
          />
          <Figure
            label={t('sysadmin.health.errorRate')}
            value={health.push.failureRate}
            format={(value) => `${(value * 100).toFixed(1)} %`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.health.queues')}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2">{t('sysadmin.health.queueName')}</th>
                <th className="p-2 text-right">{t('sysadmin.health.queueWaiting')}</th>
                <th className="p-2 text-right">{t('sysadmin.health.queueActive')}</th>
                <th className="p-2 text-right">{t('sysadmin.health.queueDelayed')}</th>
                <th className="p-2 text-right">{t('sysadmin.health.queueFailed')}</th>
              </tr>
            </thead>
            <tbody>
              {health.queues.map((queue) => (
                <tr key={queue.name} className="border-b">
                  <td className="p-2 font-mono text-xs">{queue.name}</td>
                  <td className="p-2 text-right tabular-nums">{queue.waiting}</td>
                  <td className="p-2 text-right tabular-nums">{queue.active}</td>
                  <td className="p-2 text-right tabular-nums">{queue.delayed}</td>
                  <td
                    className={`p-2 text-right tabular-nums ${
                      queue.failed > 0 ? 'font-medium text-destructive' : ''
                    }`}
                  >
                    {queue.failed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.health.maps')}</CardTitle>
          {health.maps?.budgetExceeded ? (
            <CardDescription className="text-destructive">
              {t('sysadmin.health.mapsExceeded')}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {health.maps === null ? (
            <p className="text-sm text-muted-foreground">{t('sysadmin.health.unknown')}</p>
          ) : (
            <>
              <Figure label={t('sysadmin.health.mapsMode')} text={health.maps.mode} />
              <Figure label={t('sysadmin.health.mapsCalls')} value={health.maps.billableCalls} />
              <Figure label={t('sysadmin.health.mapsCacheHits')} value={health.maps.cacheHits} />
              <Figure label={t('sysadmin.health.mapsSpend')} text={`$${health.maps.spentUsd}`} />
              <Figure label={t('sysadmin.health.mapsBudget')} text={`$${health.maps.budgetUsd}`} />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.health.tenants')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {TENANT_STATUSES.map((status) => (
            <Figure
              key={status}
              label={t(`sysadmin.status.${status}`)}
              value={health.tenants[status]}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * One number, or the fact that there is no number.
 *
 * `value === null` renders *"unknown"* with the reason under it. There is deliberately no
 * way to pass a fallback: a component that could be told to show `0` for a missing figure
 * is a component somebody will eventually tell to.
 */
function Figure({
  label,
  value,
  text,
  format,
  alarming,
}: {
  label: string;
  value?: number | null;
  text?: string;
  format?: (value: number) => string;
  alarming?: boolean;
}) {
  const unknown = text === undefined && (value === null || value === undefined);

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {unknown ? (
        <>
          <p className="text-sm text-muted-foreground">{t('sysadmin.health.unknown')}</p>
          <p className="text-xs text-muted-foreground">{t('sysadmin.health.unknownHint')}</p>
        </>
      ) : (
        <p
          className={`text-xl font-semibold tabular-nums ${alarming ? 'text-destructive' : ''}`}
        >
          {text ?? (format ? format(value as number) : String(value))}
        </p>
      )}
    </div>
  );
}

function DependencyRow({ name, dependency }: { name: string; dependency: HealthDependency }) {
  const up = dependency.status === 'up';

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{dependencyLabel(name)}</p>
        {dependency.reason ? (
          <p className="truncate text-xs text-muted-foreground">{dependency.reason}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {dependency.latencyMs === undefined ? null : (
          <span className="text-xs text-muted-foreground">{dependency.latencyMs} ms</span>
        )}
        <Badge variant={up ? 'success' : 'destructive'}>
          {up ? t('health.statusUp') : t('health.statusDown')}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Falls back to the raw key when the API reports a dependency the catalogue has no
 * label for — a new indicator should show up unlabelled rather than not at all.
 */
function dependencyLabel(name: string): string {
  const key = `health.dependency.${name}` as TranslationKey;
  const label = t(key);
  return label === key ? name : label;
}
