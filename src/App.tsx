import { Ellipsis, RotateCw } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { AppInfo } from '@/components/app-info';
import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { DataAppStage } from '@/components/data-app-stage';
import { Home } from '@/components/home';
import { PluginPanel } from '@/components/plugin-panel';
import { PromptPanel } from '@/components/prompt-panel';
import { storedSidebarOpen, storedSidebarWidth } from '@/components/sidebar-resizer';
import { useTheme } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VersionsPanel } from '@/components/versions-panel';
import {
  type Command,
  type DatasetDescriptor,
  loadCatalog,
  type Mounted,
  type Rendering,
  setPluginTheme,
} from '@/data-app';
import { chromeCommands, commandIcon, commandIcons } from '@/lib/commands';
import {
  catalog,
  type Entry,
  findApp,
  movedTo,
  onRepoEvent,
  pathOf,
  type Redirects,
  urlOf,
} from '@/lib/host';
import { onShell, setShellState } from '@/lib/shell';
import { modKey, shortcutKeys } from '@/lib/shortcut';
import { cn } from '@/lib/utils';

// Read once: while dragging, the resizer sets the width on the wrapper itself.
const sidebarWidth = storedSidebarWidth();
const sidebarOpen = storedSidebarOpen();
const sidebarStyle = (sidebarWidth ? { '--sidebar-width': sidebarWidth } : {}) as CSSProperties;

/** The action bar's order for the commands it knows; any other primary command goes before Inspect. */
const toolbarOrder = ['shell.versions', 'askai.ask', 'shell.prompt', 'inspect.toggle'];
/** The commands whose buttons carry a word beside the icon: their title, or a shorter one. */
const toolbarText: Record<string, string | true> = {
  'askai.ask': true,
  'shell.prompt': 'Prompt',
  'inspect.toggle': true,
};
/** An overflow menu's label, by its commands' icon. */
const menuLabels: Record<string, string> = { download: 'Download a picture of the page' };

