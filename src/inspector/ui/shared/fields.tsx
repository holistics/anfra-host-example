import type { ReactNode } from 'react';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

/** Label / value pairs, two columns. */
export function Fields({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">{children}</dl>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** A section's small uppercase title. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'block px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A line saying what is missing, and why. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <Empty className="flex-none gap-0 border bg-muted/30 p-4 md:p-4">
      <EmptyDescription className="text-xs">{children}</EmptyDescription>
    </Empty>
  );
}
