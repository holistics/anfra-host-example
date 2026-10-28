import { AppWindowMac, Moon, RotateCw, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useTheme } from '@/components/theme-toggle';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import type { Command, CommandState } from '@/data-app';
import { commandIcon } from '@/lib/commands';
import type { AppEntry, Entry } from '@/lib/host';
import { iconOf } from '@/lib/icons';
import { shortcutKeys } from '@/lib/shortcut';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: Entry[] | undefined;
  /** The open Data App, whose actions the palette offers. */
  app: AppEntry | undefined;
  onSelect: (path: string) => void;
  onReload: () => void;
  /** The open Data App's commands, the plugins' and this page's own, with how each shows now. */
  commands: Command[];
  stateOf: (command: Command) => CommandState;
  onRun: (command: Command) => void;
}

/** Cmd/Ctrl+K: jump to a Data App, or run an action on the open one. */
export function CommandPalette({
  open,
  onOpenChange,
  entries,
  app,
  onSelect,
  onReload,
  commands,
  stateOf,
  onRun,
}: Props) {
  const [theme, toggleTheme] = useTheme();
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
            {commands.map((command) => {
              const state = stateOf(command);
              const Icon = commandIcon(command);
              return (
                <CommandItem
                  key={command.id}
                  value={`${command.title} ${command.id}`}
                  disabled={!!state.disabled}
                  onSelect={run(() => onRun(command))}
                >
                  <Icon />
                  {command.title}
                  {state.pressed && <span className="text-xs text-muted-foreground">On</span>}
                  {state.disabled && <span className="text-xs text-muted-foreground">{state.disabled}</span>}
                  {command.shortcut && <Shortcut keys={shortcutKeys(command.shortcut)} />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        <CommandGroup heading="Appearance">
          <CommandItem
            value={theme === 'dark' ? 'Switch to light mode theme' : 'Switch to dark mode theme'}
            onSelect={run(toggleTheme)}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          </CommandItem>
        </CommandGroup>
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

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <KbdGroup className="ml-auto">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}

/** Every Data App in the tree, folders flattened away. */
function appsOf(entries: Entry[]): AppEntry[] {
  return entries.flatMap((entry) => (entry.kind === 'app' ? [entry] : appsOf(entry.children)));
}
