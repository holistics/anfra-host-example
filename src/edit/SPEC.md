# Edit

Change a block's query, and later its chart, from the page, without prompting the agent that wrote
the app. This spec comes before the code. When the two disagree, fix one of them on purpose.

Status: **phase 3, save and history.** With the host started with `EDIT=1`, a query at tier 2 can be
drafted, checked, previewed in the running app, saved into the file it is written in, and reverted.
Later phases are marked _(not built yet)_.

---

## 1. Principles

- **Local only.** Editing writes the app's own file, so it is for a host on the author's machine.
  A hosted host shows the panel read-only: without `EDIT=1` the server serves no write route.
- **The agent's file is the truth.** A saved edit goes into the app's file, where the agent sees it
  on its next change. Nothing is applied at load.
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
    are ticked and listed first. Tick to add, untick to take out (with any dimension built on it).
  - **In this query:** its dimensions and measures by alias. Remove one, or swap a measure for
    another metric under the same alias, so the page's code still finds it.
  - **Filters in the query:** its own `filters { … }`. Add a field, operator and value; remove one.
  - **Dashboard filters:** the controls and cross-filters mapped to it, with their applied value.
    Read-only.
  - **Sorts:** its own `sorts { … }`. Flip a direction, remove one, add one on any column.
  - **Warnings** before a preview: a column the page reads goes missing, a new column the chart
    won't draw, a cross-filter that stops filtering, a grain control left with nothing to change.
  - **AQL:** the draft, and the file's text when they differ.

## 3a. Draft, check, preview

- A draft is written back into the file's AQL text section by section: an unchanged section keeps its
  text and comments, a changed one keeps the style it was written in (`model/aql.ts`).
- **Apply** checks the draft with `core.query.validate`, which the server lets through only with
  `EDIT=1`, then previews it.
- **Preview** runs the draft in place of the declared AQL, in the request: the `edit.preview`
  middleware swaps a query's AQL on its way to the backend, and the `edit` plugin's frame half reruns
  the apps that declare it. The frame never reloads, so the reader's filters, the app's own dropdowns
  and any selection stay as they are. The request log still shows what the query declared.
- **Swapping keeps names.** A field ticked where another was unticked, in the same section, takes the
  old one's name, and its sort with it: the page's code reads columns by name (`model/draft.ts`).
- Drafts and previews last while the app is open; another app starts over. **Back to the file's
  version** ends a preview.

## 3b. Save, history, revert

- **Save** sends the file's AQL as the panel read it, the preview's AQL and the file's SHA-256 to
  `POST /host/edits/<app>` (`server/edits.ts`). The server refuses when the file changed since, or
  when the AQL isn't in it exactly once; else it replaces it, escaped as the string it sits in, writes
  through a temporary file, reads it back, and appends a record to `<app>.edits.json` beside the app.
- **No reload after a save.** The preview already runs what was saved, and a reload would reset the
  reader's filters: the page holds off live reload for the write, and the preview stays on as saved.
- **Versions** lists the history (`GET /host/edits/<app>`) in place of its mock, newest first.
- **Revert** undoes one save, only if what it wrote is still in the file once; a later save over it
  means it can't be undone alone. A revert is a record too.
- Everything is left uncommitted: `git diff` is the review, `git checkout` the agent's original.

## 4. Tiers

Tried in order, per query.

| Tier | Found by | Edit |
| --- | --- | --- |
| 1 | A query manifest: `<script type="application/json" id="anfra-queries">` naming the query | Saved into the manifest _(not built yet)_ |
| 2 | The declared AQL appears exactly once in the source | Saved in place |
| 3 | Not found as written, and no other query declares the same AQL | Preview only, then Copy prompt _(not built yet)_ |
| 4 | Another query declares the same AQL | Copy prompt only _(not built yet)_ |

## 5. Out of scope

Builder apps that create queries while they run, editing AML, layout, more than one user.
