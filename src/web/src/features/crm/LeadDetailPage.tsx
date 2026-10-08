import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LEAD_STATUSES,
  addLeadNoteSchema,
  convertLeadSchema,
  isLegalLeadTransition,
  type AddLeadNoteDto,
  type ConvertLeadDto,
  type LeadDetail,
  type LeadStatus,
  type LeadTimelineEntry,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { CRM_KEYS, useLead, useResourceMutation, useSchools } from '@/api/hooks';
import { ErrorState } from '@/components/ErrorState';
import { FieldRow, Form, SelectField, TextAreaField, TextField } from '@/components/FormKit';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n';

/**
 * One lead — FR-MKT-030's timeline and states, and FR-MKT-050's conversion.
 *
 * ## The buttons are derived from `isLegalLeadTransition`, not from a list on this page
 *
 * The same function the server enforces with (`@servisapp/shared`). A screen with its own
 * idea of which moves are legal would eventually offer one the server refuses, and the
 * Admin would learn about it from a 409 in the middle of a telephone call.
 *
 * That is a convenience, not an authority: the server checks it again (SDD §1.2 P2), and
 * every refusal here still renders the server's Turkish sentence rather than a guess.
 */
export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const query = useLead(leadId);
  const [converting, setConverting] = useState(false);

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  if (!query.data) {
    return <PageHeader title={t('common.loading')} />;
  }

  const lead = query.data;

  return (
    <>
      <PageHeader
        title={lead.contactName}
        actions={
          lead.status === 'WON' && lead.convertedAt === null ? (
            <MutatingButton onClick={() => setConverting(true)}>{t('crm.convert')}</MutatingButton>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <StageCard lead={lead} />
          <TimelineCard lead={lead} />
        </div>

        <DetailsCard lead={lead} onOpenStudent={(id) => navigate(`/admin/students/${id}`)} />
      </div>

      {converting ? (
        <ConvertDialog lead={lead} onClose={() => setConverting(false)} />
      ) : null}
    </>
  );
}

/** FR-MKT-030 — advancing the stage, and recording why where it was lost. */
function StageCard({ lead }: { lead: LeadDetail }) {
  const [pending, setPending] = useState<LeadStatus | null>(null);

  const advance = useResourceMutation(
    (input: { status: LeadStatus; reason?: string }) => api.crm.update(lead.id, input),
    CRM_KEYS,
  );

  const legal = LEAD_STATUSES.filter((candidate) => isLegalLeadTransition(lead.status, candidate));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {t('crm.status')}
          <Badge>{t(`leadStatus.${lead.status}`)}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {legal.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lead.convertedAt ? t('crm.converted') : t('crm.noRate')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {legal.map((candidate) => (
              <MutatingButton
                key={candidate}
                variant="outline"
                onClick={() =>
                  // LOST is the one move that has to say why (FR-MKT-030's notes), so it
                  // opens the reason field instead of firing straight away.
                  candidate === 'LOST'
                    ? setPending(candidate)
                    : void advance.mutateAsync({ status: candidate })
                }
              >
                {t(`leadStatus.${candidate}`)}
              </MutatingButton>
            ))}
          </div>
        )}

        {pending === 'LOST' ? (
          <Form
            schema={addLeadNoteSchema}
            defaultValues={{ body: '' }}
            submitError={advance.error}
            submitLabel={t('leadStatus.LOST')}
            onCancel={() => setPending(null)}
            onSubmit={async (values) => {
              await advance.mutateAsync({ status: 'LOST', reason: values.body });
              setPending(null);
            }}
          >
            <TextAreaField name="body" label={t('crm.lostReason')} rows={2} />
          </Form>
        ) : null}

        {/* FR-MKT-030's follow-up date, beside the stage it belongs to. */}
        <FollowUpField lead={lead} />
      </CardContent>
    </Card>
  );
}

function FollowUpField({ lead }: { lead: LeadDetail }) {
  const update = useResourceMutation(
    (followUpOn: string | null) => api.crm.update(lead.id, { followUpOn }),
    CRM_KEYS,
  );

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t('crm.followUpOn')}</span>
      <input
        type="date"
        aria-label={t('crm.followUpOn')}
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={lead.followUpOn ?? ''}
        onChange={(event) => void update.mutateAsync(event.target.value || null)}
      />
    </label>
  );
}

/** FR-MKT-030 — the notes and the state changes, in one ordered story. */
function TimelineCard({ lead }: { lead: LeadDetail }) {
  const addNote = useResourceMutation(
    (dto: AddLeadNoteDto) => api.crm.addNote(lead.id, dto),
    CRM_KEYS,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('crm.timeline')}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <ol className="space-y-3">
          {lead.timeline.map((entry) => (
            <li key={entry.id} className="border-l-2 pl-3 text-sm">
              <p className="text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString('tr-TR')}
                {entry.authorName ? ` · ${entry.authorName}` : ''}
              </p>
              <p>{describe(entry)}</p>
            </li>
          ))}
        </ol>

        <Form
          schema={addLeadNoteSchema}
          defaultValues={{ body: '' }}
          submitError={addNote.error}
          submitLabel={t('crm.addNote')}
          onSubmit={async (values) => {
            await addNote.mutateAsync(values);
          }}
        >
          <TextAreaField name="body" label={t('crm.note')} rows={2} />
        </Form>
      </CardContent>
    </Card>
  );
}

