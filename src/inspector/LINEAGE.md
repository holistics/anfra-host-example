# Inspector: Lineage

The Lineage tab in depth: the graph it builds, how a path is found, how it is laid out, and what the
host gives it. [SPEC.md](./SPEC.md) §4.10 is the summary of what a reader sees; this file is what a
reimplementation needs. The graph is built in `model/lineage.ts` (pure); the canvas is in
`ui/lineage/`.

Numbers and colours here are today's values, not requirements.

## 1. The graph

### 1.1 Kinds and columns

Left to right, one column per kind (ELK partitions, in this order):

**control → block → query → metric → dimension → dataset → model → table**

A card stays in its kind's column even when it has no edges (a block whose query returns nothing
stays with the blocks).

### 1.2 Nodes

| Kind | Id | Comes from |
| --- | --- | --- |
| control | `control:{app}/{name}` | A control that a `control` mapping links to a query in the graph. Mappings to a query the graph doesn't have are skipped. |
| block | `block:{structureKey}` | A block in the structure that holds a query marker, or is in the query's `usage[…].blocks`. |
| query | `query:{app}/{name}` | Every declared query. With several apps, its card names the app (title, or "app N"). |
| metric / dimension | `metric:{parent}.{child}`, `dimension:{parent}.{child}` | Each query's non-ad-hoc result columns. `isMeasure` makes a metric. `parent` is `column.modelId ?? dataset`, `child` is the field name. Shared by every query that returns it. |
| dataset | `dataset:{fqn}` | The query's declared dataset. |
| model | `model:{fqn}` | The models a field reaches (§1.4). Its identity is the catalog fqn, resolved from a bare name through `tables` (§2). |
| table | `table:{dataSource}/{table}` | The model's `table` and `dataSource`. Not an entity of its own. Shared models and tables are drawn once. |

Card content:
- **Control**: the applied condition (`appliedCondition`, what queries last ran with) formatted as
  its **Value**, or "not set". A pending edit (`isDirty` and a different condition) shows as a muted
  `pending: …` line under the value. It changes neither the value nor the edge's colour, as in the
  Queries tab's Filters.
- **Metric / dimension**: label, description and definition from
  `metricDocs[dataset][modelId.field | field]`; the name shows `· aggregation` when it has one. A
  field whose trace failed shows the trace's error.
- **Model**: label and description from `tables`, and as chips the fields the page reads from it.

### 1.3 Edges

Every edge carries a set of `fields`: the field node ids that flow along it. That set is what makes
a path precise (§1.5).

| Edge | Id | Means | Carries |
| --- | --- | --- | --- |
| block → query | `{src}->{tgt}` | uses | the query's fields; the query id itself if it hasn't run |
| query → metric/dimension | `{src}->{tgt}` | uses | that field |
| field → dataset, field → model | `{src}->{tgt}` | built from | that field |
| model → table | `{src}->{tgt}` | built from | every field that flows into the model |
| control → query | `{src}->{tgt}` | **filters** | the query's fields (or the query id) |
| query → query (cross-filter) | `crossFilter:{app}/{id}` | **filters** | the target's fields |

"Uses" and "built from" edges point from what uses to what it is built from, and are purple.
"Filters" edges are not part of where a number comes from; they say what changes it.
- A control's edge is **active** (orange) when the control has an applied value, and inactive (light
  gray) when it is not set.
- A cross-filter is **active** while the app's applied selection is in its source query
  (`appliedSelection.source`), and inactive otherwise, including while a selection is only pending.
- A cross-filter from a query to itself is drawn too.

An edge with no `fields` passes everything (§1.5).

### 1.4 Tracing fields to models

The tab asks `env.lineage.trace` for every field at once, as `{ parent, child }` targets. Ad-hoc
columns are skipped. The answer has a `diagram` per field: cards (each with a type and props), with
sections and nodes, joined by typed links.

- The walk starts at the section node whose `props.fqn` is `parent.child`.
- It follows `refers` links transitively.
- Any node it reaches inside an `aml.model` card is a model field; its card gives the model. The
  card's `props.table_name` and `data_source_name` are the fallback when `tables` has no entry.
- When the trace has no answer for a field (no lineage, the call failed, or no diagram), metrics
  and dimensions fall back to `column.modelId` as their model; a metric without one stops at its
  dataset.

### 1.5 The path of a card

A click pins a card; its path stays lit and everything else dims (cards to 0.3, edges to 0.15).

1. **What the card carries.** A field card carries itself. Any other card carries the union of the
   `fields` on its edges, leaving out a cross-filter it is the source of.
2. **Walk.** From the card, follow edges in both directions whose `fields` share something with
   what the card carries, or that carry nothing. Repeat from each card reached.
3. **Cross-filters.** Going downstream, the walk stops at a cross-filter's target: pinning the
   source lights the edge and the target query, but nothing reached only through the target (its
   fields, datasets, models, tables). Pinning the target still walks up to the source.

So a metric lights the models it reads, not every model of its dataset.

### 1.6 Filter and focus

- **Hiding a kind** joins across it. For each hidden card, every incoming edge is joined to every
  outgoing edge whose fields overlap; the joined edge carries the intersection. An edge that
  carries nothing joins with anything and the joined edge carries the other's fields.
