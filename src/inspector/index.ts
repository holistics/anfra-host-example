// The inspector's public API: a host imports from here and nowhere else in this folder.
// How it behaves, how it is built and how to bring it to another host: SPEC.md.

export { buildReport, type InspectorReport } from './model/report';
export type { InspectorEnv, InspectorTab } from './model/types';
export {
  createInspectorStore,
  type InspectorSnapshot,
  type InspectorSource,
  type InspectorStore,
} from './source';
export { Inspector } from './ui/inspector';
