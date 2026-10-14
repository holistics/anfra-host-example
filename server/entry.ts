// Shared with the page (src/lib/host.ts), so the tree the server sends and the one the page reads are one type.
// No imports: the page's build reads this file too.

/** One node of the Data App tree: a definition, or a folder holding some. Paths are relative to the apps folder, a definition's with its `.html`. */
export type Entry =
  | { kind: 'app'; path: string; label: string; icon?: string; tags: string[]; endorsed: boolean }
  | {
      kind: 'folder';
      path: string;
      name: string;
      icon?: string;
      tags: string[];
      collapsed: boolean;
      children: Entry[];
    };
