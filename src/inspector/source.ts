// What the inspector needs from a host, and a small store a host can use to provide it.
import type { InspectedApp, InspectedStructure, LocateTarget } from '@holistics/anfra-sdk/common';

/** One inspection snapshot the frame posted: its apps, and the structure its markup declares. */
export interface InspectorSnapshot {
  apps: InspectedApp[];
  structure: InspectedStructure;
}

/** Everything the inspector needs from a host, for one mounted frame. See SPEC.md §5.2. */
export interface InspectorSource {
  /** The latest snapshot, or undefined until the frame reports. The same object until it changes. */
  getSnapshot(): InspectorSnapshot | undefined;
  /** Called whenever the snapshot changes; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Outline a structure node in the frame, or clear the outline. */
  highlight(node: string | null): void;
  /** Scroll a node, or an entity wherever it is drawn, into view in the frame. */
  locate(target: LocateTarget): void;
}

/** A source plus the hook that feeds it: pass `publish` as the frame's `onInspect`. */
export interface InspectorStore {
  source: InspectorSource;
  publish(apps: InspectedApp[], structure: InspectedStructure): void;
}

/**
 * A store for one mounted frame. Make a new one per mount, so a remounted frame starts with nothing
 * inspected. `highlight` and `locate` go to the frame, which the host owns.
 */
export function createInspectorStore(frame: Pick<InspectorSource, 'highlight' | 'locate'>): InspectorStore {
  let snapshot: InspectorSnapshot | undefined;
  const listeners = new Set<() => void>();
  return {
    source: {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      highlight: (node) => frame.highlight(node),
      locate: (target) => frame.locate(target),
    },
    publish(apps, structure) {
      snapshot = { apps, structure };
      for (const listener of listeners) listener();
    },
  };
}
