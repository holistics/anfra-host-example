import {
  Code,
  Database,
  Ellipsis,
  GitFork,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  PanelRight,
  Sheet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Panel, Tab } from '@/data-app';
import { fitTabs, type TabFit } from '@/lib/tab-fit';
import { cn } from '@/lib/utils';

/** The icon this host draws for each icon name a tab gives; a tab naming another gets a plain one. */
const tabIcons: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  table: Sheet,
  query: Database,
  lineage: GitFork,
  tree: ListTree,
  code: Code,
};

interface Props {
  panel: Panel;
  tabs: readonly Tab[];
}

/**
 * The panel's chrome: the plugins' tabs as a strip, and the open tab, drawn by its plugin in its
 * own shadow root. What each tab shows, and the panel's state (the tab, the node selected, pick
 * mode), are the SDK's; this only places them. The page draws it again on each change to the panel.
 */
export function PluginPanel({ panel, tabs }: Props) {
  const content = useRef<HTMLDivElement>(null);
  const tab = panel.tab;

  // A new element per tab, and per mount's panel: a tab draws in that element's shadow root, which
  // another tab must not reuse.
  useEffect(() => {
    const host = content.current;
    if (!host || !tab) return;
    const element = document.createElement('div');
    element.className = 'size-full';
    host.replaceChildren(element);
    const unmount = panel.mountTab(tab, element);
    return () => {
      unmount();
      element.remove();
    };
  }, [panel, tab]);

  // Which tabs fit in the strip, from a hidden copy of every tab that gives each one's width; the
  // rest go behind More. Measured at the selected tab's weight, so selecting one never overflows.
  const bar = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<TabFit>({ shown: tabs.map((each) => each.id), more: [] });
  const refit = useCallback(() => {
    if (!bar.current || !measure.current) return;
    const buttons = [...measure.current.querySelectorAll('button')];
    const widths = tabs.map((each, i) => ({ id: each.id, width: buttons[i]?.offsetWidth ?? 0 }));
    const next = fitTabs(widths, bar.current.clientWidth, GAP, MORE, tab);
    setFit((last) => (sameFit(last, next) ? last : next));
  }, [tabs, tab]);
  useLayoutEffect(refit, [refit]);
  useEffect(() => {
    if (!bar.current) return;
    const observer = new ResizeObserver(refit);
    observer.observe(bar.current);
    return () => observer.disconnect();
  }, [refit]);
  const moreTabs = tabs.filter((each) => fit.more.includes(each.id));

  return (
    <aside className="flex size-full flex-col bg-background" aria-label="Inspect panel">
      <header className="flex h-10 shrink-0 items-center gap-1 border-b pr-1 pl-2">
        <div ref={bar} className="relative flex min-w-0 flex-1 items-center gap-0.5">
          <div role="tablist" className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            {tabs
              .filter((each) => !fit.more.includes(each.id))
              .map((each) => (
                <TabButton
                  key={each.id}
                  tab={each}
                  selected={each.id === tab}
                  onClick={() => panel.show(each.id)}
                />
              ))}
          </div>
          {moreTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="More tabs">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {moreTabs.map((each) => {
                  const Icon = iconOf(each);
                  return (
                    <DropdownMenuItem key={each.id} onSelect={() => panel.show(each.id)}>
                      <Icon />
                      {each.title}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div
            ref={measure}
            aria-hidden
            className="pointer-events-none invisible absolute top-0 left-0 flex gap-0.5"
          >
            {tabs.map((each) => (
              <TabButton key={each.id} tab={each} selected tabIndex={-1} />
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Close the inspect panel"
          onClick={() => panel.hide()}
        >
          <X />
        </Button>
      </header>
      <div ref={content} className="min-h-0 flex-1 overflow-auto" />
    </aside>
  );
}

/** The space between two tabs (`gap-0.5`), and the More button's width with its gap. */
const GAP = 2;
const MORE = 30;

const sameFit = (a: TabFit, b: TabFit) =>
  a.shown.join() === b.shown.join() && a.more.join() === b.more.join();

const iconOf = (tab: Tab): LucideIcon => (tab.icon && tabIcons[tab.icon]) || PanelRight;

function TabButton({
  tab,
  selected,
  ...props
}: { tab: Tab; selected: boolean } & React.ComponentProps<'button'>) {
  const Icon = iconOf(tab);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5',
        selected && 'bg-accent font-medium text-foreground',
      )}
      {...props}
    >
      <Icon />
      {tab.title}
    </button>
  );
}
