import { ChevronRight, AppWindowMac, Folder } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MouseEvent } from 'react';
import { AnfraStatus } from '@/components/anfra-status';
import { SidebarResizer } from '@/components/sidebar-resizer';
import { ThemeToggle } from '@/components/theme-toggle';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { type Entry, urlOf } from '@/lib/host';

interface Props {
  entries: Entry[] | undefined;
  selected: string | undefined;
  onSelect: (path: string) => void;
}

/** The Data Apps in the repo, as a tree of folders. */
export function AppSidebar({ entries, selected, onSelect }: Props) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <a href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <img src="/logo.svg" alt="" className="size-6 object-contain" />
          anfra
          <Badge variant="secondary" className="mt-1">demo</Badge>
        </a>
      </SidebarHeader>
      {/* On desktop, reach over the inset padding, so the scrollbar sits on the edge and the gap is inside it. */}
      <SidebarContent className="md:-mr-2">
        <SidebarGroup className="md:pr-3">
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {entries?.map((entry) => (
                <Item key={entry.path} entry={entry} selected={selected} onSelect={onSelect} />
              ))}
              {entries?.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">No Data Apps in the repo's apps folder.</p>
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

function Item({ entry, selected, onSelect }: { entry: Entry } & Omit<Props, 'entries'>) {
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
            <AppWindowMac />
            <span>{entry.label}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/folder">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform group-data-[state=open]/folder:rotate-90" />
            <Folder />
            <span>{entry.name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {entry.children.map((child) => (
              <Item key={child.path} entry={child} selected={selected} onSelect={onSelect} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
