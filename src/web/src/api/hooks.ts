import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  AttendanceReportQueryDto,
  CalendarExceptionQueryDto,
  DashboardQueryDto,
  GuardianQueryDto,
  OperationalReportQueryDto,
  PunctualityReportQueryDto,
  LeadFunnelQueryDto,
  LeadQueryDto,
  Page,
  RegistrationQueryDto,
  RouteTemplateQueryDto,
  SchoolQueryDto,
  StaffQueryDto,
  StudentQueryDto,
} from '@servisapp/shared';
import { api } from './client';

/**
 * TanStack Query hooks (SDD §15.1 `api/`, §15.2 "no manual cache management").
 *
 * ## Query keys
 *
 * `[resource, 'list', query]` and `[resource, 'detail', id]`. The whole query object is
 * in the key, so changing a filter or a sort is a different key and a different cache
 * entry — which is what makes going back to a previous filter instant and what stops one
 * filter's results being served under another's.
 *
 * ## Invalidation
 *
 * By resource prefix after any mutation. Precise invalidation would be a cache the code
 * has to reason about, and SDD §15.2 says not to hold one — a mutation invalidates its
 * resource and the affected lists refetch.
 */

export const keys = {
  schools: ['schools'] as const,
  vehicles: ['vehicles'] as const,
  staff: ['staff'] as const,
  students: ['students'] as const,
  guardians: ['guardians'] as const,
  routeTemplates: ['route-templates'] as const,
  registrations: ['registrations'] as const,
  meTenant: ['me-tenant'] as const,

  // Finance (Phase 4, FR-FIN-*)
  feePlans: ['fee-plans'] as const,
  financeSettings: ['finance-settings'] as const,
  studentFees: ['student-fees'] as const,
  instalments: ['instalments'] as const,
  payments: ['payments'] as const,
  expenses: ['expenses'] as const,
  recurringExpenses: ['recurring-expenses'] as const,
  financeReports: ['finance-reports'] as const,

  // CRM (Phase 9, FR-MKT-*)
  leads: ['leads'] as const,
  leadFunnel: ['lead-funnel'] as const,

  // Reporting (Phase 9, FR-RPT-*)
  dashboard: ['dashboard'] as const,
  operationalReports: ['operational-reports'] as const,
};

/**
 * Every finance key a monetary mutation can affect.
 *
 * Recording a payment changes the instalment, the fee's totals and every report that
 * sums them. Listing the affected resources at each call site would mean the day someone
 * added a report, six mutations would silently keep serving stale figures — and a stale
 * *balance* is the one thing this module must never show.
 */
export const FINANCE_KEYS: readonly (readonly string[])[] = [
  keys.instalments,
  keys.studentFees,
  keys.payments,
  keys.financeReports,
];

/** A list query, keyed on its full parameter set. */
function listKey(resource: readonly string[], query: object) {
  return [...resource, 'list', query] as const;
}

function detailKey(resource: readonly string[], id: string) {
  return [...resource, 'detail', id] as const;
}

// ---- Schools ------------------------------------------------------------------------

export function useSchools(query: SchoolQueryDto) {
  return useQuery({
    queryKey: listKey(keys.schools, query),
    queryFn: () => api.schools.list(query),
  });
}

export function useSchool(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(keys.schools, id ?? ''),
    queryFn: () => api.schools.get(id as string),
    enabled: id !== undefined,
  });
}

export function useCalendarExceptions(schoolId: string, query: CalendarExceptionQueryDto) {
  return useQuery({
    queryKey: [...keys.schools, 'calendar', schoolId, query] as const,
    queryFn: () => api.schools.listCalendarExceptions(schoolId, query),
  });
}

// ---- Vehicles -----------------------------------------------------------------------

export function useVehicles(query: VehicleQueryLike) {
  return useQuery({
    queryKey: listKey(keys.vehicles, query),
    queryFn: () => api.vehicles.list(query),
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(keys.vehicles, id ?? ''),
    queryFn: () => api.vehicles.get(id as string),
    enabled: id !== undefined,
  });
}

/** FR-CMP-030 — already ordered by urgency; nothing is re-sorted here. */
export function useVehicleAlerts() {
  return useQuery({
    queryKey: [...keys.vehicles, 'alerts'] as const,
    queryFn: () => api.vehicles.alerts(),
  });
}

export function useAssignments(vehicleId: string) {
  return useQuery({
    queryKey: [...keys.vehicles, 'assignments', vehicleId] as const,
    queryFn: () => api.vehicles.listAssignments(vehicleId, { includeEnded: true }),
  });
}

// ---- Staff --------------------------------------------------------------------------

export function useStaff(query: StaffQueryDto) {
  return useQuery({
    queryKey: listKey(keys.staff, query),
    queryFn: () => api.staff.list(query),
  });
}

// ---- Students -----------------------------------------------------------------------

export function useStudents(query: StudentQueryDto) {
  return useQuery({
    queryKey: listKey(keys.students, query),
    queryFn: () => api.students.list(query),
  });
}

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(keys.students, id ?? ''),
    queryFn: () => api.students.get(id as string),
    enabled: id !== undefined,
  });
}

export function useStudentAddresses(studentId: string) {
  return useQuery({
    queryKey: [...keys.students, 'addresses', studentId] as const,
    queryFn: () => api.students.listAddresses(studentId),
  });
}

export function useStudentGuardians(studentId: string) {
  return useQuery({
    queryKey: [...keys.students, 'guardians', studentId] as const,
    queryFn: () => api.students.listGuardians(studentId),
  });
}

