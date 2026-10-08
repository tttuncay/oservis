import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import {
  FEATURE_FLAGS,
  TENANT_STATUSES,
  type FeatureFlag,
  type SubscriptionChargeStatus,
  type TenantStatus,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation } from '@/api/hooks';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatMoney } from '@/lib/money';
import { t } from '@/i18n';
import { TenantStatusBadge } from './TenantsPage';
import {
  PLATFORM_TENANT_KEYS,
  platformKeys,
  useCharges,
  useImpersonations,
  usePlans,
  useRetention,
  useTenant,
  useTenantAudit,
  useTenantFlags,
} from './use-platform';

/**
 * One company, and everything the platform does to it — FR-SYS-010/020/040/050/070/100
 * and FR-FLG-010/020.
 *
 * ## One screen rather than five
 *
 * The questions an operator arrives with are *"why can this customer not work"*, *"what
 * are they paying"* and *"who has been in their account"*, and all three are about the
 * same company on the same afternoon. Five routes would mean re-finding the tenant four
 * times. The tabs keep each answer one click away without any of them loading until it
 * is asked for.
 *
 * ## Nothing here reads the tenant's own data
 *
 * Statuses, plans, charges, flags and audit entries — all platform-scoped. A Sysadmin
 * reaches a student or a trip only through an impersonation session, which is what the
 * button at the top starts and what FR-SYS-120 confines them to.
 */
