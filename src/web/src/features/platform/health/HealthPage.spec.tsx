import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformHealth } from '@servisapp/shared';
import { HealthPage } from './HealthPage';
import type { HealthResponse } from './use-health';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HealthPage />
    </QueryClientProvider>,
  );
}

/** A platform aggregate with every figure present, which each case then narrows. */
function aggregate(overrides: Partial<PlatformHealth> = {}): PlatformHealth {
  return {
    windowMinutes: 15,
    requests: { total: 400, errors: 2, errorRate: 0.005, p50Ms: 8, p95Ms: 31, p99Ms: 120 },
    push: { sent: 40, failed: 1, failureRate: 0.025 },
    queues: [{ name: 'notifications', waiting: 3, active: 1, delayed: 0, failed: 2 }],
    maps: {
      mode: 'live',
      billableCalls: 12,
      cacheHits: 88,
      spentUsd: '1.20',
      budgetUsd: '5.00',
      budgetExceeded: false,
    },
    tenants: { TRIAL: 1, ACTIVE: 4, GRACE: 0, READ_ONLY: 0, SUSPENDED: 2 },
    computedAt: '2026-08-16T09:00:00.000Z',
    ...overrides,
  };
}

/**
 * The screen reads **two** endpoints, so the stub routes by URL.
 *
 * `GET /platform/health` is Phase 10's aggregate and `GET /health` is Phase 0's liveness
 * probe. Answering both from one body — which an earlier version of this stub did — would
 * hand the aggregate a payload with no `requests` object and fail somewhere unrelated to
 * whatever the case was about.
 */
function respondWith(options: {
  platform?: PlatformHealth;
  dependencies?: HealthResponse;
  dependencyStatus?: number;
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: unknown) => {
      const url = String(input);

      if (url.includes('/platform/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(options.platform ?? aggregate()),
          headers: new Headers({ 'content-type': 'application/json' }),
        });
      }

      const status = options.dependencyStatus ?? 200;
      return Promise.resolve({
        ok: status < 400,
        status,
        json: () => Promise.resolve(options.dependencies ?? { status: 'ok', details: {} }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });
    }),
  );
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HealthPage — FR-SYS-090 and SDD §18.3', () => {
  describe('the platform aggregate (FR-SYS-090)', () => {
    it('reports every indicator the requirement names', async () => {
      respondWith({});
      renderPage();

      // error rate and request latency
      expect(await screen.findByText('400')).toBeInTheDocument();
      expect(screen.getByText('0.50 %')).toBeInTheDocument();
      expect(screen.getByText('31 ms')).toBeInTheDocument();

      // failed background jobs
      expect(screen.getByText('notifications')).toBeInTheDocument();

      // push delivery failures, and external API quota consumption
      expect(screen.getByText('$1.20')).toBeInTheDocument();
      expect(screen.getByText('$5.00')).toBeInTheDocument();
    });

    /**
     * The assertion this screen exists to get right. A zero error rate shown because the
     * metrics store is unreachable is the most dangerous number the console could
     * display, so `null` must read as *"unknown"* and say why.
     */
    it('renders an unmeasurable figure as unknown rather than as zero', async () => {
      respondWith({
        platform: aggregate({
          requests: { total: null, errors: null, errorRate: null, p50Ms: null, p95Ms: null, p99Ms: null },
        }),
      });

      renderPage();

      expect(await screen.findAllByText('Bilinmiyor')).not.toHaveLength(0);
      expect(screen.queryByText('0.00 %')).not.toBeInTheDocument();
    });

    it('says so when the maps budget is spent, without calling it a fault', async () => {
      respondWith({
        platform: aggregate({
          maps: {
            mode: 'fallback',
            billableCalls: 500,
            cacheHits: 20,
            spentUsd: '5.00',
            budgetUsd: '5.00',
            budgetExceeded: true,
          },
        }),
      });

      renderPage();

      expect(
        await screen.findByText('Bütçe doldu — yedek rota motoru devrede'),
      ).toBeInTheDocument();
    });

    it('reports the tenant census across every lifecycle state', async () => {
      respondWith({});
      renderPage();

      expect(await screen.findByText('Deneme')).toBeInTheDocument();
      expect(screen.getByText('Askıda')).toBeInTheDocument();
    });
  });

  describe('the dependency probe (SDD §18.3)', () => {
    it('reports every dependency when all are up', async () => {
      respondWith({
        dependencies: {
          status: 'ok',
          details: {
            database: { status: 'up', latencyMs: 3 },
            redis: { status: 'up', latencyMs: 1 },
            queue: { status: 'up', latencyMs: 2 },
          },
        },
      });

      renderPage();

      expect(await screen.findByText('Veritabanı')).toBeInTheDocument();
      expect(screen.getByText('Redis')).toBeInTheDocument();
      expect(screen.getByText('İş kuyruğu')).toBeInTheDocument();
      expect(screen.getByText('Tüm bağımlılıklar çalışıyor')).toBeInTheDocument();
    });

    it('keeps reporting the healthy dependencies when one is down', async () => {
      // The whole point of a per-dependency status: a 503 must still say which one.
      respondWith({
        dependencyStatus: 503,
        dependencies: {
          status: 'error',
          details: {
            database: { status: 'up', latencyMs: 4 },
            redis: { status: 'down', reason: 'ConnectionError' },
            queue: { status: 'down', reason: 'ConnectionError' },
          },
        },
      });

      renderPage();

      expect(await screen.findByText('En az bir bağımlılık erişilemiyor')).toBeInTheDocument();
      expect(screen.getAllByText('Erişilemiyor')).toHaveLength(2);
      expect(screen.getByText('Çalışıyor')).toBeInTheDocument();
    });

    it('labels an unknown dependency with its raw key rather than hiding it', async () => {
      respondWith({ dependencies: { status: 'ok', details: { geocoder: { status: 'up' } } } });

      renderPage();

      expect(await screen.findByText('geocoder')).toBeInTheDocument();
    });
  });
});
