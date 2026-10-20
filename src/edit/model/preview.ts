// A preview: a query's draft run in place of its declared AQL. Nothing is written until it is saved.

/** One query's draft, run in place of what the frame declared. */
export interface PreviewEdit {
  /** The query's name. */
  query: string;
  /** The file under `apps/` its AQL is written in; the app's own for a query built at runtime, which Save never writes. */
  file: string;
  /** The AQL the frame declared: what its requests carry, and what the preview swaps out. */
  from: string;
  /** The AQL the frame runs instead. */
  to: string;
  /** The AQL as the file has it now: `from` until a save, `to` once saved. */
  base: string;
}

/** Whether a preview runs something the file doesn't have yet. */
export const isUnsaved = (preview: PreviewEdit) => preview.to !== preview.base;
