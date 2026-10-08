import {
  PAYMENT_METHODS,
  createPaymentSchema,
  type CreatePaymentDto,
  type Instalment,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { FINANCE_KEYS, useResourceMutation } from '@/api/hooks';
import { FieldRow, Form, SelectField, TextField } from '@/components/FormKit';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate, formatMoney } from '@/lib/money';
import { t } from '@/i18n';

/**
 * FR-FIN-070 — recording a payment against one instalment.
 *
 * ## The balance is shown, never recalculated
 *
 * The dialog displays `instalment.balance` as the server sent it and does not subtract
 * the amount being entered to preview a remainder. That would be the client computing
 * money (SDD §1.2 P2), and it would be wrong the moment another Admin recorded a payment
 * against the same instalment in the meantime — which is exactly the race the server's
 * row lock exists to handle.
 *
 * Overpayment is refused by the server (`PAYMENT_EXCEEDS_BALANCE`), and the error surfaces
 * under the form with the real balance in it. The client does not pre-empt that check:
 * duplicating it here would mean two rules that can disagree, and the server's is the
 * one that decides.
 */
export function PaymentDialog({
  instalment,
  onClose,
}: {
  instalment: Instalment;
  onClose: () => void;
}) {
  const record = useResourceMutation(
    (values: CreatePaymentDto) => api.finance.payments.record(values),
    FINANCE_KEYS,
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('finance.payment.recordTitle')}</DialogTitle>
        </DialogHeader>

        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('finance.student')}</dt>
            <dd className="font-medium">{instalment.studentName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('common.dueDate')}</dt>
            <dd className="font-medium">{formatDate(instalment.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('common.amount')}</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(instalment.amount, instalment.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('common.balance')}</dt>
            <dd className="font-semibold tabular-nums">
              {formatMoney(instalment.balance, instalment.currency)}
            </dd>
          </div>
        </dl>

        <Form
          schema={createPaymentSchema}
          defaultValues={
            {
              instalmentId: instalment.id,
              // Pre-filled with the outstanding balance, which is what is collected in
              // the overwhelming majority of cases. It remains editable for the partial
              // payment FR-FIN-080 requires.
              amount: instalment.balance,
              paidAt: today(),
              method: 'CASH',
            } as CreatePaymentDto
          }
          submitError={record.error}
          submitLabel={t('finance.payment.record')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await record.mutateAsync(values as CreatePaymentDto);
            onClose();
          }}
        >
          <FieldRow>
            <TextField name="amount" label={t('common.amount')} />
            <TextField name="paidAt" label={t('finance.payment.paidAt')} type="date" />
          </FieldRow>

          <SelectField
            name="method"
            label={t('finance.payment.method')}
            options={PAYMENT_METHODS.map((method) => ({
              value: method,
              label: t(`finance.payment.methods.${method}`),
            }))}
          />

          <TextField name="reference" label={t('finance.payment.reference')} optional />
          <TextField name="note" label={t('finance.payment.note')} optional />
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Today as a civil date, for the date input's default. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
