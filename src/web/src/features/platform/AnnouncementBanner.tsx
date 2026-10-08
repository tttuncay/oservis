import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import type { Announcement } from '@servisapp/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';
import { useMyAnnouncements } from './use-platform';

/**
 * FR-SYS-080's *"displayed on login"*, in the Admin shell.
 *
 * ## A banner in the shell rather than a field on the login response
 *
 * Two reasons, and both are about the second minute rather than the first. A notice
 * attached to `LoginResponse` disappears on the first page reload, and one published
 * while somebody is already working never reaches them at all. `GET /announcements` is
 * polled by the shell instead, so the notice survives a refresh and arrives without a
 * sign-out.
 *
 * ## Dismissal is per session and per announcement
 *
 * Held in component state, so it comes back tomorrow. Persisting it would mean a
 * sysadmin's maintenance warning could be dismissed once and never seen again by the one
 * person who needed to act on it; and a notice that cannot be put aside for the afternoon
 * is a notice people learn to look past.
 *
 * ## It never takes the shell down with it
 *
 * `useMyAnnouncements` does not retry and this renders nothing on failure. A banner that
 * broke the console because a *notice* could not be fetched would be the decoration
 * bringing down what it decorates.
 */
export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const { data } = useMyAnnouncements();

  const live = (data ?? []).filter((announcement) => !dismissed.includes(announcement.id));
  if (live.length === 0) return null;

  // One at a time. A stack of banners pushes the screen an operator came for below the
  // fold, and the count tells them there is more without doing that.
  const [first, ...rest] = live as [Announcement, ...Announcement[]];

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 border-b px-6 py-3 text-sm',
        first.severity === 'CRITICAL'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : first.severity === 'WARNING'
            ? 'border-warning/40 bg-warning/10'
            : 'bg-muted',
      )}
    >
      <Megaphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="font-medium">{first.title}</p>
        <p className="whitespace-pre-wrap">{first.body}</p>
        {rest.length > 0 ? (
          <p className="pt-1 text-xs opacity-80">
            {t('announcementBanner.more', { count: rest.length })}
          </p>
        ) : null}
      </div>

      <Button
        variant="ghost"
        size="sm"
        aria-label={t('announcementBanner.dismiss')}
        className="shrink-0"
        onClick={() => setDismissed([...dismissed, first.id])}
      >
        <X aria-hidden className="h-4 w-4" />
      </Button>
    </div>
  );
}
