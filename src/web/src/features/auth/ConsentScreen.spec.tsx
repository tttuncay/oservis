import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentDocumentDto, PendingConsentDto } from '@servisapp/shared';
import { useSessionStore } from '@/auth/session-store';
import { ConsentScreen } from './ConsentScreen';

const signOutMock = vi.fn();

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    signOut: signOutMock,
  }),
}));

function mockDoc(overrides: Partial<ConsentDocumentDto> = {}): ConsentDocumentDto {
  return {
    id: '01a00000-0000-7000-8000-000000000001',
    kind: 'KVKK_NOTICE',
    version: 1,
    locale: 'tr',
    title: 'KVKK Aydınlatma Metni',
    bodyMd: '## Kişisel Verilerin İşlenmesi\nServisApp kapsamında verileriniz işlenmektedir.',
    effectiveFrom: '2026-08-15T00:00:00.000Z',
    accepted: false,
    acceptedAt: null,
    ...overrides,
  };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConsentScreen />
    </QueryClientProvider>,
  );
}

describe('ConsentScreen (FR-KVK-010, FR-KVK-020)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    signOutMock.mockReset();
    useSessionStore.setState({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      consentRequired: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches pending documents and displays markdown content, title, and version', async () => {
    const doc = mockDoc();
    const pendingDto: PendingConsentDto = { documents: [doc] };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(pendingDto), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderScreen();

    expect(await screen.findByText('KVKK onayı gerekiyor')).toBeInTheDocument();
    expect(screen.getByText('KVKK Aydınlatma Metni')).toBeInTheDocument();
    expect(screen.getByText('Sürüm 1')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('Kişisel Verilerin İşlenmesi') &&
        content.includes('ServisApp kapsamında verileriniz işlenmektedir.'),
      ),
    ).toBeInTheDocument();
  });

  it('submits acceptance with document IDs and releases the consent gate', async () => {
    const doc1 = mockDoc({ id: '01a00000-0000-7000-8000-000000000001' });
    const doc2 = mockDoc({
      id: '01a00000-0000-7000-8000-000000000002',
      kind: 'EXPLICIT_CONSENT',
      title: 'Açık Rıza Beyanı',
    });

    // 1. GET /consent/pending
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ documents: [doc1, doc2] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    // 2. POST /consent/accept
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ documents: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderScreen();

    const acceptButton = await screen.findByRole('button', {
      name: 'Tümünü okudum, onaylıyorum',
    });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // Verify the POST body carries exact document IDs
    const postCall = fetchMock.mock.calls[1];
    const postInit = (postCall ? postCall[1] : undefined) as RequestInit;
    expect(JSON.parse(String(postInit.body))).toEqual({
      documentIds: [doc1.id, doc2.id],
    });

    // Verify sessionStore consentRequired is now false
    expect(useSessionStore.getState().consentRequired).toBe(false);
  });

  it('calls signOut when the user declines consent', async () => {
    const doc = mockDoc();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ documents: [doc] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderScreen();

    const declineButton = await screen.findByRole('button', {
      name: 'Onaylamıyorum, çıkış yap',
    });
    fireEvent.click(declineButton);

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('handles fetch errors gracefully and provides a retry button', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Servise ulaşılamıyor.' },
        }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      ),
    );

    renderScreen();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeInTheDocument();
  });
});
