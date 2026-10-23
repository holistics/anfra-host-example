# Explore Editor: testing guide

Explore Editor adds an **Edit** panel to the Anfra host (anfra-host-example). Click a chart in a Data App to see its query. You can then change its metrics, dimensions, filters and sorts, preview the change live, and save it back into the app's HTML file.

It's an early demo on the branch `khaito/explore-editor`. The design is in [SPEC.md](./SPEC.md).

---

## 0. Try it online, no setup

Open **https://explore-editor.pages.holistics.dev/apps/dashboards/ecommerce-overview** and go straight to [section 4](#4-test-it-step-by-step). Tests 1 to 6 all work there.

- It's shared. Anyone with the link can save, so you may see someone else's edits. Every edit is gone when the site restarts.
- Test 4's `git diff` step needs a local setup. Online, check the save in **Versions** (the clock icon) instead.
- To test your own apps (Test 7), run it locally with the sections below.

---

## 1. What you need

| | Version | Check with |
|---|---|---|
| Node | 22 or newer | `node -v` |
| pnpm | any recent | `pnpm -v` |
| anfra CLI | 0.11.1 | `anfra --version` |
| anfra-host-example | a clone of `github.com/holistics/anfra-host-example` | `git remote -v` |
| An Anfra repo with Data Apps | any, e.g. `anfra-demo-data` | it has an `apps/` folder of `.html` files |

The examples below use **anfra-demo-data** and its **Ecommerce Overview** dashboard, because the numbers there are known. Any Anfra repo works the same way.

---

## 2. Get the branch

The work is on the branch `khaito/explore-editor`, on top of `main`.

```sh
cd path/to/anfra-host-example
git fetch origin
git checkout khaito/explore-editor
pnpm install
```

Check that you have it:

```sh
git log --oneline -5
# 3018b19 feat: Copy prompt for edits the host can't make, and quieter live reload
# 981af3d feat: save previewed edits into the app's file, with history and revert
# 67036cd feat: draft and preview query edits from the Edit panel
# 68b77f0 feat: add a read-only Edit panel that shows what a block queries
# 51f0dda fix: move the version history button to the left of Ask AI
```

If you were sent `explore-editor.bundle` instead, `git fetch path/to/explore-editor.bundle explore-editor:khaito/explore-editor` creates the same branch from the file.

---

## 3. Start it

You need two terminals.

**Terminal 1: anfra, on your Anfra repo.** It serves the data only; the host serves the pages.

```sh
cd path/to/anfra-demo-data
ANFRA_SITE_URL=http://localhost:5173 anfra serve --no-apps --addr 127.0.0.1:7879
```

**Terminal 2: the host, with editing on.**

```sh
cd path/to/anfra-host-example
EDIT=1 ANFRA_REPO=path/to/anfra-demo-data ANFRA_URL=http://127.0.0.1:7879 pnpm dev
```

- `EDIT=1` turns editing on. Without it, the panel opens read-only: you can see each query, but Apply and Save are off.
- `ANFRA_REPO` must be an absolute path, or a path relative to anfra-host-example.
- Check that it's up: `curl http://localhost:5173/health` returns `{"host":"0.1.0","anfra":"0.11.1","edit":true}`.

Open http://localhost:5173. The sidebar lists the repo's Data Apps. Open **Dashboards › Ecommerce Overview**.

---

## 4. Test it, step by step

Each test says what to do and what you should see. Run `git status` in your Anfra repo before you start. It should be clean, so later diffs are only yours.

### Test 1: See a chart's query

1. Click **Edit** in the toolbar, top right. A panel opens on the right, and the page enters pick mode.
2. Click the **Revenue by category** chart.
3. In the panel, expand the query **byCategory**. Queries start collapsed.

