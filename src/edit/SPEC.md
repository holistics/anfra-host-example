# Edit

Change a block's query, and later its chart, from the page, without prompting the agent that wrote
the app. This spec comes before the code. When the two disagree, fix one of them on purpose.

Status: **phase 1, read-only.** The panel shows what a block queries and what its dataset offers.
Nothing can be changed yet. Later phases are marked _(not built yet)_.

---

## 1. Principles

- **Local only.** Editing writes the app's own file, so it is for a host on the author's machine.
  A hosted host shows the panel read-only. _(Saving not built yet.)_
- **The agent's file is the truth.** A saved edit goes into the app's file, where the agent sees it
  on its next change. Nothing is applied at load. _(Saving not built yet.)_
- **Reader state is not the query.** Dashboard filters, date drills, cross-filters and sort clicks
  reach a query as `input` beside its AQL. The panel shows them, read-only, and never edits them.
- **Says why.** A query that cannot be edited says why: built at runtime, or its AQL is shared.
- **Separate from the inspector.** The inspector is read-only by its own spec, and lists editing
  as out of scope. Edit reads the same snapshot and the same request log, and keeps its own panel.

## 2. Glossary

| Term | Meaning |
| --- | --- |
| **Block** | An element marked `data-anfra-block`, or any marked node a reader picks. |
| **Block's queries** | The query nodes at or under the picked node in the structure; failing that, the queries whose usage names the block. |
| **Tier** | How the host can find a query's AQL in the app's source, so it can save an edit. See §4. |
| **Source** | The app's definition, and every local script it loads with `<script src>`. |

## 3. The panel

- **Opening.** The toolbar's Edit button opens the panel and starts picking. A pick in the page
  chooses the block. Pick again from the panel's header.
- **One section per query** of the block, each with:
  - name, dataset and tier, with the tier's reason
  - **Fields:** every metric and dimension of the dataset, with a search. The ones the query uses
    are ticked and listed first. Ad hoc expressions are listed apart. _(Ticking not built yet.)_
  - **Filters in the query:** its own `filters { … }`.
  - **Dashboard filters:** the controls and cross-filters mapped to it, with their applied value.
    Read-only.
  - **Sorts:** its own `sorts { … }`.
  - **AQL:** as declared.

## 4. Tiers

Tried in order, per query.

| Tier | Found by | Edit |
| --- | --- | --- |
| 1 | A query manifest: `<script type="application/json" id="anfra-queries">` naming the query | Saved into the manifest _(not built yet)_ |
| 2 | The declared AQL appears exactly once in the source | Saved in place _(not built yet)_ |
| 3 | Not found as written, and no other query declares the same AQL | Preview only, then Copy prompt _(not built yet)_ |
| 4 | Another query declares the same AQL | Copy prompt only _(not built yet)_ |

## 5. Out of scope

Builder apps that create queries while they run, editing AML, layout, more than one user.
