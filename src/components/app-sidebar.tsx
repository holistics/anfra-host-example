import { ChevronRight, Folder } from 'lucide-react';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { AnfraStatus } from '@/components/anfra-status';
import { AppIcon } from '@/components/app-icon';
import { SidebarResizer } from '@/components/sidebar-resizer';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { focusFilterMessage, toggleSidebarMessage } from '@/data-app';
import { type Entry, type FolderEntry, filterEntries, foldersOf, urlOf } from '@/lib/host';
import { iconOf } from '@/lib/icons';
import { modKey } from '@/lib/shortcut';

interface Props {
  entries: Entry[] | undefined;
  selected: string | undefined;
  onSelect: (path: string) => void;
}

/** Folders opened or closed by hand, by path. */
type Toggled = Record<string, boolean>;

const FOLDERS_KEY = 'sidebar-folders';

const storedFolders = (): Toggled => {
  try {
    const value = JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

/** The Data Apps in the repo, as a tree of folders. */
export function AppSidebar({ entries, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const shown = entries && filterEntries(entries, query);
  // Kept here, not in each folder, so they last while a folder is filtered out. A search has its
  // own, dropped when the query changes, so browsing comes back as it was left.
  const [browsed, setBrowsed] = useState<Toggled>(storedFolders);
  const [searched, setSearched] = useState<Toggled>({});

  // `/` jumps to the filter (Cmd/Ctrl+K opens the command palette), opening the sidebar first if it's hidden. The focus waits
  // for a render, as a hidden sidebar (or the mobile sheet) has no input to focus yet.
  const { isMobile, setOpen, setOpenMobile, toggleSidebar } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '');
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing;
      if (!slash) return;
      event.preventDefault();
      (isMobile ? setOpenMobile : setOpen)(true);
      setFocusRequest((n) => n + 1);
    };
    // The same shortcuts pressed inside a Data App's frame, which it forwards. Cmd/Ctrl+B is the
    // sidebar's own, on the page.
    const onMessage = (event: MessageEvent) => {
      if (event.data === toggleSidebarMessage) return toggleSidebar();
      if (event.data !== focusFilterMessage) return;
      (isMobile ? setOpenMobile : setOpen)(true);
      setFocusRequest((n) => n + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('message', onMessage);
    };
  }, [isMobile, setOpen, setOpenMobile, toggleSidebar]);
  useEffect(() => {
    if (focusRequest === 0) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  // The open app's folders open when it changes, even ones closed by hand: what was set by hand is
  // dropped, so they follow isOpen, and a folder the repo collapses closes again once left.
  useEffect(() => {
    if (!selected) return;
    setBrowsed((prev) => {
      const next = { ...prev };
      for (const folder of foldersOf(selected)) delete next[folder];
      return next;
    });
  }, [selected]);

  // Browsing is remembered in this browser; a search's toggles are not.
  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(browsed));
    } catch {
      // Storage may be blocked; the state just lasts the session.
    }
  }, [browsed]);

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
            <div className="relative mb-2">
              <Input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  // A folder closed for one query would hide what the next one matches.
                  setSearched({});
                }}
                placeholder="Filter by name or tag"
                aria-label="Filter Data Apps"
                aria-keyshortcuts="Control+K Meta+K"
                className="h-8 pr-14"
              />
              {!searching && (
                <KbdGroup className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                  <Kbd>{modKey}</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              )}
            </div>
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
        <SidebarMenuButton
          asChild
          isActive={entry.path === selected}
          tooltip={entry.path}
          className="group/app"
        >
          <a href={urlOf(entry.path)} onClick={onClick}>
            <AppIcon
              app={entry}
              checkClassName="group-hover/app:ring-sidebar-accent group-data-[active=true]/app:ring-sidebar-accent"
            />
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
