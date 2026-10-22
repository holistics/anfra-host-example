import { Info } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { LEVELS, TRUST_LEVELS, type Trust } from '../../model/trust';
import { toneText } from './tone';
import { TrustBars } from './trust-bars';

/** Grace period so the pointer can travel from the trigger into the popover without it closing. */
const HOVER_CLOSE_DELAY_MS = 120;

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
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onPointerEnter={show} onPointerLeave={hideSoon}>
        {children ?? (
          <button
            type="button"
            aria-label={label}
            className="cursor-help text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="size-3" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        onPointerEnter={show}
        onPointerLeave={hideSoon}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-80 p-0 text-sm font-normal tracking-normal normal-case"
      >
        <TrustLevels trust={trust} />
      </PopoverContent>
    </Popover>
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
