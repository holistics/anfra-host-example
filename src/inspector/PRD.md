# Inspector: product overview

What the inspector is for, who it serves, and how it is meant to behave, at the level of ideas.
For exact behavior see [SPEC.md](./SPEC.md); for the Lineage graph see [LINEAGE.md](./LINEAGE.md).

---

## 1. The problem

A Data App is a page whose numbers come from queries on a semantic layer. The page and its
machinery are on opposite sides of a frame:

- **The page** shows charts, tables and filters. It doesn't say where any number came from.
- **The machinery** lives in the sandboxed frame: queries with their dataset and AQL, controls that
  feed them, cross-filters between them, and the requests sent to the backend.

When a number looks wrong, a filter seems to do nothing, or a chart stays empty, the person looking
can't see across that boundary. Neither can an AI agent that built the app and is asked to fix it.
Today the answers are scattered across the definition source, the browser's network tab, the
backend and the catalog.

The inspector puts them in one place, beside the running app.

## 2. Who it is for

| Person | What they ask | Where they start |
| --- | --- | --- |
| **Reader / analyst**: uses the app and doesn't write queries | "What data is behind this chart? Can I trust it?" | Overview, Data, Lineage |
| **App builder**: writes the definition, often with an agent | "Why is this query failing? Is this filter wired? What did it actually run?" | Queries, Declaration, Structure |
| **AI agent**: builds and fixes apps for the builder | "Give me the facts, in text I can act on." | Copy report, copied handles |

The panel is designed for the reader first and the builder one click deeper. The agent is served by
text that can be copied out: the report, handles, AQL and SQL, the declaration as code.

## 3. Goals and non-goals

**Goals**
1. **Answer "is this app healthy?" at a glance**: what failed, what is waiting, what is out of date.
2. **Connect what you see to what made it**: from any element on the page to its query, its data and
   its lineage, and back.
3. **Show what actually happened**, not only what was declared: the requests sent, what they
   returned, from cache or database, how long they took.
4. **Make trust visible**: how far each number traces back to the governed semantic layer.
5. **Hand off cleanly to an agent**: one copy gives an agent enough to debug with no screen.
6. **Be portable**: another host can adopt it by providing one small object.

**Non-goals**
- Editing or running anything. The inspector is a window, not a control panel.
- Full data access. It keeps a small preview of rows; full results stay in the app and in exports.
- Being a network or performance profiler. It records calls, not timings of every phase.
- Persisting history. What it knows lives as long as the frame.

## 4. The mental model

The inspector sees the app through three lenses, each with its own source of truth:

```
            ┌──────────── what the page draws ────────────┐
            │  Structure: containers, blocks, queries,    │   from the markup's
            │  controls, as the markup marks them         │   data-anfra-* attributes
            └──────────────────────┬──────────────────────┘
                                   │ "this block shows that query"
            ┌──────────── what the app declared and holds ┐
            │  Apps → queries, controls, mappings,         │   from the SDK's
            │  cross-filters, selection; each with state   │   inspection snapshots
            └──────────────────────┬──────────────────────┘
                                   │ "this query sent these requests"
            ┌──────────── what actually ran ───────────────┐
            │  Requests: every call to the backend, with   │   recorded by the host
            │  input, result size, source, duration, rows  │   as calls pass through
            └──────────────────────┬──────────────────────┘
                                   │ "these fields are built from"
            ┌──────────── where it comes from ─────────────┐
            │  Lineage: fields → dataset → model → table   │   from the semantic
            │                                              │   catalog, when present
            └──────────────────────────────────────────────┘
```

Every view in the panel is one of these lenses, or a join between two of them. The inspector's main
job is the joins: it is the only place that knows *this block* draws *this query*, which sent
*these requests*, which read *these fields* from *this table*.

### Key concepts

- **State vs applied.** A control has what the reader set and what the queries last ran with. When
  they differ, the app has *unapplied changes* ("dirty"): the screen is behind the controls.
- **Changed from the original.** Separately, a control can differ from its declared default. That is
  what a reader changed since the app loaded, whether applied or not.
- **Trust level.** Each query earns a level by how its numbers reach the semantic layer: no dataset
  (unverified), failed or not back yet (incomplete), returned from the semantic layer (verified,
  noting any ad hoc fields), and, later, endorsed. An app is as trustworthy as its weakest query.
- **Issue.** Anything that needs attention: a failed query, a broken marker in the markup, or a
  wiring mistake the SDK would report late or never.
- **Handle.** The attribute that marks an element (`data-anfra-query="trend"`). It is how a person
  tells an agent "this one".

## 5. Principles

- **Read-only.** It can point at things on the page (highlight, scroll to, pick) but never changes
  the app's state.
