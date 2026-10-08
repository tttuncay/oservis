import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  ANNOUNCEMENT_SEVERITIES,
  type Announcement,
  type AnnouncementSeverity,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { useResourceMutation } from '@/api/hooks';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/money';
import { t } from '@/i18n';
import { platformKeys, useAnnouncements, useTenants } from './use-platform';

/**
 * FR-SYS-080 — *"publish global or per-Tenant announcements displayed on login."*
 *
 * ## The audience is a radio choice, not a nullable field
 *
 * *"Every company"* and *"one company"* are different acts, and a company picker that
 * happened to be empty would silently publish to the whole platform. The two are chosen
 * explicitly and the picker only appears for the second.
 *
 * ## Withdrawn rather than deleted
 *
 * There is no delete button here and there is no delete endpoint. What a company was told
 * is a fact about what they were told; withdrawing stops it appearing and leaves it in
 * this list, which is why the list has an *"include inactive"* switch rather than a
 * separate archive screen.
 *
 * ## The text is not translated, and the form says so
 *
 * This is the one user-facing string in the system that does not come from
 * `packages/i18n`, because a catalogue cannot hold a sentence nobody has written yet.
 * `languageHint` states it under the field rather than leaving an operator to discover
 * that their Turkish notice reached an English-speaking screen unchanged.
 */
