import { AppWindowMac, Download, RotateCw, ScanSearch, ScrollText } from 'lucide-react';
import { useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import type { RenderFormat } from '@/data-app';
import type { AppEntry, Entry } from '@/lib/host';
import { iconOf } from '@/lib/icons';
import { altKey, shiftKey } from '@/lib/shortcut';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: Entry[] | undefined;
  /** The open Data App, whose actions the palette offers. */
  app: AppEntry | undefined;
  onSelect: (path: string) => void;
  onReload: () => void;
  onDownload: (format: RenderFormat) => void;
  onInspect: () => void;
  onPrompt: () => void;
}

/** Cmd/Ctrl+K: jump to a Data App, or run an action on the open one. */
export function CommandPalette({
  open,
  onOpenChange,
  entries,
  app,
  onSelect,
  onReload,
  onDownload,
  onInspect,
  onPrompt,
}: Props) {
  const apps = useMemo(() => (entries ? appsOf(entries) : []), [entries]);
  // Close first, so an action that moves focus (a panel, a download) isn't undone by the dialog's.
  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Find a Data App or run an action"
    >
      <CommandInput placeholder={app ? `Search apps, or act on ${app.label}…` : 'Search apps…'} />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {app && (
          <CommandGroup heading={app.label}>
            <CommandItem value="Refresh reload" onSelect={run(onReload)}>
              <RotateCw />
              Refresh
            </CommandItem>
            <CommandItem value="Download PNG picture image" onSelect={run(() => onDownload('png'))}>
              <Download />
              Download PNG
            </CommandItem>
            <CommandItem value="Download PDF picture" onSelect={run(() => onDownload('pdf'))}>
              <Download />
              Download PDF
            </CommandItem>
            <CommandItem value="Inspect" onSelect={run(onInspect)}>
              <ScanSearch />
              Inspect
              <Shortcut letter="I" />
            </CommandItem>
            {app.prompt && (
              <CommandItem value="Prompt that made this app" onSelect={run(onPrompt)}>
                <ScrollText />
                Prompt
                <Shortcut letter="P" />
              </CommandItem>
            )}
          </CommandGroup>
        )}
        <CommandGroup heading="Apps">
          {apps.map((entry) => {
            const folder = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';
            const Icon = iconOf(entry.icon, AppWindowMac);
            // Matched on the name first, then tags; the path keeps the value unique. Descriptions are
            // left out: a word in one outranks another app's name.
            return (
              <CommandItem
                key={entry.path}
                value={`${entry.label} ${entry.path}`}
                keywords={entry.tags}
                onSelect={run(() => onSelect(entry.path))}
              >
                <Icon />
                <span className="truncate">{entry.label}</span>
                {folder && <span className="ml-auto truncate text-xs text-muted-foreground">{folder}</span>}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function Shortcut({ letter }: { letter: string }) {
  return (
    <KbdGroup className="ml-auto">
      <Kbd>{altKey}</Kbd>
      <Kbd>{shiftKey}</Kbd>
      <Kbd>{letter}</Kbd>
    </KbdGroup>
  );
}

/** Every Data App in the tree, folders flattened away. */
function appsOf(entries: Entry[]): AppEntry[] {
  return entries.flatMap((entry) => (entry.kind === 'app' ? [entry] : appsOf(entry.children)));
}