- The joined edge's kind comes from the edge into the hidden card, else the one out of it, so a
  control's joined edge still "filters". Two joins with the same id and kind merge: their fields
  are unioned and `active` is OR-ed.
- When a joined edge meets a plain edge between the same two cards, it sits beside it with the id
  `{src}->{tgt}:{kind}` instead of replacing it.
- Hiding queries also hides cross-filters, since they join two queries.
- **Focus** keeps one card and its path (§1.5).

## 2. The host contract

```ts
interface LineageSource {
  /** Each field's lineage, in the order asked: the `lineage` plugin's `lineage.trace`. */
  trace(targets: LineageTarget[], signal?: AbortSignal): Promise<LineageResult>;
  /** Every model's database table, by the model's fqn and also by its bare name. */
  tables(signal?: AbortSignal): Promise<Record<string, ModelTable>>;
}

interface ModelTable {
  model: { fqn: string; name: string; label?: string; description?: string };
  table?: string;       // `schema.table`; absent for a query model
  dataSource?: string;
}
```

In this host (`src/data-app.ts`, `lineageSource`):
- `trace` is the `lineage` plugin's `lineage.trace`, called as the host page on the open frame's
  plugin host, so it passes the same middleware as the app's own `Anfra.lineage()` but is not in the
  request log.
- `tables` is a `core.search` for `type:aml.model`. Each entity's `properties` give `fqn`, `name`,
  `label`, `description`, `table_name` and `data_source_name`. Each is stored under its fqn, and under
  its name unless a model already took it.

Both read the catalog `anfra ingest` built, not the warehouse.

## 3. Fetching and caching

- The trace key is the sorted `parent\0child` targets, joined with `|`. The tab traces again only
  when the key changes.
- The answer and the tables are kept in panel state (`LineageFetch`), so switching tabs doesn't trace
  again. A ready trace is reused; only tables that failed are asked for again. A failed trace is
  retried on the next mount of the tab.
- If asking for the tables fails, they are not remembered as empty: models show without their
  tables, and the next trace asks again.
- **Banners**, one per cause:
  - no `env.lineage`: tables and the catalog's fields are unavailable
  - the trace failed: it needs a catalog built with `anfra ingest`
  - the tables failed: models show without their tables

## 4. Layout

ELK `layered`, run in a web worker. ELK is loaded once and retried on failure (`retryable.ts`).

| Option | Value |
| --- | --- |
| direction | RIGHT |
| partitioning | on; partition = the kind's index (§1.1) |
| separateConnectedComponents | false |
| spacing between layers / between nodes | 80 / 28 |
| node placement | BRANDES_KOEPF |
| considerModelOrder | NODES_AND_EDGES |
| card size | measured; 240×80 until measured |

- **Cross-filters are left out of the layout**, so queries stay in the one query column. Queries
  joined by a cross-filter are put next to each other in the model order (`orderForLayout`), which
  ELK then tends to keep. It is a hint, not a guarantee.
- **Cross-filter lanes.** Each card gets one handle on its right side per cross-filter it touches,
  spread evenly (`(i+1)/(n+1)` of its height). Each edge leaves the source, runs out to a lane and
  back into the target, as a smoothstep path with radius 8. Edges are ranked by vertical span after
  layout, and the lane's offset is `18 + 12 × rank`, so shorter loops nest inside longer ones.
- **Relayout.** The layout key is the graph's shape (node and edge ids) plus card sizes rounded to the
  pixel. A size change (a long value wraps, a model gains chips) lays out again without refitting;
  a shape change also refits.

## 5. View

- **First layout**: nothing (no cards, no edges) shows behind a "Laying out lineage…" spinner until
  the first layout is placed and fitted, then fades in. Later layouts glide (200ms).
- **Failure**: if ELK fails to load or run, "Couldn't lay out the lineage." with the error and
  **Retry**, which loads and lays out again.
- **Fit**: padding 0.12, max zoom 1, min zoom 0.6 in the panel (0.2 in the modal). Zoom range
  0.1–2.
- **Center** (on a pick or reveal): zoom `max(current, 0.8)`, 250ms.
- **Expanded**: the same canvas, filters and pin in a large modal with a minimap. Escape there closes
  the modal and keeps the pin.
- **Pins on the page**: pinning a block or query also outlines it on the page (`highlight`).
- **Edge legend**: a (?) popover says what purple, orange and gray edges mean.

| Edge | Colour | On the path |
| --- | --- | --- |
| uses / built from | `#a78bfa` | `#7c3aed` |
| filters, active | `#fb923c` | `#ea580c` |
| filters, inactive | `#e5e7eb` | `#9ca3af` |

On the path, edges are 2px wide (1.25px otherwise), with a 14px arrow. Kind accents on cards are
Tailwind colours: control orange, block indigo, query emerald, metric teal, dimension sky, dataset
amber, model violet, table slate.

## 6. Pick

A pick that chooses Lineage (SPEC.md §3) pins the first card of the picked subtree that the canvas
draws, in tree order, and centers it. It waits for a running trace to settle first. If no card is
drawn (a filter or focus hides them all, or the subtree holds nothing the canvas draws), nothing is
pinned and a dismissible note says so.
