import { ChevronRight, FileChartColumn, Folder } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
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
    <Sidebar>
      <SidebarHeader>
        <a href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
            a
          </span>
          Data Apps
        </a>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
      <SidebarRail />
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
            <FileChartColumn />
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
