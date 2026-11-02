import { AppWindowMac, BadgeCheck, Check } from 'lucide-react';
import type { AppEntry } from '@/lib/host';
import { iconOf } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface Props {
  app: AppEntry;
  className?: string;
  /** For the check, as its ring: the colour of what the icon sits on. */
  checkClassName?: string;
  /** Draw the check over the icon. Off where the caller shows the endorsement itself. */
  overlay?: boolean;
}

/** A Data App's icon, from the manifest, with a green check when it is endorsed. */
export function AppIcon({ app, className, checkClassName, overlay = true }: Props) {
  const Icon = iconOf(app.icon, AppWindowMac);
  if (!app.endorsed || !overlay) return <Icon className={className} />;
  return (
    // The check sits on the icon's bottom right, ringed in the surface's colour so it reads over it.
    <span className="relative flex shrink-0">
      <Icon className={cn('size-4', className)} />
      <span
        role="img"
        aria-label="Endorsed"
        title="Endorsed"
        className={cn(
          'absolute -right-1.5 -bottom-1.5 flex size-3 items-center justify-center rounded-full bg-success-default ring-[1.5px] ring-sidebar',
          checkClassName,
        )}
      >
        <Check className="size-2 stroke-[4] icon-on-fill" />
      </span>
    </span>
  );
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
