import { ChevronRight, Folder } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { AnfraStatus } from '@/components/anfra-status';
import { AppIcon } from '@/components/app-icon';
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
import { type Entry, filterEntries, foldersOf, urlOf } from '@/lib/host';
import { iconOf } from '@/lib/icons';

interface Props {
  entries: Entry[] | undefined;
  selected: string | undefined;
  onSelect: (path: string) => void;
}

type FolderEntry = Extract<Entry, { kind: 'folder' }>;

/** Folders opened or closed by hand, by path. */
type Toggled = Record<string, boolean>;

/** The Data Apps in the repo, as a tree of folders. */
export function AppSidebar({ entries, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const shown = entries && filterEntries(entries, query);
  // Kept here, not in each folder, so they last while a folder is filtered out. A search has its
  // own, dropped when it ends, so browsing comes back as it was left.
  const [browsed, setBrowsed] = useState<Toggled>({});
  const [searched, setSearched] = useState<Toggled>({});

  // The open app's folders open when it changes, even ones closed by hand.
  useEffect(() => {
    if (!selected) return;
    setBrowsed((prev) => {
      const next = { ...prev };
      for (const folder of foldersOf(selected)) next[folder] = true;
      return next;
    });
  }, [selected]);

  // Open while searching, so what matched shows; else closed when the repo says so, unless it holds the open app.
  const isOpen = (folder: FolderEntry) =>
    searching
      ? (searched[folder.path] ?? true)
      : (browsed[folder.path] ??
        (!folder.collapsed || (!!selected && foldersOf(selected).includes(folder.path))));
  const onToggle = (path: string, open: boolean) =>
    (searching ? setSearched : setBrowsed)((prev) => ({ ...prev, [path]: open }));
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
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value.trim()) setSearched({});
              }}
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
                  isOpen={isOpen}
                  onToggle={onToggle}
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

interface ItemProps extends Omit<Props, 'entries'> {
  entry: Entry;
  isOpen: (folder: FolderEntry) => boolean;
  onToggle: (path: string, open: boolean) => void;
}

function Item({ entry, selected, onSelect, isOpen, onToggle }: ItemProps) {
  if (entry.kind === 'app') {
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
            <AppIcon app={entry} />
            <span>{entry.label}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  const FolderIcon = iconOf(entry.icon, Folder);
  return (
    <SidebarMenuItem>
      <Collapsible
        open={isOpen(entry)}
        onOpenChange={(open) => onToggle(entry.path, open)}
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
                isOpen={isOpen}
                onToggle={onToggle}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
