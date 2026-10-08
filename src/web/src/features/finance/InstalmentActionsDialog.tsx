import { useState } from 'react';
import {
  refundInstalmentSchema,
  reversePaymentSchema,
  updateInstalmentSchema,
  waiveInstalmentSchema,
  type Instalment,
  type Payment,
  type RefundInstalmentDto,
  type ReversePaymentDto,
  type UpdateInstalmentDto,
  type WaiveInstalmentDto,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { useInstalmentPayments } from '@/api/finance-hooks';
import { FINANCE_KEYS, useResourceMutation } from '@/api/hooks';
import { FieldRow, Form, TextField } from '@/components/FormKit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatMoney, isNegative } from '@/lib/money';
import { t } from '@/i18n';

/**
 * Everything that can be done to one instalment beyond taking money for it —
 * FR-FIN-050, FR-FIN-090, FR-FIN-130, FR-FIN-060, plus the payment history.
 *
 * Gathered into one dialog rather than scattered across row buttons because they are all
 * exceptional actions on the same object, each needs a written reason, and an Admin
 * reaching for one is usually looking at the payment history first.
 */
export function InstalmentActionsDialog({
  instalment,
  onClose,
}: {
  instalment: Instalment;
  onClose: () => void;
}) {
  const payments = useInstalmentPayments(instalment.id);
  const [reversing, setReversing] = useState<Payment | null>(null);

  const adjustable = instalment.paidAmount === '0.00' && !isTerminal(instalment);
  const waivable = !isTerminal(instalment) && instalment.status !== 'PAID';
  const refundable = instalment.paidAmount !== '0.00';

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {instalment.studentName} ·{' '}
            {t('finance.instalment.sequenceOf', { index: instalment.sequence })}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">{t('finance.payment.history')}</TabsTrigger>
            <TabsTrigger value="adjust" disabled={!adjustable}>
              {t('finance.instalment.adjust')}
            </TabsTrigger>
            <TabsTrigger value="waive" disabled={!waivable}>
              {t('finance.instalment.waive')}
            </TabsTrigger>
            <TabsTrigger value="refund" disabled={!refundable}>
              {t('finance.instalment.refund')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <PaymentHistory
              payments={payments.data ?? []}
              loading={payments.isLoading}
              onReverse={setReversing}
            />
          </TabsContent>

          <TabsContent value="adjust">
            <AdjustForm instalment={instalment} onDone={onClose} />
          </TabsContent>

          <TabsContent value="waive">
            <WaiveForm instalment={instalment} onDone={onClose} />
          </TabsContent>

          <TabsContent value="refund">
            <RefundForm instalment={instalment} onDone={onClose} />
          </TabsContent>
        </Tabs>

        {reversing ? (
          <ReverseDialog payment={reversing} onClose={() => setReversing(null)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function isTerminal(instalment: Instalment): boolean {
  return instalment.status === 'WAIVED' || instalment.status === 'CANCELLED';
}

/**
 * The audit view — FR-FIN-090.
 *
 * A reversal appears **alongside** the payment it reverses rather than replacing it, and
 * a reversed payment is shown struck through with its reversal beneath. That is what
 * SDD §11.3 means by *"both entries appear in the student's payment history, which is
 * what an audit requires"*.
 */
function PaymentHistory({
  payments,
  loading,
  onReverse,
}: {
  payments: readonly Payment[];
  loading: boolean;
  onReverse: (payment: Payment) => void;
}) {
  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (payments.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{t('finance.payment.empty')}</p>;
  }

  return (
    <ul className="divide-y">
      {payments.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between gap-4 py-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Badge variant={payment.kind === 'PAYMENT' ? 'default' : 'secondary'}>
                {t(`finance.payment.kinds.${payment.kind}`)}
              </Badge>
              <span
                className={
                  payment.reversedBy
                    ? 'font-medium tabular-nums text-muted-foreground line-through'
                    : 'font-medium tabular-nums'
                }
              >
                {formatMoney(payment.amount, payment.currency)}
              </span>
              {isNegative(payment.amount) ? null : (
                <span className="text-xs text-muted-foreground">
                  {t(`finance.payment.methods.${payment.method}`)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(payment.paidAt)}
              {payment.reference ? ` · ${payment.reference}` : ''}
              {payment.note ? ` · ${payment.note}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {payment.receiptReady ? (
              <Button variant="ghost" size="sm" onClick={() => void openReceipt(payment.id)}>
                {t('finance.payment.receipt')}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('finance.payment.receiptPending')}
              </span>
            )}

            {/* Only an original payment is reversible, and only once. Both rules are the
                server's; the button reflects them so an Admin is not offered an action
                that will be refused. */}
            {payment.kind === 'PAYMENT' && !payment.reversedBy ? (
              <Button variant="ghost" size="sm" onClick={() => onReverse(payment)}>
                {t('finance.payment.reverse')}
              </Button>
            ) : null}

            {payment.reversedBy ? (
              <Badge variant="outline">{t('finance.payment.reversed')}</Badge>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Opens the receipt in a new tab through its signed, expiring URL (NFR-SEC-080). */
async function openReceipt(paymentId: string): Promise<void> {
  const { url } = await api.finance.payments.receipt(paymentId);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** FR-FIN-090 — the reversal, which carries a reason and no amount. */
function ReverseDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const reverse = useResourceMutation(
    (values: ReversePaymentDto) => api.finance.payments.reverse(payment.id, values),
    FINANCE_KEYS,
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('finance.payment.reverseTitle')}</DialogTitle>
        </DialogHeader>

        <p className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
          {t('finance.payment.reverseHelp')}
        </p>

        <p className="mb-4 text-sm">
          <span className="text-muted-foreground">{t('common.amount')}: </span>
          <span className="font-semibold tabular-nums">
            {formatMoney(payment.amount, payment.currency)}
          </span>
        </p>

        <Form
          schema={reversePaymentSchema}
          defaultValues={{ reason: '' } as ReversePaymentDto}
          submitError={reverse.error}
          submitLabel={t('finance.payment.reverse')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await reverse.mutateAsync(values as ReversePaymentDto);
            onClose();
          }}
        >
          <TextField name="reason" label={t('common.reason')} />
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** FR-FIN-050 — amount or due date, before any payment. */
function AdjustForm({ instalment, onDone }: { instalment: Instalment; onDone: () => void }) {
  const adjust = useResourceMutation(
    (values: UpdateInstalmentDto) => api.finance.instalments.adjust(instalment.id, values),
    FINANCE_KEYS,
  );

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">{t('finance.instalment.adjustHelp')}</p>

      <Form
        schema={updateInstalmentSchema}
        defaultValues={
          {
            amount: instalment.amount,
            dueDate: instalment.dueDate,
            reason: '',
          } as UpdateInstalmentDto
        }
        submitError={adjust.error}
        onCancel={onDone}
        onSubmit={async (values) => {
          await adjust.mutateAsync(values as UpdateInstalmentDto);
          onDone();
        }}
      >
        <FieldRow>
          <TextField name="amount" label={t('common.amount')} />
          <TextField name="dueDate" label={t('common.dueDate')} type="date" />
        </FieldRow>
        <TextField name="reason" label={t('common.reason')} />
      </Form>
    </>
  );
}

/** FR-FIN-130 — the amount stays on the record; the status says it will not be collected. */
function WaiveForm({ instalment, onDone }: { instalment: Instalment; onDone: () => void }) {
  const waive = useResourceMutation(
    (values: WaiveInstalmentDto) => api.finance.instalments.waive(instalment.id, values),
    FINANCE_KEYS,
  );

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">{t('finance.instalment.waiveHelp')}</p>

      <Form
        schema={waiveInstalmentSchema}
        defaultValues={{ reason: '' } as WaiveInstalmentDto}
        submitError={waive.error}
        submitLabel={t('finance.instalment.waive')}
        onCancel={onDone}
        onSubmit={async (values) => {
          await waive.mutateAsync(values as WaiveInstalmentDto);
          onDone();
        }}
      >
        <TextField name="reason" label={t('common.reason')} />
      </Form>
    </>
  );
}

/** FR-FIN-060 — money returned. Validated against what was actually paid. */
function RefundForm({ instalment, onDone }: { instalment: Instalment; onDone: () => void }) {
  const refund = useResourceMutation(
    (values: RefundInstalmentDto) => api.finance.instalments.refund(instalment.id, values),
    FINANCE_KEYS,
  );

  return (
    <>
      <p className="mb-4 text-sm">
        <span className="text-muted-foreground">{t('finance.instalment.paidAmount')}: </span>
        <span className="font-semibold tabular-nums">
          {formatMoney(instalment.paidAmount, instalment.currency)}
        </span>
      </p>

      <Form
        schema={refundInstalmentSchema}
        defaultValues={
          {
            amount: instalment.paidAmount,
            paidAt: new Date().toISOString().slice(0, 10),
            reason: '',
          } as RefundInstalmentDto
        }
        submitError={refund.error}
        submitLabel={t('finance.instalment.refund')}
        onCancel={onDone}
        onSubmit={async (values) => {
          await refund.mutateAsync(values as RefundInstalmentDto);
          onDone();
        }}
      >
        <FieldRow>
          <TextField name="amount" label={t('common.amount')} />
          <TextField name="paidAt" label={t('finance.payment.paidAt')} type="date" />
        </FieldRow>
        <TextField name="reason" label={t('common.reason')} />
      </Form>
    </>
  );
}
