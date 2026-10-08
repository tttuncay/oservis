import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { emailSchema } from '@servisapp/shared';
import type { AccessNotice } from '@servisapp/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, TextField } from '@/components/FormKit';
import { useAuth } from './AuthProvider';
import { t } from '@/i18n';

/**
 * FR-AUTH-080 — web roles sign in by email.
 *
 * The `surface` discriminator is set to `web` by the client, never chosen by the user:
 * the shared `loginSchema` is a discriminated union precisely so which identifier is
 * checked against which role set is decided by the shape rather than by a runtime
 * branch. It is also what gives this session twelve hours rather than thirty days
 * (NFR-SEC-090).
 */
const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<AccessNotice | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {notice ? (
            // FR-FLG-030 — a 200 carrying an explanation, rendered as a message and not
            // as an error screen. The user did nothing wrong.
            <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
              {notice.message}
            </p>
          ) : null}

          <Form
            schema={loginFormSchema}
            defaultValues={{ email: '', password: '' }}
            submitError={error}
            submitLabel={t('login.submit')}
            onSubmit={async (values: LoginFormValues) => {
              setError(null);
              setNotice(null);
              try {
                const response = await signIn(values.email, values.password);

                if (!response.tokens) {
                  // No tokens and no notice means the membership is still pending
                  // (FR-AUTH-030) — the account exists but reaches nothing yet.
                  setNotice(
                    response.access ?? {
                      blocked: true,
                      flag: 'parent_app',
                      message: t('login.noAccess'),
                    },
                  );
                  return;
                }

                // A Sysadmin's console is not the Admin one, and they hold no membership
                // to render it with (SDD §4.4). Sending them to `/admin` would bounce
                // off `RequireRole` straight back to this screen.
                navigate(response.me.platformRole === 'SYSADMIN' ? '/sysadmin' : '/admin', {
                  replace: true,
                });
              } catch (cause) {
                setError(cause);
              }
            }}
          >
            <TextField<LoginFormValues> name="email" label={t('login.email')} type="email" />
            <TextField<LoginFormValues>
              name="password"
              label={t('login.password')}
              type="password"
            />
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