export function AnnouncementsPage() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const announcements = useAnnouncements({ includeInactive, limit: 50 });
  const tenants = useTenants({ limit: 100 });

  const withdraw = useResourceMutation((id: string) => api.platform.withdrawAnnouncement(id), [
    platformKeys.announcements,
    platformKeys.myAnnouncements,
  ]);
  const republish = useResourceMutation((id: string) => api.platform.republishAnnouncement(id), [
    platformKeys.announcements,
    platformKeys.myAnnouncements,
  ]);

  const tenantName = (id: string | null): string =>
    id === null
      ? t('sysadmin.announcements.global')
      : (tenants.data?.find((tenant) => tenant.id === id)?.legalName ?? id);

  return (
    <>
      <PageHeader
        title={t('sysadmin.announcements.title')}
        description={t('sysadmin.announcements.subtitle')}
        actions={
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            {t('sysadmin.announcements.create')}
          </Button>
        }
      />

      <label className="mb-4 flex items-center gap-2 text-sm">
        <Checkbox
          checked={includeInactive}
          onCheckedChange={(checked) => setIncludeInactive(checked === true)}
        />
        {t('sysadmin.announcements.showInactive')}
      </label>

      {announcements.isError ? (
        <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
      ) : null}
      {withdraw.isError ? <ErrorState error={withdraw.error} /> : null}

      {announcements.data && announcements.data.length === 0 ? (
        <EmptyState
          title={t('sysadmin.announcements.empty')}
          body={t('sysadmin.announcements.subtitle')}
        />
      ) : null}

      <div className="grid gap-3">
        {(announcements.data ?? []).map((announcement) => (
          <Card key={announcement.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {announcement.title}
                  <SeverityBadge severity={announcement.severity} />
                  <StateBadge announcement={announcement} />
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tenantName(announcement.tenantId)} · {formatDate(announcement.publishAt.slice(0, 10))}
                  {announcement.expiresAt
                    ? ` – ${formatDate(announcement.expiresAt.slice(0, 10))}`
                    : ` · ${t('sysadmin.announcements.noExpiry')}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(announcement)}>
                  {t('common.edit')}
                </Button>
                {announcement.withdrawnAt === null ? (
                  <Button variant="outline" size="sm" onClick={() => withdraw.mutate(announcement.id)}>
                    {t('sysadmin.announcements.withdraw')}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => republish.mutate(announcement.id)}>
                    {t('sysadmin.announcements.republish')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{announcement.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {creating ? <AnnouncementDialog onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <AnnouncementDialog announcement={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function SeverityBadge({ severity }: { severity: AnnouncementSeverity }) {
  const variant =
    severity === 'CRITICAL' ? 'destructive' : severity === 'WARNING' ? 'warning' : 'secondary';

  return <Badge variant={variant}>{t(`sysadmin.announcements.severityValue.${severity}`)}</Badge>;
}

/**
 * Why an announcement is not currently on anybody's screen.
 *
 * Three reasons and they are different: somebody withdrew it, it has not started yet, or
 * it has run out. A single *"inactive"* badge would make the first two look like the
 * third, and the first two are the ones an operator has to act on.
 */
function StateBadge({ announcement }: { announcement: Announcement }) {
  const now = Date.now();

  if (announcement.withdrawnAt !== null) {
    return <Badge variant="outline">{t('sysadmin.announcements.withdrawn')}</Badge>;
  }
  if (Date.parse(announcement.publishAt) > now) {
    return <Badge variant="outline">{t('sysadmin.announcements.scheduled')}</Badge>;
  }
  if (announcement.expiresAt !== null && Date.parse(announcement.expiresAt) <= now) {
    return <Badge variant="outline">{t('sysadmin.announcements.expired')}</Badge>;
  }
  return null;
}

function AnnouncementDialog({
  announcement,
  onClose,
}: {
  announcement?: Announcement;
  onClose: () => void;
}) {
  const tenants = useTenants({ limit: 100 });

  const [global, setGlobal] = useState(announcement ? announcement.tenantId === null : true);
  const [tenantId, setTenantId] = useState(announcement?.tenantId ?? '');
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [severity, setSeverity] = useState<AnnouncementSeverity>(announcement?.severity ?? 'INFO');
  const [expiresAt, setExpiresAt] = useState(announcement?.expiresAt?.slice(0, 10) ?? '');

  const save = useResourceMutation(() => {
    // An empty date field is "no expiry", not the epoch. The end of the chosen day, so a
    // notice set to expire on the 30th is still showing on the morning of the 30th.
    const expiry = expiresAt.trim() === '' ? null : new Date(`${expiresAt}T23:59:59.000Z`).toISOString();

    return announcement
      ? api.platform.updateAnnouncement(announcement.id, { title, body, severity, expiresAt: expiry })
      : api.platform.createAnnouncement({
          tenantId: global ? null : tenantId,
          title,
          body,
          severity,
          expiresAt: expiry,
        });
  }, [platformKeys.announcements, platformKeys.myAnnouncements]);

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {announcement
              ? t('sysadmin.announcements.editTitle')
              : t('sysadmin.announcements.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* The audience is fixed once published: moving a notice between companies
              would change who was told what, after they were told it. */}
          {announcement ? null : (
            <div className="space-y-1.5">
              <Label>{t('sysadmin.announcements.audience')}</Label>
              <Select value={global ? 'GLOBAL' : 'TENANT'} onValueChange={(v) => setGlobal(v === 'GLOBAL')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">{t('sysadmin.announcements.global')}</SelectItem>
                  <SelectItem value="TENANT">{t('sysadmin.announcements.oneTenant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!announcement && !global ? (
            <div className="space-y-1.5">
              <Label>{t('sysadmin.tenants.title')}</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(tenants.data ?? []).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="announcementTitle">{t('sysadmin.announcements.announcementTitle')}</Label>
            <Input
              id="announcementTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="announcementBody">{t('sysadmin.announcements.body')}</Label>
            <Textarea
              id="announcementBody"
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('sysadmin.announcements.languageHint')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('sysadmin.announcements.severity')}</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as AnnouncementSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_SEVERITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`sysadmin.announcements.severityValue.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">{t('sysadmin.announcements.expiresAt')}</Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
          </div>

          {save.isError ? <ErrorState error={save.error} /> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={
                title.trim().length < 3 ||
                body.trim().length < 3 ||
                (!announcement && !global && tenantId === '') ||
                save.isPending
              }
              onClick={() => save.mutate(undefined as never, { onSuccess: onClose })}
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
