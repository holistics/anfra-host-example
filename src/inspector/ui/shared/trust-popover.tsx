import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LEVELS, TRUST_LEVELS, type Trust } from '../../model/trust';
import { HoverPopover } from './hover-popover';
import { toneText } from './tone';
import { TrustBars } from './trust-bars';

/** A trigger that opens the trust levels on hover (or click): where this app stands, then every level with what it means. */
export function TrustPopover({
  trust,
  children,
  label = 'About trust levels',
  side,
  align,
}: {
  trust: Trust;
  /** The trigger's content; a small (i) when omitted. */
  children?: ReactNode;
  label?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <HoverPopover
      side={side}
      align={align}
      className="w-80 p-0 text-sm font-normal tracking-normal normal-case"
      trigger={
        children ?? (
          <button
            type="button"
            aria-label={label}
            className="cursor-help text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="size-3" />
          </button>
        )
      }
    >
      <TrustLevels trust={trust} />
    </HoverPopover>
  );
}

/** The popover's body: the app's level and why, then the ladder of levels with the current one marked. */
function TrustLevels({ trust }: { trust: Trust }) {
  return (
    <>
      <div className="space-y-1 border-b px-3 py-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Trust level</p>
        <div className="flex items-center gap-2.5">
          <TrustBars trust={trust} />
          <p className={cn('font-semibold', toneText[trust.tone])}>
            Level {trust.level} · {TRUST_LEVELS[trust.level].name}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{trust.text}</p>
      </div>
      <div className="p-3">
        <p className="mb-1.5 text-xs text-muted-foreground">
          How far the numbers trace back to the semantic layer:
        </p>
        <ol className="space-y-1">
          {LEVELS.map((level) => {
            const { name, points, tone } = TRUST_LEVELS[level];
            const current = level === trust.level;
            return (
              <li
                key={level}
                aria-current={current ? 'true' : undefined}
                className={cn('flex gap-2.5 rounded-md px-2 py-1.5', current && 'bg-muted')}
              >
                <span className="pt-0.5">
                  <TrustBars trust={{ level, tone, text: '' }} size="sm" />
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-medium">
                    {level}. {name}
                  </span>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs leading-snug text-muted-foreground">
                    {points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
