import { useMemo, useState } from 'react';
import {
  createAssignmentSchema,
  substituteAssignmentSchema,
  type CreateAssignmentDto,
  type SubstituteAssignmentDto,
  type VehicleAssignment,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useAssignments, useResourceMutation, useStaff } from '@/api/hooks';
import { FieldRow, Form, SelectField, type SelectOption } from '@/components/FormKit';
import { MutatingButton } from '@/components/MutatingButton';
import { TextField } from '@/components/FormKit';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';

/**
 * FR-CMP-060, FR-CMP-070 — the driver and host on a vehicle, over time.
 *
 * ## Nothing here edits an existing assignment
 *
 * FR-CMP-060 permits *"substitution without altering historical records"*, and the API
 * offers no route that could rewrite one: a substitution bounds the outgoing row and
 * creates a new one, and ending closes a row without a replacement. So this panel has an
 * "add", a "substitute" and an "end", and no "edit" — the missing button is the
 * requirement, not an omission.
 */
export function AssignmentsPanel({ vehicleId }: { vehicleId: string }) {
  const query = useAssignments(vehicleId);
  const [mode, setMode] = useState<'none' | 'create' | 'substitute'>('none');

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const rows = query.data ?? [];
  const open = rows.filter((row) => row.validTo === null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('assignment.description')}</p>

      {rows.length === 0 ? (
        <EmptyState
          title={t('assignment.emptyTitle')}
          body={t('assignment.emptyBody')}
          action={
            <MutatingButton size="sm" onClick={() => setMode('create')}>
              {t('assignment.create')}
            </MutatingButton>
          }
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((assignment) => (
            <AssignmentRow key={assignment.id} assignment={assignment} vehicleId={vehicleId} />
          ))}
        </ul>
      )}

      {mode === 'none' && rows.length > 0 ? (
        <div className="flex gap-2">
          <MutatingButton size="sm" variant="outline" onClick={() => setMode('create')}>
            {t('assignment.create')}
          </MutatingButton>
          {open.length > 0 ? (
            <MutatingButton size="sm" variant="outline" onClick={() => setMode('substitute')}>
              {t('assignment.substitute')}
            </MutatingButton>
          ) : null}
        </div>
      ) : null}

      {mode === 'create' ? (
        <AssignmentForm vehicleId={vehicleId} onDone={() => setMode('none')} />
      ) : null}
      {mode === 'substitute' ? (
        <SubstituteForm vehicleId={vehicleId} onDone={() => setMode('none')} />
      ) : null}
    </div>
  );
}

function AssignmentRow({
  assignment,
  vehicleId,
}: {
  assignment: VehicleAssignment;
  vehicleId: string;
}) {
  const [ending, setEnding] = useState(false);

  const end = useResourceMutation(
    (validTo: string) => api.vehicles.endAssignment(vehicleId, assignment.id, { validTo }),
    [keys.vehicles],
  );

  const current = assignment.validTo === null;

  return (
    <li className="space-y-2 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{assignment.driverName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {assignment.hostName ?? t('assignment.noHost')}
          </p>
        </div>

        <span className="tabular-nums text-muted-foreground">
          {assignment.validFrom} — {assignment.validTo ?? t('assignment.openEnded')}
        </span>

        {current ? (
          <>
            <Badge>{t('status.ACTIVE')}</Badge>
            <MutatingButton size="sm" variant="ghost" onClick={() => setEnding((open) => !open)}>
              {t('assignment.end')}
            </MutatingButton>
          </>
        ) : (
          <Badge variant="secondary">{t('status.INACTIVE')}</Badge>
        )}
      </div>

      {ending ? (
        <div className="rounded-md border p-3">
          <Form
            schema={substituteAssignmentSchema.innerType().innerType().pick({ validTo: true })}
            defaultValues={{ validTo: '' } as { validTo: string }}
            submitError={end.error}
            submitLabel={t('assignment.end')}
            onCancel={() => setEnding(false)}
            onSubmit={async (values) => {
              await end.mutateAsync((values as { validTo: string }).validTo);
              setEnding(false);
            }}
          >
            <TextField<{ validTo: string }>
              name="validTo"
              label={t('assignment.validTo')}
              type="date"
            />
          </Form>
        </div>
      ) : null}
    </li>
  );
}

