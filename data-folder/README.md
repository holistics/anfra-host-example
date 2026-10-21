# Metric tree and catalog: Data Folder

An Anfra Data Folder for the Metric tree and catalog app, for use with this host.

## What it is

- `apps/metric-catalog-tree.html`: one HTML file. It builds a metric tree from the metric definitions in the repo, with period change, a change path, a Catalog tab, and notes.
- `models/` and `datasets/`: the AML behind it. The "Business metrics" dataset has 28 metrics in 6 levels.
- `data/`: two DuckDB files with generated data, plus the scripts that make them. The data is not real.

## Run it

1. Start anfra on this folder, without its own pages:

   ```sh
   cd data-folder && ANFRA_SITE_URL=http://localhost:5173 anfra serve --no-apps
   ```

2. Start the host from the repo root, with `ANFRA_REPO` set to the full path of `data-folder`. See the main README.
3. Open `http://localhost:5173/apps/metric-catalog-tree`.

Tested with anfra 0.11.1.

## Use it on your own repo

Copy `apps/metric-catalog-tree.html` into your Data Folder. The tree finds itself from your metric definitions. Notes live in one `NOTES` block at the top of the script. Entries for a dataset or metric that does not exist are ignored.
