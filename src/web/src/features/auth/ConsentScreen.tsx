import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { useSessionStore } from '@/auth/session-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ErrorState';
import { t } from '@/i18n';

/**
 * FR-KVK-010 / FR-KVK-020 — the KVKK consent gate for the Web application (SDD §17.1).
 *
 * ## Accepting names the documents, not the kinds
 *
 * `POST /consent/accept` takes document identifiers rather than kinds (SDD §17.1), so a
 * client showing a cached screen cannot accept the *current* version without having
 * rendered it. This screen therefore passes back exactly the identifiers it was handed.
 *
 * ## The Markdown is rendered as formatted text
 *
 * `bodyMd` is Markdown (SDD §17.1). Displayed in a scrollable container with whitespace
 * preservation so headers, lists, and clauses remain clean and legible.
 *
 * ## Declining leaves the user signed out
 *
 * FR-KVK-020's refusal must leave somewhere to go. A user who would rather leave than
 * consent can sign out cleanly via `signOut()`. `POST /auth/logout` is explicitly exempt
 * from `ConsentGuard` on the server.
 */
export function ConsentScreen() {
  const { signOut } = useAuth();
  const setConsentRequired = useSessionStore((state) => state.setConsentRequired);
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const pendingQuery = useQuery({
    queryKey: ['consent-pending'],
    queryFn: () => api.consent.pending(),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: (documentIds: string[]) => api.consent.accept({ documentIds }),
    onSuccess: (data) => {
      setSubmitError(null);
      if (data.documents.length === 0) {
        setConsentRequired(false);
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== 'consent-pending',
        });
      } else {
        // Partial acceptance remaining (e.g. if new version arrived)
        void pendingQuery.refetch();
      }
    },
    onError: (err) => {
      setSubmitError(err);
    },
  });

  if (pendingQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (pendingQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md">
          <ErrorState
            error={pendingQuery.error}
            onRetry={() => void pendingQuery.refetch()}
          />
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              {t('mobile.consentDecline')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const documents = pendingQuery.data?.documents ?? [];

  // If there are no pending documents left, release the gate immediately
  if (documents.length === 0) {
    setConsentRequired(false);
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl shadow-md">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold">{t('mobile.consentRequiredTitle')}</CardTitle>
          <CardDescription>{t('mobile.consentRequiredBody')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {documents.map((doc) => (
            <section
              key={doc.id}
              aria-labelledby={`consent-doc-${doc.id}`}
              className="space-y-2 rounded-lg border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <h3 id={`consent-doc-${doc.id}`} className="text-sm font-semibold">
                  {doc.title}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {t('mobile.consentVersion', { version: doc.version })}
                </Badge>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-label={doc.title}
                className="max-h-60 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap"
              >
                {doc.bodyMd}
              </div>
            </section>
          ))}

          {submitError ? <ErrorState error={submitError} /> : null}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
              disabled={acceptMutation.isPending}
            >
              {t('mobile.consentDecline')}
            </Button>

            <Button
              type="button"
              onClick={() => acceptMutation.mutate(documents.map((d) => d.id))}
              disabled={acceptMutation.isPending || documents.length === 0}
            >
              {acceptMutation.isPending ? t('common.loading') : t('mobile.consentAcceptAll')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
