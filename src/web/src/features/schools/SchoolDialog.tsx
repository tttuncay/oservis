import { useState } from 'react';
import {
  createSchoolSchema,
  type Coordinates,
  type CreateSchoolDto,
  type School,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation } from '@/api/hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldRow, Form, TextAreaField, TextField } from '@/components/FormKit';
import { MapPicker } from '@/components/MapPicker';
import { SchoolCalendarPanel } from './SchoolCalendarPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { t } from '@/i18n';

/** The form's fields. The coordinates are held outside it — see the note below. */
type SchoolFormValues = Omit<CreateSchoolDto, 'lat' | 'lng'>;

/**
 * Create and edit a school — FR-CMP-010, with FR-CMP-130/140's calendar beside it.
 *
 * The map is mounted here and nowhere in the list: Google bills map loads per session
 * (SDD §1.2 P7), so one map on an open dialog is the whole cost rather than one per row.
 *
 * The coordinates are held outside the form because they come from a click on a map
 * rather than from a text input. They are validated on submit — `createSchoolSchema`
 * requires both — and the dialog refuses to submit without a point rather than sending
 * a school with no location, which the NOT NULL column would reject anyway with a much
 * worse message.
 */
export function SchoolDialog({ school, onClose }: { school: School | null; onClose: () => void }) {
  const editing = school !== null;

  const [point, setPoint] = useState<Coordinates | null>(
    school ? { lat: school.lat, lng: school.lng } : null,
  );
  const [pointMissing, setPointMissing] = useState(false);

  const save = useResourceMutation(
    (values: SchoolFormValues & Coordinates) =>
      editing
        ? api.schools.update(school.id, values)
        : api.schools.create({ ...values, lat: values.lat, lng: values.lng }),
    [keys.schools],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('school.edit') : t('school.create')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">{t('student.tabDetails')}</TabsTrigger>
            {/* A calendar belongs to a school that exists; there is nothing to hang an
                exception off before the first save. */}
            <TabsTrigger value="calendar" disabled={!editing}>
              {t('calendar.title')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Form
              schema={createSchoolSchema.innerType().omit({ lat: true, lng: true })}
              defaultValues={
                {
                  name: school?.name ?? '',
                  textAddress: school?.textAddress ?? '',
                  morningBell: school?.morningBell ?? '08:30',
                  afternoonDismissal: school?.afternoonDismissal ?? '15:30',
                  phone: school?.phone ?? undefined,
                  note: school?.note ?? undefined,
                } as SchoolFormValues
              }
              submitError={save.error}
              onCancel={onClose}
              onSubmit={async (values) => {
                if (!point) {
                  setPointMissing(true);
                  return;
                }
                setPointMissing(false);
                await save.mutateAsync({ ...(values as SchoolFormValues), ...point });
                onClose();
              }}
            >
              <TextField<SchoolFormValues> name="name" label={t('school.name')} />
              <TextField<SchoolFormValues> name="textAddress" label={t('school.textAddress')} />

              <FieldRow>
                <TextField<SchoolFormValues>
                  name="morningBell"
                  label={t('school.morningBell')}
                  type="time"
                />
                <TextField<SchoolFormValues>
                  name="afternoonDismissal"
                  label={t('school.afternoonDismissal')}
                  type="time"
                />
              </FieldRow>

              <FieldRow>
                <TextField<SchoolFormValues> name="phone" label={t('school.phone')} optional />
                <div />
              </FieldRow>

              <TextAreaField<SchoolFormValues> name="note" label={t('school.note')} optional />

              <MapPicker
                value={point}
                onChange={(next) => {
                  setPoint(next);
                  setPointMissing(false);
                }}
                label={t('school.location')}
                hint={t('school.locationHint')}
              />
              {pointMissing ? (
                <p role="alert" className="text-xs text-destructive">
                  {t('validation.required')}
                </p>
              ) : null}
            </Form>
          </TabsContent>

          <TabsContent value="calendar">
            {editing ? <SchoolCalendarPanel schoolId={school.id} /> : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