- **Outside the frame.** It never reaches into the app's code. It learns only from what the SDK
  reports and what the host records, so it can't break the app it inspects.
- **Live.** While open, it repaints on every change. Requests are recorded even while it is closed,
  so opening it late loses nothing.
- **Always says why.** Nothing is silently empty or disabled. "Not run yet." "Needs permission to
  view SQL." "No element is marked."
- **Plain words first.** The reader-facing views use no AQL, SQL or status codes. The technical
  detail is one click away, never in the way.
- **Safe to share.** The copied report leaves out row data, which may be sensitive.

## 6. The experience

### 6.1 Where it lives

A panel docked beside the app, resizable, with the app still usable. It is a companion, not a mode:
the reader can keep clicking around the app and watch the panel follow.

### 6.2 The views

Each tab answers one question. The first four are for everyone; the last two are for builders and
start tucked behind a "…" menu.

| Tab | The question it answers |
| --- | --- |
| **Overview** | Is this app healthy, and where should I look? Trust, counts, the top issues, what changed, the environment. |
| **Data** | What data is behind the page? Each query's rows as a plain table, downloadable when complete. |
| **Queries** | How is each number made? Every query and control: state, inputs, fields, the AQL and SQL, the requests and their rows. |
| **Lineage** | Where does each number come from? A map from controls and blocks through queries and fields to models and database tables. |
| **Structure** | How is the page marked up? The tree of marked elements, and what is wrong with it. |
| **Declaration** | How is the app put together? Its declaration as code, a wiring matrix, and checks for wiring mistakes. |

A small status line above the tabs is always visible: the trust level and how many queries are ok,
failed, running, idle or out of date. Each count is a shortcut to the matching list.

### 6.3 Moving between views

Everything links to everything. A query mentioned anywhere (an issue, a filter, a lineage card, a
data table) can be opened in Queries; a block can be found on the page or in Structure; a query
can be found in Lineage. Following a link always lands on the thing, opened, scrolled into view and
briefly flashed, with any search or filter that would hide it cleared.

### 6.4 Starting from the page: Pick

The most natural question starts with something on the screen: "what is *this*?" Pick lets the
reader click any element in the app. A small menu appears beside it and asks what they want to know:

- **Underlying data**: the table behind it.
- **How data is constructed**: its query or control.
- **Where it comes from**: its lineage.
- **Its place in the page**: its spot in the structure.

Choices that don't apply say so ("None here") rather than disappear. The same click target can be
used to leave a comment for an agent (see `src/comments/`); the two share one pick mode.

## 7. Key journeys

**"This chart looks wrong."** (reader)
Pick the chart → *Underlying data*: see the rows behind it. Not convinced → *Where it comes from*:
see which metric, dataset, model and table it reads, and which filters change it. The trust meter
says whether it is on the governed layer.

**"This chart is empty."** (builder)
Overview shows one failed query in its issues. Click it: Queries opens that query with its error,
the AQL it declared, the AQL and SQL it executed, and the failed request's input.

**"My filter does nothing."** (builder)
Declaration's checks flag it: the control maps to no query, or a date drill maps to a field the
query never mentions. The wiring matrix shows which queries each control reaches.

**"Why didn't my numbers update?"** (reader)
The status line shows unapplied changes. Overview's Controls card and the Queries rows mark which
controls are set but not applied.

**"Fix this for me."** (builder → agent)
Copy report, paste to the agent. It gets every app, its declaration, states, trust, checks, the
request log and the structure's problems, without the rows. For one element, copy its handle instead.

## 8. Portability

The inspector is a self-contained folder. A host gives it one object describing a mounted frame:
who reads it, its datasets, the snapshots, the request log, and a way to highlight and locate
elements. Everything else is optional and adds a capability: pick, pictures of blocks, field docs,
and catalog lineage. Without catalog lineage, the Lineage view still draws what the page and the
datasets say. The logic is pure TypeScript separate from the React views, so a non-React host could
reuse it.

## 9. What success looks like

- A reader can answer "where does this number come from?" without asking anyone.
- A builder finds the cause of a failing or empty chart from the panel, without opening the browser's
  devtools or the backend logs.
- An agent given the copied report can locate and fix a wiring or query problem without a
  screenshot.
- A second host adopts the inspector by copying the folder and writing the glue, without changing the
  inspector.

## 10. Open directions

- **Endorsement.** Trust level 4 waits for the SDK to report endorsed queries.
- **Status line vs tab badges.** Both count issues; one may be enough in a narrow panel.
- **Structure filtering.** A search and a "problems only" view for large pages.
- **Keyboard tree navigation.** Arrow keys to collapse and expand the structure tree.
