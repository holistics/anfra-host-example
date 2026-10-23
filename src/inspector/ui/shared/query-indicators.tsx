import type { InspectedQuery, QueryDeclaration } from '@holistics/anfra-sdk/common';
import { ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { plural } from '../../model/format';
import { declaredFilters, isActive, type QueryInput } from '../../model/inputs';
import { queryTrust, TRUST_LEVELS } from '../../model/trust';
import { stateDot } from './tone';
import { TrustBars } from './trust-bars';

/** Every filter a query has, declared or fed by a control or a selection, and the ones narrowing it now. */
export function queryFilters(declaration: QueryDeclaration | undefined, inputs: QueryInput[]) {
  const all = [...declaredFilters(declaration?.aql), ...inputs];
  return { all, active: all.filter(isActive) };
}

/** How many filters narrow the query now; an empty slot when none, so the icons after it stay in line. */
export function FilterIndicator({ active }: { active: QueryInput[] }) {
  if (active.length === 0) return <span className="w-9 shrink-0" aria-hidden />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex w-9 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground tabular-nums">
          {active.length}
          <ListFilter className="size-3.5 shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">
        <div className="max-w-72">
          <div className="mb-1 font-medium">{plural(active.length, 'filter')} applied</div>
          <ul className="space-y-1.5">
            {active.map((input, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two filters can share a field and source
              <li key={`${input.kind}:${input.source}:${input.field}:${index}`}>
                <span className="break-words">{input.field}</span>
                <span className="opacity-70">
                  {' '}
                  · {input.kind === 'declared' ? 'query' : input.self ? 'itself' : input.source}
                </span>
                {input.value !== '—' && (
                  <div className="line-clamp-3 break-words opacity-70" title={input.value}>
                    {input.value}
                  </div>
                )}
                {input.pending && (
                  <div
                    className="line-clamp-3 break-words text-amber-600 dark:text-amber-400"
                    title={input.pending}
                  >
                    pending: {input.pending}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** The query's trust level as rising bars. */
export function TrustIndicator({ trust }: { trust: ReturnType<typeof queryTrust> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          className="flex h-3 w-6 shrink-0 items-end justify-end"
          aria-label={`Trust level ${trust.level}`}
        >
          <TrustBars trust={trust} size="sm" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">
        Level {trust.level} · {TRUST_LEVELS[trust.level].name}
      </TooltipContent>
    </Tooltip>
  );
}

/** A dot for where the query stands: idle, executing, success or error. */
export function StateIndicator({ state }: { state: InspectedQuery['state'] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`State: ${state}`}
          className={cn('size-2 shrink-0 rounded-full', stateDot[state])}
        />
      </TooltipTrigger>
      <TooltipContent>{state}</TooltipContent>
    </Tooltip>
  );
}

/** Filters, trust and state of a query, in the order every row shows them. */
export function QueryIndicators({
  query,
  declaration,
  active,
  showState = true,
  beforeTrust,
}: {
  query: InspectedQuery;
  declaration: QueryDeclaration | undefined;
  active: QueryInput[];
  /** Whether the state dot shows; a table that couldn't load already says so. */
  showState?: boolean;
  /** Drawn between the filters and the trust level. */
  beforeTrust?: ReactNode;
}) {
  return (
    <>
      <FilterIndicator active={active} />
      {beforeTrust}
      <TrustIndicator trust={queryTrust(declaration, query)} />
      {showState && <StateIndicator state={query.state} />}
    </>
  );
}
