import { AppWindowMac, BadgeCheck } from 'lucide-react';
import type { AppEntry } from '@/lib/host';
import { iconOf } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface Props {
  app: AppEntry;
  className?: string;
}

/** A Data App's icon, from the manifest. Its endorsement is shown beside its name, by EndorsedMark. */
export function AppIcon({ app, className }: Props) {
  const Icon = iconOf(app.icon, AppWindowMac);
  return <Icon className={className} />;
}

/** An endorsed app's mark, for beside its name. */
export function EndorsedMark({ className }: { className?: string }) {
  return (
    <BadgeCheck
      role="img"
      aria-label="Endorsed"
      className={cn('ml-auto size-4 shrink-0 icon-success-default', className)}
    />
  );
}