You should see:
- The query's dataset (`ecommerce`) and its **tier**. Tier 2 means the panel found the AQL in the file and can save edits.
- **In this query:** the dimension `category` and the measure `revenue`.
- **Fields:** every metric and dimension of the dataset, as checkboxes. The ones the query uses are ticked and listed first.
- **Filters in the query**, **Dashboard filters** (the dashboard's own controls, read-only) and **Sorts**.
- **AQL:** the query's `explore { … }`.

To pick another chart, click **Pick** in the panel's header.

### Test 2: Swap a metric

On **byCategory**:

1. Untick **Revenue** and tick **Net Revenue**. You can also use the select next to `revenue` under **In this query**.
2. Look at the AQL. It now reads `measures { revenue: net_revenue }`. The name `revenue` is kept on purpose, because the chart's code reads the column by that name.
3. Click **Apply**.

You should see the chart update in place, with no page reload. Services goes from about **$424.5K to $416.6K**. Any dashboard filters you had set stay as they were.

### Test 3: Add a filter

1. Click **Pick**, then the **Top countries by revenue** chart, and expand **byCountry**.
2. Under **Filters in the query**, choose the field `orders.status`, the operator `is`, and the value `completed`. Click **Add**.
3. Click **Apply**.

You should see the bars change. Australia drops from about **$240K to $136.3K**, and Vietnam and Germany swap places.

To drop the preview without saving, click **Back to the file's version**.

### Test 4: Save into the file

1. With a preview applied (Test 2 or 3), click **Save**.
2. The panel says the edit was saved into `dashboards/ecommerce-overview.html`, uncommitted. The page doesn't reload.
3. In a terminal:

   ```sh
   cd path/to/anfra-demo-data
   git diff
   ```

   You should see one changed line per edit, for example `measures { revenue: net_revenue }`. A file `apps/dashboards/ecommerce-overview.edits.json` also appears. It's the edit history.

### Test 5: Undo from Versions

1. Click the **clock icon** in the toolbar (Show version history).
2. Each saved edit is listed with its diff. Click **Revert** on one.

You should see that line go back in `git diff`. A revert is listed in the history too.

### Test 6: An edit it can't do on its own

Some changes need the chart's code, not just its query.

1. Pick the **Revenue & orders over time** chart and expand **trend**.
2. Tick **Units Sold**, then click **Apply**, then **Save**.

You should see an amber callout: *"Units Sold won't show on Revenue & orders over time."* The query now returns the column, but the chart's code never draws it. **Ask the agent to draw it** copies a prompt you can paste into Claude Code in the app's repo. The prompt names the file, the block, the query and what to draw.

### Test 7: Your own apps

Point `ANFRA_REPO` and anfra at another repo and try its apps. Expand a query and check its tier:

| Tier | Meaning | What you can do |
|---|---|---|
| 2 | The AQL is written once, as-is, in the file | Preview and save |
| 3 | The AQL is built while the app runs | Preview, then Copy prompt for the agent |
| 4 | Another query has the exact same AQL | Check, then Copy prompt |

---

## 5. Clean up

Saved edits are left uncommitted in your Anfra repo. To undo all of them:

```sh
cd path/to/anfra-demo-data
git checkout -- apps
find apps -name '*.edits.json' -delete
```

Stop both terminals with Ctrl+C. To go back to the main host: `git checkout main` in anfra-host-example.

---

## 6. Troubleshooting

| What you see | Why, and the fix |
|---|---|
| "No Data App at …" | The host is serving a different repo. Check `ANFRA_REPO` and restart terminal 2. |
| Apply and Save are greyed out | The host started without `EDIT=1`. |
| `/health` returns 503 | anfra isn't answering. Check terminal 1, and that `ANFRA_URL` matches its `--addr`. |
| Port 5173 or 8787 in use | Another host is running. Stop it, or run this one on other ports (see below). |
| Save refuses: "the file changed" | Someone (or the agent) changed the file since the panel read it. Click **Pick** and reopen the query, then try again. |
| A query shows tier 3 or 4 | Expected for apps that build their AQL in code or repeat it. Use Copy prompt. |

To run a second host for another repo side by side:

```sh
EDIT=1 PORT=8788 ANFRA_REPO=… ANFRA_URL=http://127.0.0.1:7880 \
  pnpm exec concurrently -k "pnpm dev:server" "pnpm dev:page --port 5174"
```

---

## 7. What it doesn't do yet

- Chart type and style. It edits the query only.
- Apps that create their queries while they run (builder apps), the AML itself, and layout.
- Editing on a shared or hosted host. It's for your own machine.

Feedback welcome, especially on apps where it can't find the query or where a warning was wrong.
