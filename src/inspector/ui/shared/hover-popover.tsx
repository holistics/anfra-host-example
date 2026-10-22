import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Grace period so the pointer can travel from the trigger into the popover without it closing. */
const HOVER_CLOSE_DELAY_MS = 120;

/**
 * A popover a mouse opens by hovering its trigger, and a click or tap opens too, rather than
 * toggling: a click after the hover, or a tap's own pointerenter, would otherwise close it at once.
 * Escape or a click outside closes it.
 */
export function HoverPopover({
  trigger,
  children,
  side,
  align,
  className,
}: {
  /** One element, rendered as the trigger. */
  trigger: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Only a mouse hovers: a touch's pointerleave comes with the tap's end, and would close what it opened.
  const showOnHover = (event: PointerEvent) => event.pointerType === 'mouse' && show();
  const hideSoon = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onPointerEnter={showOnHover}
        onPointerLeave={hideSoon}
        // Prevented, Radix's own toggle doesn't run.
        onClick={(event) => {
          event.preventDefault();
          show();
        }}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        onPointerEnter={showOnHover}
        onPointerLeave={hideSoon}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={className}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
