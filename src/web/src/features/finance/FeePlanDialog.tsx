import { createFeePlanSchema, type CreateFeePlanDto, type FeePlan } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation } from '@/api/hooks';
import { FieldRow, Form, TextField } from '@/components/FormKit';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n';

/**
 * FR-FIN-010 — the terms a schedule is generated from.
 *
 * ## No instalment preview is computed here
 *
 * It would be one division, and it would be the client computing money (SDD §1.2 P2).
 * The Admin sees the real schedule the moment the plan is assigned to a student, where
 * the figures come from the server that will actually charge them — including the
 * residual on the final instalment, which a naive division in the browser would get
 * wrong anyway.
 */
export function FeePlanDialog({ plan, onClose }: { plan: FeePlan | null; onClose: () => void }) {
  const editing = plan !== null;

  const save = useResourceMutation(
    (values: CreateFeePlanDto) =>
      editing ? api.finance.feePlans.update(plan.id, values) : api.finance.feePlans.create(values),
    [keys.feePlans],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('finance.plan.edit') : t('finance.plan.create')}</DialogTitle>
        </DialogHeader>

        {editing && plan.assignedStudents > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {t('finance.plan.inUseNotice', { count: plan.assignedStudents })}
          </p>
        ) : null}

        <Form
          schema={createFeePlanSchema}
          defaultValues={
            {
              name: plan?.name ?? '',
              academicYear: plan?.academicYear ?? defaultAcademicYear(),
              totalAmount: plan?.totalAmount ?? '',
              currency: plan?.currency ?? 'TRY',
              instalmentCount: plan?.instalmentCount ?? 10,
              dueDay: plan?.dueDay ?? 10,
              firstDueMonth: plan?.firstDueMonth ?? defaultFirstDueMonth(),
            } as CreateFeePlanDto
          }
          submitError={save.error}
          onCancel={onClose}
          onSubmit={async (values) => {
            await save.mutateAsync(values as CreateFeePlanDto);
            onClose();
          }}
        >
          <TextField name="name" label={t('finance.plan.name')} />

          <FieldRow>
            <TextField
              name="academicYear"
              label={t('finance.academicYear')}
              placeholder="2026-2027"
            />
            <TextField name="currency" label={t('finance.currency')} />
          </FieldRow>

          <FieldRow>
            {/* A text field, not a number one: money crosses the wire as a decimal
                string (FR-FIN-290), and `valueAsNumber` would put it through a double
                on the way to the schema. */}
            <TextField
              name="totalAmount"
              label={t('finance.plan.totalAmount')}
              placeholder="12000.00"
            />
            <TextField
              name="instalmentCount"
              label={t('finance.plan.instalmentCount')}
              type="number"
            />
          </FieldRow>

          <FieldRow>
            <TextField
              name="dueDay"
              label={t('finance.plan.dueDay')}
              type="number"
              hint={t('finance.plan.dueDayHelp')}
            />
            <TextField name="firstDueMonth" label={t('finance.plan.firstDueMonth')} type="date" />
          </FieldRow>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** The academic year the current month most likely belongs to. Turkish years run Sep–Jun. */
function defaultAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  return `${start}-${start + 1}`;
}

/** September of that academic year, as a first-of-month date. */
function defaultFirstDueMonth(): string {
  return `${defaultAcademicYear().split('-')[0]}-09-01`;
}
