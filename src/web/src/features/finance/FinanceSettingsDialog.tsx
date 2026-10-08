import { updateFinanceSettingsSchema, type UpdateFinanceSettingsDto } from '@servisapp/shared';
import { api } from '@/api/client';
import { useFinanceSettings } from '@/api/finance-hooks';
import { keys, useResourceMutation } from '@/api/hooks';
import { Form, TextField } from '@/components/FormKit';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n';

/**
 * FR-FIN-030's configurable percentage and FR-FIN-110's reminder intervals.
 *
 * The note under the discount field is load-bearing, not decoration: SDD §11.2 persists
 * the applied percentage and never recomputes it, so changing this value does **not**
 * alter a fee already issued. An Admin who expected it to would otherwise reduce the
 * percentage, see no change on last term's bills, and conclude the field is broken.
 */
export function FinanceSettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useFinanceSettings();

  const save = useResourceMutation(
    (values: UpdateFinanceSettingsDto) => api.finance.settings.update(values),
    [keys.financeSettings],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('finance.settings.title')}</DialogTitle>
        </DialogHeader>

        {settings.data ? (
          <Form
            schema={updateFinanceSettingsSchema}
            defaultValues={
              {
                siblingDiscountPercent: settings.data.siblingDiscountPercent,
                currency: settings.data.currency,
              } as UpdateFinanceSettingsDto
            }
            submitError={save.error}
            onCancel={onClose}
            onSubmit={async (values) => {
              await save.mutateAsync(values as UpdateFinanceSettingsDto);
              onClose();
            }}
          >
            <TextField
              name="siblingDiscountPercent"
              label={t('finance.settings.siblingDiscount')}
              hint={t('finance.settings.siblingDiscountHelp')}
              placeholder="20.00"
            />

            <TextField name="currency" label={t('finance.currency')} />

            {/*
              The reminder offsets are a signed list and are left to configuration rather
              than given a bespoke editor: FR-FIN-110's defaults (−3, 1, 7, 14) suit every
              tenant in V1, and a five-field array editor would be the most complicated
              control in the console for a value nobody has yet asked to change.
            */}
            <p className="text-sm text-muted-foreground">
              {t('finance.settings.reminderOffsets')}:{' '}
              <span className="tabular-nums">{settings.data.reminderOffsetDays.join(', ')}</span>
              <br />
              {t('finance.settings.reminderOffsetsHelp')}
            </p>
          </Form>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
