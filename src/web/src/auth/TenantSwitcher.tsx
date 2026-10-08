import { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { TenantMembership } from '@servisapp/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ErrorState';
import { useAuth } from './AuthProvider';
import { t } from '@/i18n';

/**
 * FR-TEN-030, SDD §4.3 — one identity, several companies.
 *
 * *"A single user identity shall be able to hold roles in more than one Tenant; the
 * client shall display the associated company alongside each Student or assignment."*
 *
 * A token is scoped to one tenant, and where an identity holds several the server issues
 * one carrying none — so this screen is not a convenience, it is the only way such a
 * user reaches any data at all. `POST /auth/select-tenant` verifies the membership
 * server-side; this names a tenant, it does not grant one.
 *
 * Every cached query is discarded on the switch, in `AuthProvider`. Leaving one behind
 * would show company A's students under company B's name for as long as it stayed fresh.
 */
export function TenantSwitcher() {
  const { me, selectTenant } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const memberships = me?.memberships ?? [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('tenantSwitcher.title')}</CardTitle>
          <CardDescription>{t('tenantSwitcher.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <ErrorState error={error} /> : null}

          {memberships.map((membership) => (
            <MembershipRow
              key={membership.tenantId}
              membership={membership}
              pending={pending === membership.tenantId}
              disabled={pending !== null}
              onSelect={async () => {
                setError(null);
                setPending(membership.tenantId);
                try {
                  await selectTenant(membership.tenantId);
                } catch (cause) {
                  setError(cause);
                } finally {
                  setPending(null);
                }
              }}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MembershipRow({
  membership,
  pending,
  disabled,
  onSelect,
}: {
  membership: TenantMembership;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  // A membership awaiting approval, or one whose company is suspended, cannot be
  // selected — the server refuses it, and offering the button would be a promise the
  // next request breaks.
  const selectable = membership.status === 'ACTIVE' && membership.tenantStatus !== 'SUSPENDED';

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <Building2 aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{membership.tenantName}</p>
        <p className="text-xs text-muted-foreground">{t(`role.${membership.role}`)}</p>
      </div>

      {selectable ? (
        <Button size="sm" onClick={onSelect} disabled={disabled}>
          {pending ? t('tenantSwitcher.switching') : t('common.details')}
        </Button>
      ) : (
        <Badge variant="secondary">
          {membership.status === 'ACTIVE'
            ? t(`tenantStatus.${membership.tenantStatus}`)
            : t(`status.${membership.status}`)}
        </Badge>
      )}
    </div>
  );
}
