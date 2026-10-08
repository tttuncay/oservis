import { useRef, useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  createExpenseSchema,
  type CreateExpenseDto,
  type Expense,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useVehicles } from '@/api/hooks';
import { FieldRow, Form, SelectField, TextField } from '@/components/FormKit';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n';

/** FR-FIN-180 to FR-FIN-200 — an expense, with its scanned document. */
export function ExpenseDialog({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  const editing = expense !== null;
  const vehicles = useVehicles({ limit: 100, sort: 'plate', dir: 'asc' });
  const fileInput = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false);

  const save = useResourceMutation(
    (values: CreateExpenseDto) =>
      editing
        ? api.finance.expenses.update(expense.id, values)
        : api.finance.expenses.create(values),
    [keys.expenses, keys.financeReports],
  );

  const attach = useResourceMutation(
    ({ id, file }: { id: string; file: File }) => api.finance.expenses.attach(id, file),
    [keys.expenses],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('finance.expense.edit') : t('finance.expense.create')}
          </DialogTitle>
        </DialogHeader>

        <Form
          schema={createExpenseSchema}
          defaultValues={
            {
              category: expense?.category ?? 'FUEL',
              vehicleId: expense?.vehicleId ?? undefined,
              amount: expense?.amount ?? '',
              currency: expense?.currency ?? 'TRY',
              incurredOn: expense?.incurredOn ?? new Date().toISOString().slice(0, 10),
              description: expense?.description ?? undefined,
            } as CreateExpenseDto
          }
          submitError={save.error}
          onCancel={onClose}
          onSubmit={async (values) => {
            await save.mutateAsync(values as CreateExpenseDto);
            onClose();
          }}
        >
          <FieldRow>
            <SelectField
              name="category"
              label={t('finance.expense.category')}
              options={EXPENSE_CATEGORIES.map((category) => ({
                value: category,
                label: t(`finance.expense.categories.${category}`),
              }))}
            />
            {/* Optional by requirement: an unattributed expense is company overhead,
                which SDD §11.5 shares across active vehicles rather than dropping. */}
            <SelectField
              name="vehicleId"
              label={t('finance.expense.vehicleOptional')}
              optional
              options={(vehicles.data?.data ?? []).map((vehicle) => ({
                value: vehicle.id,
                label: vehicle.plate,
              }))}
            />
          </FieldRow>

          <FieldRow>
            <TextField name="amount" label={t('common.amount')} placeholder="2500.00" />
            <TextField name="incurredOn" label={t('finance.expense.incurredOn')} type="date" />
          </FieldRow>

          <TextField name="description" label={t('finance.expense.description')} optional />
        </Form>

        {/*
          The attachment is uploaded separately, after the expense exists: it is
          multipart rather than JSON, and a row must exist for the file to belong to.
          Offered only when editing, for the same reason.
        */}
        {editing ? (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm text-muted-foreground">
              {t('finance.expense.attachmentHelp')}
            </p>

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                setAttaching(true);
                try {
                  await attach.mutateAsync({ id: expense.id, file });
                } finally {
                  setAttaching(false);
                  event.target.value = '';
                }
              }}
            />

            <Button
              type="button"
              variant="outline"
              disabled={attaching}
              onClick={() => fileInput.current?.click()}
            >
              {attaching ? t('common.saving') : t('finance.expense.attachmentAdd')}
            </Button>

            {attach.error ? (
              <p className="mt-2 text-sm text-destructive">{String(attach.error)}</p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
