import { AppWindowMac, Check, ChevronRight, Folder } from 'lucide-react';
import { type MouseEvent, useState } from 'react';
import { AnfraStatus } from '@/components/anfra-status';
import { SidebarResizer } from '@/components/sidebar-resizer';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/components/ui/sidebar';
import { type Entry, filterEntries, holds, urlOf } from '@/lib/host';
import { iconOf } from '@/lib/icons';

interface Props {
  entries: Entry[] | undefined;
  selected: string | undefined;
  onSelect: (path: string) => void;
}

/** The Data Apps in the repo, as a tree of folders. */
export function AppSidebar({ entries, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const shown = entries && filterEntries(entries, query);
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <a href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <img src="/logo.svg" alt="" className="size-6 object-contain" />
          anfra
          <Badge variant="secondary" className="mt-1">
            demo
          </Badge>
        </a>
      </SidebarHeader>
      {/* On desktop, reach over the inset padding, so the scrollbar sits on the edge and the gap is inside it. */}
      <SidebarContent className="md:-mr-2">
        <SidebarGroup className="md:pr-3">
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name or tag"
              aria-label="Filter Data Apps"
              className="mb-2 h-8"
            />
            <SidebarMenu>
              {shown?.map((entry) => (
                <Item
                  key={entry.path}
                  entry={entry}
                  selected={selected}
                  onSelect={onSelect}
                  searching={searching}
                />
              ))}
              {entries?.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">No Data Apps in the repo's apps folder.</p>
              )}
              {entries && entries.length > 0 && shown?.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">Nothing matches.</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="flex-row items-center justify-between border-t">
        <AnfraStatus />
        <ThemeToggle />
      </SidebarFooter>
      <SidebarResizer />
    </Sidebar>
  );
}

function Item({
  entry,
  selected,
  onSelect,
  searching,
}: { entry: Entry; searching: boolean } & Omit<Props, 'entries'>) {
  if (entry.kind === 'app') {
    const Icon = iconOf(entry.icon, AppWindowMac);
    // A real link, so it opens in a new tab too; a plain click stays in the page.
    const onClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      onSelect(entry.path);
    };
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={entry.path === selected} tooltip={entry.path}>
          <a href={urlOf(entry.path)} onClick={onClick}>
            {entry.endorsed ? (
              // The check sits on the icon's bottom right, ringed in the sidebar's colour so it reads over it.
              <span className="relative flex shrink-0">
                <Icon className="size-4" />
                <span
                  role="img"
                  aria-label="Endorsed"
                  title="Endorsed"
                  className="absolute -right-1 -bottom-1 flex size-2.5 items-center justify-center rounded-full bg-green-500 text-white ring-2 ring-sidebar"
                >
                  <Check className="size-1.5 stroke-[5]" />
                </span>
              </span>
            ) : (
              <Icon />
            )}
            <span>{entry.label}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  const FolderIcon = iconOf(entry.icon, Folder);
  return (
    <SidebarMenuItem>
      {/* Open while searching, so what matched shows; else closed when the repo says so, unless it holds the open app. */}
      <Collapsible
        key={searching ? 'search' : 'browse'}
        defaultOpen={searching || !entry.collapsed || holds(entry, selected)}
        className="group/folder"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform group-data-[state=open]/folder:rotate-90" />
            <FolderIcon />
            <span>{entry.name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {entry.children.map((child) => (
              <Item
                key={child.path}
                entry={child}
                selected={selected}
                onSelect={onSelect}
                searching={searching}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
