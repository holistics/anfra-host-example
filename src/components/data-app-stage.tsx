import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type DatasetDescriptor, type Mounted, mount } from '@/data-app';

interface Props {
  path: string;
  /** The app's label, for Ask AI's prompt. */
  label: string;
  datasets: Record<string, DatasetDescriptor>;
  /** The Data App is mounted, or gone (undefined): the page draws its commands and panel from it. */
  onMount: (mounted: Mounted | undefined) => void;
}

/**
 * The stage: one Data App, mounted in its frame. It is mounted once per path and datasets; the
 * page remounts it (with a new key) to reload it.
 */
export function DataAppStage({ path, label, datasets, onMount }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  // The latest callback and label, so a re-render doesn't remount the frame.
  const latest = useRef({ onMount, label });
  latest.current = { onMount, label };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let mounted: Mounted | undefined;
    let cancelled = false;
    setError(undefined);
    mount({ container: element, path, label: latest.current.label, datasets }).then(
      (result) => {
        if (cancelled) return result.unmount();
        mounted = result;
        mounted.app.frame.className = 'size-full border-0 bg-white';
        latest.current.onMount(mounted);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
      if (!mounted) return;
      latest.current.onMount(undefined);
      mounted.unmount();
    };
  }, [path, datasets]);

  return (
    <div className="relative size-full">
      <div ref={container} className="size-full" />
      {error && (
        <div className="absolute inset-0 bg-background p-6">
          <div
            role="alert"
            className="mx-auto grid max-w-lg grid-cols-[auto_1fr] gap-x-2 rounded-xl border border-danger-default bg-danger-secondary-default px-2.5 py-2 text-body text-default"
          >
            <CircleAlert className="size-4 translate-y-0.5 icon-danger-default" />
            <p className="text-pretty text-weak">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