/** Staff of one kind, as select options. Soft-deleted people are already excluded. */
function useStaffOptions(kind: 'DRIVER' | 'HOST'): SelectOption[] {
  const query = useStaff({ kind, status: 'ACTIVE', limit: 100, sort: 'fullName', dir: 'asc' });

  return useMemo(
    () => (query.data?.data ?? []).map((member) => ({ value: member.id, label: member.fullName })),
    [query.data],
  );
}

function AssignmentForm({ vehicleId, onDone }: { vehicleId: string; onDone: () => void }) {
  const drivers = useStaffOptions('DRIVER');
  const hosts = useStaffOptions('HOST');

  const create = useResourceMutation(
    (values: CreateAssignmentDto) => api.vehicles.assign(vehicleId, values),
    [keys.vehicles],
  );

  return (
    <div className="rounded-md border p-4">
      <Form
        schema={createAssignmentSchema}
        defaultValues={
          { driverId: '', hostId: undefined, validFrom: '', validTo: undefined } as
            CreateAssignmentDto
        }
        submitError={create.error}
        onCancel={onDone}
        onSubmit={async (values) => {
          await create.mutateAsync(values as CreateAssignmentDto);
          onDone();
        }}
      >
        <FieldRow>
          <SelectField<CreateAssignmentDto>
            name="driverId"
            label={t('assignment.driver')}
            options={drivers}
          />
          {/* FR-CMP-070 — optional. Without a host the driver performs attendance. */}
          <SelectField<CreateAssignmentDto>
            name="hostId"
            label={t('assignment.host')}
            options={hosts}
            optional
          />
        </FieldRow>
        <FieldRow>
          <TextField<CreateAssignmentDto>
            name="validFrom"
            label={t('assignment.validFrom')}
            type="date"
          />
          <TextField<CreateAssignmentDto>
            name="validTo"
            label={t('assignment.validTo')}
            type="date"
            optional
            hint={t('assignment.openEnded')}
          />
        </FieldRow>
      </Form>
    </div>
  );
}

function SubstituteForm({ vehicleId, onDone }: { vehicleId: string; onDone: () => void }) {
  const drivers = useStaffOptions('DRIVER');
  const hosts = useStaffOptions('HOST');

  const substitute = useResourceMutation(
    (values: SubstituteAssignmentDto) => api.vehicles.substitute(vehicleId, values),
    [keys.vehicles],
  );

  return (
    <div className="rounded-md border p-4">
      <p className="pb-3 text-sm font-medium">{t('assignment.substituteTitle')}</p>
      <Form
        schema={substituteAssignmentSchema}
        defaultValues={
          { driverId: '', hostId: undefined, effectiveFrom: '', validTo: undefined } as
            SubstituteAssignmentDto
        }
        submitError={substitute.error}
        onCancel={onDone}
        onSubmit={async (values) => {
          await substitute.mutateAsync(values as SubstituteAssignmentDto);
          onDone();
        }}
      >
        <FieldRow>
          <SelectField<SubstituteAssignmentDto>
            name="driverId"
            label={t('assignment.driver')}
            options={drivers}
          />
          <SelectField<SubstituteAssignmentDto>
            name="hostId"
            label={t('assignment.host')}
            options={hosts}
            optional
          />
        </FieldRow>
        <TextField<SubstituteAssignmentDto>
          name="effectiveFrom"
          label={t('assignment.validFrom')}
          type="date"
          hint={t('assignment.substituteHint')}
        />
      </Form>
    </div>
  );
}
