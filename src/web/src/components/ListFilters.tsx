import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { RECORD_STATUSES, type RecordStatus } from '@servisapp/shared';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/i18n';

/** The shared schemas reject a one-character term, so the filter waits for two. */
const MIN_SEARCH_LENGTH = 2;

/**
 * The search box every list carries.
 *
 * ## Debounced, and empty-or-valid only
 *
 * Filtering is the server's (SDD §15.2), so every keystroke is a request unless it is
 * held back. Three hundred milliseconds is long enough to swallow a burst of typing and
 * short enough not to feel laggy.
 *
 * A one-character term is never sent: `searchTermSchema` rejects it — a single character
 * matches most of a tenant and costs a full scan to return a page nobody can use — so
 * sending it would produce a 422 for a user who is simply still typing.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? '');

  // Held in a ref rather than listed as effect dependencies. A parent re-rendering gives
  // a new `onChange` identity on every render, and depending on it would restart the
  // timer each time — the debounce would never elapse and the filter would never fire.
  // The ref keeps the effect depending on the one thing that should restart it, the
  // text, while still calling the current callback.
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = text.trim();
      const next = trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : undefined;
      // Compared against the committed value so an unchanged term does not refetch.
      if (next !== latest.current.value) latest.current.onChange(next);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <div className="relative w-72">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        className="pl-8"
        aria-label={t('common.search')}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}

/** The sentinel for "no filter". Radix Select cannot carry an empty string value. */
const ANY = '__any__';

export function StatusFilter({
  value,
  onChange,
}: {
  value: RecordStatus | undefined;
  onChange: (next: RecordStatus | undefined) => void;
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => onChange(next === ANY ? undefined : (next as RecordStatus))}
    >
      <SelectTrigger className="w-44" aria-label={t('common.status')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t('common.all')}</SelectItem>
        {RECORD_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {t(`status.${status}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A generic single-choice filter, for the ones with no shared enum behind them. */
export function ChoiceFilter({
  value,
  onChange,
  options,
  label,
  width,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  options: readonly { value: string; label: string }[];
  label: string;
  width?: string;
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => onChange(next === ANY ? undefined : next)}
    >
      <SelectTrigger className={width ?? 'w-48'} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t('common.all')}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
