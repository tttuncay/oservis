import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import {
  createGuardianLinkSchema,
  type CreateGuardianLinkDto,
  type GuardianLink,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useGuardians, useResourceMutation, useStudentGuardians } from '@/api/hooks';
import { CheckboxField, FieldRow, Form, SelectField, TextField } from '@/components/FormKit';
import { MutatingButton } from '@/components/MutatingButton';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/i18n';

/**
 * FR-CMP-120 — *"designating for each: primary contact, authorisation to receive the
 * child, permission to view location, and notification preference"*.
 *
 * The four flags default the permissive way except `isPrimary`: a link created without
 * thought should still let a parent see their child and hear about them, and only "who do
 * we ring first" needs a deliberate choice. `isAuthorisedReceiver` is the one with a
 * safety consequence and it is asserted at drop-off, not here.
 */
export function StudentGuardiansPanel({ studentId }: { studentId: string }) {
  const query = useStudentGuardians(studentId);
  const [adding, setAdding] = useState(false);

  const unlink = useResourceMutation(
    (linkId: string) => api.students.unlinkGuardian(studentId, linkId),
    [keys.students, keys.guardians],
  );

  const confirm = useConfirm<GuardianLink>({
    title: () => t('guardianLink.removeTitle'),
    body: () => t('guardianLink.removeBody'),
    onConfirm: (link) => unlink.mutateAsync(link.id),
    pending: unlink.isPending,
  });

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const links = query.data ?? [];

  return (
    <div className="max-w-3xl space-y-4">
      {links.length === 0 && !adding ? (
        <EmptyState
          title={t('guardianLink.emptyTitle')}
          body={t('guardianLink.emptyBody')}
          action={
            <MutatingButton size="sm" onClick={() => setAdding(true)}>
              {t('guardianLink.add')}
            </MutatingButton>
          }
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {links.map((link) => (
            <li key={link.id} className="flex items-start gap-3 px-3 py-3 text-sm">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{link.guardianName}</span>
                  {link.isPrimary ? (
                    <Badge className="gap-1">
                      <Star aria-hidden className="h-3 w-3" />
                      {t('guardianLink.isPrimary')}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {link.guardianPhone ?? t('common.notSet')}
                  {link.relationship ? ` · ${link.relationship}` : ''}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {link.isAuthorisedReceiver ? (
                    <Badge variant="secondary">{t('guardianLink.isAuthorisedReceiver')}</Badge>
                  ) : null}
                  {link.canViewLocation ? (
                    <Badge variant="secondary">{t('guardianLink.canViewLocation')}</Badge>
                  ) : null}
                  {link.receivesNotifications ? (
                    <Badge variant="secondary">{t('guardianLink.receivesNotifications')}</Badge>
                  ) : null}
                </div>
              </div>

              <MutatingButton
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => confirm.ask(link)}
              >
                {t('common.remove')}
              </MutatingButton>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <GuardianLinkForm
          studentId={studentId}
          linkedUserIds={links.map((link) => link.userId)}
          onDone={() => setAdding(false)}
        />
      ) : links.length > 0 ? (
        <MutatingButton size="sm" variant="outline" onClick={() => setAdding(true)}>
          {t('guardianLink.add')}
        </MutatingButton>
      ) : null}

      {confirm.dialog}
    </div>
  );
}

function GuardianLinkForm({
  studentId,
  linkedUserIds,
  onDone,
}: {
  studentId: string;
  linkedUserIds: readonly string[];
  onDone: () => void;
}) {
  // **[V2 — Phase 11] Invited guardians belong in this list.**
  //
  // Until this phase the filter was `status: 'ACTIVE'`, because a pending applicant could
  // not be linked and offering them would have been a broken promise. FR-AUTH-180 inverts
  // that: an invited guardian is a shadow account the Admin is expected to configure
  // *before* the person has installed anything, and the server now admits them
  // (`MembershipService.assignableRoleIn`). Leaving the filter as it was would have made
  // the phase's own exit criterion unreachable from the console.
  //
  // The status is dropped rather than widened to two calls: `REJECTED` and `SUSPENDED`
  // rows are excluded below, where the reason for excluding each is visible.
  const guardians = useGuardians({ limit: 100, sort: 'fullName', dir: 'asc' });

  const options = useMemo(
    () =>
      (guardians.data?.data ?? [])
        // Already linked: the server answers `GUARDIAN_ALREADY_LINKED`, and excluding
        // them here is why the picker needs no `studentId` filter on the endpoint.
        .filter((guardian) => !linkedUserIds.includes(guardian.userId))
        // REJECTED — they declined the invitation, and configuring against them until an
        // Admin resends would quietly rebuild what they refused. SUSPENDED — FR-AUTH-130.
        // The server refuses both; excluding them here keeps the list honest.
        .filter(
          (guardian) => guardian.status === 'ACTIVE' || guardian.status === 'PENDING_APPROVAL',
        )
        .map((guardian) => ({
          value: guardian.userId,
          label: [
            guardian.fullName,
            guardian.phone,
            // An invited guardian has not accepted yet, and an Admin picking from a list
            // of names deserves to know which of them can actually open the application.
            guardian.status === 'PENDING_APPROVAL' ? t('invite.neverSignedIn') : null,
          ]
            .filter(Boolean)
            .join(' · '),
        })),
    [guardians.data, linkedUserIds],
  );

  const link = useResourceMutation(
    (values: CreateGuardianLinkDto) => api.students.linkGuardian(studentId, values),
    [keys.students, keys.guardians],
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <Form
          schema={createGuardianLinkSchema}
          defaultValues={
            {
              userId: '',
              relationship: undefined,
              isPrimary: false,
              isAuthorisedReceiver: true,
              canViewLocation: true,
              receivesNotifications: true,
            } as CreateGuardianLinkDto
          }
          submitError={link.error}
          onCancel={onDone}
          onSubmit={async (values) => {
            await link.mutateAsync(values as CreateGuardianLinkDto);
            onDone();
          }}
        >
          <FieldRow>
            <SelectField<CreateGuardianLinkDto>
              name="userId"
              label={t('guardianLink.choose')}
              options={options}
            />
            <TextField<CreateGuardianLinkDto>
              name="relationship"
              label={t('guardianLink.relationship')}
              optional
            />
          </FieldRow>

          <div className="space-y-2.5">
            <CheckboxField<CreateGuardianLinkDto>
              name="isPrimary"
              label={t('guardianLink.isPrimary')}
            />
            <CheckboxField<CreateGuardianLinkDto>
              name="isAuthorisedReceiver"
              label={t('guardianLink.isAuthorisedReceiver')}
            />
            <CheckboxField<CreateGuardianLinkDto>
              name="canViewLocation"
              label={t('guardianLink.canViewLocation')}
            />
            <CheckboxField<CreateGuardianLinkDto>
              name="receivesNotifications"
              label={t('guardianLink.receivesNotifications')}
            />
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
