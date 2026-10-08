import { NavLink, Outlet } from 'react-router-dom';
import {
  Bus,
  CalendarDays,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Radio,
  Receipt,
  Route as RouteIcon,
  Settings,
  UserCheck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImpersonationBanner } from '@/auth/ImpersonationBanner';
import { AnnouncementBanner } from '@/features/platform/AnnouncementBanner';
import { useAuth } from '@/auth/AuthProvider';
import { ReadOnlyProvider, useReadOnly } from '@/components/ReadOnlyProvider';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

/**
 * The company administrator console (SDD §15.1).
 *
 * Laid out for 1280×720 and usable on a tablet in landscape (SRS §2.4). The navigation
 * is a fixed 15rem column rather than a collapsing drawer, because the panel is not
 * required to be mobile-responsive in V1 and a drawer would add a state to test on every
 * screen for a viewport nobody has committed to supporting.
 */
export function AdminLayout() {
  const { me, membership, signOut } = useAuth();

  return (
    <ReadOnlyProvider>
      <div className="min-h-screen bg-muted/30">
        {/* Above everything, sticky, not dismissible (FR-SYS-100). */}
        <ImpersonationBanner />

        {/*
          FR-SYS-080 — below the impersonation banner, and dismissible, because the two
          say different kinds of thing: one is *"you are not yourself right now"* and must
          not be put aside, the other is a notice from the platform that an operator may
          reasonably read once.
        */}
        <AnnouncementBanner />

        <div className="flex min-h-screen">
          <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
            <div className="border-b px-5 py-4">
              <p className="text-sm font-semibold">{t('common.appName')}</p>
              <CompanyLabel name={membership?.tenantName ?? null} />
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
              <NavSection title={t('nav.sectionOperations')}>
                <NavItem to="/admin" end icon={LayoutDashboard} label={t('nav.dashboard')} />
                <NavItem to="/admin/trips" icon={CalendarDays} label={t('nav.trips')} />
                <NavItem to="/admin/live" icon={Radio} label={t('nav.live')} />
                <NavItem to="/admin/route-templates" icon={RouteIcon} label={t('nav.routeTemplates')} />
                <NavItem to="/admin/reports" icon={FileBarChart} label={t('nav.reports')} />
                <NavItem to="/admin/vehicles" icon={Bus} label={t('nav.vehicles')} />
              </NavSection>

              <NavSection title={t('nav.sectionPeople')}>
                <NavItem to="/admin/students" icon={GraduationCap} label={t('nav.students')} />
                <NavItem to="/admin/guardians" icon={Users} label={t('nav.guardians')} />
                <NavItem to="/admin/drivers" icon={UserRound} label={t('nav.drivers')} />
                <NavItem to="/admin/hosts" icon={UserCheck} label={t('nav.hosts')} />
                <NavItem to="/admin/invitations" icon={Mail} label={t('nav.invitations')} />
              </NavSection>

              <NavSection title={t('nav.sectionFinance')}>
                <NavItem to="/admin/finance/instalments" icon={Receipt} label={t('nav.financeInstalments')} />
                <NavItem to="/admin/finance/fee-plans" icon={Wallet} label={t('nav.financePlans')} />
                <NavItem to="/admin/finance/expenses" icon={Receipt} label={t('nav.financeExpenses')} />
                <NavItem to="/admin/finance/reports" icon={FileBarChart} label={t('nav.financeReports')} />
              </NavSection>

              {/*
                FR-MKT-* — its own section rather than a page under *Company*. The CRM is
                a per-tenant module (`crm`, FR-FLG-010) that a company may not have
                bought, and grouping it separately is what makes its absence legible
                rather than a hole in another menu.
              */}
              <NavSection title={t('nav.sectionCrm')}>
                <NavItem to="/admin/crm/leads" icon={Megaphone} label={t('nav.crmLeads')} />
                <NavItem to="/admin/crm/funnel" icon={FileBarChart} label={t('nav.crmFunnel')} />
              </NavSection>

              <NavSection title={t('nav.sectionCompany')}>
                <NavItem to="/admin/schools" icon={GraduationCap} label={t('nav.schools')} />
                <NavItem to="/admin/settings" icon={Settings} label={t('nav.settings')} />
              </NavSection>
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
    </ReadOnlyProvider>
  );
}

/**
 * The company name, with its status where that status changes what the Admin can do.
 *
 * FR-TEN-030 asks for the company to be displayed alongside the data; the badge is the
 * read-only half of FR-SYS-060 restated where the eye already is.
 */
function CompanyLabel({ name }: { name: string | null }) {
  const { readOnly, status } = useReadOnly();

  return (
    <div className="flex items-center gap-2 pt-0.5">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{name ?? t('common.unknown')}</p>
      {readOnly && status ? (
        <Badge variant="secondary" className="shrink-0">
          {t('readOnly.badge')}
        </Badge>
      ) : null}
    </div>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: typeof Bus;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
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
