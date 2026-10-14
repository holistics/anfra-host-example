import { cn } from '@/lib/utils';
import { LEVELS, type Trust } from '../../model/trust';
import { toneFill } from './tone';

/** The trust meter: one rising bar per level, filled up to the one reached. */
export function TrustBars({ trust, size = 'md' }: { trust: Trust; size?: 'sm' | 'md' }) {
  const [base, rise] = size === 'sm' ? [4, 8] : [12, 16];
  return (
    <span className={cn('flex items-end', size === 'sm' ? 'gap-px' : 'gap-0.5')} aria-hidden>
      {LEVELS.map((level) => (
        <span
          key={level}
          style={{ height: `${base + ((level - 1) * rise) / (LEVELS.length - 1)}px` }}
          className={cn(
            'rounded-sm',
            size === 'sm' ? 'w-[3px]' : 'w-2',
            // Small bars sit on a row's hover color, which hides bg-muted.
            level <= trust.level
              ? toneFill[trust.tone]
              : size === 'sm'
                ? 'bg-muted-foreground/25'
                : 'bg-muted',
          )}
        />
      ))}
    </span>
  );
}