/**
 * One timeline entry as a sentence.
 *
 * A `CONVERSION` entry's body is a **count**, never the children's names: the timeline is
 * read by every Admin of the tenant, and the names are already on the student records
 * where the FR-KVK-100 policy governs who may see them.
 */
function describe(entry: LeadTimelineEntry): string {
  if (entry.kind === 'NOTE') return entry.body ?? '';

  if (entry.kind === 'CONVERSION') {
    return `${t('crm.converted')} · ${t('crm.convertedStudents')}: ${entry.body ?? '0'}`;
  }

  const from = entry.fromStatus ? t(`leadStatus.${entry.fromStatus}`) : '';
  const to = entry.toStatus ? t(`leadStatus.${entry.toStatus}`) : '';
  return entry.body ? `${from} → ${to} · ${entry.body}` : `${from} → ${to}`;
}

function DetailsCard({
  lead,
  onOpenStudent,
}: {
  lead: LeadDetail;
  onOpenStudent: (studentId: string) => void;
}) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{t('common.details')}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        <Row label={t('crm.phone')} value={lead.phone} />
        <Row label={t('crm.email')} value={lead.email ?? t('common.notSet')} />
        <Row label={t('crm.school')} value={lead.schoolName} />
        <Row label={t('crm.district')} value={lead.district} />
        <Row label={t('crm.childCount')} value={String(lead.childCount)} />
        <Row label={t('crm.source')} value={t(`leadSource.${lead.source}`)} />
        <Row
          label={t('crm.createdAt')}
          value={new Date(lead.createdAt).toLocaleDateString('tr-TR')}
        />
        {/*
          FR-MKT-070's evidence, as a date and nothing more. The document identifier, the
          address and the user agent are on the row for a KVKK complaint; they are not
          something to put on a screen.
        */}
        {lead.consentAcceptedAt ? (
          <Row
            label={t('quote.consentTitle')}
            value={new Date(lead.consentAcceptedAt).toLocaleDateString('tr-TR')}
          />
        ) : null}

        {lead.convertedStudentIds.length > 0 ? (
          <div className="pt-2">
            <p className="mb-1 text-muted-foreground">{t('crm.convertedStudents')}</p>
            <ul className="space-y-1">
              {lead.convertedStudentIds.map((studentId) => (
                <li key={studentId}>
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => onOpenStudent(studentId)}
                  >
                    {studentId.slice(0, 8)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/**
 * FR-MKT-050 — *"convert a WON Lead into a Student and Guardian record"*.
 *
 * The guardian fields are pre-filled from the lead and the children are typed here,
 * because a quote form captures *how many* children and never who they are — nobody types
 * their children's names into a web form, and a company that guessed them would be
 * inventing personal data about a minor.
 *
 * The number of rows is fixed at `childCount`: the server refuses a mismatch, and a form
 * that let an Admin add a sixth child to a four-child enquiry would be offering them a
 * 409.
 */
function ConvertDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc', status: 'ACTIVE' });

  const convert = useResourceMutation(
    (dto: ConvertLeadDto) => api.crm.convert(lead.id, dto),
    CRM_KEYS,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('crm.convert')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={convertLeadSchema}
          defaultValues={{
            guardian: {
              fullName: lead.contactName,
              phone: lead.phone,
              ...(lead.email ? { email: lead.email } : {}),
            },
            students: Array.from({ length: lead.childCount }, () => ({
              fullName: '',
              schoolId: lead.schoolId ?? '',
              className: undefined,
              dateOfBirth: undefined,
            })),
          }}
          onSubmit={async (values) => {
            await convert.mutateAsync(values);
            onClose();
          }}
          submitError={convert.error}
          submitLabel={t('crm.convert')}
          onCancel={onClose}
        >
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">{t('crm.guardian')}</legend>
            <FieldRow>
              <TextField name="guardian.fullName" label={t('crm.contactName')} />
              <TextField name="guardian.phone" label={t('crm.phone')} type="tel" />
            </FieldRow>
            <TextField name="guardian.email" label={t('crm.email')} type="email" optional />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">{t('crm.students')}</legend>
            {Array.from({ length: lead.childCount }, (_unused, index) => (
              <FieldRow key={index}>
                <TextField name={`students.${index}.fullName`} label={t('crm.studentName')} />
                <SelectField
                  name={`students.${index}.schoolId`}
                  label={t('crm.school')}
                  options={(schools.data?.data ?? []).map((school) => ({
                    value: school.id,
                    label: school.name,
                  }))}
                />
                <TextField
                  name={`students.${index}.className`}
                  label={t('crm.className')}
                  optional
                />
              </FieldRow>
            ))}
          </fieldset>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
