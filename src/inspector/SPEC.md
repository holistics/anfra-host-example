# Inspector

A devtool over a running Data App: what it declared, what state it is in, how its parts are wired,
and what it asked the backend. This spec comes before the code. When the two disagree, fix one of
them on purpose.

Status: **agreed, being built**. Sections marked _(new)_ describe behavior not built yet. The rest
writes down what the host does today.

---

## 1. Principles

- **Read-only.** The inspector never executes a query, sets a control or changes a selection. The
  only things it does to the page are highlight, locate and pick, which change no state.
- **Host-side.** It runs in the host page, not in the Data App's frame. It learns about the frame
  from the SDK's inspection snapshots and from the host's own backend. It never patches SDK methods
  or reads the frame's globals.
- **Live while open.** The frame posts snapshots only while it is inspected (`setInspecting(true)`).
  The panel repaints on each one. The request log is the exception: the host records it all the
  time, so requests made before the panel opened still show.
- **Portable.** Everything lives in `src/inspector/`. The only things it takes from the host are
  one `InspectorSource` object and the shared shadcn primitives (see §5 and §6).
- **Says why.** An empty, missing or disabled thing always says why ("Not run yet", "No element is
  marked …", "Needs canViewGeneratedSql").

## 2. Glossary

| Term | Meaning |
| --- | --- |
| **Frame** | The sandboxed iframe running one Data App definition. |
| **App** | One `Anfra.createApp()` inside the frame. A frame can hold several, addressed by index (`0`, `1`, …). |
| **Query** | A declared `createQuery(name, {dataset, aql})`. It has a state: `idle`, `executing`, `success` or `error`. |
| **Control** | A filter or a date drill. It has a *condition* (what the reader set) and an *applied condition* (what queries last ran with). |
| **Mapping** | A control → query link on a field, optionally with an aggregation. |
| **Cross-filter** | A query → query link: a selection in the source query filters the target. |
| **Dirty** | Re-running would give something new: a query whose inputs changed, or a control whose condition differs from the applied one. At app level this is `hasChanges`. |
| **Snapshot** | One `onInspect(apps: InspectedApp[], structure: InspectedStructure)` post from the frame. It has no rows. |
| **Structure** | The tree of elements the markup marks with `data-anfra-container`, `data-anfra-block`, `data-anfra-query` and `data-anfra-control`. |
| **Handle** | The attribute that marks a node, e.g. `data-anfra-query="trend"`. Copied so an agent can find the node. |
| **Request** | One `submitQuery` call the host's backend answered, recorded by the inspector. |
| **Issue** | Something wrong: a failed query, a structure problem, or a wiring check at warn or error level. |
| **Trust level** | 1–3: how far an app's numbers trace back to the semantic layer (§4.3). |

## 3. Layout and entry points

The inspector is a **docked, resizable panel** to the right of the stage. Its default width is
320px, with a minimum of 220px and a maximum of 60%. The app stays usable while the panel is open.
There is no modal or backdrop.

**Host toolbar** (owned by the host, documented here because the inspector depends on it):
- **Inspect**: toggles the panel. Closing the panel also ends picking.
- **Pick**: enters pick mode in the frame and opens the panel on Structure. Picking a node selects
  and reveals it in the tree. The frame leaves pick mode after a pick or on Escape.
- **Reload**: remounts the frame. The snapshot, request log and transient UI state reset. The
  selected tab and panel width are kept.

The inspector state also resets when the path changes or the repo revision changes (live reload).

## 4. Behavior

### 4.1 Panel shell

```
┌ Ecommerce Overview          [Copy report] [×] ┐
│ ● 4 ok  ● 1 error  ◌ 1 running  ◆ 2 dirty     │   ← status bar (new)
│ [Overview] [Structure ⚠2] [Data] [Wiring ⚠1]  │
├───────────────────────────────────────────────┤
│  tab body (scrolls)                            │
└───────────────────────────────────────────────┘
```

- **Title** _(new)_: the app's `title`. With several apps it reads "N apps", and the status bar
  totals across them.
- **Status bar** _(new)_: counts by query state, plus dirty queries. A count of zero is hidden.
  Each count links to Data with the matching filter.
- **Tabs**: Overview · Structure · Data · Wiring, in that order. A tab shows a badge with its issue
  count, if any. Structure counts structure problems. Wiring counts checks at warn or error level.
  Data counts failed queries.
- **Default tab**: Overview _(new; today it is Structure)_. Pick always switches to Structure.
  Opening the panel again keeps the tab it was closed on.
- **Copy report** _(new)_: copies the report (§4.7) as JSON. A toast says "Report copied", or
  "Couldn't copy: logged to the console" if the copy fails, in which case the report is logged.
- **Close**: the same as the toolbar's Inspect.

**States**, shared by every tab:

| State | What shows |
| --- | --- |
| No snapshot yet | "Waiting for the Data App…" |
| Snapshot with no apps | "This Data App hasn't created an SDK app." Structure still works. |
| Frame failed to mount | The stage shows the error. The panel says "The Data App didn't load." |

### 4.2 Multi-app

When the frame has more than one app, Data and Wiring group by app under a header like
"App 2 · Sales · Europe/Paris · unapplied changes". Overview shows one trust card per app. With a
single app there is no app header.

### 4.3 Overview _(new)_

The landing tab. It answers "is this app healthy, and where do I look?"

1. **Trust card**: a 3-bar meter, a level name and a sentence of why. An (i) tooltip lists all the
   levels. One query's level is the first rule that matches:
   1. *Unverified*: the query declares no dataset.
   2. *Verified, with failures*: the query is in the `error` state.
   3. *Semantic layer verified*. If some result columns are `adhoc`, it adds "· N ad hoc fields".

   The app's level is its lowest query's level. An app with no queries is level 1 ("No queries
   found"). The old inspector's level 4 ("Endorsed") is dropped until the SDK reports endorsement.
2. **Stat cards**, in a 2-column grid. Each one is a button that jumps somewhere:
   - **Issues** (errors · warnings): goes to the first place with issues, in this order: Data with
     the Errors filter, then Wiring checks, then Structure.
   - **Queries** (ok / error / running / idle): goes to Data › Queries.
   - **Controls** (count, and how many are unapplied): goes to Data › Controls.
   - **Last request** (time, duration, cache or database): goes to that query's row in Data.
3. **Issues list**: the five most severe issues, each a link to where it is (a query row, a check
   or a structure node). "Show all" appears when there are more.
4. **Environment** (collapsible, closed by default):
   - SDK version
   - reader: name · email · role
   - reader timezone vs app timezone, with a warning if they differ
   - permissions: `canViewGeneratedSql`, `canExportData`
   - the datasets in the frame's provision, by name
   - the request count for this mount

### 4.4 Structure

The page's marked elements as a tree, the same as today:

- Each node shows a kind pill (container, block, query, control), its id or name, its label, and a
  ⚠ when it has problems (the tooltip lists them).
- **Hover** highlights the node in the frame. Leaving the tree clears the highlight.
- **Click or Enter** selects the node and scrolls it into view in the frame (locate).
- On hover or focus, a row shows **Copy handle** (`[Label](data-anfra-block="id")`, or just the
  attribute), and for queries and controls with no problems, **Show in Data**.
- **Picked** node: it is selected, its ancestors expand and it scrolls into view.
- Collapsed nodes stay collapsed across snapshots.
- **Empty**: "Nothing is marked yet. Add data-anfra-container, … and they show up here."

_(new)_ A filter box at the top narrows the tree to matching nodes and their ancestors. A
"Problems only" toggle shows only nodes that have problems.

### 4.5 Data

Every app's queries, controls and selection. Each item is one line until opened. Which items and
sections are open, and the code tab chosen, survive new snapshots.

**Toolbar** _(new)_: a search box (matches name, dataset or label) and a segmented filter,
**All · Errors (n) · Dirty (n)**. The filter applies to queries and controls; selection always
shows. When nothing matches: "No queries match '…'."

**Query row**
- Summary line: a state dot (it pulses while executing), the name, the dataset _(new)_, a "dirty"
  tag, and on the right the row count or "—". A ⟲ "cache" tag shows when the last result was
  cached _(new)_.
- An error shows under the line, opened or not: `ErrorName: message`, plus the HTTP status if
  there is one _(new)_.
- Locate button: scrolls the frame to where the query is drawn. It is disabled, with a reason, when
  nothing is marked for it.
- Opened, it shows:
  - **Fields**:
    - Drawn: "In N places: blocks …" plus copy handle
    - Selected rows
    - Page and "more available" _(new)_
    - Source: cache or fresh run, at time
    - Duration: from the request log _(new)_
  - **Inputs** _(new)_: one row per mapping and cross-filter that feeds this query. Columns are
    source (control or query, a link that reveals it), field, and current value. A cross-filter
    from the query itself reads "itself".
  - **Columns** _(new)_: name, label, measure or dimension, aggregation, and an ad hoc tag.
  - **Code**: the tabs **Declared AQL** _(new)_ · Executed AQL · SQL · Signature, with copy. It
    opens on the first tab that has content. The chosen tab is per query _(changed: today it is
    shared by all queries)_. Empty tabs say why:
    - "Not run yet"
    - "Needs canViewGeneratedSql" (no SQL while the reader lacks that permission)
    - "Not returned"
  - **Requests** _(new)_: this query's recent requests from the log, newest first. Each line shows
    the time, the duration, cache or database, page, and the row count or error. Opening a request
    shows its `input` (filters, conditions, sorts, date drills) as JSON, and a **row preview**: the
    first 20 rows in a scrolling table, plus a note when there are more.

**Control row**
- Summary line: the name, the current condition (or "not set"), and an "unapplied" tag.
- Opened, it shows:
  - Kind (filter or date drill)
  - Set to and Applied
  - Default, from the declaration _(new)_
  - Options: fixed, loaded, or not loaded
  - **Maps to** _(new)_: links to the queries it maps to, with field and aggregation
  - Drawn

**Selection**: Current and Applied, each showing the source query, row count, conditions,
expression, and a "lossy" warning that explains that some selected values can't be expressed as a
filter.

**Unattributed requests** _(new)_: requests that matched no query (§5.3) appear in an
"Other requests" section at the end, so nothing is hidden.

### 4.6 Wiring _(new)_

How the app is put together, from `declaration`. One group per app.

1. **Counts**: queries · controls · mappings · cross-filters.
2. **Matrix**: rows are queries, columns are controls, then a "cross-filtered by" column. A cell
   shows ● when mapped (tooltip: field and aggregation) and · otherwise. Row and column headers are
   links that reveal the entity in Data. The matrix scrolls sideways inside its box; the panel never
   scrolls sideways.
3. **Checks**: static lint for mistakes the SDK reports late or never:
   - ✕ error: a cross-filter spans different datasets.
   - ⚠ warn: a control maps to no query, so it has no effect.
   - ⚠ warn: a date drill maps to a field that the query's AQL never mentions (whole-name match),
     so the grain never changes.
   - ℹ info: a query has no controls and no cross-filters, so it never changes.

   Each check links to the entity it is about. When there are none: "No issues found."
4. **Declaration**: the app's declaration written back out as JS (`createQuery`, `createFilter`,
   `createDateDrill`, `mapControl`, `mapCrossFilter`), syntax-highlighted and copyable. It is meant
   for pasting to an agent or diffing against the source.

### 4.7 Copy report _(new)_

One JSON document, enough to debug from with no screen:

```ts
interface InspectorReport {
  inspector: string;            // inspector version
  capturedAt: string;           // ISO time
  host: { name: string; sdkVersion?: string; path?: string };
  reader?: { name; email; role; timezone; permissions };
  apps: Array<InspectedApp & { trust: Trust; checks: Check[] }>;
  structure?: { problems: Array<{ node: string; handle: string; problems: string[] }> };
  requests: RequestEntry[];     // the log (§5.3), without `preview`
}
```

The full structure tree is left out to keep the report small. Only nodes with problems are listed.
Row previews are left out because they may hold sensitive data. Row counts and columns stay.

### 4.8 Cross-navigation

Every link inside the panel resolves to one action, `reveal(target)`. `target` is one of:
- `{ tab }`
- `{ entity: query | control, app, name }`
- `{ check, app, index }`
- `{ node }`

Revealing an entity switches to Data, clears a search or filter that would hide it, opens its
section and row, scrolls it into view, and flashes it briefly. Today's "Show in Data" is one case
of this.

### 4.9 Keyboard and accessibility

- Tabs are a WAI-ARIA tablist (from shadcn Tabs): arrow keys, Home and End move between tabs.
- The tree uses `role="tree"` and `treeitem`. Enter locates the node _(new: ←/→ collapse and
  expand)_.
- Row toggles are buttons with `aria-expanded`. Errors use `role="alert"`.
- Escape in the panel's search box clears it. Escape is not used to close the panel, because the
  frame uses it for pick.
- Every icon-only button has an `aria-label` and a tooltip.
- Light and dark themes come from the host's tokens. There are no hard-coded colors outside the
  kind pills and state dots, and those have dark variants.

## 5. Structure

### 5.1 Folder

```
src/inspector/
  SPEC.md                 this file
  index.ts                the public API; the only file a host imports from
  source.ts               InspectorSource and the types the host provides
  model/                  pure TypeScript: no React, no DOM, unit-tested
    view-model.ts         snapshot + requests → InspectorModel (per app: queries, controls, inputs, issues)
    trust.ts              query and app trust levels
    checks.ts             wiring checks
    declaration-code.ts   declaration → JS text
    report.ts             InspectorModel → InspectorReport
    requests.ts           request log store + attribution to queries
    format.ts             formatCondition, formatTime, handles, usage (today's lib/inspect.ts)
    highlight.ts          tiny AQL/SQL/JS tokenizer for code blocks
  ui/                     React; imports only from model/, source.ts and the host's shadcn ui
    inspector.tsx         shell: header, status bar, tabs, reveal()
    use-inspector.ts      subscribes to the source, builds the model, holds UI state
    overview/  structure/  data/  wiring/
    shared/               code-block, fields, section, row, copy-button, empty-note, stat-card
```

Rules:
- `model/` depends on SDK **types** only, so it could serve a non-React host.
- `ui/` never touches the SDK or the frame. It reads the model and calls the source.
- Nothing outside `src/inspector/` imports from inside it except through `index.ts`.
- Inside the folder, imports are relative. The only `@/` imports are the host's shadcn primitives
  (`@/components/ui/*`) and `cn` (`@/lib/utils`), so the folder can move as is.
- SDK types come from `@holistics/anfra-sdk/common`, never from the host's `data-app.ts`.

### 5.2 The host contract

```ts
/** Everything the inspector needs from a host. One per mounted frame. */
export interface InspectorSource {
  /** Latest snapshot, or undefined until the frame reports. */
  getSnapshot(): { apps: InspectedApp[]; structure: InspectedStructure } | undefined;
  /** The request log for this frame (see recordRequests). */
  requests: RequestLog;
  /** Who reads the app, and what the frame was provisioned with. */
  env: { reader: User; datasets: Record<string, DatasetDescriptor>; sdkVersion?: string; hostName: string; path?: string };
  /** Called when the snapshot or the log changes; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  highlight(node: string | null): void;
  locate(target: LocateTarget): void;
}

export function recordRequests(backend: Backend, options?: { limit?: number; previewRows?: number }): {
  backend: Backend;   // pass this to mountDataApp instead
  log: RequestLog;
};

export function Inspector(props: {
  source: InspectorSource;
  /** Node picked in the frame; the host owns pick mode. */
  picked?: string;
  tab?: InspectorTab; onTab?(tab: InspectorTab): void;
  onClose(): void;
}): JSX.Element;
```

In this host, `src/data-app.ts`'s `mount()` wraps `coreApiBackend` with `recordRequests` and
returns the log on `DataApp`. `App.tsx` builds the source from the stage and renders `<Inspector>`
in its resizable panel. The toolbar, pick mode and the panel slot stay host code.

### 5.3 Request log

- Each `submitQuery` records an entry:
  `{ id, at, durationMs, dataset, aql, input, page, pageSize, bustCache, status: 'ok' | 'error' | 'aborted', fromCache, numRows, columns, preview (first 20 rows), error }`.
  It records each `fieldSuggestions` call too, with no preview.
- **Attribution**: a request carries the *declared* AQL; filters and sorts are in `input`. So a
  request belongs to the queries whose `declaration.queries[name]` has the same `dataset` and
  `aql`. This is checked across every app in the frame:
  - If more than one query matches, the request is listed under each one, tagged "shared".
  - If none match, the request is unattributed and goes under Other requests.
- **Retention**: the last 200 requests per frame, in memory only. The log is cleared on remount.
  Rows beyond the preview are never kept.
- An aborted request (the SDK cancelled it) is logged as `aborted`, not as an error.

### 5.4 Data flow

```
frame ──postMessage──▶ mountDataApp ──onInspect──▶ source.getSnapshot ─┐
frame ──anfra:request─▶ recordRequests(backend) ──▶ RequestLog ─────────┼─▶ useInspector ─▶ model ─▶ ui
                                                    │                   │        (memoized per snapshot)
                                     coreApiBackend ▼                   │
                                            POST /api/core.query        │
ui ──highlight/locate──▶ source ──▶ DataApp.highlight / locate ─────────┘
```

The model is rebuilt only when the snapshot or log changes; the source's `subscribe` drives
`useSyncExternalStore`. UI state (tab, open rows, filters, code tabs) lives in `useInspector`, so
it survives new snapshots.

## 6. Porting to another host

What the next host needs:
1. React 19, Tailwind v4 and the shadcn primitives the inspector uses: `badge`, `button`,
   `collapsible`, `input`, `tabs`, `tooltip`, plus `cn` from `@/lib/utils`. If its paths differ,
   change the imports in `ui/` (one search-and-replace on `@/components/ui`).
2. Copy `src/inspector/`.
3. Wrap its backend with `recordRequests`, keep the snapshot from `onInspect`, and build an
   `InspectorSource` (about 30 lines; this host's version is the example).
4. Render `<Inspector source={…} onClose={…} />` wherever it docks panels, and call
   `setInspecting(true)` on the frame while it shows.

If the inspector ever needs to run outside React, `model/` already stands alone. Only `ui/` would
need rewriting.

## 7. Out of scope

- Running, editing or re-executing anything from the panel.
- Full result sets. The SDK leaves rows out of snapshots on purpose (anfra ADR 0007), and the
  inspector keeps only a 20-row preview, captured on the host side.
- Persisting the log across reloads, or exporting it as a HAR file.
- The old in-frame inspector's features that depended on patching: tracked control history,
  `lastExecute` summaries, and the "introspected" mode.

## 8. Decisions

- **Default tab**: Overview.
- **Request log limits**: 200 requests per frame and 20 preview rows.
- **Copy report has no rows**: row previews stay in the panel and are left out of the report,
  because they may hold sensitive data.

## 9. Open questions

1. **Status bar vs tab badges.** Is having both redundant in a 320px panel? Decide once the
   panel's new design can be tried out.

## 10. Todo

- Add vitest and unit tests for `model/` (trust, checks, declaration code, report, request
  attribution). The repo has no test runner yet.
