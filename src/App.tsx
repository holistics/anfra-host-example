import { Crosshair, Download, PanelRight, RotateCw, ScrollText } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { DataAppStage, type StageHandle } from '@/components/data-app-stage';
import { Home } from '@/components/home';
import { PromptPanel } from '@/components/prompt-panel';
import { storedSidebarWidth } from '@/components/sidebar-resizer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type DatasetDescriptor,
  datasets as loadDatasets,
  type RenderFormat,
  type RenderRequest,
  reader,
  type StructureNode,
  sdkVersion,
} from '@/data-app';
import {
  createInspectorStore,
  createRequestLog,
  Inspector,
  type InspectorTab,
  type NodeRequest,
} from '@/inspector';
import { catalog, type Entry, findApp, onRepoEvent, pathOf, urlOf } from '@/lib/host';
import { cn } from '@/lib/utils';

// Read once: while dragging, the resizer sets the width on the wrapper itself.
const sidebarWidth = storedSidebarWidth();
const sidebarStyle = (sidebarWidth ? { '--sidebar-width': sidebarWidth } : {}) as CSSProperties;

// Numbers each mount of a Data App: the stage and the inspect panel are keyed on it.
let mounts = 0;

export function App() {
  const [entries, setEntries] = useState<Entry[]>();
  const [datasets, setDatasets] = useState<Record<string, DatasetDescriptor>>();
  const [error, setError] = useState<string>();
  const [path, setPath] = useState(() => pathOf(window.location.pathname));
  // Bumped to remount the Data App: the reload button, and live reload.
  const [revision, setRevision] = useState(0);
  // The right-hand panel: the inspector, or the prompt that made the app. One at a time.
  const [panel, setPanel] = useState<'inspect' | 'prompt'>();
  const inspecting = panel === 'inspect';
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState<InspectorTab>('overview');
  const [picked, setPicked] = useState<NodeRequest>();
  const [toast, setToast] = useState<Toast>();
  const stage = useRef<StageHandle>(null);

  const refreshCatalog = useCallback(
    () => catalog().then(setEntries, (err: Error) => setError(`Couldn't list the Data Apps: ${err.message}`)),
    [],
  );
  const refreshDatasets = useCallback(
    () =>
      loadDatasets().then(setDatasets, (err: Error) =>
        setError(`Couldn't load the datasets: ${err.message}`),
      ),
    [],
  );

  useEffect(() => {
    void refreshCatalog();
    void refreshDatasets();
  }, [refreshCatalog, refreshDatasets]);

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

  // A new Data App starts with nothing inspected: one inspector store, request log and panel per
  // mounted frame. The stage and the panel are keyed on `mount`, so a new store always comes with a
  // new frame recording into it. A ref, not a memo: React may drop a memo and build it again, which
  // would split the frame from its store; a ref keeps the mount until the app, its revision or the
  // datasets change.
  const mounted = useRef<{ deps: unknown[]; inspector: ReturnType<typeof mountInspector> }>(null);
  const deps = [path, revision, datasets];
  if (!mounted.current || deps.some((dep, i) => !Object.is(dep, mounted.current?.deps[i]))) {
    mounted.current = { deps, inspector: mountInspector() };
  }
  const { inspector } = mounted.current;
  function mountInspector() {
    const requests = createRequestLog();
    const store = createInspectorStore({
      env: { hostName: 'anfra demo', path, sdkVersion, reader, datasets: datasets ?? {} },
      requests: requests.log,
      highlight: (node) => stage.current?.highlight(node),
      locate: (target) => stage.current?.locate(target),
      download: (node, format) => downloadNode(node, format),
    });
    return { ...store, record: requests.record, mount: ++mounts };
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on each mount
  useEffect(() => {
    setPicked(undefined);
    setPicking(false);
  }, [inspector.mount]);

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

  // Pick works on the structure, which the frame reads only while it is inspected: picking opens
  // the panel, and closing the panel ends picking.
  const togglePicking = () => {
    if (!picking) {
      setPanel('inspect');
      setTab('structure');
    }
    setPicking(!picking);
  };
  const toggleInspecting = () => {
    if (inspecting) setPicking(false);
    setPanel(inspecting ? undefined : 'inspect');
  };
  // The prompt panel stays chosen across apps, like the inspector, but shows only for an app with a
  // prompt; one without leaves the button off rather than stuck on and disabled.
  const prompting = panel === 'prompt' && !!app?.prompt;
  const togglePrompt = () => {
    setPicking(false);
    setPanel(prompting ? undefined : 'prompt');
  };

  const onPick = (node: string | null) => {
    if (node) {
      setPicked({ key: node, nonce: Date.now() });
      setTab('structure');
    }
    // The frame leaves pick mode once something is picked, or when the reader presses Escape.
    setPicking(false);
  };

  // A picture of the app, or of one node. The browser's own download says it worked; a failure, or
  // images left blank for want of CORS, is told in a toast.
  const download = (request: RenderRequest) => {
    stage.current?.render(request).then(
      ({ omitted }) => {
        if (omitted.length) {
          setToast({
            tone: 'note',
            text: `Saved, with ${omitted.length === 1 ? 'an image' : `${omitted.length} images`} left blank: their servers send no CORS headers.`,
          });
        }
      },
      (err: Error) => setToast({ tone: 'error', text: `Couldn't save the picture: ${err.message}` }),
    );
  };
  const downloadNode = (node: StructureNode, format: RenderFormat) =>
    download(node.kind === 'block' ? { block: node.id, format } : { container: node.id, format });

  let content: React.ReactNode;
  if (error) {
    content = <Message>{error}</Message>;
  } else if (!path) {
    content = entries ? <Home entries={entries} onSelect={select} /> : <Message>Loading…</Message>;
  } else if (entries && !app) {
    content = <Message>No Data App at {path}.</Message>;
  } else if (!datasets) {
    content = <Message>Loading…</Message>;
  } else {
    content = (
      <DataAppStage
        key={inspector.mount}
        ref={stage}
        path={path}
        datasets={datasets}
        inspecting={inspecting}
        picking={picking}
        onInspect={inspector.publish}
        record={inspector.record}
        onPick={onPick}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-full" style={sidebarStyle}>
        <AppSidebar entries={entries} selected={path} onSelect={select} />
        <SidebarInset className="min-w-0 overflow-hidden md:peer-data-[variant=inset]:border">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <h1 className="truncate text-sm font-medium">{app?.label ?? 'anfra demo'}</h1>
            {app && (
              <span className="hidden truncate text-xs text-muted-foreground md:inline">{app.path}</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <ToolbarButton label="Reload" disabled={!app} onClick={() => setRevision((n) => n + 1)}>
                <RotateCw />
              </ToolbarButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton label="Download a picture of the page" disabled={!app}>
                    <Download />
                  </ToolbarButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => download({ format: 'png' })}>PNG</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => download({ format: 'pdf' })}>PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ToolbarButton
                label={picking ? 'Stop picking' : 'Pick an element on the page'}
                disabled={!app}
                active={picking}
                onClick={togglePicking}
              >
                <Crosshair />
              </ToolbarButton>
              <ToolbarButton
                label={
                  !app || app.prompt
                    ? prompting
                      ? 'Close the prompt panel'
                      : 'Show the prompt that made this app'
                    : 'No prompt recorded for this app'
                }
                disabled={!app?.prompt}
                active={prompting}
                onClick={togglePrompt}
              >
                <ScrollText />
              </ToolbarButton>
              <ToolbarButton
                label={inspecting ? 'Close the inspect panel' : 'Inspect the Data App'}
                disabled={!app}
                active={inspecting}
                onClick={toggleInspecting}
              >
                <PanelRight />
              </ToolbarButton>
            </div>
          </header>
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel id="stage" minSize="30%">
              {content}
            </ResizablePanel>
            {inspecting && app && (
              <>
                <ResizableHandle />
                <ResizablePanel id="inspect" defaultSize="320px" minSize="220px" maxSize="60%">
                  <Inspector
                    key={inspector.mount}
                    source={inspector.source}
                    tab={tab}
                    onTab={setTab}
                    picked={picked}
                    onClose={toggleInspecting}
                  />
                </ResizablePanel>
              </>
            )}
            {prompting && app?.prompt && (
              <>
                <ResizableHandle />
                <ResizablePanel id="prompt" defaultSize="320px" minSize="220px" maxSize="60%">
                  <PromptPanel prompt={app.prompt} onClose={togglePrompt} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </SidebarInset>
      </SidebarProvider>
      {toast && <ToastMessage toast={toast} onDone={() => setToast(undefined)} />}
    </TooltipProvider>
  );
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

function ToolbarButton({
  label,
  active,
  ...props
}: { label: string; active?: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', active && 'bg-accent text-accent-foreground')}
          aria-label={label}
          aria-pressed={active}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
