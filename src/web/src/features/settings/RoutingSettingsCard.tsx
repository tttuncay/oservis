import {
  updateRoutingSettingsSchema,
  type UpdateRoutingSettingsDto,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation } from '@/api/hooks';
import { routingKeys, useRoutingSettings } from '@/api/routing-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ErrorState';
import { FieldRow, Form, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

/**
 * FR-ABS-030's cut-offs, FR-RTE-020's generation offset and FR-RTE-040's merge radius.
 *
 * ## The cut-off is the field with consequences
 *
 * Everything else here trades a little accuracy for a little cost. The cut-off decides
 * the last moment a parent may keep their child off a vehicle, and the generation offset
 * decides how long after that the route is built — which is why the hint under each one
 * says what it does rather than what it is. An Admin who moves the cut-off to 07:00
 * without realising generation follows it has not misconfigured a number; they have
 * changed when the vehicle leaves.
 *
 * The two are one settings section on the server for exactly that reason: they cannot be
 * saved out of step with each other.
 */
export function RoutingSettingsCard() {
  const query = useRoutingSettings();

  const save = useResourceMutation(
    (values: UpdateRoutingSettingsDto) => api.routing.settings.update(values),
    [routingKeys.routingSettings, routingKeys.trips],
  );

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const settings = query.data;
  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('routingSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form
          schema={updateRoutingSettingsSchema}
          defaultValues={settings as UpdateRoutingSettingsDto}
          submitError={save.error}
          onSubmit={async (values) => {
            await save.mutateAsync(values as UpdateRoutingSettingsDto);
          }}
        >
          <FieldRow>
            <TextField<UpdateRoutingSettingsDto>
              name="morningCutoff"
              type="time"
              label={t('routingSettings.morningCutoff')}
              hint={t('routingSettings.cutoffHint')}
            />
            <TextField<UpdateRoutingSettingsDto>
              name="afternoonCutoff"
              type="time"
              label={t('routingSettings.afternoonCutoff')}
            />
          </FieldRow>

          <TextField<UpdateRoutingSettingsDto>
            name="generationOffsetMinutes"
            type="number"
            label={t('routingSettings.generationOffsetMinutes')}
            hint={t('routingSettings.generationOffsetHint')}
          />

          <FieldRow>
            <TextField<UpdateRoutingSettingsDto>
              name="stopMergeRadiusM"
              type="number"
              label={t('routingSettings.stopMergeRadiusM')}
              hint={t('routingSettings.stopMergeRadiusHint')}
            />
            <TextField<UpdateRoutingSettingsDto>
              name="dwellSecondsPerStudent"
              type="number"
              label={t('routingSettings.dwellSecondsPerStudent')}
            />
          </FieldRow>

          <FieldRow>
            <TextField<UpdateRoutingSettingsDto>
              name="arrivalBufferMinutes"
              type="number"
              label={t('routingSettings.arrivalBufferMinutes')}
            />
            <TextField<UpdateRoutingSettingsDto>
              name="maxAbsenceRangeDays"
              type="number"
              label={t('routingSettings.maxAbsenceRangeDays')}
            />
          </FieldRow>
        </Form>
      </CardContent>
    </Card>
  );
}
