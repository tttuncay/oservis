import { createVehicleSchema, type CreateVehicleDto, type Vehicle } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation } from '@/api/hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldRow, Form, TextField } from '@/components/FormKit';
import { AssignmentsPanel } from './AssignmentsPanel';
import { t } from '@/i18n';

/** FR-CMP-020, with FR-CMP-060/070's assignments on their own tab. */
export function VehicleDialog({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const editing = vehicle !== null;

  const save = useResourceMutation(
    (values: CreateVehicleDto) =>
      editing ? api.vehicles.update(vehicle.id, values) : api.vehicles.create(values),
    [keys.vehicles],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('vehicle.edit') : t('vehicle.create')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">{t('student.tabDetails')}</TabsTrigger>
            <TabsTrigger value="assignments" disabled={!editing}>
              {t('assignment.title')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Form
              schema={createVehicleSchema}
              defaultValues={
                {
                  plate: vehicle?.plate ?? '',
                  capacity: vehicle?.capacity ?? 16,
                  makeModel: vehicle?.makeModel ?? undefined,
                  inspectionDue: vehicle?.inspectionDue ?? undefined,
                  insuranceDue: vehicle?.insuranceDue ?? undefined,
                } as CreateVehicleDto
              }
              submitError={save.error}
              onCancel={onClose}
              onSubmit={async (values) => {
                await save.mutateAsync(values as CreateVehicleDto);
                onClose();
              }}
            >
              <FieldRow>
                {/* The shared schema upper-cases and unspaces before validating, so
                    "34 abc 123" is accepted and stored canonically — which is the only
                    form `UNIQUE (tenant_id, plate)` can do its job on. */}
                <TextField<CreateVehicleDto> name="plate" label={t('vehicle.plate')} />
                <TextField<CreateVehicleDto>
                  name="capacity"
                  label={t('vehicle.capacity')}
                  type="number"
                />
              </FieldRow>

              <TextField<CreateVehicleDto>
                name="makeModel"
                label={t('vehicle.makeModel')}
                optional
              />

              <FieldRow>
                <TextField<CreateVehicleDto>
                  name="inspectionDue"
                  label={t('vehicle.inspectionDue')}
                  type="date"
                  optional
                />
                <TextField<CreateVehicleDto>
                  name="insuranceDue"
                  label={t('vehicle.insuranceDue')}
                  type="date"
                  optional
                />
              </FieldRow>
            </Form>
          </TabsContent>

          <TabsContent value="assignments">
            {editing ? <AssignmentsPanel vehicleId={vehicle.id} /> : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
