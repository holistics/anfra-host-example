// Types the model and the UI share: where a link in the panel goes, and what the host tells the
// inspector about the frame it mounted.
import type { DatasetDescriptor, User } from '@holistics/anfra-sdk/common';

export type InspectorTab = 'overview' | 'structure' | 'data' | 'wiring';

/** Where a link in the panel goes. Every link resolves to one of these; see SPEC.md §4.8. */
export type RevealTarget =
  | { tab: InspectorTab }
  | { entity: 'query' | 'control'; app: number; name: string }
  | { check: number; app: number }
  | { node: string };

/** What the host knows about the frame it mounted, beyond what the frame posts. */
export interface InspectorEnv {
  /** Names the host in the report, e.g. "anfra demo". */
  hostName: string;
  /** The Data App's path, as the host addresses it. */
  path?: string;
  /** The SDK version the host mounts frames with. */
  sdkVersion?: string;
  /** Who reads the app; the frame is provisioned with it. */
  reader: User;
  /** The datasets the frame is provisioned with. */
  datasets: Record<string, DatasetDescriptor>;
}
