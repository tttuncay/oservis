import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  createCalendarExceptionSchema,
  type CreateCalendarExceptionDto,
  type SchoolCalendarException,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useCalendarExceptions, useResourceMutation } from '@/api/hooks';
import { CheckboxField, FieldRow, Form, TextField } from '@/components/FormKit';
import { MutatingButton } from '@/components/MutatingButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ConfirmDialog';
import { t } from '@/i18n';

/**
 * FR-CMP-130 and FR-CMP-140 — non-service days and dismissal-time exceptions.
 *
 * One row expresses both, which is how the schema models it: `isServiceDay: false` is a
 * holiday and no trips are generated (SDD §8.1 step 1); `isServiceDay: true` with a time
 * is a half day. A non-service day carrying bell times is rejected, because it says two
 * contradictory things.
 */
export function SchoolCalendarPanel({ schoolId }: { schoolId: string }) {
  const [adding, setAdding] = useState(false);
  const query = useCalendarExceptions(schoolId, {});

  const remove = useResourceMutation(
    (exceptionId: string) => api.schools.removeCalendarException(schoolId, exceptionId),
    [keys.schools],
  );

  const confirm = useConfirm<SchoolCalendarException>({
    title: (exception) => t('confirm.deleteTitle', { name: exception.date }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (exception) => remove.mutateAsync(exception.id),
    pending: remove.isPending,
  });

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('calendar.description')}</p>

      {rows.length === 0 && !adding ? (
        <EmptyState
          title={t('calendar.emptyTitle')}
          body={t('calendar.emptyBody')}
          action={
            <MutatingButton size="sm" onClick={() => setAdding(true)}>
              {t('calendar.add')}
            </MutatingButton>
          }
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((exception) => (
            <li key={exception.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="w-28 font-medium tabular-nums">{exception.date}</span>
              <Badge variant={exception.isServiceDay ? 'secondary' : 'destructive'}>
                {exception.isServiceDay ? t('calendar.changedTimes') : t('calendar.noService')}
              </Badge>
              {exception.isServiceDay ? (
                <span className="text-muted-foreground">
                  {exception.morningBell ?? '—'} · {exception.afternoonDismissal ?? '—'}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {exception.reason ?? ''}
              </span>
              <MutatingButton
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => confirm.ask(exception)}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                <span className="sr-only">{t('common.delete')}</span>
              </MutatingButton>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <CalendarExceptionForm schoolId={schoolId} onDone={() => setAdding(false)} />
      ) : rows.length > 0 ? (
        <MutatingButton size="sm" variant="outline" onClick={() => setAdding(true)}>
          {t('calendar.add')}
        </MutatingButton>
      ) : null}

      {confirm.dialog}
    </div>
  );
}

function CalendarExceptionForm({ schoolId, onDone }: { schoolId: string; onDone: () => void }) {
  const create = useResourceMutation(
    (values: CreateCalendarExceptionDto) => api.schools.addCalendarException(schoolId, values),
    [keys.schools],
  );

  return (
    <div className="rounded-md border p-4">
      <Form
        schema={createCalendarExceptionSchema}
        defaultValues={
          {
            date: '',
            isServiceDay: false,
            reason: undefined,
          } as CreateCalendarExceptionDto
        }
        submitError={create.error}
        onCancel={onDone}
        onSubmit={async (values) => {
          await create.mutateAsync(values as CreateCalendarExceptionDto);
          onDone();
        }}
      >
        <FieldRow>
          <TextField<CreateCalendarExceptionDto>
            name="date"
            label={t('calendar.date')}
            type="date"
          />
          <TextField<CreateCalendarExceptionDto>
            name="reason"
            label={t('calendar.reason')}
            optional
          />
        </FieldRow>

        <CheckboxField<CreateCalendarExceptionDto>
          name="isServiceDay"
          label={t('calendar.isServiceDay')}
          hint={t('calendar.changedTimes')}
        />

        {/* Only meaningful on a service day; the schema rejects them otherwise, and the
            error names the field rather than the row. */}
        <FieldRow>
          <TextField<CreateCalendarExceptionDto>
            name="morningBell"
            label={t('school.morningBell')}
            type="time"
            optional
          />
          <TextField<CreateCalendarExceptionDto>
            name="afternoonDismissal"
            label={t('school.afternoonDismissal')}
            type="time"
            optional
          />
        </FieldRow>
      </Form>
    </div>
  );
}
