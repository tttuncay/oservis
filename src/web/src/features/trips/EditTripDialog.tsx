import { useState } from 'react';
import type { ReassignTripDto, TripDetailDto, TripSummaryDto } from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation, useStaff, useVehicles } from '@/api/hooks';
import { TRIP_KEYS } from '@/api/routing-hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/ErrorState';
import { MutatingButton } from '@/components/MutatingButton';
import { formatClock } from './format';
import { t } from '@/i18n';

interface EditTripDialogProps {
  trip: TripSummaryDto | TripDetailDto;
  onClose: () => void;
}

export function EditTripDialog({ trip, onClose }: EditTripDialogProps) {
  const vehicles = useVehicles({ limit: 100, sort: 'plate', dir: 'asc', status: 'ACTIVE' });
  const drivers = useStaff({ kind: 'DRIVER', status: 'ACTIVE', limit: 100, sort: 'fullName', dir: 'asc' });
  const hosts = useStaff({ kind: 'HOST', status: 'ACTIVE', limit: 100, sort: 'fullName', dir: 'asc' });

  const [driverId, setDriverId] = useState<string>(trip.driverId ?? '');
  const [hostId, setHostId] = useState<string>(trip.hostId ?? '');
  const [vehicleId, setVehicleId] = useState<string>(trip.vehicleId ?? '');
  const initialTime = trip.plannedDepartureAt ? formatClock(trip.plannedDepartureAt) : '07:30';
  const [departureTime, setDepartureTime] = useState<string>(
    initialTime === '—' ? '07:30' : initialTime,
  );

  const reassign = useResourceMutation(
    (payload: ReassignTripDto) => api.routing.reassign(trip.id, payload),
    TRIP_KEYS,
  );

  const handleSave = async () => {
    // Construct ISO string for plannedDepartureAt if serviceDate & departureTime exist
    let plannedDepartureAt: string | undefined;
    if (departureTime && departureTime.includes(':')) {
      const datePart = trip.serviceDate;
      const parts = departureTime.split(':');
      const h = Number(parts[0]) || 0;
      const m = Number(parts[1]) || 0;
      const dateObj = new Date(`${datePart}T00:00:00.000Z`);
      dateObj.setUTCHours(h, m, 0, 0);
      plannedDepartureAt = dateObj.toISOString();
    }

    const payload: ReassignTripDto = {
      driverId: driverId || undefined,
      hostId: hostId || null,
      vehicleId: vehicleId || undefined,
      plannedDepartureAt,
    };

    await reassign.mutateAsync(payload);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('trip.edit')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{t('trip.school')}:</span>
              <span className="font-medium text-foreground">{trip.schoolName}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>{t('trip.direction')}:</span>
              <span className="font-medium text-foreground">{t(`direction.${trip.direction}`)}</span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t('trip.vehicle')}</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder={t('trip.vehicle')} />
              </SelectTrigger>
              <SelectContent>
                {(vehicles.data?.data ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate} ({v.capacity} {t('vehicle.capacity')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>{t('trip.driver')}</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder={t('routeTemplate.selectDriver')} />
              </SelectTrigger>
              <SelectContent>
                {(drivers.data?.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>{t('trip.host')}</Label>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger>
                <SelectValue placeholder={t('routeTemplate.noHost')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('routeTemplate.noHost')}</SelectItem>
                {(hosts.data?.data ?? []).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>{t('trip.departure')}</Label>
            <Input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
            />
          </div>

          {reassign.error ? <ErrorState error={reassign.error} /> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={reassign.isPending}>
            {t('common.cancel')}
          </Button>
          <MutatingButton onClick={handleSave} disabled={reassign.isPending}>
            {t('common.save')}
          </MutatingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
