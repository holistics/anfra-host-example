import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAgo, formatTime } from '../../model/format';

/** A moment in natural time that keeps up; the full time on hover. */
export function AgoTime({ at }: { at: Date | string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{formatAgo(at, now)}</span>
      </TooltipTrigger>
      <TooltipContent>{formatTime(at)}</TooltipContent>
    </Tooltip>
  );
}
