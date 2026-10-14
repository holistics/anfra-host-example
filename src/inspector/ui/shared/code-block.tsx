import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { type Lang, type TokenKind, tokenize } from '../../model/highlight';
import { CopyButton } from './copy-button';

/** One code tab: its label, its code and language, and why it is empty when it is. */
export interface CodeSource {
  label: string;
  code: string | undefined;
  /** Highlighted as this language; plain when absent. */
  lang?: Lang;
  empty: string;
}

const tokenColor: Record<TokenKind, string> = {
  kw: 'font-semibold text-violet-700 dark:text-violet-300',
  str: 'text-emerald-700 dark:text-emerald-300',
  num: 'text-amber-700 dark:text-amber-300',
  com: 'italic text-muted-foreground',
  fn: 'text-blue-700 dark:text-blue-300',
};

/** Several pieces of code, one at a time: tabs, a copy button, and the code. */
export function CodeBlock<T extends string>({
  tab,
  onTab,
  sources,
  className,
}: {
  tab: T;
  onTab: (tab: T) => void;
  sources: Record<T, CodeSource>;
  /** For the code area, e.g. a taller max height. */
  className?: string;
}) {
  const tabs = Object.keys(sources) as T[];
  // The reader's tab, or the first with something in it.
  const shown = sources[tab].code ? tab : (tabs.find((t) => sources[t].code) ?? tab);
  const { label, code, lang, empty } = sources[shown];
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center border-b px-1">
        <Tabs value={shown} onValueChange={(value) => onTab(value as T)}>
          <TabsList variant="line">
            {tabs.map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                disabled={!sources[t].code}
                title={sources[t].code ? undefined : sources[t].empty}
              >
                {sources[t].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {code && <CopyButton text={code} label={`Copy the ${label}`} className="ml-auto" />}
      </div>
      {code ? (
        <pre className={cn('max-h-56 overflow-auto p-2 font-mono text-xs', className)}>
          <Highlighted code={code} lang={lang} />
        </pre>
      ) : (
        <p className="p-2 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function Highlighted({ code, lang }: { code: string; lang: Lang | undefined }) {
  const tokens = useMemo(() => (lang ? tokenize(code, lang) : [{ text: code }]), [code, lang]);
  return tokens.map((token, i) =>
    token.kind ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
      <span key={i} className={tokenColor[token.kind]}>
        {token.text}
      </span>
    ) : (
      token.text
    ),
  );
}
