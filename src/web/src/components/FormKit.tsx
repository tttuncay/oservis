import { createContext, useContext, useId } from 'react';
import {
  Controller,
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type Path,
  type SubmitHandler,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MutatingButton, MutatingFieldset } from '@/components/MutatingButton';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

/**
 * Forms — React Hook Form validated by the **shared** Zod schema (SDD §15.2), so client
 * and server apply the same rules.
 *
 * ## Same schema, not the same authority
 *
 * `packages/shared` holds one definition of "a valid plate" and both sides use it. That
 * makes the two agree by construction rather than by discipline: there is no second
 * regular expression here to drift from the server's.
 *
 * It does **not** make the client an authority. Everything validated here is validated
 * again by `ZodValidationPipe` on the way in, and a rule the client cannot see — the
 * common-password deny list, tenant writability, the assignment overlap constraint —
 * lives only on the server (SDD §1.2 P2). The client's copy exists to spare a round trip
 * and to put the error next to the field, not to decide anything.
 */

// ---- Form shell ---------------------------------------------------------------------

interface FormShellContext {
  /** Set from a failed mutation, shown above the buttons. */
  submitError: unknown;
}

const FormShellContext = createContext<FormShellContext>({ submitError: null });

export function Form<S extends z.ZodType<FieldValues>>({
  schema,
  defaultValues,
  onSubmit,
  submitError,
  submitLabel,
  onCancel,
  children,
  className,
}: {
  schema: S;
  defaultValues: DefaultValues<z.infer<S>>;
  onSubmit: SubmitHandler<z.infer<S>>;
  submitError?: unknown;
  submitLabel?: string;
  onCancel?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  type Values = z.infer<S>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
    // Validate on blur rather than on every keystroke: an error appearing under a field
    // the user is still halfway through typing is noise, not help.
    mode: 'onBlur',
  });

  const errorCount = Object.keys(form.formState.errors).length;

  return (
    <FormProvider {...form}>
      <FormShellContext.Provider value={{ submitError: submitError ?? null }}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn('space-y-5', className)}
        >
          {/* Every control inside is disabled when the tenant is READ_ONLY, including
              ones a screen forgot to wrap individually (FR-SYS-060). */}
          <MutatingFieldset className="space-y-5">{children}</MutatingFieldset>

          {errorCount > 0 ? (
            <p role="alert" className="text-sm text-destructive">
              {t('validation.summary', { count: errorCount })}
            </p>
          ) : null}

          <SubmitError />

          <div className="flex justify-end gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            ) : null}
            <MutatingButton type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('common.saving') : (submitLabel ?? t('common.save'))}
            </MutatingButton>
          </div>
        </form>
      </FormShellContext.Provider>
    </FormProvider>
  );
}

/**
 * The server's rejection, rendered as the Turkish sentence it sent (NFR-USA-060).
 *
 * Kept separate from the field errors because it is a different kind of failure: a
 * plate that is already taken, or a tenant gone read-only mid-edit, is something only
 * the server knew.
 */
function SubmitError() {
  const { submitError } = useContext(FormShellContext);
  if (!submitError) return null;

  const message =
    submitError instanceof ApiError ? submitError.message : t('error.INTERNAL_ERROR');

  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

// ---- Fields -------------------------------------------------------------------------

interface FieldShellProps {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string | undefined;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldShell({ label, hint, optional, error, htmlFor, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted-foreground">({t('common.optional')})</span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The message under a field.
 *
 * Zod's own messages are written for a developer and in English. They are mapped to the
 * catalogue by issue code where a mapping exists, and the raw message is the last
 * resort — a visible English sentence beats a blank space, and it is a bug report.
 */
function messageFor(error: { type?: string; message?: string } | undefined): string | undefined {
  if (!error) return undefined;

  switch (error.type) {
    case 'too_small':
      return error.message ?? t('validation.required');
    case 'invalid_type':
      return t('validation.required');
    default:
      return error.message ?? t('validation.required');
  }
}

export function TextField<V extends FieldValues>({
  name,
  label,
  hint,
  optional,
  type = 'text',
  placeholder,
}: {
  name: Path<V>;
  label: string;
  hint?: string;
  optional?: boolean;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'time';
  placeholder?: string;
}) {
  const id = useId();
  const { register, formState } = useFormContext<V>();
  const error = messageFor(formState.errors[name] as { type?: string; message?: string });

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      {...(hint ? { hint } : {})}
      {...(optional ? { optional } : {})}
    >
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        // `valueAsNumber` so a capacity reaches the schema as a number rather than as
        // the string an input always produces — `z.number()` would otherwise reject
        // every value the user typed correctly.
        {...register(name, type === 'number' ? { valueAsNumber: true } : {})}
      />
    </FieldShell>
  );
}

export function TextAreaField<V extends FieldValues>({
  name,
  label,
  hint,
  optional,
  rows,
}: {
  name: Path<V>;
  label: string;
  hint?: string;
  optional?: boolean;
  rows?: number;
}) {
  const id = useId();
  const { register, formState } = useFormContext<V>();
  const error = messageFor(formState.errors[name] as { type?: string; message?: string });

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      {...(hint ? { hint } : {})}
      {...(optional ? { optional } : {})}
    >
      <Textarea id={id} rows={rows ?? 3} aria-invalid={error !== undefined} {...register(name)} />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField<V extends FieldValues>({
  name,
  label,
  options,
  hint,
  optional,
  placeholder,
  onChange,
}: {
  name: Path<V>;
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const { control, formState } = useFormContext<V>();
  const error = messageFor(formState.errors[name] as { type?: string; message?: string });

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      {...(hint ? { hint } : {})}
      {...(optional ? { optional } : {})}
    >
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={(field.value as string | undefined) ?? ''}
            onValueChange={(val) => {
              field.onChange(val);
              onChange?.(val);
            }}
          >
            <SelectTrigger id={id} aria-invalid={error !== undefined}>
              <SelectValue placeholder={placeholder ?? t('common.none')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldShell>
  );
}

export function CheckboxField<V extends FieldValues>({
  name,
  label,
  hint,
}: {
  name: Path<V>;
  label: string;
  hint?: string;
}) {
  const id = useId();
  const { control } = useFormContext<V>();

  return (
    <div className="flex items-start gap-2.5">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Checkbox
            id={id}
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            className="mt-0.5"
          />
        )}
      />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** A two-column row, which is how every form in the console is laid out at 1280×720. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}