/**
 * FR-KVK-100, NFR-SEC-080 — the signed URL expires in fifteen minutes.
 *
 * `staleTime` is well under that so a photograph left on screen refetches its URL before
 * the one it is showing dies, rather than turning into a broken image.
 */
export function useStudentPhotoUrl(studentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...keys.students, 'photo', studentId] as const,
    queryFn: () => api.students.photoUrl(studentId),
    enabled,
    staleTime: 10 * 60_000,
  });
}

// ---- Guardians ----------------------------------------------------------------------

export function useGuardians(query: GuardianQueryDto) {
  return useQuery({
    queryKey: listKey(keys.guardians, query),
    queryFn: () => api.guardians.list(query),
  });
}

// ---- Route templates ----------------------------------------------------------------

export function useRouteTemplates(query: RouteTemplateQueryDto) {
  return useQuery({
    queryKey: listKey(keys.routeTemplates, query),
    queryFn: () => api.routeTemplates.list(query),
  });
}

export function useRouteTemplate(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(keys.routeTemplates, id ?? ''),
    queryFn: () => api.routeTemplates.get(id as string),
    enabled: id !== undefined,
  });
}

// ---- Registrations ------------------------------------------------------------------

export function useRegistrations(query: RegistrationQueryDto) {
  return useQuery({
    queryKey: listKey(keys.registrations, query),
    queryFn: () => api.registrations.list(query),
  });
}

// ---- The caller's own tenant --------------------------------------------------------

export function useMeTenant() {
  return useQuery({ queryKey: keys.meTenant, queryFn: () => api.meTenant.get() });
}

// ---- Mutations ----------------------------------------------------------------------

/**
 * A mutation that invalidates one or more resource prefixes when it succeeds.
 *
 * Every write in the console goes through this rather than calling `useMutation`
 * directly, so "did this screen remember to refetch" stops being a question anyone has
 * to ask per screen.
 */
export function useResourceMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  invalidates: readonly (readonly string[])[],
): UseMutationResult<TResult, unknown, TInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all(
        invalidates.map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
    },
  });
}

/**
 * The vehicle list query, as the screen holds it.
 *
 * `VehicleQueryDto` is the parsed shape and carries defaults the caller has already
 * applied; this alias exists only so the hook signature reads the same as its siblings
 * without importing a type the screen does not use.
 */
type VehicleQueryLike = Parameters<typeof api.vehicles.list>[0];

// ---- CRM — Phase 9 (FR-MKT-*) --------------------------------------------------------

export function useLeads(query: LeadQueryDto) {
  return useQuery({
    queryKey: listKey(keys.leads, query),
    queryFn: () => api.crm.list(query),
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(keys.leads, id ?? ''),
    queryFn: () => api.crm.get(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useLeadFunnel(query: LeadFunnelQueryDto) {
  return useQuery({
    queryKey: [...keys.leadFunnel, query],
    queryFn: () => api.crm.funnel(query),
  });
}

/**
 * Every key a lead mutation can affect.
 *
 * The funnel is on the list because advancing a lead to WON or LOST changes the
 * conversion rate the report shows, and `students` is there because FR-MKT-050's
 * conversion creates them — an Admin who converts a lead and then opens the student list
 * should not have to reload the page to see the children they just enrolled.
 */
export const CRM_KEYS: readonly (readonly string[])[] = [
  keys.leads,
  keys.leadFunnel,
  keys.students,
  keys.guardians,
];

// ---- Reporting — Phase 9 (FR-RPT-*) ---------------------------------------------------

/**
 * SDD §15.3's aggregate — one request for the whole first screen.
 *
 * `staleTime` matches the server's own sixty-second cache. Without it TanStack Query
 * would refetch on every window focus and get the identical cached body back, which is a
 * round trip per tab switch for a number that cannot have changed.
 */
export function useDashboard(query: DashboardQueryDto) {
  return useQuery({
    queryKey: [...keys.dashboard, query],
    queryFn: () => api.reporting.dashboard(query),
    staleTime: 60_000,
  });
}

export function useAttendanceReport(query: AttendanceReportQueryDto, enabled = true) {
  return useQuery({
    queryKey: [...keys.operationalReports, 'attendance', query],
    queryFn: () => api.reporting.attendance(query),
    enabled,
  });
}

export function usePunctualityReport(query: PunctualityReportQueryDto, enabled = true) {
  return useQuery({
    queryKey: [...keys.operationalReports, 'punctuality', query],
    queryFn: () => api.reporting.punctuality(query),
    enabled,
  });
}

export function useCrewActivityReport(query: OperationalReportQueryDto, enabled = true) {
  return useQuery({
    queryKey: [...keys.operationalReports, 'crew-activity', query],
    queryFn: () => api.reporting.crewActivity(query),
    enabled,
  });
}

export function useExceptionReport(query: OperationalReportQueryDto, enabled = true) {
  return useQuery({
    queryKey: [...keys.operationalReports, 'exceptions', query],
    queryFn: () => api.reporting.exceptions(query),
    enabled,
  });
}

/**
 * A dispatched operational PDF, polled until it is ready — FR-RPT-070.
 *
 * The twin of `useReportJob` in `finance-hooks`, against `/reports/jobs/:id`. Three
 * seconds while queued or running, then it stops: the job settles once and a screen that
 * kept polling a `READY` row would be asking the same question forever.
 */
export function useOperationalReportJob(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.operationalReports, 'job', id ?? ''],
    queryFn: () => api.reporting.job(id as string),
    enabled: id !== undefined,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'QUEUED' || status === 'RUNNING' ? 3_000 : false;
    },
  });
}

export type { UseQueryResult, Page };
