import { useState } from 'react';
import {
  DIRECTIONS,
  createRouteTemplateSchema,
  updateRouteTemplateSchema,
  type CreateRouteTemplateDto,
  type RouteTemplate,
  type RouteTemplateDetail,
  type UpdateRouteTemplateDto,
} from '@servisapp/shared';
import { api } from '@/api/client';
import {
  keys,
  useResourceMutation,
  useSchools,
  useStaff,
  useVehicles,
} from '@/api/hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FieldRow, Form, SelectField, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

export const ALL_DAYS = [
  { id: 1, label: 'Pzt' },
  { id: 2, label: 'Sal' },
  { id: 3, label: 'Çar' },
  { id: 4, label: 'Per' },
  { id: 5, label: 'Cum' },
  { id: 6, label: 'Cmt' },
  { id: 7, label: 'Paz' },
] as const;

export function formatDays(days?: number[] | null): string {
  if (!days || days.length === 0) return '—';
  const labels: Record<number, string> = {
    1: t('days.mon'),
    2: t('days.tue'),
    3: t('days.wed'),
    4: t('days.thu'),
    5: t('days.fri'),
    6: t('days.sat'),
    7: t('days.sun'),
  };
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => labels[d] ?? String(d))
    .join(', ');
}

interface RouteTemplateDialogProps {
  template?: RouteTemplate | RouteTemplateDetail;
  onClose: () => void;
}

