import {
  createStaffSchema,
  type CreateStaffDto,
  type Staff,
  type UpdateStaffDto,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation } from '@/api/hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldRow, Form, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

export function StaffEditDialog({
  member,
  onClose,
}: {
  member: Staff;
  onClose: () => void;
}) {
  const isDriver = member.kind === 'DRIVER';

  const save = useResourceMutation(
    (values: UpdateStaffDto) => api.staff.update(member.id, values),
    [keys.staff],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {isDriver ? t('driver.edit') : t('hostStaff.edit')}
          </DialogTitle>
        </DialogHeader>

        <Form
          schema={createStaffSchema}
          defaultValues={
            {
              kind: member.kind,
              fullName: member.fullName,
              phoneE164: member.phoneE164 ?? undefined,
              licenceNo: member.licenceNo ?? undefined,
              licenceExpiry: member.licenceExpiry ?? undefined,
              recordCertDate: member.recordCertDate ?? undefined,
              status: member.status,
            } as CreateStaffDto
          }
          submitError={save.error}
          submitLabel={t('common.save')}
          onCancel={onClose}
          onSubmit={async (values) => {
            const payload: UpdateStaffDto = {
              fullName: values.fullName,
              phoneE164: values.phoneE164 || null,
              licenceNo: values.licenceNo || null,
              licenceExpiry: values.licenceExpiry || null,
              recordCertDate: values.recordCertDate || null,
            };
            await save.mutateAsync(payload);
            onClose();
          }}
        >
          <TextField<CreateStaffDto> name="fullName" label={t('staff.fullName')} />
          <TextField<CreateStaffDto> name="phoneE164" label={t('staff.phone')} optional />

          {isDriver && (
            <FieldRow>
              <TextField<CreateStaffDto> name="licenceNo" label={t('staff.licenceNo')} optional />
              <TextField<CreateStaffDto>
                name="licenceExpiry"
                label={t('staff.licenceExpiry')}
                type="date"
                optional
              />
            </FieldRow>
          )}

          <TextField<CreateStaffDto>
            name="recordCertDate"
            label={t('staff.recordCertDate')}
            type="date"
            optional
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}
