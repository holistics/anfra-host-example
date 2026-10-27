# Inspector

A devtool over a running Data App: what it declared, what state it is in, how its parts are wired,
and what it asked the backend. This spec comes before the code. When the two disagree, fix one of
them on purpose; disagreements known today are listed in §9.

Status: **built**, except what is marked _(not built yet)_.

**How to read this spec.**
- Quoted UI text ("Waiting for the Data App…") is the text the UI shows. Change both together.
- Numbers for widths, durations, colours and zoom levels are today's values, given so a port can
  match them. They are not requirements unless a section says so.
- The Lineage tab's graph model, layout and its host contract are in [LINEAGE.md](./LINEAGE.md).
  §4.10 here is the summary.

---

## 1. Principles

- **Read-only.** The inspector never executes a query, sets a control or changes a selection. The
  only things it does to the page are highlight, locate, pick and (when the host offers it)
  download a picture of a block, none of which change the app's state.
- **Host-side.** It runs in the host page, not in the Data App's frame. It learns about the frame
  from the SDK's inspection snapshots and from the host's own backend. It never patches SDK methods
  or reads the frame's globals.
- **Live while open.** The frame posts snapshots only while it is watched (`inspect.watch` with
  `true`). The panel repaints on each one. The request log is the exception: the host records it all
  the time, so requests made before the panel opened still show.
- **Portable.** Everything lives in `src/inspector/`. It takes from the host one `InspectorSource`
  object, the shadcn primitives and a few npm packages (§6).
