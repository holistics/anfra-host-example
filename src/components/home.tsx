import { Folder } from 'lucide-react';
import type { MouseEvent } from 'react';
import { AppIcon } from '@/components/app-icon';
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
  apps: AppEntry[];
}

/** One category per folder, named by its path; the apps at the root go in a category of their own. */
function categories(entries: Entry[], path: string, name: string, icon?: string): Category[] {
  const apps = entries.filter((entry): entry is AppEntry => entry.kind === 'app');
  const nested = entries.flatMap((entry) =>
    entry.kind === 'folder'
      ? categories(entry.children, entry.path, name ? `${name} / ${entry.name}` : entry.name, entry.icon)
      : [],
  );
  return apps.length > 0 ? [{ path, name, icon, apps }, ...nested] : nested;
}

/** The home page: every Data App, in a grid under its category. */
export function Home({ entries, onSelect }: Props) {
  const groups = categories(entries, '', '');
  if (groups.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        No Data Apps in the repo's apps folder.
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
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
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" />
        {group.name || 'Apps'}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {group.apps.map((app) => (
          <AppCard key={app.path} app={app} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function AppCard({ app, onSelect }: { app: AppEntry; onSelect: (path: string) => void }) {
  // A real link, so it opens in a new tab too; a plain click stays in the page.
  const onClick = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onSelect(app.path);
  };
  return (
    <a
      href={urlOf(app.path)}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
    >
      <AppIcon
        app={app}
        className="size-5 shrink-0 text-muted-foreground"
        checkClassName="ring-card group-hover:ring-accent"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{app.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{app.path}</span>
      </span>
    </a>
  );
}