export function RouteTemplateDialog({ template, onClose }: RouteTemplateDialogProps) {
  const isEditing = Boolean(template);
  const vehicles = useVehicles({ limit: 100, sort: 'plate', dir: 'asc', status: 'ACTIVE' });
  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc', status: 'ACTIVE' });
  const drivers = useStaff({ kind: 'DRIVER', status: 'ACTIVE', limit: 100, sort: 'fullName', dir: 'asc' });
  const hosts = useStaff({ kind: 'HOST', status: 'ACTIVE', limit: 100, sort: 'fullName', dir: 'asc' });

  const [selectedDays, setSelectedDays] = useState<number[]>(
    template?.daysOfWeek && template.daysOfWeek.length > 0 ? template.daysOfWeek : [1, 2, 3, 4, 5],
  );

  const create = useResourceMutation(
    (values: CreateRouteTemplateDto) => api.routeTemplates.create(values),
    [keys.routeTemplates],
  );

  const update = useResourceMutation(
    (values: UpdateRouteTemplateDto) => api.routeTemplates.update(template!.id, values),
    [keys.routeTemplates],
  );

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.length > 1
          ? prev.filter((d) => d !== day)
          : prev
        : [...prev, day].sort(),
    );
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('routeTemplate.edit') : t('routeTemplate.create')}</DialogTitle>
        </DialogHeader>

        {isEditing ? (
          <Form
            schema={updateRouteTemplateSchema}
            defaultValues={
              {
                vehicleId: template!.vehicleId,
                name: template!.name ?? undefined,
                departureTime: template!.departureTime ?? '07:30',
                daysOfWeek: selectedDays,
                driverId: template!.driverId ?? undefined,
                hostId: template!.hostId ?? undefined,
                active: template!.active,
              } as UpdateRouteTemplateDto
            }
            submitError={update.error}
            onCancel={onClose}
            onSubmit={async (values) => {
              const payload: UpdateRouteTemplateDto = {
                ...(values as UpdateRouteTemplateDto),
                daysOfWeek: selectedDays,
                driverId: values.driverId || null,
                hostId: values.hostId || null,
                departureTime: values.departureTime || null,
                name: values.name || null,
              };
              await update.mutateAsync(payload);
              onClose();
            }}
          >
            <div className="mb-2 rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('routeTemplate.school')}:</span>
                <span className="font-medium">{template!.schoolName}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">{t('routeTemplate.direction')}:</span>
                <span className="font-medium">{t(`direction.${template!.direction}`)}</span>
              </div>
            </div>

            <FieldRow>
              <SelectField<UpdateRouteTemplateDto>
                name="vehicleId"
                label={t('routeTemplate.vehicle')}
                options={(vehicles.data?.data ?? []).map((vehicle) => ({
                  value: vehicle.id,
                  label: `${vehicle.plate} · ${t('vehicle.capacityUnit', { count: vehicle.capacity })}`,
                }))}
              />
              <SelectField<UpdateRouteTemplateDto>
                name="active"
                label={t('common.status')}
                options={[
                  { value: true as unknown as string, label: t('status.ACTIVE') },
                  { value: false as unknown as string, label: t('status.INACTIVE') },
                ]}
              />
            </FieldRow>

            <FieldRow>
              <SelectField<UpdateRouteTemplateDto>
                name="driverId"
                label={t('routeTemplate.driver')}
                options={[
                  { value: '', label: t('routeTemplate.selectDriver') },
                  ...(drivers.data?.data ?? []).map((d) => ({
                    value: d.id,
                    label: d.fullName,
                  })),
                ]}
                optional
              />
              <SelectField<UpdateRouteTemplateDto>
                name="hostId"
                label={t('routeTemplate.host')}
                options={[
                  { value: '', label: t('routeTemplate.noHost') },
                  ...(hosts.data?.data ?? []).map((h) => ({
                    value: h.id,
                    label: h.fullName,
                  })),
                ]}
                optional
              />
            </FieldRow>

            <FieldRow>
              <TextField<UpdateRouteTemplateDto>
                name="departureTime"
                label={t('routeTemplate.departureTime')}
                placeholder="07:30"
                optional
              />
              <TextField<UpdateRouteTemplateDto> name="name" label={t('routeTemplate.name')} optional />
            </FieldRow>

            <div className="space-y-1.5 pt-1">
              <label className="text-sm font-medium">{t('routeTemplate.daysOfWeek')}</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAYS.map((day) => {
                  const active = selectedDays.includes(day.id);
                  return (
                    <Button
                      key={day.id}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-10 px-0 text-xs font-semibold"
                      onClick={() => toggleDay(day.id)}
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </Form>
        ) : (
          <Form
            schema={createRouteTemplateSchema}
            defaultValues={
              {
                vehicleId: '',
                schoolId: '',
                direction: 'MORNING',
                name: undefined,
                departureTime: undefined,
                daysOfWeek: [1, 2, 3, 4, 5],
                driverId: undefined,
                hostId: undefined,
              } as CreateRouteTemplateDto
            }
            submitError={create.error}
            onCancel={onClose}
            onSubmit={async (values) => {
              const payload: CreateRouteTemplateDto = {
                ...(values as CreateRouteTemplateDto),
                daysOfWeek: selectedDays,
                driverId: values.driverId || undefined,
                hostId: values.hostId || undefined,
                departureTime: values.departureTime || undefined,
                name: values.name || undefined,
              };
              await create.mutateAsync(payload);
              onClose();
            }}
          >
            <FieldRow>
              <SelectField<CreateRouteTemplateDto>
                name="vehicleId"
                label={t('routeTemplate.vehicle')}
                options={(vehicles.data?.data ?? []).map((vehicle) => ({
                  value: vehicle.id,
                  label: `${vehicle.plate} · ${t('vehicle.capacityUnit', { count: vehicle.capacity })}`,
                }))}
              />
              <SelectField<CreateRouteTemplateDto>
                name="direction"
                label={t('routeTemplate.direction')}
                options={DIRECTIONS.map((direction) => ({
                  value: direction,
                  label: t(`direction.${direction}`),
                }))}
              />
            </FieldRow>

            <SelectField<CreateRouteTemplateDto>
              name="schoolId"
              label={t('routeTemplate.school')}
              hint={t('routeTemplate.directionLocked')}
              options={(schools.data?.data ?? []).map((school) => ({
                value: school.id,
                label: school.name,
              }))}
            />

            <FieldRow>
              <SelectField<CreateRouteTemplateDto>
                name="driverId"
                label={t('routeTemplate.driver')}
                options={[
                  { value: '', label: t('routeTemplate.selectDriver') },
                  ...(drivers.data?.data ?? []).map((d) => ({
                    value: d.id,
                    label: d.fullName,
                  })),
                ]}
                optional
              />
              <SelectField<CreateRouteTemplateDto>
                name="hostId"
                label={t('routeTemplate.host')}
                options={[
                  { value: '', label: t('routeTemplate.noHost') },
                  ...(hosts.data?.data ?? []).map((h) => ({
                    value: h.id,
                    label: h.fullName,
                  })),
                ]}
                optional
              />
            </FieldRow>

            <FieldRow>
              <TextField<CreateRouteTemplateDto>
                name="departureTime"
                label={t('routeTemplate.departureTime')}
                placeholder="Örn: 07:30 / 16:30"
                optional
              />
              <TextField<CreateRouteTemplateDto> name="name" label={t('routeTemplate.name')} optional />
            </FieldRow>

            <div className="space-y-1.5 pt-1">
              <label className="text-sm font-medium">{t('routeTemplate.daysOfWeek')}</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAYS.map((day) => {
                  const active = selectedDays.includes(day.id);
                  return (
                    <Button
                      key={day.id}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-10 px-0 text-xs font-semibold"
                      onClick={() => toggleDay(day.id)}
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
