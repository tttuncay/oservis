import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { t } from '@/i18n';

/**
 * FR-SYS-100 — *"a persistent, unmissable banner naming the tenant and remaining session
 * time"* (SDD §15.2).
 *
 * ## Why it survives a reload
 *
 * The session is described by `GET /auth/me`, not held in the page. `MeResponse` carries
 * `impersonation: { tenantName, reason, expiresAt } | null` — added in Phase 3 for
 * exactly this, because `isImpersonating` alone is a boolean and after a reload the
 * banner could say *that* a support session was running but not whose company it was or
 * how long was left. Which is the difference between a warning and a decoration.
 *
 * ## Why the countdown is computed here
 *
 * From `expiresAt`, once a second. Not from a duration sent at page load: a tab left
 * open would show a number frozen at whatever it was when the page rendered, which is
 * worse than no number because it looks live.
 */
export function ImpersonationBanner() {
  const { me } = useAuth();
  const session = me?.impersonation ?? null;
  const remaining = useCountdown(session?.expiresAt ?? null);

  if (!session) return null;

  return (
    <div
      role="alert"
      // Persistent and unmissable: it sits above the shell, it is not dismissible, and
      // it does not scroll away.
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-1 bg-destructive px-6 py-2.5 text-sm text-destructive-foreground"
    >
      <span className="flex items-center gap-2 font-semibold">
        <ShieldAlert aria-hidden className="h-4 w-4" />
        {t('impersonation.title')}
      </span>

      <span>{t('impersonation.body', { company: session.tenantName })}</span>
      <span className="opacity-90">{t('impersonation.reason', { reason: session.reason })}</span>

      <span className="ml-auto font-mono font-semibold tabular-nums">
        {remaining === null
          ? t('impersonation.expired')
          : remaining.minutes > 0
            ? t('impersonation.remaining', { minutes: remaining.minutes })
            : t('impersonation.remainingSeconds', { seconds: remaining.seconds })}
      </span>
    </div>
  );
}

/**
 * Time left until `expiresAt`, ticking each second, or `null` once it has passed.
 *
 * The last minute is shown in seconds. Sixty minutes is a hard stop nobody can extend
 * (FR-SYS-100), so a sysadmin about to lose the session mid-task should be able to see
 * it coming precisely rather than watch "1 min" sit there for sixty seconds.
 */
function useCountdown(expiresAt: string | null): { minutes: number; seconds: number } | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return null;

  const totalSeconds = Math.floor(remainingMs / 1_000);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}
