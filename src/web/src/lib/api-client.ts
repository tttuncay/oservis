import { isApiErrorBody, type ApiErrorBody, type ErrorCode } from '@servisapp/shared';
import { t } from '@/i18n';

/**
 * Thrown for any non-2xx response.
 *
 * Carries the stable machine code so callers switch on `code`, never on message text
 * (FR-INT-040). `requestId` is surfaced in the UI on unexpected failures so a user can
 * quote it in a support request and it can be found in the logs.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    override readonly message: string,
    readonly status: number,
    readonly requestId: string | null,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Fetch wrapper that understands the FR-INT-040 error body.
 *
 * A response that is not JSON, or is JSON in an unexpected shape, still produces an
 * `ApiError` with a Turkish message — a network failure or a proxy error page must not
 * surface to the user as a raw exception.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      credentials: 'include',
    });
  } catch (cause) {
    throw new ApiError('SERVICE_UNAVAILABLE', t('error.SERVICE_UNAVAILABLE'), 0, null, {
      cause: String(cause),
    });
  }

  const requestId = response.headers.get('x-request-id');
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw toApiError(payload, response.status, requestId);
  }

  return payload as T;
}

function toApiError(payload: unknown, status: number, requestId: string | null): ApiError {
  if (isApiErrorBody(payload)) {
    const { error } = payload as ApiErrorBody;
    return new ApiError(
      error.code,
      error.message,
      status,
      error.requestId ?? requestId,
      error.details,
    );
  }

  const code: ErrorCode = status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  return new ApiError(code, t(`error.${code}`), status, requestId);
}
