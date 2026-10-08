import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PlanTier, SubscriptionPlanSummary } from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation } from '@/api/hooks';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/money';
import { t } from '@/i18n';
import { PLATFORM_TENANT_KEYS, usePlans } from './use-platform';

/**
 * FR-SYS-020 — *"Subscription Plans priced per active vehicle per month, with volume
 * tiers (e.g. 1–10, 11–30, 31+ vehicles)."*
 *
 * ## The tier editor refuses nothing, and that is deliberate
 *
 * `createSubscriptionPlanSchema` is where a gap or an overlap is rejected, in
 * `packages/shared`, and the server applies the same schema. A second set of rules here
 * would be a second thing to keep in step with the first — so the form submits, and a
 * malformed tier list comes back as a validation error against the field. What the editor
 * does do is *shape* the input so the common case is right without thinking: a new tier
 * starts where the previous one ended, and the last row is open-ended.
 *
 * ## Prices are typed and sent as strings
 *
 * Never parsed to a number on the way through. A JSON number is an IEEE double
 * (FR-FIN-290, SDD §11.1), and the one place a price could quietly acquire a rounding
 * error is a client that thought it was being helpful.
 */
export function PlansPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlanSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<SubscriptionPlanSummary | null>(null);

  const plans = usePlans(showArchived);

  const archive = useResourceMutation(
    (id: string) => api.platform.archivePlan(id),
    PLATFORM_TENANT_KEYS,
  );
  const restore = useResourceMutation(
    (id: string) => api.platform.restorePlan(id),
    PLATFORM_TENANT_KEYS,
  );

  return (
    <>
      <PageHeader
        title={t('sysadmin.plans.title')}
        description={t('sysadmin.plans.subtitle')}
        actions={
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            {t('sysadmin.plans.create')}
          </Button>
        }
      />

      <label className="mb-4 flex items-center gap-2 text-sm">
        <Checkbox
          checked={showArchived}
          onCheckedChange={(checked) => setShowArchived(checked === true)}
        />
        {t('sysadmin.plans.showArchived')}
      </label>

      {plans.isError ? <ErrorState error={plans.error} onRetry={() => void plans.refetch()} /> : null}
      {archive.isError ? <ErrorState error={archive.error} /> : null}

      {plans.data && plans.data.length === 0 ? (
        <EmptyState title={t('sysadmin.plans.empty')} body={t('sysadmin.plans.subtitle')} />
      ) : null}

      <div className="grid gap-3">
        {(plans.data ?? []).map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  {plan.name}
                  {plan.archivedAt ? (
                    <Badge variant="secondary">{t('sysadmin.plans.archived')}</Badge>
                  ) : null}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('sysadmin.plans.tenantCount')}: {plan.tenantCount}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(plan)}>
                  {t('common.edit')}
                </Button>
                {plan.archivedAt ? (
                  <Button variant="outline" size="sm" onClick={() => restore.mutate(plan.id)}>
                    {t('sysadmin.plans.restore')}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setArchiving(plan)}>
                    {t('sysadmin.plans.archive')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {plan.tiers.map((tier) => (
                  <li key={tier.minVehicles} className="flex gap-2">
                    <span className="w-32 text-muted-foreground">{tierRange(tier)}</span>
                    <span className="tabular-nums">
                      {formatMoney(tier.pricePerVehicle, plan.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {creating ? <PlanDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <PlanDialog plan={editing} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={archiving !== null}
        title={t('sysadmin.plans.archive')}
        body={t('sysadmin.plans.subtitle')}
        confirmLabel={t('sysadmin.plans.archive')}
        pending={archive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) });
        }}
      />
    </>
  );
}

/** `1–10`, or `31 üzeri` for the open-ended top tier. */
function tierRange(tier: PlanTier): string {
  return tier.maxVehicles === null
    ? `${tier.minVehicles} ${t('sysadmin.plans.tierOpenEnded')}`
    : `${tier.minVehicles}–${tier.maxVehicles}`;
}

/** A tier as the form holds it: everything a string, because everything is an input. */
interface TierDraft {
  minVehicles: string;
  maxVehicles: string;
  pricePerVehicle: string;
}

function PlanDialog({
  plan,
  onClose,
}: {
  plan?: SubscriptionPlanSummary;
  onClose: () => void;
}) {
  const [name, setName] = useState(plan?.name ?? '');
  const [tiers, setTiers] = useState<TierDraft[]>(
    plan
      ? plan.tiers.map((tier) => ({
          minVehicles: String(tier.minVehicles),
          maxVehicles: tier.maxVehicles === null ? '' : String(tier.maxVehicles),
          pricePerVehicle: tier.pricePerVehicle,
        }))
      : [{ minVehicles: '1', maxVehicles: '', pricePerVehicle: '' }],
  );

  const save = useResourceMutation(() => {
    const payload = {
      name,
      // The schema defaults this, but the *parsed* type has it required — so the form
      // carries the plan's own currency rather than the client re-deciding a default.
      currency: plan?.currency ?? 'TRY',
      tiers: tiers.map((tier) => ({
        minVehicles: Number(tier.minVehicles),
        // An empty upper bound is the open-ended tier, not a zero.
        maxVehicles: tier.maxVehicles.trim() === '' ? null : Number(tier.maxVehicles),
        pricePerVehicle: tier.pricePerVehicle.trim(),
      })),
    };

    return plan ? api.platform.updatePlan(plan.id, payload) : api.platform.createPlan(payload);
  }, PLATFORM_TENANT_KEYS);

  function addTier() {
    const last = tiers[tiers.length - 1];
    // The next tier starts where the previous one ended, which is the only arrangement
    // the schema accepts. Leaving it blank would make a contiguous list the hard case.
    const nextMin = last && last.maxVehicles.trim() !== '' ? Number(last.maxVehicles) + 1 : '';

    setTiers([
      ...tiers,
      { minVehicles: String(nextMin), maxVehicles: '', pricePerVehicle: '' },
    ]);
  }

  function update(index: number, patch: Partial<TierDraft>) {
    setTiers(tiers.map((tier, at) => (at === index ? { ...tier, ...patch } : tier)));
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {plan ? t('sysadmin.plans.editTitle') : t('sysadmin.plans.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="planName">{t('sysadmin.plans.name')}</Label>
            <Input id="planName" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('sysadmin.plans.tiers')}</Label>
            <p className="text-xs text-muted-foreground">{t('sysadmin.plans.tiersHelp')}</p>

            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
              <span>{t('sysadmin.plans.tierFrom')}</span>
              <span>{t('sysadmin.plans.tierTo')}</span>
              <span>{t('sysadmin.plans.tierPrice')}</span>
              <span />
            </div>

            {tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={tier.minVehicles}
                  onChange={(event) => update(index, { minVehicles: event.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  value={tier.maxVehicles}
                  placeholder={t('sysadmin.plans.tierOpenEnded')}
                  onChange={(event) => update(index, { maxVehicles: event.target.value })}
                />
                <Input
                  inputMode="decimal"
                  value={tier.pricePerVehicle}
                  placeholder="0.00"
                  onChange={(event) => update(index, { pricePerVehicle: event.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('sysadmin.plans.removeTier')}
                  disabled={tiers.length === 1}
                  onClick={() => setTiers(tiers.filter((_, at) => at !== index))}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" className="gap-2" onClick={addTier}>
              <Plus aria-hidden className="h-4 w-4" />
              {t('sysadmin.plans.addTier')}
            </Button>
          </div>

          {save.isError ? <ErrorState error={save.error} /> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={name.trim().length < 2 || save.isPending}
              onClick={() => save.mutate(undefined as never, { onSuccess: onClose })}
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