export function App() {
  const [entries, setEntries] = useState<Entry[]>();
  const [redirects, setRedirects] = useState<Redirects>({});
  const [datasets, setDatasets] = useState<Record<string, DatasetDescriptor>>();
  const [error, setError] = useState<string>();
  const [path, setPath] = useState(() => pathOf(window.location.pathname));
  // Bumped to remount the Data App: the reload button, and live reload.
  const [revision, setRevision] = useState(0);
  // The page's own side panels: the prompt that made the app, or its version history. The inspect
  // panel is the SDK's; one of the three shows at a time.
  const [side, setSide] = useState<'prompt' | 'versions'>();
  const [toast, setToast] = useState<Toast>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme] = useTheme();
  // The open Data App's mount: its panel and its commands' state live in the SDK, and `version` is
  // bumped on each change to them, so the page draws them again.
  const [mounted, setMounted] = useState<Mounted>();
  const [version, setVersion] = useState(0);
  // The panel belongs to one Data App: it closes when another is opened, and survives a reload.
  const keptPanel = useRef<{ path: string | undefined; tab: string | undefined }>(undefined);

  const refreshCatalog = useCallback(
    () =>
      catalog().then(
        (read) => {
          setEntries(read.entries);
          setRedirects(read.redirects);
        },
        (err: Error) => setError(`Couldn't list the Data Apps: ${err.message}`),
      ),
    [],
  );
  const refreshDatasets = useCallback(
    () =>
      loadCatalog().then(setDatasets, (err: Error) => setError(`Couldn't load the datasets: ${err.message}`)),
    [],
  );

  useEffect(() => {
    void refreshCatalog();
    void refreshDatasets();
  }, [refreshCatalog, refreshDatasets]);

  // The plugins' UI (the panel's tabs, the menu and card in the frame) follows the page's theme.
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim() || undefined;
    setPluginTheme({
      scheme: theme,
      tokens: {
        'color-bg': read('--background'),
        'color-fg': read('--foreground'),
        'color-muted': read('--muted-foreground'),
        'color-border': read('--border'),
        // The neutral theme has no accent colour; links and selection in the tabs take indigo.
        'color-accent': theme === 'dark' ? '#a5b4fc' : '#4f46e5',
        'color-danger': read('--destructive'),
        radius: read('--radius'),
        font: getComputedStyle(document.body).fontFamily || undefined,
      },
    });
  }, [theme]);

  // Deep links: the address follows the open Data App, and back and forward follow the address.
  useEffect(() => {
    const onPopState = () => setPath(pathOf(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const select = (next: string) => {
    if (next === path) return;
    window.history.pushState(null, '', urlOf(next));
    setPath(next);
  };

  // Live reload, in development: a changed Data App reloads if it is the one open; a changed AML
  // reloads the datasets, and with them the open Data App.
  const current = useRef(path);
  current.current = path;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return onRepoEvent((event) => {
      if (event.type === 'apps') {
        void refreshCatalog();
        if (current.current && event.paths.includes(current.current)) setRevision((n) => n + 1);
      } else {
        void refreshDatasets();
      }
    });
  }, [refreshCatalog, refreshDatasets]);

  const app = entries && path ? findApp(entries, path) : undefined;
  if (app) document.title = `${app.label} · anfra demo`;

  // An old link to a Data App since moved, renamed or removed: the address is replaced with where it
  // went, as the server would have sent it (the server does, in production, for links it sees).
  const moved = entries && path && !app ? movedTo(entries, redirects, path) : undefined;
  useEffect(() => {
    if (!moved) return;
    window.history.replaceState(null, '', urlOf(moved) + window.location.search + window.location.hash);
    setPath(moved);
  }, [moved]);

  // Follow the mount's panel and commands. Opening the panel closes the page's own side panel; a
  // reload of the same app opens it again where it was.
  useEffect(() => {
    if (!mounted) return;
    const { panel } = mounted.app;
    const changed = () => {
      setVersion((n) => n + 1);
      keptPanel.current = panel.open ? { path: current.current, tab: panel.tab } : undefined;
      if (panel.open) setSide(undefined);
    };
    const stops = [panel.subscribe(changed), mounted.app.onCommandsChange(() => setVersion((n) => n + 1))];
    const kept = keptPanel.current;
    if (kept && kept.path === current.current) panel.show(kept.tab);
    setVersion((n) => n + 1);
    return () => {
      for (const stop of stops) stop();
    };
  }, [mounted]);
  const panel = mounted?.app.panel;
  const inspecting = !!panel?.open;

  // The page's side panels show only for an open app; the prompt panel only for one with a prompt.
  const prompting = side === 'prompt' && !!app?.prompt;
  const versioning = side === 'versions' && !!app;
  const toggleSide = (which: 'prompt' | 'versions') => {
    const open = which === 'prompt' ? prompting : versioning;
    if (!open) panel?.hide();
    setSide(open ? undefined : which);
  };
  useEffect(
    () => setShellState({ prompting, versioning, hasPrompt: !!app?.prompt }),
    [prompting, versioning, app],
  );

  // The shell's commands: from the action bar, the palette, or a shortcut on the page or in the frame.
  const shellActions = useRef({ toggleSide });
  shellActions.current = { toggleSide };
  useEffect(
    () =>
      onShell((action) => {
        if (action === 'prompt' || action === 'versions') shellActions.current.toggleSide(action);
        if (action === 'palette') setPaletteOpen((open) => !open);
      }),
    [],
  );

  // Cmd/Ctrl+K opens the palette with or without an app; the commands' shortcuts run on the open one.
  // The sidebar's own keys (Cmd/Ctrl+B, `/`) are its own listeners', which run first.
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      // Picking, Escape on the page ends the pick, as it does in the frame: starting it from the
      // panel's strip or the palette leaves focus here.
      const panel = mountedRef.current?.app.panel;
      if (event.key === 'Escape' && !event.defaultPrevented && panel?.picking && !isTyping(event.target)) {
        event.preventDefault();
        panel.pick(false);
        return;
      }
      mountedRef.current?.app.handleKeydown(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands = chromeCommands(mounted);
  const stateOf = (command: Command) => {
    void version;
    return mounted ? mounted.app.commandState(command.id) : { disabled: 'The Data App is loading' };
  };
  // A command's failure shows in a toast; so do images a picture left blank.
  const run = (command: Command) => {
    if (!mounted) return;
    mounted.app.run(command.id).then(
      (result) => {
        if (!('call' in command.run) || command.run.call !== 'render.download') return;
        const { omitted } = result as Rendering;
        if (!omitted.length) return;
        setToast({
          tone: 'note',
          text: `Saved, with ${omitted.length === 1 ? 'an image' : `${omitted.length} images`} left blank: their servers send no CORS headers.`,
        });
      },
      (err: Error) => setToast({ tone: 'error', text: `Couldn't run ${command.title}: ${err.message}` }),
    );
  };

  // The action bar: a plugin's primary commands as buttons, its overflow ones in a menu per icon.
  // The panel's (Pick) go in its strip.
  const primary = commands
    .filter((command) => command.placement !== 'overflow' && command.placement !== 'panel')
    .sort((a, b) => rank(a) - rank(b));
  const menus = new Map<string, Command[]>();
  for (const command of commands.filter((each) => each.placement === 'overflow')) {
    const icon = command.icon && commandIcons[command.icon] ? command.icon : 'more';
    menus.set(icon, [...(menus.get(icon) ?? []), command]);
  }

  let content: React.ReactNode;
  if (error) {
    content = <Message>{error}</Message>;
  } else if (!path) {
    content = entries ? <Home entries={entries} onSelect={select} /> : <Message>Loading…</Message>;
  } else if (entries && !app) {
    content = moved ? <Message>Loading…</Message> : <Message>No Data App at {path}.</Message>;
  } else if (!datasets || !app) {
    content = <Message>Loading…</Message>;
  } else {
    content = (
      <DataAppStage
        key={`${path}:${revision}`}
        path={path}
        label={app.label}
        datasets={datasets}
        onMount={setMounted}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-full" style={sidebarStyle} defaultOpen={sidebarOpen}>
        <AppSidebar entries={entries} selected={path} onSelect={select} />
        <SidebarInset className="min-w-0 overflow-hidden md:peer-data-[variant=inset]:border">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger />
              </TooltipTrigger>
              <TooltipContent>
                Toggle the app browser{' '}
                <KbdGroup>
                  <Kbd>{modKey}</Kbd>
                  <Kbd>B</Kbd>
                </KbdGroup>
              </TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <h1 className="truncate text-sm font-medium">{app?.label ?? 'anfra demo'}</h1>
            {app && <AppInfo app={app} />}
            {path && (
              <div className="ml-auto flex items-center gap-1">
                <ToolbarButton label="Reload" disabled={!app} onClick={() => setRevision((n) => n + 1)}>
                  <RotateCw />
                </ToolbarButton>
                {[...menus].map(([icon, items]) => {
                  const Icon = commandIcons[icon] ?? Ellipsis;
                  return (
                    <DropdownMenu key={icon}>
                      <DropdownMenuTrigger asChild>
                        <ToolbarButton label={menuLabels[icon] ?? 'More actions'}>
                          <Icon />
                        </ToolbarButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {items.map((command) => {
                          const state = stateOf(command);
                          return (
                            <DropdownMenuItem
                              key={command.id}
                              disabled={!!state.disabled}
                              title={state.disabled}
                              onSelect={() => run(command)}
                            >
                              {command.title}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
                {primary.map((command) => {
                  const state = stateOf(command);
                  const Icon = commandIcon(command);
                  return (
                    <ToolbarButton
                      key={command.id}
                      label={state.disabled ?? command.title}
                      aria-disabled={!!state.disabled}
                      active={!!state.pressed}
                      onClick={() => !state.disabled && run(command)}
                      text={textOf(command)}
                      shortcut={command.shortcut}
                      className={cn(state.disabled && 'cursor-not-allowed opacity-50')}
                    >
                      <Icon />
                    </ToolbarButton>
                  );
                })}
              </div>
            )}
          </header>
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel id="stage" minSize="30%">
              {content}
            </ResizablePanel>
            {inspecting && panel && mounted && (
              <>
                <ResizableHandle />
                <ResizablePanel id="inspect" defaultSize="440px" minSize="220px" maxSize="60%">
                  <PluginPanel
                    panel={panel}
                    tabs={mounted.host.tabs}
                    commands={commands.filter((command) => command.placement === 'panel')}
                    stateOf={stateOf}
                    onRun={run}
                  />
                </ResizablePanel>
              </>
            )}
            {prompting && app?.prompt && (
              <>
                <ResizableHandle />
                <ResizablePanel id="prompt" defaultSize="320px" minSize="220px" maxSize="60%">
                  <PromptPanel prompt={app.prompt} onClose={() => toggleSide('prompt')} />
                </ResizablePanel>
              </>
            )}
            {versioning && (
              <>
                <ResizableHandle />
                <ResizablePanel id="versions" defaultSize="360px" minSize="260px" maxSize="60%">
                  <VersionsPanel onClose={() => toggleSide('versions')} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </SidebarInset>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          entries={entries}
          app={app}
          onSelect={select}
          onReload={() => setRevision((n) => n + 1)}
          commands={commands}
          stateOf={stateOf}
          onRun={run}
        />
      </SidebarProvider>
      {toast && <ToastMessage toast={toast} onDone={() => setToast(undefined)} />}
    </TooltipProvider>
  );
}

/** The word beside a command's icon in the action bar, if it has one. */
/** Whether a key went to something that takes text, whose Escape is its own. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName ?? ''));
}

function textOf(command: Command): string | undefined {
  const text = toolbarText[command.id];
  return text === true ? command.title : text;
}

/** Where a primary command goes in the action bar. */
function rank(command: Command): number {
  const at = toolbarOrder.indexOf(command.id);
  return at === -1 ? toolbarOrder.length - 1.5 : at;
}

interface Toast {
  tone: 'note' | 'error';
  text: string;
}

/** A message over the page's corner, gone after a few seconds. */
function ToastMessage({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 6000);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div
      role="status"
      className={cn(
        'fixed right-4 bottom-4 z-50 max-w-sm rounded-md border px-3 py-2 text-sm shadow-md',
        toast.tone === 'error'
          ? 'border-destructive/40 bg-destructive text-white'
          : 'bg-popover text-popover-foreground',
      )}
    >
      {toast.text}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">{children}</div>;
}

/** An icon button; with `text` it carries a visible label beside the icon, and with `shortcut` its tooltip shows the keys to press. */
function ToolbarButton({
  label,
  active,
  text,
  shortcut,
  children,
  className,
  ...props
}: { label: string; active?: boolean; text?: string; shortcut?: string } & React.ComponentProps<
  typeof Button
>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={text ? 'sm' : 'icon'}
          className={cn(!text && 'size-8', active && 'bg-accent text-accent-foreground', className)}
          aria-label={label}
          aria-pressed={active}
          {...props}
        >
          {children}
          {text}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && (
          <>
            {' '}
            <KbdGroup>
              {shortcutKeys(shortcut).map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
