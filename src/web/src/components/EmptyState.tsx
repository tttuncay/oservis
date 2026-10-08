import { Inbox } from 'lucide-react';

/**
 * What a list shows instead of an empty table.
 *
 * Two variants matter and they are different situations: nothing exists yet (say what
 * to do), or nothing matches the filters (say to change them). Showing the first when
 * the second is true leaves an Admin thinking their data is gone.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <Inbox aria-hidden className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
