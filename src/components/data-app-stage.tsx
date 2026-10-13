import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  type DataApp,
  type DatasetDescriptor,
  type InspectedApp,
  type InspectedStructure,
  type LocateTarget,
  mount,
  type Rendering,
  type RenderRequest,
} from '@/data-app';

/** What the inspect panel and the toolbar do to the page in the stage. */
export interface StageHandle {
  highlight: (node: string | null) => void;
  locate: (target: LocateTarget) => void;
  render: (request: RenderRequest) => Promise<Rendering>;
}

interface Props {
  path: string;
  datasets: Record<string, DatasetDescriptor>;
  inspecting: boolean;
  picking: boolean;
  onInspect: (apps: InspectedApp[], structure: InspectedStructure) => void;
  onPick: (node: string | null) => void;
  ref?: Ref<StageHandle>;
}

/**
 * The stage: one Data App, mounted in its frame. It is mounted once per path and datasets; the
 * page remounts it (with a new key) to reload it.
 */
export function DataAppStage({ path, datasets, inspecting, picking, onInspect, onPick, ref }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<DataApp>();
  const [error, setError] = useState<string>();

  // The latest callbacks, so a re-render doesn't remount the frame.
  const callbacks = useRef({ onInspect, onPick });
  callbacks.current = { onInspect, onPick };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let mounted: DataApp | undefined;
    let cancelled = false;
    setError(undefined);
    mount({
      container: element,
      path,
      datasets,
      onInspect: (apps, structure) => callbacks.current.onInspect(apps, structure),
      onPick: (node) => callbacks.current.onPick(node),
    }).then(
      (result) => {
        if (cancelled) return result.unmount();
        mounted = result;
        mounted.frame.className = 'size-full border-0 bg-white';
        setApp(mounted);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
      mounted?.unmount();
      setApp(undefined);
    };
  }, [path, datasets]);

  useEffect(() => app?.setInspecting(inspecting), [app, inspecting]);
  useEffect(() => app?.setPicking(picking), [app, picking]);

  useImperativeHandle(
    ref,
    () => ({
      highlight: (node) => app?.highlight(node),
      locate: (target) => app?.locate(target),
      render: (request) =>
        app ? app.render(request) : Promise.reject(new Error('The Data App has not loaded yet.')),
    }),
    [app],
  );

  return (
    <div className="relative size-full">
      <div ref={container} className="size-full" />
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  );
}
