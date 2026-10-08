import { useState } from 'react';
import type { TripDetailDto, TripSummaryDto } from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation } from '@/api/hooks';
import { TRIP_KEYS } from '@/api/routing-hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorState } from '@/components/ErrorState';
import { MutatingButton } from '@/components/MutatingButton';
import { t } from '@/i18n';

interface CancelTripDialogProps {
  trip: TripSummaryDto | TripDetailDto;
  onClose: () => void;
}

export function CancelTripDialog({ trip, onClose }: CancelTripDialogProps) {
  const [reason, setReason] = useState('');

  const cancel = useResourceMutation(
    (cancelReason: string) => api.routing.cancel(trip.id, { reason: cancelReason }),
    TRIP_KEYS,
  );

  const handleCancel = async () => {
    if (reason.trim().length < 3) return;
    await cancel.mutateAsync(reason.trim());
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('trip.cancelTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {trip.vehiclePlate} ({trip.schoolName} · {t(`direction.${trip.direction}`)})
          </p>

          <div className="space-y-2">
            <Label>{t('trip.cancelReason')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Hava muhalefeti / Kar tatili',
                'Araç arızası / Bakım',
                'Okul idari tatil / Etkinlik',
                'Yol / Trafik engeli',
                'Şoför rahatsızlığı',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    reason === preset
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted text-foreground'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              id="cancel-reason"
              placeholder="İptal gerekçesini yazın veya yukarıdan seçin..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {cancel.error ? <ErrorState error={cancel.error} /> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            {t('common.cancel')}
          </Button>
          <MutatingButton
            variant="destructive"
            onClick={handleCancel}
            disabled={reason.trim().length < 3 || cancel.isPending}
          >
            {t('trip.cancel')}
          </MutatingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