- **Says why.** An empty, missing or disabled thing always says why ("Not run yet.", "No element is
  marked …", "Needs canViewGeneratedSql.").

## 2. Glossary

| Term | Meaning |
| --- | --- |
| **Frame** | The sandboxed iframe running one Data App definition. |
| **App** | One `Anfra.createApp()` inside the frame. A frame can hold several, addressed by index (`0`, `1`, …). An entity of app `n > 0` is named `n/name` in ids and handles. |
| **Query** | A declared `createQuery(name, {dataset, aql})`. It has a state: `idle`, `executing`, `success` or `error`. |
| **Control** | A filter or a date drill. It has a *condition* (what the reader set) and an *applied condition* (what queries last ran with). |
| **Mapping** | A control → query link on a field, optionally with an aggregation. |
| **Cross-filter** | A query → query link: a selection in the source query filters the target. |
| **Dirty** | Re-running would give something new: a query whose inputs changed, or a control whose condition differs from the applied one. At app level this is `hasChanges`. "Dirty" counts add dirty queries and dirty controls. |
| **Changed** | A control whose condition differs from the one its declaration starts with (its default). Not the same as dirty. |
| **Snapshot** | One `inspect.snapshot` event from the frame (`{ apps: InspectedApp[], structure: InspectedStructure }`), posted while the host watches. It has no rows. |
| **Structure** | The tree of elements the markup marks with `data-anfra-container`, `data-anfra-block`, `data-anfra-query` and `data-anfra-control`. |
| **Handle** | The attribute that marks a node, e.g. `data-anfra-query="trend"`. Copied so an agent can find the node. |
| **Request** | One call the frame made through the host's plugins (`core.submitQuery`, `export.query`, `lineage.trace`, …), recorded by the inspector's middleware. |
| **Issue** | Something wrong: a failed query, a structure problem, or a wiring check at warn or error level. |
| **Trust level** | 1–4: how far an app's numbers trace back to the semantic layer (§4.3). Level 4 is defined but not reached yet. |

## 3. Layout and entry points

The inspector is a **docked, resizable panel** to the right of the stage. Its default width is
440px, with a minimum of 220px and a maximum of 60%; the stage keeps at least 30%. The app stays
usable while the panel is open. There is no modal or backdrop. The panel unmounts when closed, so its
width resets to the default when it opens again.

**Host toolbar** (owned by the host, documented here because the inspector depends on it). Each
button has a shortcut; Cmd/Ctrl+K opens a command palette over the same actions.
- **Inspect** (Alt+Shift+I): toggles the panel. Closing the panel also ends picking.
- **Prompt** (Alt+Shift+P) and **Versions** (Alt+Shift+V): toggle their own panels, in the same slot
  as the inspector. Only one of the three shows at a time.
- **Comment** (Alt+Shift+C): picks a node to comment on (`src/comments/SPEC.md`). It shares the
  frame's one pick mode with Pick: starting either ends the other.
- **Reload**: remounts the frame. The snapshot, request log and transient UI state reset. The
  selected tab is kept.

**Pick** is a toggle in the panel's header. The host owns pick mode; the panel shows its state
(`picking`) and asks the host to toggle it (`onTogglePicking`). Pick enters pick mode in the frame
and opens the panel. A pick needs the structure, which the frame posts only while watched, so the
host watches while picking even with the panel closed.

Picking a node holds it highlighted and opens the **pick menu** beside it (anchored to the clicked
element's rect and following it as the frame scrolls, like the comment card in
`src/comments/SPEC.md` §4.3; with no rect, at the top centre of the stage). It asks what to check:
- **Data** ("Underlying data"): opens the card of the first query at or below the node, in Data,
  switches to that tab, and scrolls the card into view with a flash.
- **Queries** ("How data is constructed"): opens the row of the first query or control at or below
  the node, in Queries.
- **Lineage** ("Where it comes from"): pins the first node of the picked subtree that the canvas
  draws (a control, block or query) and centers it, in Lineage. If none is drawn (a filter or focus
  hides them all, or the subtree holds nothing the canvas draws), nothing is pinned and a
  dismissible note says so. The pin waits for a running lineage trace to settle.
- **Structure** ("Its place in the page"): selects the node and reveals it in the tree.

Hints show on hover or focus. Data and Queries are disabled (`aria-disabled`, hint "None here") when
the node holds no query (Data) or no query or control (Queries). The menu names the node (kind pill
and label); Up and Down move between its choices and wrap, Home and End go to the ends. It closes on
Escape, a click outside, a choice, or when the node leaves the structure; closing it lets go of its
own highlight (not a comment card's) and navigates nowhere. The tab the panel is on doesn't change
what a pick does.

A pick that lands before the frame's structure waits up to 2s for it, then shows "Couldn't find that
element in the page's structure." The frame's pick report doesn't carry modifier keys or a position,
so the host's injected script posts each click's position and element just before it; the host pairs
the two when they arrive within 500ms. The frame leaves pick mode after a pick or on Escape.

A host without a pick menu passes `picked` with no `to`; the pick then goes to Structure.

The inspector state also resets when the path changes or the repo revision changes (live reload).

## 4. Behavior

### 4.1 Panel shell

```
┌ Ecommerce Overview              [Pick] [Copy report] [×] ┐
│ L3 Semantic layer verified  ● 4 ok  ● 1 error  ● 1 running  ● 2 dirty │  ← status bar
│ [Overview] [Data] [Queries ⚠1] [Lineage] […]              │
├──────────────────────────────────────────────────────────┤
│  tab body (scrolls)                                       │
└──────────────────────────────────────────────────────────┘
```

- **Title**: with no apps, the path (or "Inspect"); with one app, its `title`, else the path, else
  "Untitled"; with several, "N apps", and the status bar totals across them.
- **Status bar**:
  - A trust pill, "L*n*" and the level's name, which opens the trust popover (§4.3).
  - Counts of ok, error, running and idle queries, and of dirty queries plus dirty controls. A count
    of zero is hidden; with every count zero it reads "No queries".
  - Each count opens Queries. Error sets the Errors filter, dirty sets the Dirty filter, and the
    rest set All.
- **Tabs**: Overview · Data · Queries · Lineage, then Structure · Declaration.
  - Structure and Declaration start hidden behind a "More tabs" (…) menu. Choosing one from the
    menu, or any link to it, adds it to the bar, where it stays until the app or path changes.
    Focus moves to the tab that opened.
  - A tab shows a badge with its issue count when it is above zero: Queries counts failed queries,
    Structure counts structure problems, Declaration counts checks at warn or error level. The menu
    item shows the same count. Overview, Data and Lineage have no badge.
- **Default tab**: Overview. The host holds the tab, so reopening the panel keeps the tab it was
  closed on. Pick goes to the tab chosen in the pick menu (§3).
- **Copy report**: copies the report (§4.7) as JSON, indented by 2. The button's tooltip says
  "Report copied", or "Couldn't copy: logged to the console" if the clipboard refuses, in which case
  the report is logged.
- **Close**: the same as the toolbar's Inspect.

**States**, shared by every tab:

| State | What shows |
| --- | --- |
| No snapshot yet | "Waiting for the Data App…" |
| Snapshot with no apps | "This Data App hasn't created an SDK app." Structure still works. |
| Frame failed to mount | The stage shows the error. _(not built yet)_ The panel says "The Data App didn't load." |

### 4.2 Multi-app

When the frame has more than one app, Data, Queries, Declaration and the Overview's trust cards
group by app.
- Data and Declaration put "App N · title" over each app's group.
- Queries always shows an app line, even with a single app:
  `title · timezone (or "tenant timezone") · unapplied changes | no unapplied changes`, prefixed
  with "App N" when there are several.
- Overview shows one trust card per app, labeled "App N".
- Lineage names a query or control card with its app ("App N" or the app's title) when there are
  several.

### 4.3 Overview

The landing tab. It answers "is this app healthy, and where do I look?" Top to bottom:

1. **Trust card** (one per app): a 4-bar meter, "Level N" over the level's name, and a sentence of
   why. An (i) popover lists all the levels and what each means. One query's level is the first
   rule that matches:
   1. *Unverified*: the query declares no dataset. "Not on the semantic layer: declares no dataset"
   2. *Verified, incomplete*: the query is in the `error` state ("On the semantic layer, but
      failed"), or hasn't returned yet ("On the semantic layer, but hasn't returned yet").
   3. *Semantic layer verified*. When some result columns are `adhoc`, it adds "· N ad hoc fields".
   4. *Endorsed*: defined, but never reached until the SDK reports endorsement.

   The app's level is its lowest query's level. An app with no queries is level 1 ("No queries
   found"). An app at level 3 says "All queries are semantic layer verified · N with ad hoc fields".
2. **Stat cards**: a row of three over a row of two. Each card except the last is a button:
   - **Issues** ("N errors · M warnings", or "None found"). It goes to Queries with the Errors filter
     when any query failed, otherwise to the first issue's own target.
   - **Queries** ("N ok · N failed · N running · N idle", zero parts left out): Queries, filter All.
   - **Controls** ("N unapplied", or "All applied"): Queries, filter All.
   - **Last request**: how long ago, and the query it belongs to ("no query" if it matches none,
     "Nothing has run yet" before any). It is the newest `core.submitQuery` that isn't pending. It
     goes to that query's row in Queries.
   - **Last run duration**: that request's duration, and "from cache", "from database" or its status.
3. **Issues list**: errors first, then warnings, each in the order found. Per app, that is failed
   queries ("`name` failed: message") then checks; then structure problems in tree order
   ("`handle`: problem"). The first five show; "Show all N" shows the rest and becomes "Show fewer".
   Each is a link to where it is.
4. **Changes from the original** (collapsible, closed by default): each *changed* control (§2), as
   "from → to", with Highlight on the page and Show in Queries. The trigger shows "N changes" or
   "none"; open with none it reads "Every control is still as the app declared it."
5. **Environment** (collapsible, closed by default):
   - Host, SDK version
   - Reader: name · email · role, and reader timezone
   - App timezone per app ("tenant default" when unset), with a warning when it differs from the
     reader's: "The reader is in X, but the app runs in Y: dates are computed in the app's timezone."
   - Generated SQL ("can view" or "hidden") and Export ("allowed" or "not allowed")
   - Requests: "N since the app loaded"
   - Datasets (N): each dataset's label, or name

### 4.4 Structure

The page's marked elements as a tree:

- Each node shows its kind as an icon (container, block, query, control) with a tooltip, its id or
  name, its label when it differs from the id, and a ⚠ when it has problems (the tooltip lists them).
- **Hover** highlights the node in the frame. Leaving the tree clears the highlight.
- **Click or Enter** selects the node and scrolls it into view in the frame (locate).
- On hover or focus, a row shows:
  - **Copy handle** (`[Label](data-anfra-block="id")`, or just the attribute)
  - **Show in Queries**, for queries and controls with no problems
  - **Show in Lineage**, for what the Lineage canvas draws
  - **Download** a picture (PNG or PDF) of a container or block, only when the source offers
    `download`.
- **Picked** node (when Structure is chosen in the pick menu, §3): it is selected, its ancestors
  expand and it scrolls into view.
- Collapsed nodes stay collapsed across snapshots. Switching tabs resets them (§4.12).
- **Empty**: "Nothing is marked yet. Add data-anfra-container, … and they show up here."

_(not built yet)_ A filter box at the top narrows the tree to matching nodes and their ancestors. A
"Problems only" toggle shows only nodes that have problems.

### 4.5 Queries

Every app's queries, controls and selection, in sections: Queries, Controls, Selection (only when
there is one) and Other requests. Each item is one line until opened. Section headers read "N", or
"N of M" while a search or filter hides some.

**Toolbar**: a search box and a segmented filter, **All · Errors (n) · Dirty (n)**. Dirty counts
dirty queries and dirty controls. Search matches a query's name and dataset, and a control's name,
label and field. The filter applies to queries and controls; selection always shows. When nothing
matches, each section says so: `No queries match "…".`, `No controls match "…".`; with only a filter,
"No … match the filter." Controls under the Errors filter read "Controls have no error state." An
app with no controls reads "This app declares no controls."

**Query row**
- Summary line, left to right:
  - the name
  - the row count ("—" until it succeeds; tooltip "N rows" or "No rows yet")
  - a "dirty" tag, or, when not dirty and the last result came from the cache, a "cache" tag
  - on the right, the active filter count (tooltip lists each filter and its value), a **Show in
    Lineage** button, the trust bars, and the state dot (it pulses while executing).
- An error shows under the line, opened or not: `ErrorName (status): message`.
- Opened, it shows these sections:
  - **General**:
    - Dataset, as declared ("none declared")
    - Last run: `cache | database · <ago> · N ms`, from the request log
    - On the page: "In N places" (one per marker), plus ", outside any block" when no block holds
      it, or "Not on the page yet". Opened, it lists the blocks, each with Highlight on the page
      and Show in Structure, and a Copy handle for the query's attribute.
    - Cross-filters: the queries this one filters, or "No query"
    - Selected: "N rows", only when there is a selection
    - Page: "N, more available", only when more are available or the page is past the first
  - **Metrics** and **Dimensions**: the result columns split by `isMeasure`, each with a type icon,
    name, an "ad hoc" tag, and its label (or a "no label" tag). A non-ad-hoc column opens to show
    its label, description, type, format and definition from `metricDocs`. Before the query runs
    there is one **Definition** section: "Known once it runs."
  - **Filters**: every input that filters this query, with an **Active (n) · All (n)** toggle, Active
    by default ("No active filters."). An input is a control mapping, a cross-filter, or a filter
    declared in the query's own AQL (source "query"). Each row shows its source (a link that reveals
    it) with the field under it, and its current value; a cross-filter from the query itself reads
    "itself". The field sits under the source so the value keeps its width in a narrow panel.
  - **Query** (collapsed by default): the tabs **Declared AQL** · Executed AQL · Executed SQL ·
    Signature, with copy. It opens on Executed AQL, or the first tab that has content. Each query
    keeps its own tab. A tab with nothing is disabled, with the reason as its tooltip: "Not run
    yet.", "Needs canViewGeneratedSql.", "Not returned.", "Not declared." or "No signature."
  - **Requests** (collapsed by default, absent when there are none): this query's requests from the
    log, newest first, 5 at a time ("Show all N", "Show fewer"). Each line shows the time, a status
    dot, `cache | database · page N · N rows | status`, a "shared" tag (§5.3), and the duration (or
    "…" while pending). Opening a request shows its `input` (with dataset, page, page size, timezone
    and bustCache merged in) as JSON, and a **row preview**: the kept rows (§5.3) in a scrolling
    table, plus a note when there are more.

**Control row**
- Summary line: the name, its current condition when it has values (blank otherwise), an
  "unapplied" tag, an "M" badge when the control is *changed* (tooltip "Changed from the default
  value"), and how many queries it maps to.
- Opened, it shows:
  - Kind (filter or date drill)
  - Set to and Applied
  - Default, from the declaration
  - Options: fixed, loaded, or not loaded
  - **Maps to**: links to the queries it maps to, with the field
  - On the page

**Selection**: Current and Applied, each showing the source query, row count, conditions,
expression, and a "lossy" warning that explains that some selected values can't be expressed as a
filter.

**Other requests**: requests that matched no query (§5.3), at the end, so nothing is hidden.

### 4.6 Declaration

How the app is put together, from `declaration`. One group per app. (The tab's id is `wiring`.)

1. **Counts**: queries · controls · mappings · cross-filters.
2. **Checks**: static lint for mistakes the SDK reports late or never, errors first:
   - ✕ error: "Cross-filter A → B spans datasets (x → y)." It links to the source query.
   - ⚠ warn: "C is mapped to no query, so it has no effect."
   - ⚠ warn: "C → Q: field isn't in the query's AQL, so the grain never changes." A date drill's
     field is looked for in the AQL as a whole name.
   - ℹ info: "Q has no controls or cross-filters, so it never changes."

   Each check is a button that opens its entity in Queries. With none: "No issues found."
3. **Declaration code**: the app's declaration written back out as JS, in this order: `createQuery`
   (with `pageSize` when declared), `createFilter`, `createDateDrill`, `mapControl`,
   `mapCrossFilter`. Variable names are the entity names in camelCase, made unique. It is
   syntax-highlighted and copyable, for pasting to an agent or diffing against the source. With
   nothing declared: "Nothing declared."
4. **Wiring**: rows are queries, columns are controls, then a "cross-filtered by" column. A cell
   shows ● when mapped (tooltip: field and aggregation) and · otherwise. The "cross-filtered by" cell
   lists source query names (plain text, ", "-joined) or "—". Row and column headers are links that
   reveal the entity in Queries. Collapsed by default, last, and left out when there are no queries.
   The matrix scrolls sideways inside its box; the panel never scrolls sideways.

### 4.7 Copy report

One JSON document, enough to debug from with no screen:

```ts
interface InspectorReport {
  inspector: string;            // the inspector's version, today "0.2.0"
  capturedAt: string;           // ISO time
  host: { name: string; sdkVersion?: string; path?: string };
  reader: User;                 // name, email, role, timezone, permissions
  datasets: string[];           // the provisioned datasets' keys
  apps: Array<InspectedApp & { trust: Trust; checks: Check[] }>;
  structure: { problems: Array<{ node: string; handle: string; problems: string[] }> };
  requests: Array<Omit<RequestEntry, 'preview'>>;   // the log (§5.3)
}
```

The full structure tree is left out to keep the report small. Only nodes with problems are listed.
Row previews are left out because they may hold sensitive data. Row counts and columns stay.

### 4.8 Cross-navigation

Every link inside the panel resolves to one action, `reveal(target)`. `target` is one of:
- `{ tab, filter? }`: opens a tab. On Queries, it sets the filter and clears the search.
- `{ entity: 'query' | 'control', app, name }`: switches to Queries, clears a search or filter that
  would hide it, opens its section and row, scrolls it into view, and flashes it.
- `{ check, app }`: the check at that index in the app's checks, in Declaration.
- `{ lineage: 'query', app, name }`: pins the query in Lineage and centers it.
- `{ node }`: selects a structure node and reveals it in the tree.

The flash is a 1200ms fading inset ring, after scrolling the target to the nearest edge.

### 4.9 Keyboard and accessibility

- Tabs are a WAI-ARIA tablist (from shadcn Tabs): arrow keys, Home and End move between tabs.
- The tree uses `role="tree"` and `treeitem`. Enter locates the node. _(not built yet: ←/→
  collapse and expand)_.
- Row toggles are buttons with `aria-expanded`. Errors use `role="alert"`.
- Escape in a search box clears it. Escape is not used to close the panel, because the frame uses it
  for pick. In Lineage, Escape lets go of the pin; in the expanded Lineage modal it closes the modal.
- Every icon-only button has an `aria-label` and a tooltip (300ms delay).
- Light and dark themes come from the host's tokens. Fixed colours are allowed only for meaning
  (kind accents, state dots, status pills, tones, warnings), each with a dark variant. Lineage's
  edge colours are the exception, listed in LINEAGE.md.

### 4.10 Lineage

Where each number on the page comes from, as a canvas (React Flow, laid out by ELK), left to right:

**Control → Block → Query → Metric / Dimension → Dataset → Model → Database table**

with cross-filters linking one query to another. The full model is in [LINEAGE.md](./LINEAGE.md).

- **Scope**: the whole page. Blocks come from the structure. Fields are each query's non-ad-hoc
  result columns, so a query that hasn't run has none yet. Controls are the cards a control mapping
  links to a graph query; each shows its applied condition as its value, or "not set", with a muted
  `pending:` line for an unapplied edit.
- **Two kinds of edge.** A purple edge points from what uses to what it is built from. An orange or
  light-gray edge means "filters": a control's edge (orange when it has an applied value) and a
  cross-filter (orange while the app's applied selection is in its source query). Cross-filters are
  off by default.
- **Catalog**: the tab traces every field through `env.lineage` once per set of fields and keeps the
  answer across tab switches. Without `env.lineage`, or when a call fails, a banner says why (no
  lineage source, no catalog built with `anfra ingest`, or tables unavailable) and the canvas draws
  what it can.
- **Highlight**: a click on a card pins its path; everything else dims. A path follows only the edges
  that carry the card's fields. A click on the pane or Escape lets go. Pinning a block or query also
  outlines it on the page.
- **Hover buttons** on a card: Locate on the page and Show in Structure (controls, blocks, queries),
  Show in Queries (controls, queries, fields), Focus.
- **Show menu**: a "Show" dropdown with a checkbox per kind (with its count) and one for
  cross-filters ("with queries" when queries are hidden); the trigger says "N hidden". Hiding a kind
  joins the edges across it.
- **Presets** (a select beside it): Default (every kind, no cross-filters), Everything, Interaction
  mapping (controls, blocks, queries, cross-filters) and Query lineage (everything but controls and
  cross-filters). "Custom" shows once the choices match no preset. Presets leave the focus alone.
- **Focus**: keeps one card and its path. "Focused on …" above the canvas, with × to show everything.
- **View**: wheel, zoom buttons and drag. The expand button opens the same canvas, filters and pin in
  a large modal with a minimap. A (?) button explains the edge colours.
- **Layout**: nothing shows behind a "Laying out lineage…" spinner until the first layout is placed;
  later layouts glide, and a card that changes size is laid out again without refitting. If the
  layout engine fails, "Couldn't lay out the lineage." with the error and **Retry**.

Links into Lineage: the Queries row's and Data card's Show in Lineage, Structure's Show in Lineage,
and the pick menu's Lineage.

### 4.11 Data

The tables behind the page, for someone who doesn't write queries: only each query's raw result,
none of the machinery. Everything technical is in Queries (§4.5), one click away.

- **Search**: "Search tables", pinned to the top while the tables scroll. It narrows the tables by
  title; Escape clears it. When nothing matches, each app says `No tables match "…".` Its text is
  local to the tab, so no link sets it.
- **One card per query**, in declaration order, grouped by app when there are several. With none:
  "This app has no tables yet." Cards are closed by default; the title row opens one, and which are
  open survives a switch of tab.
  - **Header**: the query's name, a "couldn't load" tag when in error, the active filter count, the
    trust bars, and two buttons: **Show in Lineage** and **Query** (opens the query's row in Queries).
  - **Row-count line**: "N rows" or "First N of M rows", how long ago the rows were returned, and
    **Download CSV** (§ below).
  - **Table**: the rows kept for the latest request (below), with the columns' labels as headers.
    Each header has an icon (Σ for a metric, the type's icon for a dimension). Hovering it shows the
    field's label, Source (`dataset > model`), Type (the catalog's type, else "Metric · sum" or
    "Dimension · date"), Format ("None declared"), Formula and Description, as known.
- **Latest request**: the newest `ok` request of this query that kept rows and is on the first page,
  and isn't shared with another query (§5.3).
- **Download CSV**: an icon button with a tooltip, shown only when `canExportData` is allowed *and*
  the kept rows are every row (no later page, and the row count is within the preview). A partial
  table has no download, so no one mistakes it for the full data. The file is `<name>.csv`, UTF-8
  with a BOM, CRLF line ends, the labels as headers, and a `'` before any cell that starts with `=`,
  `+`, `-`, `@`, tab or CR.
- **States**, in plain words: "Loading this table…" before the first rows arrive, "This table
  couldn't load." when the query is in error, even if an earlier request returned rows (the reason
  is in Queries), "No rows." for an empty result, and "This table's rows aren't available here."
  when the query succeeded but its request is no longer in the log. No AQL, SQL, status codes or
  cache tags appear here.
- A pick that chooses Data opens the first query's card here (it stays open across tabs like any
  other).

### 4.12 State lifetime

Where each piece of UI state lives decides when it resets. Tabs unmount when inactive.

| State | Kept in | Survives a snapshot | Survives a tab switch | Survives closing the panel | Survives a remount |
| --- | --- | --- | --- | --- | --- |
| Selected tab | host | yes | — | yes | yes |
| Panel width | host panel | yes | yes | no | no |
| Hidden tabs shown from "…" | panel | yes | yes | no | no (path change resets) |
| Queries search and filter, open rows and sections | panel | yes | yes | no | no |
| Data open cards; Lineage kinds, cross-filters, pin, focus, trace and tables | panel | yes | yes | no | no |
| Lineage zoom and pan, expanded modal | Lineage tab | yes | no | no | no |
| Query's code tab and inner sections, "In N places", Requests "Show all" | the row | yes | no | no | no |
| Structure collapsed nodes, Overview's "Show all" and collapsibles, Data search | the tab | yes | no | no | no |
| Request log | host, per mount | — | yes | yes | no |

## 5. Structure

### 5.1 Folder

```
src/inspector/
  SPEC.md                 this file
  LINEAGE.md              the Lineage tab's model, layout and host contract
  index.ts                the public API; the only file a host imports from
  source.ts               InspectorSource, InspectorSnapshot, and createInspectorStore to provide one
  model/                  pure TypeScript: no React, no DOM
    types.ts              InspectorTab, RevealTarget, NodeRequest, PickTarget, InspectorEnv,
                          LineageSource, ModelTable, MetricDocs
    format.ts             conditions, times, handles, where an entity is drawn
    trust.ts              query and app trust levels
    checks.ts             wiring checks; control mappings and cross-filters of an app
    issues.ts             every issue in one list; query counts
    changes.ts            controls changed from their declared default
    inputs.ts             every input that filters a query, for the Filters section
    column-kind.ts        a column's kind and type, for icons and tooltips
    declaration-code.ts   declaration → JS text
    highlight.ts          a small AQL/SQL/JS tokenizer, returning plain tokens
    requests.ts           the request log, the middleware that fills it, attribution
    report.ts             snapshot + env + log → InspectorReport
    lineage.ts            the Lineage graph: build, filter, focus, a node's path
    fixtures/             recorded snapshots for tests
  ui/                     React; imports only from model/, source.ts and the host's shadcn ui
    inspector.tsx         shell: subscriptions, tabs, reveal()
    header.tsx            title, status bar, Pick, Copy report, close
    overview/  data/  structure/  queries/  wiring/
    lineage/              tab, canvas, node, toolbar; layout.ts, tables.ts, retryable.ts (pure helpers)
    shared/               code-block, copy-button, fields, result-table, mini-table, reveal, tone,
                          kind, trust bars and popover, query indicators, type icon, hover popover
```

Tests sit beside what they test (`*.test.ts`) and run with `pnpm test` (`tsx --test`).

Rules:
- `model/` depends on SDK **types** only, so it could serve a non-React host.
- `ui/` never touches the SDK or the frame at runtime. It reads the model and calls the source.
- Nothing outside `src/inspector/` imports from inside it except through `index.ts`.
- Inside the folder, imports are relative. The only `@/` imports are the host's shadcn primitives
  (`@/components/ui/*`) and `cn` and `toggleIn` (`@/lib/utils`), so the folder can move as is.
- SDK types come from `@holistics/anfra-sdk/common` (a call's `CallContext` from
  `@holistics/anfra-sdk/host`), never from the host's `data-app.ts`.

### 5.2 The host contract

`index.ts` is the contract. Its exports, by purpose:

```ts
// ── Mounting the inspector ─────────────────────────────────────────────────────
/** Everything the inspector needs from a host. One per mounted frame. */
interface InspectorSource {
  env: InspectorEnv;
  requests: RequestLog;                       // from createRequestLog
  getSnapshot(): InspectorSnapshot | undefined; // { apps, structure }; the same object until it changes
  subscribe(listener: () => void): () => void;
  highlight(node: string | null): void;       // outline a structure node, or clear it
  locate(target: LocateTarget): void;         // scroll a node or entity into view
  download?(node: StructureNode, format: RenderFormat): void; // optional: picture of a block
}

interface InspectorEnv {
  hostName: string;            // names the host in the report
  path?: string;               // the Data App's path
  sdkVersion?: string;
  reader: User;                // the reader the frame is provisioned with
  datasets: Record<string, DatasetDescriptor>;
  metricDocs?: MetricDocs;     // optional: field docs for tooltips (§6)
  lineage?: LineageSource;     // optional: catalog lineage (LINEAGE.md §2)
}

/** A log for one frame, made before the frame so its first requests are in it. */
function createRequestLog(options?: RecordOptions /* { limit?, previewRows? } */): RequestRecorder;
interface RequestRecorder {
  log: RequestLog;             // entries(): the same array until it changes; subscribe()
  record: RecordCall;          // a middleware's handle: (request, context, next) => Promise
}

/** A source plus `publish`, fed by the frame's `inspect.snapshot` events. */
function createInspectorStore(
  frame: Pick<InspectorSource, 'env' | 'requests' | 'highlight' | 'locate' | 'download'>,
): InspectorStore; // { source, publish(apps, structure) }

function Inspector(props: {
  source: InspectorSource;
  tab: InspectorTab;                 // the host holds the tab
  onTab(tab: InspectorTab): void;
  picked: NodeRequest | undefined;   // { key, nonce, to? }: a picked node and where it goes
  picking: boolean;                  // whether pick mode is on, for the header's Pick toggle
  onTogglePicking(): void;
  onClose(): void;
}): JSX.Element;

// Types: InspectorTab, NodeRequest, PickTarget, RequestEntry, RequestLog, RecordOptions,
// InspectorSnapshot, InspectorStore, InspectorReport, LineageSource, ModelTable, MetricDoc(s).
// buildReport(snapshot, env, requests): the report (§4.7), for a host that wants it elsewhere.

// ── Shared with the host's other features ─────────────────────────────────────
// The pick menu and comments name and draw nodes the way the inspector does. These are part of
// the contract on purpose, so the three features agree:
//   attributeFor(node), handleFor(node)  the node's attribute, and its Markdown handle
//   firstEntityUnder(nodes, key)         the first query or control at or below a node
//   kindIcons, kindPills                 a node kind's icon and pill classes
//   copyText(text)                       clipboard write, falling back to the console
```

Both `getSnapshot()` and `requests.entries()` must return the same object until something changes,
because the panel reads them with `useSyncExternalStore`.

In this host, `App.tsx` makes a request log and a store per mounted frame (per path, revision and
datasets). It passes `record` down to `mount()` in `src/data-app.ts`, whose one middleware on the
plugin host hands each call to the recorder of the frame it is about, and passes `publish` as
`onInspect`, which `mount()` feeds from `inspect.snapshot`. It renders `<Inspector>` in its
resizable panel. The toolbar, pick mode, the pick menu (`src/components/pick-menu.tsx`) and the panel
slot stay host code.

### 5.3 Request log

- Every call the frame starts records an entry when it is sent (`pending`) and updates it when it
  settles, with `durationMs` and either the result's fields or `error`:
  `{ id, call, caller, trace?, at, durationMs?, status: 'pending' | 'ok' | 'error' | 'aborted', … }`.
  - `call` is its full name.
  - `caller` is `frame`, or `plugin <name>` for a call a plugin made for the frame.
  - `trace` is the middleware it passed before the log, outermost first; absent when none did.
- The host page's own calls are passed on unrecorded: highlight, locate, pick, and the Lineage tab's
  own `lineage.trace` (it runs as the host page).
- What each known call keeps:
  - `core.submitQuery`: `dataset, aql, input, page, pageSize, bustCache, timezone`, and on success
    `fromCache, numRows, columns, preview`.
  - `core.fieldSuggestions`: `field` (`model.field`), `q` (what was typed), and `numRows` (how many
    values came back).
  - `export.query`: `dataset, aql, input, timezone, format, formatOptions, filename`, and `numRows`
    (the rows exported).
  - `lineage.trace`: `targets` (`parent.child`), and `numRows` (how many answered).
  - `render.save`: the picture's file name, never the file.
  - Any other call: its request as sent, in `request`.
- **Attribution**: a request carries the *declared* AQL; filters and sorts are in `input`. So a
  `core.submitQuery` or `export.query` belongs to the queries whose `declaration.queries[name]` has
  the same `dataset` and `aql`. This is checked across every app in the frame:
  - If more than one query matches, in any app, the request is listed under each one, tagged
    "shared". A shared request never feeds a query's Last run or Data table, since another query may
    have made it.
  - Other calls, and requests that match none, go under Other requests.
- **Retention**: the last 200 requests per frame, in memory only. A remount starts a new log.
  Rows beyond the 20-row preview are never kept.
- An aborted request (its signal was aborted when it threw) is logged as `aborted`, not as an error.

### 5.4 Data flow

```
frame ──inspect.snapshot─▶ mount() ──onInspect──▶ store.publish ──▶ source.getSnapshot ─┐
frame ──plugin call──▶ middleware ──record──▶ RequestLog ──────────────────────────────────┼─▶ Inspector ─▶ model ─▶ tabs
                            │                                                              │   (useSyncExternalStore)
              plugins ▼ (core, export, lineage, …)                                         │
                    POST /api/core.query, …                                                │
tabs ──highlight/locate──▶ source ──▶ inspect.highlight / inspect.locate ──────────────────┘
```

`Inspector` subscribes to the snapshot and the log with `useSyncExternalStore`, and derives
everything else from them on render. Where UI state lives is in §4.12.

## 6. Porting to another host

**Dependencies.**
- React 19, Tailwind v4, and `lucide-react` for icons.
- `@xyflow/react` (React Flow) and `elkjs`, for Lineage. `ui/lineage/lineage-canvas.tsx` imports
  React Flow's stylesheet and loads ELK in a web worker through Vite's `?worker` import. On another
  bundler, change that one import to its own worker syntax, or load `elkjs/lib/elk.bundled.js` on
  the main thread.
- These shadcn primitives under `@/components/ui/`: `badge`, `button`, `collapsible`, `dialog`,
  `dropdown-menu`, `empty`, `input`, `item`, `popover`, `select`, `table`, `tabs`, `toggle-group`,
  `tooltip`. Also `cn` and `toggleIn` from `@/lib/utils`. If the paths differ, change the imports
  in `ui/` (one search-and-replace).

**Minimal host** (every tab works; no pick, no pictures, Lineage without a catalog):
1. Copy `src/inspector/`.
2. Install the SDK's `inspectPlugin()` on the page's plugin host.
3. Per mounted frame, before its document loads:
   - `createRequestLog()`, and hand its `record` the frame's calls from a middleware matching `*`.
   - `createInspectorStore({ env, requests: log, highlight, locate })`. Feed `publish` from the
     frame's `inspect.snapshot` events. Send `highlight` and `locate` as `inspect.highlight` and
     `inspect.locate`.
   - Make a new log and store whenever the frame remounts (here: path, revision or datasets
     change), and key `<Inspector>` on it.
4. Render `<Inspector source={…} tab={…} onTab={…} picked={undefined} picking={false}
   onTogglePicking={() => {}} onClose={…} />` where the host docks panels. Call `inspect.watch` with
   `true` on the frame while it shows. (This host wraps that as `DataApp.setInspecting`.)

This is about 150 lines of glue in this host (`App.tsx` and `src/data-app.ts`).

**Optional, each independent:**
- **Pick.** Send `inspect.pick`, listen for `inspect.picked`, and watch while picking. Pass
  `picking` and `onTogglePicking`, and pass each pick as `picked` with a fresh nonce. Without a pick
  menu, leave `to` unset (Structure).
- **Pick menu.** Inject a script into the frame that posts each click's position and element, pair
  it with `inspect.picked`, and render a menu with the four choices of §3. This host's is about 250
  lines (`src/components/pick-menu.tsx` and the pick handling in `App.tsx`).
- **Pictures.** Pass `download`, rendering the block or container through the SDK's render call
  (this host saves it and reports failures in a toast).
- **Field docs.** Pass `env.metricDocs`, by dataset fqn and then by a metric's name or a model
  field's `model.field` (also under `modelFqn.field`). This host builds it from `core.show` for each
  dataset.
- **Catalog lineage.** Pass `env.lineage` (LINEAGE.md §2).

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
- **Structure and Declaration behind "…"**: most readers want data, queries and lineage; the
  page's markup and its declaration are for whoever builds the app.
- **Request log limits**: 200 requests per frame and 20 preview rows.
- **Copy report has no rows**: row previews stay in the panel and are left out of the report,
  because they may hold sensitive data.
- **Shared exports**: the inspector's node helpers (§5.2) are part of its contract, so the pick menu,
  comments and inspector name and draw nodes the same way.

## 9. Known gaps

Where the code doesn't yet do what this spec says. Fix the code.

1. The Pick tooltip says "Shift-click to open its query or control in Queries", but nothing handles
   Shift (`ui/header.tsx`). The tooltip should drop that part.
2. The Data tab doesn't skip shared requests when it picks a query's latest rows
   (`ui/data/data-tab.tsx`), so a table can show another query's rows (§4.11).
3. A level-3 query always adds "· N ad hoc fields", even "· 0 ad hoc fields" (`model/trust.ts`).
4. "The Data App didn't load." isn't shown when the frame fails to mount (§4.1).
5. The close (×) and "More tabs" buttons have no tooltip (§4.9).
6. A Lineage layout failure after the first layout is only logged; it should offer Retry (§4.10).
7. The Overview's Controls card should open Queries at the Controls section, not just the tab.
8. Imports that break §5.1's rules:
   - `src/components/versions-panel.tsx` imports `model/format`, and `src/components/prompt-panel.tsx`
     imports `ui/shared/copy-button`, not through `index.ts`.
   - `model/issues.ts` and `model/report.ts` import `InspectorSnapshot` from `../source`. Move it to
     `model/types.ts`.
   - `RecordCall` isn't exported, so `src/data-app.ts` declares its own copy.

## 10. Open questions

1. **Status bar vs tab badges.** Is having both redundant in a narrow panel? Decide once the panel's
   new design can be tried out.

## 11. Todo

- More unit tests for `model/`: trust, checks, declaration code, report, request attribution and
  changes. Lineage, column kinds and the lineage UI helpers have tests today.
