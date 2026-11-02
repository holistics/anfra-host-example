import { ChevronRight, Folder } from 'lucide-react';
import type { MouseEvent } from 'react';
import { AppIcon, EndorsedMark } from '@/components/app-icon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isPlainClick } from '@/lib/click';
import { type AppEntry, type Entry, urlOf } from '@/lib/host';
import { iconOf } from '@/lib/icons';

interface Props {
  entries: Entry[];
  onSelect: (path: string) => void;
}

interface Category {
  /** The folder's path, as a key: names from the manifest can repeat. */
  path: string;
  name: string;
  /** The folder's, from the manifest; none for the root. */
  icon?: string;
  /** The folder's, from the manifest. */
  description?: string;
  /** The folder, or one holding it, starts closed in the repo's manifest. */
  collapsed: boolean;
  apps: AppEntry[];
}

/** One category per folder, named by its path; the apps at the root go in a category of their own. */
function categories(
  entries: Entry[],
  path: string,
  name: string,
  icon?: string,
  description?: string,
  collapsed = false,
): Category[] {
  const apps = entries.filter((entry): entry is AppEntry => entry.kind === 'app');
  const nested = entries.flatMap((entry) =>
    entry.kind === 'folder'
      ? categories(
          entry.children,
          entry.path,
          name ? `${name} / ${entry.name}` : entry.name,
          entry.icon,
          entry.description,
          collapsed || entry.collapsed,
        )
      : [],
  );
  return apps.length > 0 ? [{ path, name, icon, description, collapsed, apps }, ...nested] : nested;
}

/** The home page: every Data App, in a grid under its category. */
export function Home({ entries, onSelect }: Props) {
  const groups = categories(entries, '', '');
  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 bg-background p-6 text-center">
        <p className="text-heading">No Data Apps yet</p>
        <p className="text-body text-pretty text-weak">The repo's apps folder has none</p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto px-6 pt-6 pb-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="truncate text-title">Data Apps</h1>
        {groups.map((group) => (
          <Group key={group.path} group={group} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function Group({ group, onSelect }: { group: Category; onSelect: (path: string) => void }) {
  const Icon = iconOf(group.icon, Folder);
  return (
    <Collapsible asChild defaultOpen={!group.collapsed}>
      <section className="group/section">
        <CollapsibleTrigger className="mb-3 flex w-full items-center gap-2 rounded-md text-heading text-weak transition-colors duration-160 ease-anfra-out hover:text-default [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:icon-weak">
          <ChevronRight className="transition-transform duration-160 ease-anfra-out group-data-[state=open]/section:rotate-90" />
          <Icon />
          {group.name || 'Apps'}
          <span className="text-caption text-placeholder tabular-nums">{group.apps.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {group.description && (
            <p className="-mt-1 mb-3 text-body text-pretty text-placeholder">{group.description}</p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
            {group.apps.map((app) => (
              <AppCard key={app.path} app={app} onSelect={onSelect} />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function AppCard({ app, onSelect }: { app: AppEntry; onSelect: (path: string) => void }) {
  // A real link, so it opens in a new tab too; a plain click stays in the page.
  const onClick = (event: MouseEvent) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onSelect(app.path);
  };
  return (
    <a
      href={urlOf(app.path)}
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-default bg-card text-card-foreground transition-colors duration-160 ease-anfra-out hover:border-hover"
    >
      {app.image && (
        <img
          src={app.image}
          alt=""
          loading="lazy"
          className="aspect-[1200/630] w-full border-b border-default bg-muted object-cover"
        />
      )}
      <span className="flex items-center gap-3 px-4 py-3">
        <AppIcon app={app} className="size-4 shrink-0 icon-weak" />
        <span className="min-w-0">
          <span className="block truncate text-label">{app.label}</span>
          <span className="block truncate font-mono text-caption text-placeholder">{app.path}</span>
        </span>
        {app.endorsed && <EndorsedMark />}
      </span>
    </a>
  );
}