export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const tenant = useTenant(tenantId);

  if (tenant.isError) return <ErrorState error={tenant.error} onRetry={() => void tenant.refetch()} />;
  if (!tenant.data) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  const company = tenant.data;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 gap-2" onClick={() => navigate('/sysadmin/tenants')}>
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t('sysadmin.tenants.title')}
      </Button>

      <PageHeader
        title={company.legalName}
        description={t('sysadmin.tenants.detailTitle')}
        actions={<ImpersonateButton tenantId={company.id} legalName={company.legalName} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <TenantStatusBadge status={company.status} />
        <Field label={t('sysadmin.tenants.taxNo')} value={company.taxNo ?? '—'} />
        <Field label={t('sysadmin.tenants.trialEndsAt')} value={day(company.trialEndsAt)} />
        <Field label={t('sysadmin.tenants.graceEndsAt')} value={day(company.graceEndsAt)} />
        <Field label={t('sysadmin.tenants.createdAt')} value={day(company.createdAt)} />
      </div>

      <Tabs defaultValue="lifecycle">
        <TabsList>
          <TabsTrigger value="lifecycle">{t('sysadmin.tenants.changeStatus')}</TabsTrigger>
          <TabsTrigger value="charges">{t('sysadmin.charges.title')}</TabsTrigger>
          <TabsTrigger value="flags">{t('sysadmin.flags.title')}</TabsTrigger>
          <TabsTrigger value="retention">{t('sysadmin.retention.title')}</TabsTrigger>
          <TabsTrigger value="audit">{t('sysadmin.audit.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="lifecycle">
          <LifecyclePanel tenantId={company.id} status={company.status} />
        </TabsContent>
        <TabsContent value="charges">
          <ChargesPanel tenantId={company.id} planId={company.planId} />
        </TabsContent>
        <TabsContent value="flags">
          <FlagsPanel tenantId={company.id} />
        </TabsContent>
        <TabsContent value="retention">
          <RetentionPanel tenantId={company.id} legalName={company.legalName} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditPanel tenantId={company.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---- FR-SYS-050 — the lifecycle -------------------------------------------------------

/**
 * The status change, with its mandatory reason.
 *
 * Every status is offered and the **server** refuses the illegal ones — the state machine
 * is `TenantService`'s and a second copy here would be a second thing to keep in step.
 * What the screen does is make the reason unavoidable, because it is what the audit entry
 * is read for six months later (SDD §17.4).
 */
function LifecyclePanel({ tenantId, status }: { tenantId: string; status: TenantStatus }) {
  const [target, setTarget] = useState<TenantStatus>(status);
  const [reason, setReason] = useState('');
  const [graceDays, setGraceDays] = useState('14');

  const mutation = useResourceMutation(
    () =>
      api.platform.setStatus(tenantId, {
        status: target,
        reason,
        ...(target === 'GRACE' ? { graceDays: Number(graceDays) } : {}),
      }),
    PLATFORM_TENANT_KEYS,
  );

  return (
    <Card className="mt-4 max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t('sysadmin.tenants.changeStatusTitle')}</CardTitle>
        <CardDescription>{t('sysadmin.tenants.statusReasonHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t('sysadmin.tenants.targetStatus')}</Label>
          <Select value={target} onValueChange={(value) => setTarget(value as TenantStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TENANT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sysadmin.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {target === 'GRACE' ? (
          <div className="space-y-1.5">
            <Label htmlFor="graceDays">{t('sysadmin.tenants.graceDays')}</Label>
            <Input
              id="graceDays"
              type="number"
              min={0}
              max={180}
              value={graceDays}
              onChange={(event) => setGraceDays(event.target.value)}
              className="w-32"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="statusReason">{t('sysadmin.tenants.statusReason')}</Label>
          <Textarea
            id="statusReason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {mutation.isError ? <ErrorState error={mutation.error} /> : null}

        <Button
          disabled={reason.trim().length < 3 || mutation.isPending}
          onClick={() => mutation.mutate(undefined as never)}
        >
          {mutation.isPending ? t('common.saving') : t('sysadmin.tenants.changeStatus')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- FR-SYS-020, FR-SYS-040 — plan and charges ---------------------------------------

function ChargesPanel({ tenantId, planId }: { tenantId: string; planId: string | null }) {
  const plans = usePlans(true);
  const charges = useCharges(tenantId, { limit: 24 });

  const assign = useResourceMutation(
    (next: string | null) => api.platform.setPlan(tenantId, next),
    PLATFORM_TENANT_KEYS,
  );

  const compute = useResourceMutation(() => api.platform.computeCharge(tenantId), [
    platformKeys.charges,
  ]);

  const setStatus = useResourceMutation(
    (input: { chargeId: string; status: SubscriptionChargeStatus }) =>
      api.platform.setChargeStatus(tenantId, input.chargeId, input.status),
    [platformKeys.charges],
  );

  return (
    <div className="mt-4 space-y-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.tenants.assignPlan')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={planId ?? 'NONE'}
            onValueChange={(value) => assign.mutate(value === 'NONE' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">{t('sysadmin.tenants.noPlan')}</SelectItem>
              {(plans.data ?? []).map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                  {plan.archivedAt ? ` — ${t('sysadmin.plans.archived')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assign.isError ? <ErrorState error={assign.error} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('sysadmin.charges.title')}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={compute.isPending}
            onClick={() => compute.mutate(undefined as never)}
          >
            {compute.isPending ? t('common.saving') : t('sysadmin.charges.compute')}
          </Button>
        </CardHeader>
        <CardContent>
          {compute.isError ? <ErrorState error={compute.error} /> : null}
          {/* The server answers with nothing at all when the tenant is on no plan. */}
          {compute.isSuccess && compute.data === null ? (
            <p className="mb-3 text-sm text-muted-foreground">{t('sysadmin.charges.skipped')}</p>
          ) : null}

          {(charges.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sysadmin.charges.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">{t('sysadmin.charges.period')}</th>
                  <th className="p-2">{t('sysadmin.plans.name')}</th>
                  <th className="p-2 text-right">{t('sysadmin.charges.vehicles')}</th>
                  <th className="p-2 text-right">{t('sysadmin.charges.amount')}</th>
                  <th className="p-2">{t('sysadmin.charges.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(charges.data ?? []).map((charge) => (
                  <tr key={charge.id} className="border-b">
                    <td className="p-2">{charge.periodStart.slice(0, 7)}</td>
                    <td className="p-2">{charge.planName}</td>
                    <td className="p-2 text-right tabular-nums">{charge.activeVehicleCount ?? '—'}</td>
                    {/* Rendered, never recomputed — the server owns the arithmetic. */}
                    <td className="p-2 text-right tabular-nums">
                      {charge.amount === null ? '—' : formatMoney(charge.amount, charge.currency)}
                    </td>
                    <td className="p-2">
                      <Select
                        value={charge.status}
                        onValueChange={(value) =>
                          setStatus.mutate({
                            chargeId: charge.id,
                            status: value as SubscriptionChargeStatus,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['COMPUTED', 'INVOICED', 'PAID', 'WRITTEN_OFF'] as const).map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`sysadmin.charges.statusValue.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- FR-FLG-010, FR-FLG-020 — the module toggles --------------------------------------

/**
 * *"Disabling a flag shall hide the corresponding functionality from all affected users
 * without requiring a deployment."*
 *
 * One `PUT` per toggle rather than a form with a save button, because that is what
 * "without requiring a deployment" is asking for: the change takes effect on the next
 * request the tenant makes, and a Sysadmin on the telephone to a customer should be able
 * to say *"try now"*. The server invalidates its own cache on the write (FR-FLG-020), so
 * there is no window in which the console and the tenant disagree.
 *
 * Nothing here decides anything. `FeatureFlagGuard` evaluates every flag server-side and
 * a modified client reaches nothing extra (FR-FLG-040).
 */
function FlagsPanel({ tenantId }: { tenantId: string }) {
  const flags = useTenantFlags(tenantId);

  const toggle = useResourceMutation(
    (input: { flag: FeatureFlag; enabled: boolean }) =>
      api.platform.setFlags(tenantId, { [input.flag]: input.enabled }),
    [platformKeys.flags],
  );

  return (
    <Card className="mt-4 max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t('sysadmin.flags.title')}</CardTitle>
        <CardDescription>{t('sysadmin.flags.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {toggle.isError ? <ErrorState error={toggle.error} /> : null}

        {FEATURE_FLAGS.map((flag) => (
          <label key={flag} className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={flags.data?.[flag] ?? false}
              disabled={flags.isLoading || toggle.isPending}
              onCheckedChange={(checked) => toggle.mutate({ flag, enabled: checked === true })}
            />
            {t(`sysadmin.flags.flag.${flag}`)}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

// ---- FR-SYS-070 — retention and the purge ---------------------------------------------

/**
 * The ninety-day floor, and the one button in the console with no undo.
 *
 * The purge form only appears once the server says the floor has lifted. That is not the
 * enforcement — the server refuses regardless, with `TENANT_RETENTION_ACTIVE` — but a
 * destructive control that is *visible* whenever an operator is looking at a suspended
 * customer is a control that will eventually be pressed by mistake.
 */
function RetentionPanel({ tenantId, legalName }: { tenantId: string; legalName: string }) {
  const navigate = useNavigate();
  const retention = useRetention(tenantId);

  const [confirmLegalName, setConfirmLegalName] = useState('');
  const [reason, setReason] = useState('');

  const purge = useResourceMutation(
    () => api.platform.purge(tenantId, { confirmLegalName, reason }),
    PLATFORM_TENANT_KEYS,
  );

  if (!retention.data) return <p className="mt-4 text-sm text-muted-foreground">{t('common.loading')}</p>;

  const state = retention.data;

  return (
    <Card className="mt-4 max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t('sysadmin.retention.title')}</CardTitle>
        <CardDescription>
          {state.suspendedAt === null
            ? t('sysadmin.retention.notSuspended')
            : state.purgeEligible
              ? t('sysadmin.retention.eligible')
              : t('sysadmin.retention.waiting', { date: formatDate(state.retainedUntil) })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-6 text-sm">
          <Field label={t('sysadmin.retention.suspendedAt')} value={day(state.suspendedAt)} />
          <Field label={t('sysadmin.retention.retainedUntil')} value={day(state.retainedUntil)} />
        </div>

        {state.purgeEligible && state.deletedAt === null ? (
          <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{t('sysadmin.retention.purgeWarning')}</p>

            <div className="space-y-1.5">
              <Label htmlFor="confirmLegalName">{t('sysadmin.retention.confirmLegalName')}</Label>
              <Input
                id="confirmLegalName"
                value={confirmLegalName}
                onChange={(event) => setConfirmLegalName(event.target.value)}
                placeholder={legalName}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purgeReason">{t('sysadmin.retention.purgeReason')}</Label>
              <Textarea
                id="purgeReason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            {purge.isError ? <ErrorState error={purge.error} /> : null}

            <Button
              variant="destructive"
              disabled={reason.trim().length < 10 || confirmLegalName.trim() === '' || purge.isPending}
              onClick={() =>
                purge.mutate(undefined as never, {
                  onSuccess: () => navigate('/sysadmin/tenants'),
                })
              }
            >
              {t('sysadmin.retention.purge')}
            </Button>
          </div>
        ) : null}

        {state.deletedAt === null ? null : (
          <Badge variant="destructive">{t('sysadmin.retention.purged')}</Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ---- FR-SYS-100, FR-KVK-080 — the audit view ------------------------------------------

function AuditPanel({ tenantId }: { tenantId: string }) {
  const sessions = useImpersonations(tenantId);
  const entries = useTenantAudit(tenantId);

  const end = useResourceMutation(
    (sessionId: string) => api.platform.endImpersonation(sessionId),
    [platformKeys.audit],
  );

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.tenants.impersonate')}</CardTitle>
          <CardDescription>{t('sysadmin.audit.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {(sessions.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sysadmin.audit.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">{t('sysadmin.audit.startedAt')}</th>
                  <th className="p-2">{t('sysadmin.audit.reason')}</th>
                  <th className="p-2">{t('sysadmin.audit.expiresAt')}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(sessions.data ?? []).map((session) => (
                  <tr key={session.id} className="border-b">
                    <td className="p-2">{stamp(session.startedAt)}</td>
                    <td className="p-2">{session.reason}</td>
                    <td className="p-2">{stamp(session.expiresAt)}</td>
                    <td className="p-2 text-right">
                      {session.live ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={end.isPending}
                          onClick={() => end.mutate(session.id)}
                        >
                          {t('sysadmin.audit.endSession')}
                        </Button>
                      ) : (
                        <Badge variant="secondary">{t('sysadmin.audit.ended')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sysadmin.audit.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {(entries.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sysadmin.audit.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">{t('sysadmin.audit.startedAt')}</th>
                  <th className="p-2">{t('sysadmin.audit.action')}</th>
                  <th className="p-2">{t('sysadmin.audit.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {(entries.data ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">{stamp(entry.createdAt)}</td>
                    {/*
                      The raw action key, deliberately. It is an operator's audit trail
                      rather than a customer-facing screen, and inventing a Turkish
                      sentence per action would put the catalogue permanently one action
                      behind whatever the code emits.
                    */}
                    <td className="p-2 font-mono text-xs">{entry.action}</td>
                    <td className="p-2">{entry.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- FR-SYS-100 — starting a session --------------------------------------------------

/**
 * The one control in the console that reaches a tenant's own data.
 *
 * The reason is mandatory at three layers — here, in the Zod schema and in a CHECK
 * constraint — and the tenant's Admins are told it by email (FR-SYS-110). The session is
 * hard-limited to sixty minutes by the token, the row and a constraint; none of that is
 * this component's business, and the copy says so rather than implying the operator can
 * choose.
 */
function ImpersonateButton({ tenantId, legalName }: { tenantId: string; legalName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const start = useResourceMutation(() => api.platform.impersonate(tenantId, { reason }), [
    platformKeys.audit,
  ]);

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <LogIn aria-hidden className="h-4 w-4" />
        {t('sysadmin.tenants.impersonate')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t('common.close')} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('sysadmin.tenants.impersonateTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{legalName}</p>

            <div className="space-y-1.5">
              <Label htmlFor="impersonateReason">{t('sysadmin.tenants.impersonateReason')}</Label>
              <Textarea
                id="impersonateReason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('sysadmin.tenants.impersonateReasonHelp')}
              </p>
            </div>

            {start.isError ? <ErrorState error={start.error} /> : null}
            {start.isSuccess ? (
              <p className="text-sm text-success">{t('sysadmin.tenants.impersonateStarted')}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={reason.trim().length < 10 || start.isPending}
                onClick={() => start.mutate(undefined as never)}
              >
                {t('sysadmin.tenants.impersonate')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function day(value: string | null): string {
  return value === null ? '—' : formatDate(value.slice(0, 10));
}

/** A timestamp an operator reads next to a reason: the date, and the minute. */
function stamp(value: string): string {
  return `${formatDate(value.slice(0, 10))} ${value.slice(11, 16)}`;
}
