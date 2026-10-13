// The inspector's public API: a host imports from here and nowhere else in this folder.
// How it behaves, how it is built and how to bring it to another host: SPEC.md.
export {
  createInspectorStore,
  type InspectorSnapshot,
  type InspectorSource,
  type InspectorStore,
} from './source';
export { Inspector, type InspectorTab } from './ui/inspector';
