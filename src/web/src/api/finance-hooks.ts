import { useQuery } from '@tanstack/react-query';
import type {
  ExpenseQueryDto,
  FeePlanQueryDto,
  InstalmentQueryDto,
  OccupancyQueryDto,
  ReceivablesQueryDto,
  ReportRangeDto,
  StudentFeeQueryDto,
} from '@servisapp/shared';
import { api } from './client';
import { keys } from './hooks';

/**
 * Finance queries — FR-FIN-*.
 *
 * Separate from `hooks.ts` because that file already carries every Phase 2 resource and
 * a module's worth of finance would bury them. The key registry stays shared, so
 * invalidation still has one home.
 */

function listKey(resource: readonly string[], query: object) {
  return [...resource, 'list', query] as const;
}

function detailKey(resource: readonly string[], id: string) {
  return [...resource, 'detail', id] as const;
}

// ---- Fee plans and settings ---------------------------------------------------------

export function useFeePlans(query: FeePlanQueryDto) {
  return useQuery({
    queryKey: listKey(keys.feePlans, query),
    queryFn: () => api.finance.feePlans.list(query),
  });
}

export function useFinanceSettings() {
  return useQuery({
    queryKey: keys.financeSettings,
    queryFn: () => api.finance.settings.get(),
  });
}

// ---- Student fees -------------------------------------------------------------------

export function useStudentFees(query: StudentFeeQueryDto) {
  return useQuery({
    queryKey: listKey(keys.studentFees, query),
    queryFn: () => api.finance.studentFees.list(query),
  });
}

export function useStudentFee(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(keys.studentFees, id ?? ''),
    queryFn: () => api.finance.studentFees.get(id as string),
    enabled: id !== undefined,
  });
}

/**
 * FR-FIN-060 — the termination proposal.
 *
 * Fetched only while a date has been chosen: the preview is what the Admin reads before
 * committing, and asking for one with no date would be a request the server must refuse.
 */
export function useTerminationPreview(
  feeId: string | undefined,
  effectiveDate: string | undefined,
) {
  return useQuery({
    queryKey: [...keys.studentFees, 'termination', feeId ?? '', effectiveDate ?? ''] as const,
    queryFn: () =>
      api.finance.studentFees.terminationPreview(feeId as string, effectiveDate as string),
    enabled: feeId !== undefined && effectiveDate !== undefined,
  });
}

// ---- Instalments and payments -------------------------------------------------------

export function useInstalments(query: InstalmentQueryDto) {
  return useQuery({
    queryKey: listKey(keys.instalments, query),
    queryFn: () => api.finance.instalments.list(query),
  });
}

/** Reversals and refunds included, with their signs — the audit view (FR-FIN-090). */
export function useInstalmentPayments(instalmentId: string | undefined) {
  return useQuery({
    queryKey: [...keys.payments, 'instalment', instalmentId ?? ''] as const,
    queryFn: () => api.finance.instalments.payments(instalmentId as string),
    enabled: instalmentId !== undefined,
  });
}

// ---- Expenses -----------------------------------------------------------------------

export function useExpenses(query: ExpenseQueryDto) {
  return useQuery({
    queryKey: listKey(keys.expenses, query),
    queryFn: () => api.finance.expenses.list(query),
  });
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: keys.recurringExpenses,
    queryFn: () => api.finance.recurringExpenses.list(),
  });
}

// ---- Reports ------------------------------------------------------------------------

export function useIncomeExpenseReport(query: ReportRangeDto) {
  return useQuery({
    queryKey: [...keys.financeReports, 'income-expense', query] as const,
    queryFn: () => api.finance.reports.incomeExpense(query),
  });
}

export function useReceivablesReport(query: ReceivablesQueryDto) {
  return useQuery({
    queryKey: [...keys.financeReports, 'receivables', query] as const,
    queryFn: () => api.finance.reports.receivables(query),
  });
}

export function useVehicleProfitReport(query: ReportRangeDto) {
  return useQuery({
    queryKey: [...keys.financeReports, 'vehicle-profit', query] as const,
    queryFn: () => api.finance.reports.vehicleProfit(query),
  });
}

export function useOccupancyReport(query: OccupancyQueryDto) {
  return useQuery({
    queryKey: [...keys.financeReports, 'occupancy', query] as const,
    queryFn: () => api.finance.reports.occupancy(query),
  });
}

export function useStudentStatement(studentId: string | undefined, academicYear?: string) {
  return useQuery({
    queryKey: [...keys.financeReports, 'statement', studentId ?? '', academicYear ?? ''] as const,
    queryFn: () => api.finance.reports.studentStatement(studentId as string, academicYear),
    enabled: studentId !== undefined,
  });
}

/**
 * A dispatched export, polled until it is ready — NFR-PER-080.
 *
 * Polls every three seconds while the job is queued or running and stops as soon as it
 * settles. Phase 8's notification module will push the same completion; polling is the
 * degraded path (SDD §1.2 P5), not a placeholder.
 */
export function useReportJob(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.financeReports, 'job', id ?? ''] as const,
    queryFn: () => api.finance.reports.job(id as string),
    enabled: id !== undefined,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'QUEUED' || status === 'RUNNING' ? 3_000 : false;
    },
  });
}
