import { useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import {
  ADDRESS_TYPES,
  createAddressSchema,
  hasUsableGeo,
  type Coordinates,
  type CreateAddressDto,
  type StudentAddress,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useStudentAddresses } from '@/api/hooks';
import { FieldRow, Form, SelectField, TextField } from '@/components/FormKit';
import { MapPicker } from '@/components/MapPicker';
import { MutatingButton } from '@/components/MutatingButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/i18n';

/**
 * FR-CMP-100 — the student's addresses and the coordinate confirmation step.
 *
 * SDD §21 TI-04 makes the confirmation non-optional rather than cosmetic: geocoding
 * quality for informal Turkish addresses is variable, and a plausible-looking wrong point
 * is worse than an obvious gap because nothing downstream can tell it is wrong. So an
 * unconfirmed address is called out, and confirming stores the point as `MANUAL` and
 * immune to any later geocode.
 */
export function StudentAddressesPanel({ studentId }: { studentId: string }) {
  const query = useStudentAddresses(studentId);
  const [adding, setAdding] = useState(false);

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const addresses = query.data ?? [];

  return (
    <div className="max-w-3xl space-y-4">
      {addresses.length === 0 && !adding ? (
        <EmptyState
          title={t('address.emptyTitle')}
          body={t('address.emptyBody')}
          action={
            <MutatingButton size="sm" onClick={() => setAdding(true)}>
              {t('address.add')}
            </MutatingButton>
          }
        />
      ) : (
        addresses.map((address) => <AddressCard key={address.id} address={address} />)
      )}

      {adding ? (
        <AddressForm studentId={studentId} onDone={() => setAdding(false)} />
      ) : addresses.length > 0 && addresses.length < ADDRESS_TYPES.length ? (
        // At most one address of each type; the server enforces it with a unique index
        // and would answer `ADDRESS_TYPE_DUPLICATE`. Hiding the button once both exist
        // is the courtesy half of that.
        <MutatingButton size="sm" variant="outline" onClick={() => setAdding(true)}>
          {t('address.add')}
        </MutatingButton>
      ) : null}
    </div>
  );
}

function AddressCard({ address }: { address: StudentAddress }) {
  const [point, setPoint] = useState<Coordinates | null>(
    address.lat !== null && address.lng !== null ? { lat: address.lat, lng: address.lng } : null,
  );

  const setGeo = useResourceMutation(
    (next: Coordinates) => api.addresses.setGeo(address.id, next),
    [keys.students],
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t(`address.type${address.type}`)}</span>
              {address.label ? (
                <span className="text-sm text-muted-foreground">{address.label}</span>
              ) : null}
              <Badge variant={hasUsableGeo(address.geoStatus) ? 'secondary' : 'destructive'}>
                {t(`geoStatus.${address.geoStatus}`)}
              </Badge>
              {address.verifiedByAdmin ? (
                <Badge className="gap-1">
                  <CheckCircle2 aria-hidden className="h-3 w-3" />
                  {t('address.verified')}
                </Badge>
              ) : (
                <Badge variant="outline">{t('address.notVerified')}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{address.textAddress}</p>
          </div>
        </div>

        {address.geoStatus === 'PENDING' ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t('address.geocodePending')}
          </p>
        ) : null}

        <MapPicker
          value={point}
          onChange={setPoint}
          label={t('address.confirmLocation')}
          hint={t('address.confirmHint')}
        />

        <div className="flex items-center gap-3">
          <MutatingButton
            size="sm"
            disabled={point === null || setGeo.isPending}
            onClick={() => point && setGeo.mutate(point)}
          >
            {t('address.confirmLocation')}
          </MutatingButton>
          {setGeo.error ? <ErrorState error={setGeo.error} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AddressForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const create = useResourceMutation(
    (values: CreateAddressDto) => api.students.addAddress(studentId, values),
    [keys.students],
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <Form
          schema={createAddressSchema}
          defaultValues={
            { type: 'HOME', textAddress: '', label: undefined } as CreateAddressDto
          }
          submitError={create.error}
          onCancel={onDone}
          onSubmit={async (values) => {
            await create.mutateAsync(values as CreateAddressDto);
            onDone();
          }}
        >
          <FieldRow>
            <SelectField<CreateAddressDto>
              name="type"
              label={t('common.details')}
              options={ADDRESS_TYPES.map((type) => ({
                value: type,
                label: t(`address.type${type}`),
              }))}
            />
            <TextField<CreateAddressDto> name="label" label={t('address.label')} optional />
          </FieldRow>

          {/* No coordinates on creation: the address is queued for geocoding in the
              background (SDD §21 TI-08) and confirmed on the card above once a point
              exists. Asking for coordinates here would make every new address a
              two-step form for the common case. */}
          <TextField<CreateAddressDto> name="textAddress" label={t('address.textAddress')} />
        </Form>
      </CardContent>
    </Card>
  );
}
