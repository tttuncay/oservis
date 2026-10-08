import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useReadOnly } from '@/components/ReadOnlyProvider';
import { t } from '@/i18n';

/**
 * Every control that causes a write goes through this component (FR-SYS-060).
 *
 * ## Why a component rather than a rule
 *
 * "Remember to check `readOnly` before rendering a save button" is a rule, and rules get
 * forgotten on the twenty-third screen. A component cannot be forgotten in the same way:
 * the review question becomes "is this a plain `Button` where it should be a
 * `MutatingButton`", which is greppable, and the ESLint rule in `eslint.config.mjs`
 * makes it mechanical.
 *
 * The disabled control keeps its `title` so hovering says *why* it is disabled. A greyed
 * button with no explanation reads as a bug, and an Admin who thinks the panel is broken
 * raises a support ticket instead of paying an invoice.
 */
export const MutatingButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ disabled, title, ...props }, ref) => {
    const { readOnly } = useReadOnly();

    return (
      <Button
        ref={ref}
        disabled={disabled === true || readOnly}
        title={readOnly ? t('readOnly.controlDisabled') : title}
        {...props}
      />
    );
  },
);
MutatingButton.displayName = 'MutatingButton';

/**
 * The same guard for a whole form.
 *
 * A read-only tenant should not be able to submit by pressing Enter in a text field
 * either, and `fieldset[disabled]` disables every control inside it — including ones a
 * screen forgot to wrap.
 */
export function MutatingFieldset({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { readOnly } = useReadOnly();

  return (
    <fieldset
      disabled={readOnly}
      className={className}
      title={readOnly ? t('readOnly.controlDisabled') : undefined}
    >
      {children}
    </fieldset>
  );
}
