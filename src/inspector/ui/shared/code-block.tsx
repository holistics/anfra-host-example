import { cn } from '@/lib/utils';
import { CopyButton } from './copy-button';

/** One code tab: its label, its code, and why it is empty when it is. */
export interface CodeSource {
  label: string;
  code: string | undefined;
  empty: string;
}

/** Several pieces of code, one at a time: tabs, a copy button, and the code. */
export function CodeBlock<T extends string>({
  tab,
  onTab,
  sources,
}: {
  tab: T;
  onTab: (tab: T) => void;
  sources: Record<T, CodeSource>;
}) {
  const tabs = Object.keys(sources) as T[];
  // The reader's tab, or the first with something in it.
  const shown = sources[tab].code ? tab : (tabs.find((t) => sources[t].code) ?? tab);
  const { label, code, empty } = sources[shown];
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center border-b">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            disabled={!sources[t].code}
            className={cn(
              '-mb-px border-b-2 border-transparent px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
              t === shown && 'border-foreground font-medium text-foreground',
            )}
            onClick={() => onTab(t)}
            title={sources[t].code ? undefined : sources[t].empty}
          >
            {sources[t].label}
          </button>
        ))}
        {code && <CopyButton text={code} label={`Copy the ${label}`} className="mr-1 ml-auto size-6" />}
      </div>
      {code ? (
        <pre className="max-h-56 overflow-auto p-2 font-mono text-[11px] leading-snug">{code}</pre>
      ) : (
        <p className="p-2 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
