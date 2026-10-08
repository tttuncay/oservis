import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout';
import { SysadminLayout } from '@/layouts/SysadminLayout';
import { RequireRole } from '@/auth/RequireRole';
import { LoginPage } from '@/auth/LoginPage';
import { HealthPage } from '@/features/platform/health/HealthPage';
import { TenantsPage } from '@/features/platform/TenantsPage';
import { TenantDetailPage } from '@/features/platform/TenantDetailPage';
import { PlansPage } from '@/features/platform/PlansPage';
import { AnnouncementsPage } from '@/features/platform/AnnouncementsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SchoolsPage } from '@/features/schools/SchoolsPage';
import { VehiclesPage } from '@/features/vehicles/VehiclesPage';
import { VehicleAlertsPage } from '@/features/vehicles/VehicleAlertsPage';
import { DriversPage } from '@/features/staff/DriversPage';
import { HostsPage } from '@/features/staff/HostsPage';
import { InvitationsPage } from '@/features/invitations/InvitationsPage';
import { StudentsPage } from '@/features/students/StudentsPage';
import { StudentDetailPage } from '@/features/students/StudentDetailPage';
import { StudentImportPage } from '@/features/students/import/StudentImportPage';
import { GuardiansPage } from '@/features/guardians/GuardiansPage';
import { RouteTemplatesPage } from '@/features/route-templates/RouteTemplatesPage';
import { ExpensesPage } from '@/features/finance/ExpensesPage';
import { FeePlansPage } from '@/features/finance/FeePlansPage';
import { InstalmentsPage } from '@/features/finance/InstalmentsPage';
import { ReportsPage } from '@/features/finance/ReportsPage';
import { RouteTemplateDetailPage } from '@/features/route-templates/RouteTemplateDetailPage';
import { TripsPage } from '@/features/trips/TripsPage';
import { TripDetailPage } from '@/features/trips/TripDetailPage';
import { FleetMapPage } from '@/features/tracking/FleetMapPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { LeadsPage } from '@/features/crm/LeadsPage';
import { LeadDetailPage } from '@/features/crm/LeadDetailPage';
import { LeadFunnelPage } from '@/features/crm/LeadFunnelPage';
import { OperationalReportsPage } from '@/features/reports/OperationalReportsPage';
import { QuoteRequestPage } from '@/features/quote/QuoteRequestPage';

/**
 * Routes (SDD §15.1).
 *
 * `RequireRole` wraps the layout rather than each page: a guard per route is a guard
 * somebody forgets on the next one, and every screen under `/admin` has the same
 * audience. It routes rather than authorises — the server guards every endpoint
 * (FR-AUTH-140), and this only keeps a user out of a shell whose every request would 403.
 *
 * The sysadmin console landed in Phase 10 (FR-SYS-*). Its shell has existed since Phase 0
 * carrying only the health view; the tenant, plan and announcement screens join it here.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <LoginPage /> },

  /*
   * FR-MKT-010 — the public quote page, deliberately **outside** `RequireRole` and
   * outside `AdminLayout`. It is reached by a stranger from a link on the company's own
   * website; a shell carrying a tenant switcher and an impersonation banner has nothing
   * to render for them, and a role guard would redirect them to a login screen they have
   * no account for.
   *
   * The path is Turkish because the URL is customer-facing and the UI language is Turkish
   * (NFR-USA-050). Every other route in this file is an operator's and stays in English.
   */
  { path: '/teklif/:slug', element: <QuoteRequestPage /> },

  {
    path: '/admin',
    element: (
      <RequireRole roles={['ADMIN']}>
        <AdminLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <DashboardPage /> },

      { path: 'schools', element: <SchoolsPage /> },

      { path: 'vehicles', element: <VehiclesPage /> },
      { path: 'vehicles/alerts', element: <VehicleAlertsPage /> },

      { path: 'drivers', element: <DriversPage /> },
      { path: 'hosts', element: <HostsPage /> },
      { path: 'invitations', element: <InvitationsPage /> },
      { path: 'staff', element: <Navigate to="/admin/drivers" replace /> },
      { path: 'approvals', element: <Navigate to="/admin/invitations" replace /> },

      { path: 'students', element: <StudentsPage /> },
      // Declared before `:studentId`, so `import` is not parsed as an identifier — the
      // same ordering constraint the students controller has on the server.
      { path: 'students/import', element: <StudentImportPage /> },
      { path: 'students/:studentId', element: <StudentDetailPage /> },

      { path: 'guardians', element: <GuardiansPage /> },

      { path: 'route-templates', element: <RouteTemplatesPage /> },
      { path: 'route-templates/:templateId', element: <RouteTemplateDetailPage /> },

      // Routing — Phase 5 (FR-RTE-*)
      { path: 'trips', element: <TripsPage /> },
      { path: 'trips/:tripId', element: <TripDetailPage /> },

      // Tracking — Phase 7 (FR-TRK-090). The fleet map is its own route rather than a
      // dashboard panel: it refreshes every fifteen seconds, and a panel that polled
      // would keep doing so behind whatever else the Admin opened.
      { path: 'live', element: <FleetMapPage /> },

      // Finance — Phase 4 (FR-FIN-*)
      { path: 'finance/fee-plans', element: <FeePlansPage /> },
      { path: 'finance/instalments', element: <InstalmentsPage /> },
      { path: 'finance/expenses', element: <ExpensesPage /> },
      { path: 'finance/reports', element: <ReportsPage /> },

      // CRM — Phase 9 (FR-MKT-*). The funnel is declared before `:leadId` for the reason
      // the server's controller declares `funnel` before its own parameter route.
      { path: 'crm/leads', element: <LeadsPage /> },
      { path: 'crm/funnel', element: <LeadFunnelPage /> },
      { path: 'crm/leads/:leadId', element: <LeadDetailPage /> },

      // Reporting — Phase 9 (FR-RPT-030…070). Distinct from `finance/reports`, which is
      // FR-FIN-230…280's five financial ones: an operations manager and a bookkeeper are
      // not the same reader and do not open the same screen.
      { path: 'reports', element: <OperationalReportsPage /> },

      { path: 'settings', element: <SettingsPage /> },
    ],
  },

  {
    path: '/sysadmin',
    element: (
      <RequireRole roles={['SYSADMIN']}>
        <SysadminLayout />
      </RequireRole>
    ),
    children: [
      // Phase 10 — the tenant list is the console's front door: every other screen is
      // reached from a company, and the health view is what an operator opens when
      // something is wrong rather than when they arrive.
      { index: true, element: <Navigate to="tenants" replace /> },

      { path: 'tenants', element: <TenantsPage /> },
      { path: 'tenants/:tenantId', element: <TenantDetailPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'health', element: <HealthPage /> },
    ],
  },
]);
