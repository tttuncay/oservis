import { createContext, useContext, useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { TenantStatus } from '@servisapp/shared';
import { useAuth } from '@/auth/AuthProvider';
import { t } from '@/i18n';

interface ReadOnlyContextValue {
  /** True when the tenant may be read but not written (FR-SYS-060). */
  readOnly: boolean;
  /** The Turkish sentence explaining why, or null when writing is permitted. */
  reason: string | null;
  status: TenantStatus | null;
}

const ReadOnlyContext = createContext<ReadOnlyContextValue>({
  readOnly: false,
  reason: null,
  status: null,
});

/**
 * FR-SYS-060 — *"users shall retain the ability to view existing data and complete
 * in-progress trips, but shall not create or modify records"*.
 *
 * ## This is a courtesy, not the enforcement
 *
 * The server refuses every write from a `READ_ONLY` or `SUSPENDED` tenant, in
 * `TenantService.assertWritable`, called by every write path in the system. That is the
 * enforcement, and it holds whatever the browser does (SDD §1.2 P2).
 *
 * What this provider adds is that the Admin finds out *before* filling in a form rather
 * than after submitting it, and is told why rather than shown a bare 403. The two answer
 * different questions and the client's one is not load-bearing.
 *
 * The status comes from `MeResponse.memberships`, which the server evaluates — the
 * console never infers it.
 */
export function ReadOnlyProvider({ children }: { children: React.ReactNode }) {
  const { membership } = useAuth();
  const status = membership?.tenantStatus ?? null;

  const value = useMemo<ReadOnlyContextValue>(() => {
    if (status === 'READ_ONLY') {
      return { readOnly: true, reason: t('readOnly.body'), status };
    }
    // A suspended tenant is read-only too, and for a reason worth stating differently:
    // `READ_ONLY` is a payment state one call fixes, suspension is not.
    if (status === 'SUSPENDED') {
      return { readOnly: true, reason: t('readOnly.suspendedBody'), status };
    }
    return { readOnly: false, reason: null, status };
  }, [status]);

  return (
    <ReadOnlyContext.Provider value={value}>
      {value.readOnly ? <ReadOnlyNotice reason={value.reason ?? ''} /> : null}
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly(): ReadOnlyContextValue {
  return useContext(ReadOnlyContext);
}

/**
 * Stated once at the top of the console, in addition to each disabled control's own
 * explanation. A tooltip on a greyed-out button is easy to miss; a banner is not.
 */
function ReadOnlyNotice({ reason }: { reason: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-amber-300 bg-amber-50 px-6 py-3 text-amber-900"
    >
      <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-0.5 text-sm">
        <p className="font-medium">{t('readOnly.title')}</p>
        <p className="text-amber-800">{reason}</p>
      </div>
    </div>
  );
}
