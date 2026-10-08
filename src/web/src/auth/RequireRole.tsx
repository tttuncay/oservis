import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@servisapp/shared';
import { useAuth } from './AuthProvider';
import { TenantSwitcher } from './TenantSwitcher';
import { ConsentScreen } from '@/features/auth/ConsentScreen';
import { t } from '@/i18n';

/**
 * The role guard (SDD §15.1 `auth/`).
 *
 * ## It routes; it does not authorise
 *
 * Every endpoint is role-guarded on the server (FR-AUTH-140, SDD §7.3), and that is the
 * authorisation. What this does is keep a user out of a screen whose every request would
 * 403 — which is a navigation decision, not a security one. Deleting this component
 * would make the console unpleasant and would not expose a single row.
 *
 * ## States before a screen can render
 *
 *  1. restoring — the refresh token is being exchanged. Render nothing; a flash of the
 *     login form for a signed-in user is worse than a blank moment.
 *  2. no session — to the login screen, remembering where they were headed.
 *  3. consent required — the server returned CONSENT_REQUIRED (FR-KVK-020, SDD §17.1).
 *     Render the KVKK consent screen before any other screen can load.
 *  4. session, several tenants — the token carries no tenant (SDD §4.3), so no
 *     tenant-scoped screen can load. The switcher is shown instead of an empty table.
 *     A Sysadmin also carries no tenant and is *not* offered the switcher: they have no
 *     membership to choose, and their console is not tenant-scoped (SDD §4.4).
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const { me, membership, role, restoring, consentRequired } = useAuth();
  const location = useLocation();

  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // FR-KVK-020 / SDD §17.1 — gate every screen behind consent acceptance
  if (consentRequired) {
    return <ConsentScreen />;
  }

  // A signed-in identity with more than one usable membership holds a token with no
  // tenant. Choosing one is the only thing they can usefully do here.
  //
  // A **Sysadmin** also holds a token with no tenant, and for the opposite reason: they
  // have no membership to choose (SDD §4.4, FR-SYS-120). Offering them a switcher would
  // show an empty list and strand them, so the platform role skips this branch and goes
  // straight to the role check below — which is what routes them to `/sysadmin`.
  if (!membership && me.platformRole === null) {
    return <TenantSwitcher />;
  }

  if (role === null || !roles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
