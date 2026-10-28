import {
  Code,
  Database,
  GitFork,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  PanelRight,
  Sheet,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { Panel, Tab } from '@/data-app';
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

  return (
    <aside className="flex size-full flex-col bg-background" aria-label="Inspect panel">
      <header className="flex h-10 shrink-0 items-center gap-1 border-b pr-1 pl-2">
        <div role="tablist" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {tabs.map((each) => {
            const Icon = (each.icon && tabIcons[each.icon]) || PanelRight;
            const selected = each.id === tab;
            return (
              <button
                key={each.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => panel.show(each.id)}
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5',
                  selected && 'bg-accent font-medium text-foreground',
                )}
              >
                <Icon />
                {each.title}
              </button>
            );
          })}
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
