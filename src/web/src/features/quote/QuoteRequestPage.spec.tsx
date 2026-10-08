import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteFormDto } from '@servisapp/shared';
import { QuoteRequestPage } from './QuoteRequestPage';

/**
 * FR-MKT-010 and FR-MKT-070 — the public quote page.
 *
 * ## Why this screen gets a component test when most do not
 *
 * It is the only screen in the console reached by somebody who is **not a user**, and the
 * only one carrying a legal gate. FR-MKT-070 is *"shall obtain explicit consent **before**
 * submission"*, and the whole of that obligation is discharged by a tick box whose absence
 * a server-side test cannot see — the server refuses an unticked submission, but nothing
 * server-side proves the page never sends one.
 *
 * So the three assertions here are the three the API suite cannot make: the notice is
 * rendered, an unticked box does not produce a request, and a ticked one sends the
 * document identifier that was on screen.
 */

const FORM: QuoteFormDto = {
  tenantName: 'Yıldız Turizm',
  schools: [{ id: '01920000-0000-7000-8000-000000000001', name: 'Kadıköy İlkokulu' }],
  consent: {
    documentId: '01920000-0000-7000-8000-0000000000c1',
    version: 1,
    title: 'KVKK Aydınlatma Metni',
    bodyMd: '## Veri Sorumlusu\n\nServisApp veri sorumlusudur.',
  },
};

/**
 * A fetch that answers the form request and records every submission.
 *
 * Recording rather than asserting on a call count, because the interesting question is
 * *"was a request made at all"* — an unticked box must produce **none**, and a spy that
 * was merely not called with the right body would pass for a page that sent an empty one.
 */
function stubFetch(options: { formStatus?: number } = {}) {
  const submissions: unknown[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/quote-form')) {
        const status = options.formStatus ?? 200;
        return Promise.resolve({
          ok: status === 200,
          status,
          json: () =>
            Promise.resolve(
              status === 200
                ? FORM
                : { error: { code: 'QUOTE_PAGE_UNAVAILABLE', message: 'Yok.', requestId: 'x' } },
            ),
          headers: new Headers(),
        });
      }

      submissions.push(JSON.parse(String(init?.body ?? '{}')));
      return Promise.resolve({
        ok: true,
        status: 202,
        json: () => Promise.resolve({ accepted: true }),
        headers: new Headers(),
      });
    }),
  );

  return submissions;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/teklif/yildiz-turizm']}>
        <Routes>
          <Route path="/teklif/:slug" element={<QuoteRequestPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Fills everything except the consent box. */
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Ad soyad/), 'Ayşe Yılmaz');
  await user.type(screen.getByLabelText(/^Telefon/), '+905321112233');
  await user.type(screen.getByLabelText(/Okul adı/), 'Kadıköy İlkokulu');
  await user.type(screen.getByLabelText(/Oturduğunuz semt/), 'Kadıköy');
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('QuoteRequestPage (FR-MKT-010, FR-MKT-070)', () => {
  it('renders the KVKK notice above the tick box', async () => {
    stubFetch();
    renderPage();

    expect(await screen.findByText('KVKK Aydınlatma Metni')).toBeInTheDocument();
    expect(screen.getByText(/Veri Sorumlusu/)).toBeInTheDocument();
    expect(screen.getByLabelText(/açık rıza veriyorum/)).toBeInTheDocument();
  });

  it('names the company the enquiry is for', async () => {
    stubFetch();
    renderPage();

    expect(await screen.findByText(/Yıldız Turizm/)).toBeInTheDocument();
  });

  it('sends nothing when the consent box is not ticked — FR-MKT-070', async () => {
    // The gate is `z.literal(true)` in the schema both sides validate with, so there is
    // no `if (!consented)` on the page for anybody to delete. This asserts the outcome
    // rather than the mechanism.
    const submissions = stubFetch();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('KVKK Aydınlatma Metni');
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /Teklif iste/ }));

    // More than one alert: the field's own message and the form's summary. Both are the
    // point — the person is told which control is wrong, not only that something is.
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(submissions).toHaveLength(0);
  });

  it('submits with the document version that was on screen once it is ticked', async () => {
    // FR-MKT-070's evidence is *which* notice was consented to. A page that sent a
    // constant, or omitted it, would produce a record that says nothing.
    const submissions = stubFetch();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('KVKK Aydınlatma Metni');
    await fillForm(user);
    await user.click(screen.getByLabelText(/açık rıza veriyorum/));
    await user.click(screen.getByRole('button', { name: /Teklif iste/ }));

    await waitFor(() => expect(submissions).toHaveLength(1));
    expect(submissions[0]).toMatchObject({
      contactName: 'Ayşe Yılmaz',
      phone: '+905321112233',
      district: 'Kadıköy',
      kvkkConsent: true,
      consentDocumentId: FORM.consent.documentId,
    });
  });

  it('confirms without naming the lead it created', async () => {
    const submissions = stubFetch();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('KVKK Aydınlatma Metni');
    await fillForm(user);
    await user.click(screen.getByLabelText(/açık rıza veriyorum/));
    await user.click(screen.getByRole('button', { name: /Teklif iste/ }));

    expect(await screen.findByText(/Talebiniz alındı/)).toBeInTheDocument();
    expect(submissions).toHaveLength(1);
  });

  it('says one thing for every reason the page is closed', async () => {
    // An unknown slug, a tenant with the `crm` module off and a suspended tenant all
    // answer the same 404 (SDD §16's enumeration threat). This screen must not undo that
    // by rendering something more helpful for one of them.
    stubFetch({ formStatus: 404 });
    renderPage();

    expect(await screen.findByText(/Bu sayfa kullanılamıyor/)).toBeInTheDocument();
  });
});
