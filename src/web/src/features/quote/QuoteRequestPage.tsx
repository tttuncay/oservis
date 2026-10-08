import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { createApiClient } from '@servisapp/contracts';
import { quoteRequestSchema, type QuoteRequestDto } from '@servisapp/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckboxField,
  FieldRow,
  Form,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/FormKit';
import { t } from '@/i18n';

/**
 * **FR-MKT-010 and FR-MKT-070** — the public quote-request page.
 *
 * ## It is outside `AdminLayout`, outside `RequireRole`, and on its own client
 *
 * Every other screen in this application lives under `/admin` behind `RequireRole` and
 * calls the shared `api` client — which reads the session store, sends a bearer token and
 * refreshes on a 401. None of that is right here. This page is reached by a stranger from
 * a link on a company's website, and pointing it at the authenticated client would mean a
 * prospective customer's browser sending whatever token happened to be in `localStorage`
 * to a public endpoint, and a 401 handler trying to refresh a session that does not exist.
 *
 * So it builds its **own** client, with `accessToken` returning null and no
 * `onUnauthorised`. That is not defensive coding; it is the same separation
 * `publicQuoteResource` makes in `@servisapp/contracts`, where the public methods are a
 * resource of their own precisely so a page like this can reach them and nothing else.
 *
 * ## The consent is a schema literal, not a state variable
 *
 * `quoteRequestSchema.kvkkConsent` is `z.literal(true)`, so an unticked box fails
 * validation in the same schema the server applies (FR-MKT-070, CLAUDE.md — one source of
 * truth). There is no `if (!consented) return` anywhere on this page, because there is
 * nowhere for one to be forgotten.
 *
 * ## Every failure looks the same
 *
 * An unknown slug, a tenant with the `crm` module off and a suspended tenant all answer
 * 404 `QUOTE_PAGE_UNAVAILABLE`, and this page renders one message for all three. That is
 * the server's decision (see `PublicQuoteService`) and this must not undo it by rendering
 * something more helpful for one of them.
 */
export function QuoteRequestPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);

  // Built once per slug. No token, no refresh — see the note above.
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api/v1',
        accessToken: () => null,
      }),
    [],
  );

  const form = useQuery({
    queryKey: ['public-quote-form', slug],
    queryFn: () => client.publicQuote.form(slug),
    // A closed page stays closed; retrying a 404 four times only delays the message.
    retry: false,
  });

  const submit = useMutation({
    mutationFn: (dto: QuoteRequestDto) => client.publicQuote.submit(slug, dto),
    onSuccess: () => setSubmitted(true),
  });

  if (form.isPending) {
    return <PublicShell>{t('common.loading')}</PublicShell>;
  }

  if (form.isError || !form.data) {
    return (
      <PublicShell title={t('quote.unavailableTitle')}>
        <p className="text-muted-foreground">{t('quote.unavailableBody')}</p>
      </PublicShell>
    );
  }

  if (submitted) {
    return (
      <PublicShell title={t('quote.successTitle')}>
        <p className="text-muted-foreground">{t('quote.successBody')}</p>
      </PublicShell>
    );
  }

  const { tenantName, schools, consent } = form.data;

  return (
    <PublicShell title={t('quote.title')}>
      <p className="mb-6 text-muted-foreground">
        {t('quote.subtitle', { company: tenantName })}
      </p>

      <Card>
        <CardContent className="pt-6">
          <Form
            schema={quoteRequestSchema}
            defaultValues={{
              contactName: '',
              phone: '',
              email: undefined,
              schoolId: undefined,
              schoolName: '',
              district: '',
              childCount: 1,
              message: undefined,
              // Unticked. `z.literal(true)` refuses the submission until it is not.
              kvkkConsent: undefined as unknown as true,
              // The version the page is rendering, so the record names what was shown.
              consentDocumentId: consent.documentId,
            }}
            onSubmit={(values) => submit.mutate(values)}
            submitError={submit.error}
            submitLabel={submit.isPending ? t('quote.submitting') : t('quote.submit')}
          >
            <FieldRow>
              <TextField name="contactName" label={t('quote.contactName')} />
              <TextField name="phone" label={t('quote.phone')} type="tel" placeholder="+905321234567" />
            </FieldRow>

            <TextField name="email" label={t('quote.email')} type="email" optional />

            {/*
              The school is picked where the prospect recognises one and typed otherwise.
              Both fields are shown rather than one being revealed by the other: a family
              at a school the company does not serve yet is the most valuable enquiry it
              receives, and hiding the free-text box behind a "not listed" option is one
              more thing between them and sending it.
            */}
            <FieldRow>
              <SelectField
                name="schoolId"
                label={t('quote.school')}
                optional
                placeholder={t('quote.schoolOther')}
                options={schools.map((school) => ({ value: school.id, label: school.name }))}
              />
              <TextField name="schoolName" label={t('quote.schoolName')} />
            </FieldRow>

            <FieldRow>
              <TextField name="district" label={t('quote.district')} />
              <TextField name="childCount" label={t('quote.childCount')} type="number" />
            </FieldRow>

            <TextAreaField name="message" label={t('quote.message')} optional rows={3} />

            {/* FR-MKT-070 — the notice is rendered **above** the tick box, in full. */}
            <section aria-labelledby="kvkk-notice" className="rounded-md border bg-muted/40 p-4">
              <h2 id="kvkk-notice" className="mb-2 text-sm font-semibold">
                {consent.title}
              </h2>
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {consent.bodyMd}
              </div>
            </section>

            <CheckboxField name="kvkkConsent" label={t('quote.consentCheckbox')} />
          </Form>
        </CardContent>
      </Card>
    </PublicShell>
  );
}

/**
 * The page's own chrome.
 *
 * Deliberately not `AdminLayout`: that shell carries a tenant switcher, an impersonation
 * banner and a navigation tree, every one of which reads a session this page does not
 * have.
 */
function PublicShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {title ? (
        <Card className="mb-6 border-0 shadow-none">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl">{title}</CardTitle>
          </CardHeader>
        </Card>
      ) : null}
      {children}
    </main>
  );
}
