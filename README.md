# Slijepa karta

A blind-map quiz of Croatia. Tap where a place is; the closer you are, the more points you get.

Levels: big cities → smaller towns → rivers → mountains → national parks → islands → power plants.
Score 50% or more to unlock the next level. Any level can also be played on its own.
Main game: all levels in a row, 5 questions each; under 50% on a level ends the game.

## Run it

```bash
cd www && python3 -m http.server 5173
```

Then open http://localhost:5173

## Rebuild the map data

Country outlines come from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
Rivers, islands and power plants come from [OpenStreetMap](https://www.openstreetmap.org/copyright)
(© OpenStreetMap contributors, ODbL), downloaded with the Overpass API into `raw-data/osm/`.

```bash
mkdir -p raw-data && cd raw-data
B=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_admin_0_countries ne_10m_rivers_lake_centerlines ne_10m_rivers_europe; do curl -sSfLO $B/$f.geojson; done
cd .. && node scripts/build-map.mjs
```

## Android APK

Needs Java 21 and the Android SDK (see `android/local.properties`).

```bash
npm install
npm run apk
```

The APK is written to `SlijepaKarta.apk`.

## Files

- `www/levels.js`: the places in each level (edit this to add more)
- `www/game.js`: game logic
- `www/data.js`: generated map shapes (don't edit by hand)
- `scripts/build-map.mjs`: turns the map data into `www/data.js`
- `scripts/make-icon.mjs`: draws the app icon into `assets/`
