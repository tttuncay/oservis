import { createStudentSchema, type CreateStudentDto, type Student } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useSchools } from '@/api/hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldRow, Form, SelectField, TextAreaField, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

/**
 * Create or edit a student — FR-CMP-050.
 *
 * `medicalNote` is editable here because an Admin may always read and write it
 * (FR-KVK-100); it is the *reading* by a driver or host that the server's policy narrows,
 * and the detail screen puts it behind an explicit reveal so it is not shown to whoever
 * is standing behind the Admin's chair.
 */
export function StudentDialog({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
  const editing = student !== null;
  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc' });

  const save = useResourceMutation(
    (values: CreateStudentDto) =>
      editing ? api.students.update(student.id, values) : api.students.create(values),
    [keys.students],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('student.edit') : t('student.create')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={createStudentSchema}
          defaultValues={
            {
              fullName: student?.fullName ?? '',
              schoolId: student?.schoolId ?? '',
              dateOfBirth: student?.dateOfBirth ?? undefined,
              className: student?.className ?? undefined,
              externalRef: student?.externalRef ?? undefined,
              medicalNote: student?.medicalNote ?? undefined,
            } as CreateStudentDto
          }
          submitError={save.error}
          onCancel={onClose}
          onSubmit={async (values) => {
            await save.mutateAsync(values as CreateStudentDto);
            onClose();
          }}
        >
          <TextField<CreateStudentDto> name="fullName" label={t('student.fullName')} />

          <FieldRow>
            <SelectField<CreateStudentDto>
              name="schoolId"
              label={t('student.school')}
              options={(schools.data?.data ?? []).map((school) => ({
                value: school.id,
                label: school.name,
              }))}
            />
            <TextField<CreateStudentDto>
              name="dateOfBirth"
              label={t('student.dateOfBirth')}
              type="date"
              optional
            />
          </FieldRow>

          <FieldRow>
            <TextField<CreateStudentDto> name="className" label={t('student.className')} optional />
            <TextField<CreateStudentDto>
              name="externalRef"
              label={t('student.externalRef')}
              optional
            />
          </FieldRow>

          <TextAreaField<CreateStudentDto>
            name="medicalNote"
            label={t('student.medicalNote')}
            hint={t('student.medicalNoteWarning')}
            optional
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}
