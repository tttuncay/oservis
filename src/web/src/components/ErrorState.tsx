import { AlertTriangle } from 'lucide-react';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';

/**
 * A failed request, rendered for a person.
 *
 * NFR-USA-060 — *"Error messages shall state the cause and the corrective action in
 * plain language, without technical codes."* So what is shown is `ApiError.message`, the
 * Turkish sentence the server wrote, and never `ApiError.code`. The code is for the
 * client's own branching and appears nowhere in the DOM.
 *
 * `requestId` is the one identifier that does surface, labelled as a support reference.
 * It is not a technical code in the sense the requirement forbids — it carries no
 * meaning to decode, and it is the only way a user can point support at the exact
 * request that failed.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const message = apiError?.message ?? t('error.INTERNAL_ERROR');

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertTriangle aria-hidden className="h-7 w-7 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium">{t('errorState.title')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        {apiError?.requestId ? (
          <p className="pt-1 text-xs text-muted-foreground">
            {t('errorState.requestId', { requestId: apiError.requestId })}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}
