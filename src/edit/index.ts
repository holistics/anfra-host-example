// Edit's public API: a host imports from here and nowhere else in this folder.
// How it behaves and what is built so far: SPEC.md.

export { type EditRecord, loadHistory, revertEdit } from './model/history';
export { isUnsaved, type PreviewEdit } from './model/preview';
export { EditHistory } from './ui/edit-history';
export { EditPanel } from './ui/edit-panel';
