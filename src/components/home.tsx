import { AppWindowMac, Folder } from 'lucide-react';
import type { MouseEvent } from 'react';
import { type Entry, urlOf } from '@/lib/host';

type AppEntry = Extract<Entry, { kind: 'app' }>;

interface Props {
  entries: Entry[];
  onSelect: (path: string) => void;
}

interface Category {
  name: string;
  apps: AppEntry[];
}

/** One category per folder, named by its path; the apps at the root go in a category of their own. */
function categories(entries: Entry[], name: string): Category[] {
  const apps = entries.filter((entry): entry is AppEntry => entry.kind === 'app');
  const nested = entries.flatMap((entry) =>
    entry.kind === 'folder' ? categories(entry.children, name ? `${name} / ${entry.name}` : entry.name) : [],
  );
  return apps.length > 0 ? [{ name, apps }, ...nested] : nested;
}

/** The home page: every Data App, in a grid under its category. */
export function Home({ entries, onSelect }: Props) {
  const groups = categories(entries, '');
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
          <section key={group.name}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Folder className="size-4" />
              {group.name || 'Apps'}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
              {group.apps.map((app) => (
                <AppCard key={app.path} app={app} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
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
      className="flex items-center gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
    >
      <AppWindowMac className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{app.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{app.path}</span>
      </span>
    </a>
  );
}
