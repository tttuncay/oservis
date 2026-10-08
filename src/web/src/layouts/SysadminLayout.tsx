import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Building2, LogOut, Megaphone, Receipt } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

/**
 * Shell for the platform administration console (SDD §15.1, FR-SYS-*).
 *
 * ## Deliberately not the Admin shell with a different menu
 *
 * A Sysadmin holds **no tenant**, so everything `AdminLayout` wraps itself in has nothing
 * to render here: `ReadOnlyProvider` reads a tenant status that does not exist, and the
 * impersonation banner belongs to the shell a Sysadmin *lands in* rather than the one
 * they leave from (FR-SYS-100 — the server side landed in Phase 1, the console that
 * starts a session is this one). Sharing a layout would mean a provider that is
 * meaningful in one shell and inert in the other, which is the state nobody remembers to
 * check.
 *
 * ## No tenant switcher either
 *
 * The console reaches a company by opening its detail page, and reaches its *data* only
 * through an audited impersonation session. A switcher would suggest a third way that
 * FR-SYS-120 does not permit.
 */
export function SysadminLayout() {
  const { me, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-semibold">{t('layout.sysadminTitle')}</p>
            <p className="pt-0.5 text-xs text-muted-foreground">{t('common.appName')}</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            <NavItem to="/sysadmin/tenants" icon={Building2} label={t('sysadmin.nav.tenants')} />
            <NavItem to="/sysadmin/plans" icon={Receipt} label={t('sysadmin.nav.plans')} />
            <NavItem
              to="/sysadmin/announcements"
              icon={Megaphone}
              label={t('sysadmin.nav.announcements')}
            />
            <NavItem to="/sysadmin/health" icon={Activity} label={t('sysadmin.nav.health')} />
          </nav>

          <div className="border-t px-3 py-3">
            <p className="truncate px-2 pb-2 text-xs text-muted-foreground">{me?.fullName}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => void signOut()}
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t('nav.signOut')}
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-auto px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Building2;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-accent font-medium text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )
      }
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}
