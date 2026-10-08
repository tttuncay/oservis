import { updateOwnTenantSchema, type UpdateOwnTenantDto } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useMeTenant, useResourceMutation } from '@/api/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { FieldRow, Form, TextField } from '@/components/FormKit';
import { useAuth } from '@/auth/AuthProvider';
import { RoutingSettingsCard } from './RoutingSettingsCard';
import { t } from '@/i18n';

/**
 * The company's own details — `GET` and `PATCH /me/tenant`.
 *
 * ## What is not on this form
 *
 * `status`, `trialEndsAt` and `graceEndsAt`. They are shown, because an Admin should know
 * what state their account is in, and they are not editable, because a tenant that can
 * set its own status can lift its own `READ_ONLY` and FR-SYS-060 would stop meaning
 * anything. The server enforces that with a `.strict()` schema that has no such field —
 * sending one is a validation failure, not a silently ignored key — so this is the
 * courtesy half of a boundary that holds without it.
 */
export function SettingsPage() {
  const query = useMeTenant();
  const { refreshMe } = useAuth();

  const save = useResourceMutation(
    (values: UpdateOwnTenantDto) => api.meTenant.update(values),
    [keys.meTenant],
  );

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const tenant = query.data;
  if (!tenant) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t('settings.accountStatus')}</CardTitle>
            <Badge variant={tenant.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {t(`tenantStatus.${tenant.status}`)}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('settings.accountStatusHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Form
              schema={updateOwnTenantSchema}
              defaultValues={
                {
                  legalName: tenant.legalName,
                  taxNo: tenant.taxNo,
                  timezone: tenant.timezone,
                  publicSlug: tenant.publicSlug,
                } as UpdateOwnTenantDto
              }
              submitError={save.error}
              onSubmit={async (values) => {
                await save.mutateAsync(values as UpdateOwnTenantDto);
                // The company name is rendered in the shell from `MeResponse`, so a
                // rename that did not refresh it would leave the old name in the sidebar
                // until the next reload.
                await refreshMe();
              }}
            >
              <TextField<UpdateOwnTenantDto> name="legalName" label={t('settings.legalName')} />

              <FieldRow>
                <TextField<UpdateOwnTenantDto> name="taxNo" label={t('settings.taxNo')} optional />
                <TextField<UpdateOwnTenantDto> name="timezone" label={t('settings.timezone')} />
              </FieldRow>

              <TextField<UpdateOwnTenantDto>
                name="publicSlug"
                label={t('settings.publicSlug')}
                hint={t('settings.publicSlugHint')}
                optional
              />
            </Form>
          </CardContent>
        </Card>

        {/* FR-ABS-030, FR-RTE-020/040 — the settings that decide when a parent may still
            act and how the day's routes are built. */}
        <RoutingSettingsCard />
      </div>
    </>
  );
}
