import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Announcement } from '@servisapp/shared';
import { AnnouncementBanner } from './AnnouncementBanner';

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: '01a00000-0000-7000-8000-000000000001',
    tenantId: null,
    title: 'Planlı bakım',
    body: 'Cumartesi 02:00-04:00 arası hizmet kesintisi olacaktır.',
    severity: 'INFO',
    publishAt: '2026-08-01T00:00:00.000Z',
    expiresAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    withdrawnAt: null,
    ...overrides,
  };
}

function respondWith(body: Announcement[] | null, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body ?? { error: { code: 'INTERNAL_ERROR', message: 'x' } }),
      headers: new Headers({ 'content-type': 'application/json' }),
    }),
  );
}

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <AnnouncementBanner />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * FR-SYS-080 — *"announcements displayed on login"*, in the shell rather than on the
 * login response.
 */
describe('AnnouncementBanner (FR-SYS-080)', () => {
  it('shows the notice the server sent', async () => {
    respondWith([announcement()]);

    renderBanner();

    expect(await screen.findByText('Planlı bakım')).toBeInTheDocument();
    expect(
      screen.getByText('Cumartesi 02:00-04:00 arası hizmet kesintisi olacaktır.'),
    ).toBeInTheDocument();
  });

  /**
   * One banner at a time. A stack of them pushes the screen an operator came for below
   * the fold, and the count is what tells them there is more without doing that.
   */
  it('shows one at a time and counts the rest', async () => {
    respondWith([
      announcement(),
      announcement({ id: 'b', title: 'İkinci duyuru' }),
      announcement({ id: 'c', title: 'Üçüncü duyuru' }),
    ]);

    renderBanner();

    expect(await screen.findByText('Planlı bakım')).toBeInTheDocument();
    expect(screen.queryByText('İkinci duyuru')).not.toBeInTheDocument();
    expect(screen.getByText('2 duyuru daha')).toBeInTheDocument();
  });

  it('reveals the next one when the first is dismissed', async () => {
    respondWith([announcement(), announcement({ id: 'b', title: 'İkinci duyuru' })]);

    renderBanner();

    fireEvent.click(await screen.findByRole('button', { name: 'Kapat' }));

    expect(await screen.findByText('İkinci duyuru')).toBeInTheDocument();
  });

  it('renders nothing at all when there is nothing to say', async () => {
    respondWith([]);

    const { container } = renderBanner();

    // Awaited so the query has resolved before the absence is asserted — otherwise this
    // would pass on the render that happens before the fetch, whatever the fetch said.
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * The decoration must never take down what it decorates. `useMyAnnouncements` does not
   * retry and the banner renders nothing on failure, so a console whose announcement
   * endpoint is broken is a console without a banner rather than a blank page.
   */
  it('renders nothing when the endpoint fails', async () => {
    respondWith(null, false);

    const { container } = renderBanner();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });
});
