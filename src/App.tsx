import { Crosshair, PanelRight, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { DataAppStage, type StageHandle } from '@/components/data-app-stage';
import { InspectPanel, type InspectTab } from '@/components/inspect-panel';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type DatasetDescriptor,
  type InspectedApp,
  type InspectedStructure,
  datasets as loadDatasets,
} from '@/data-app';
import { catalog, type Entry, findApp, onRepoEvent, pathOf, urlOf } from '@/lib/host';
import { cn } from '@/lib/utils';

export function App() {
  const [entries, setEntries] = useState<Entry[]>();
  const [datasets, setDatasets] = useState<Record<string, DatasetDescriptor>>();
  const [error, setError] = useState<string>();
  const [path, setPath] = useState(() => pathOf(window.location.pathname));
  // Bumped to remount the Data App: the reload button, and live reload.
  const [revision, setRevision] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [structure, setStructure] = useState<InspectedStructure>();
  const [inspectedApps, setInspectedApps] = useState<InspectedApp[]>();
  const [tab, setTab] = useState<InspectTab>('structure');
  const [picked, setPicked] = useState<string>();
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

  // A new Data App starts with nothing inspected.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the app or its revision changes
  useEffect(() => {
    setStructure(undefined);
    setInspectedApps(undefined);
    setPicked(undefined);
    setPicking(false);
  }, [path, revision]);

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
  if (app) document.title = `${app.label} · Data Apps`;

  // Pick works on the structure, which the frame reads only while it is inspected: picking opens
  // the panel, and closing the panel ends picking.
  const togglePicking = () => {
    if (!picking) {
      setInspecting(true);
      setTab('structure');
    }
    setPicking(!picking);
  };
  const toggleInspecting = () => {
    if (inspecting) setPicking(false);
    setInspecting(!inspecting);
  };

  const onPick = (node: string | null) => {
    if (node) {
      setPicked(node);
      setTab('structure');
    }
    // The frame leaves pick mode once something is picked, or when the reader presses Escape.
    setPicking(false);
  };

  let content: React.ReactNode;
  if (error) {
    content = <Message>{error}</Message>;
  } else if (!path) {
    content = <Message>Pick a Data App from the sidebar.</Message>;
  } else if (entries && !app) {
    content = <Message>No Data App at {path}.</Message>;
  } else if (!datasets) {
    content = <Message>Loading…</Message>;
  } else {
    content = (
      <DataAppStage
        key={`${path}#${revision}`}
        ref={stage}
        path={path}
        datasets={datasets}
        inspecting={inspecting}
        picking={picking}
        onInspect={(apps, next) => {
          setInspectedApps(apps);
          setStructure(next);
        }}
        onPick={onPick}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-full">
        <AppSidebar entries={entries} selected={path} onSelect={select} />
        <SidebarInset className="min-w-0">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <h1 className="truncate text-sm font-medium">{app?.label ?? 'Data Apps'}</h1>
            {app && (
              <span className="hidden truncate text-xs text-muted-foreground md:inline">{app.path}</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <ToolbarButton label="Reload" disabled={!app} onClick={() => setRevision((n) => n + 1)}>
                <RotateCw />
              </ToolbarButton>
              <ToolbarButton
                label={picking ? 'Stop picking' : 'Pick an element on the page'}
                disabled={!app}
                active={picking}
                onClick={togglePicking}
              >
                <Crosshair />
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
                  <InspectPanel
                    apps={inspectedApps}
                    structure={structure}
                    tab={tab}
                    onTab={setTab}
                    picked={picked}
                    onHighlight={(node) => stage.current?.highlight(node)}
                    onLocate={(target) => stage.current?.locate(target)}
                    onClose={toggleInspecting}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
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
