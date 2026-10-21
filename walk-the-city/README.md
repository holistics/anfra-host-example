# Walk the city

An anfra Data Folder with one Data App: **Walk the city**, an interactive data story that asks whether a place is made for people or for vehicles. It goes from the whole planet down to one street in five levels (Planet, City, Neighbourhood, Street, You), and the place you pick carries down from level to level.

Live demo: https://meomeo-anfra.pages.holistics.dev

## What is in this folder

| Path | What it is |
|---|---|
| `apps/walkable-insights.html` | The Data App: one HTML file that queries the dataset through the anfra SDK |
| `apps/_meta.yaml` | Display name and order in the host |
| `models/walkable.model.aml`, `models/walkable_v2.model.aml` | AML models |
| `datasets/walkable_insights.dataset.aml` | The dataset the app queries (models and relationships) |
| `data/walkable.duckdb` | The data (DuckDB, opened read-only) |
| `.anfra/data_sources.yml` | Data source `walkable`, path relative to this folder |

## Run it with this host

From the repo root:

```sh
pnpm install
cd walk-the-city && anfra serve --no-apps    # core API on 127.0.0.1:7878
# in a second terminal, from the repo root:
ANFRA_REPO=walk-the-city pnpm dev
```

Then open the host and pick **Walk the city**. `anfra validate` passes in this folder (anfra 0.11.1).

## About the data

This is an experimental project. Country and city anchors are real (Althoff 2017 steps, Boeing 2025 street networks, UN-Habitat, WHO, ERA5 climate, city mode-share surveys, published road and shop cases). Neighbourhood and street values are synthetic, calibrated against those anchors. Money uses local currencies at approximate, synthetic rates. The data shows links, not proof of cause. The app's Sources level, and the `wk_sources` and `wk_provenance` tables, list what is real, what is modelled, and the licence of each source.
