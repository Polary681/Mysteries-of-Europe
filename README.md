# Mysteries of Europe

This website was mostly AI-generated. I'm not a big fan of having AI do most of the work for me, but hey, that was the assignment. :(

An interactive archive of the dark legends of Europe: a real map, a 3D globe, six 3D narrative adventures, a collectible Archive, the Sibyl’s Oracle and four 3D mini-games. 100% offline.

**Launch:** double-click `index.html` (or `start.bat` on Windows / `./start.sh` on macOS/Linux). No server, no internet and no install are needed. A modern browser with WebGL (Chrome, Edge, Firefox, Safari) is required.
Optional: `node tools/serve.mjs` (or `npm run serve`) serves the site at http://localhost:8080. A server is only needed if you add the optional 3D Earth model (see "3D globe" below); everything else works from the file.

What changed in each version, and the test reports: see **[CHANGELOG.md](CHANGELOG.md)**.

## How unlocking works
- The Archive does **not** keep its own idea of your progress. Each adventure remains the owner of its saves; the Archive re-reads them and decides which cards you have earned. Rules are in `CARDS` in `src/shared/archive.js`:
  - *Legend case file* — available from the start (the three legends are open).
  - *Woolpit relic* — reach the matching one of its six endings (servant, both, bells, font, omen, ink).
  - *Skye relic* — reach the matching one of its four endings.
  - *Baba Yaga relic* — reach the matching one of its four endings (lantern, flight, stay, leave).
  - *Sibilla relics* (v8) — *La Sale’s Notebook* the moment Antoine de La Sale gives it to you in Act I (recorded in `moe.sibilla.finds.v1`, condition `find`); one relic per ending (dance, return, knowledge, kingdom); *The Sibyl’s Seal* for any of the three endings reached before the queen (condition `anyEnding`).
  - *Hoia relic* — reach the matching one of the four endings of the 3D adventure (time, lights, shepherd, leave). *The Watch That Lost Its Hour* and *The Watching Trees* are also earned by node d ("time bends") and node e ("you leave safely") of the short text story, as before.
  - *Archivist's Seal* — recover at least one relic from each of the four legends of v7 (Woolpit, Hoia, Skye, Baba Yaga). v8 did not change this rule, so nobody loses or gains it; the Sibyl has her own seal.
- Unlocks are **monotonic and idempotent**: finishing the same ending again never adds or duplicates a card, and nothing is ever locked again.
- The reveal appears only when an ending unlocks something **new** during play. The ending screen also names the relic (or says "already in your Archive").

## How saving works
- Only `localStorage` is used (no accounts, no server, no database), through the existing `src/shared/save.js` (it falls back to memory for the session if the browser blocks storage).
- Existing keys are untouched: `moe.woolpit.save.v1`, `moe.skye.save.v1`, `moe.woolpit.endings.v1`, `moe.skye.endings.v1`. v6 adds `moe.hoia.save.v1`, `moe.hoia.endings.v1` (the Hoia adventure) and `moe.journal.v1` (the Archivist's journal). v7 adds `moe.babayaga.save.v1` and `moe.babayaga.endings.v1`. v8 adds `moe.sibilla.save.v1`, `moe.sibilla.endings.v1` and `moe.sibilla.finds.v1`.
- New keys: `moe.archive.v1` (what was unlocked and when, which cards were already revealed/examined, Hoia endings) and `moe.ambient.v1` (sound on/off and volume). The intro flag lives in `sessionStorage` (`moe.intro`).
- **Old saves keep working.** On first load the Archive reads the endings you had already reached in v3 and unlocks the matching relics *without* a fake animation; they appear marked **New** until you examine them.
- To reset the collection: clear the site's data in the browser (or run `localStorage.removeItem("moe.archive.v1")`). Adventure saves are separate and are not touched by that.

## 3D globe
The globe keeps the optional GLB loader (`./assets/models/Earth_1_12756.glb`). **That folder is intentionally not shipped**, so the globe falls back to the classic Natural Earth line globe, silently. Over `file://` the fetch is skipped altogether (browsers block it); with `npm run serve`, a missing file also ends in the classic globe. If you add the GLB, use `npm run serve`. This path was *not* tested with a real model (see "Open issues").

## The two 3D adventures (v3)
Open the **Legends** section and click the card of *The Green Children of Woolpit* or *The Ghost Pianist of Skye* (also from the map pins). Every other legend still opens its short text story. Deep links: `index.html?play=woolpit` and `index.html?play=skye`.

| | **The Green Children of Woolpit** (England, 12th c.) | **The Ghost Pianist of Skye** (Scotland) |
|---|---|---|
| Style | Third-person narrative adventure in a low-poly medieval village | First-person atmospheric exploration of a storm-swept headland, plus a piano mini-game |
| Core | Branching dialogues with villagers, 3 meters (Trust / Suspicion / Knowledge), items, clues, a learnable "language" (the children's speech is garbled until you learn words), 3 acts, visible consequences (the village mood, the mob, the hollow) | Hold **L** to *listen*: echoes of a lament point to six places; collect all six phrases, learn the tune and play it on the piano; a tide cuts the causeway when you come back with all the outside echoes |
| Endings | 6 really different endings (servant, both, bells, font, omen, ink) | 4 endings: The Last Tune, The Other Note, Until the Tide Comes In, The Unfinished Tune |
| Save | `moe.woolpit.save.v1` (localStorage) | `moe.skye.save.v1` (localStorage) |

**History vs invention.** Woolpit follows the two 12th-century chronicles (William of Newburgh, Ralph of Coggeshall) and does not impose one explanation (the codex in the journal, key **J**, labels every entry *historical*, *uncertain* or *invented*; all named characters in the village scenes beyond the chroniclers' figures are invented). **I could not find a documented ghost-pianist legend of Skye in folklore sources**, so the Skye card is treated as a creative starting point: the story is an original one and says so on its title screen. Real history (the Highland Clearances, Gaelic song, "second sight") is only background and is labelled in the codex.

### Controls
| | Keyboard / mouse | Touch (phones, tablets) |
|---|---|---|
| Move | `W A S D` / arrows, `Shift` run | on-screen joystick (drag on the left) |
| Look (Skye) / camera (Woolpit) | drag the mouse (click the scene for pointer lock, `Esc` releases it) | drag on the right |
| Interact / talk | `E` or `Space` | **E** button |
| Dialogue | `E`/`Space`/`Enter` next (the first press finishes the typing), `1-4` or click to choose | tap |
| Listen (Skye) | hold `L` | hold the ear button |
| Piano (Skye) | `A S D F G H J K` = the 8 keys, or click/tap the keys; the lit key is the next one in *Guided* mode | tap the keys |
| Journal / codex / hints | `J` or `Tab` (the journal also explains how to play) | book button |
| Mute | `M` or the speaker button | speaker button |
| Pause / restart / exit | `Esc` or the pause button | pause button |

Progress is saved automatically (localStorage, kept between visits) and the title screen offers **Continue**. Endings you have reached are remembered. If localStorage is blocked, the game still works for the current session.

### Technical notes
- Source in `src/`: `shared/` (saves, procedural WebAudio, input, UI shell, world helpers), `narrative/` (the reusable dialogue/choice/state engine in `core.js` and its in-scene UI), `adventures/woolpit/`, `adventures/skye/` (each: `story.js` pure logic, `world.js` scenery, `game.js` gameplay). Existing arcade games are in `src/games/`.
- **No external assets.** All models, textures, sounds and music are generated procedurally by code (low-poly geometry, vertex colours, WebAudio synthesis), so there is nothing to download or license apart from the libraries and fonts below.
- Performance: low-poly, instanced vegetation, fog, no shadow maps, and an adaptive pixel ratio that lowers resolution if frames get slow. Adventures are created on demand and fully disposed on exit (the site and the arcade games are not touched while one is running).
- Hi-dpi: the canvas never takes part in the layout, so it can't cause the black-screen problem fixed in v2.

## Earlier features (v2)
| Feature | Where | How it works |
|---|---|---|
| Real 2D map | `js/geo-data.js` → `js/main.js` | Natural Earth 1:50m borders, Lambert azimuthal equal-area projection (the EU standard). Zoom/pan, 42 clickable countries, legend pins, capital marker, keyboard accessible. |
| 3D globe | `src/globe.js` | Same Natural Earth data on a sphere; follows the country you select on the 2D map. |
| Legend Runner | `src/games/runner.js` | 3D endless runner: steer the ghost into the gate with the right answer. |
| Spell the Spirit | `src/games/letters.js` | 3D rune cubes: click them in order to spell the word. |
| Capital Express 3D | `src/games/map3d.js` | The real borders extruded into a 3D map you can orbit; find the country of each capital. |
| Hoia Baciu Lantern | `src/games/forest.js` | Third-person 3D forest: follow light beams, collect 8 wisps (facts), avoid wraiths, keep the lantern alive. |
| Offline fonts | `css/fonts/` | Cinzel + Outfit + Cormorant Garamond (SIL OFL) bundled, no Google Fonts. |

The old text quizzes were replaced by the 3D games. The branching stories are unchanged.

## Rebuilding and tests (only if you change the source; needs Node.js 18+)
```
npm install        # three, esbuild, d3-geo, topojson-client, world-atlas, fonts, playwright (tests only)
npm run geo        # regenerates js/geo-data.js from Natural Earth
npm run bundle     # bundles src/ + three.js into js/bundle.js (one classic script, works from file://)
npm run check      # static checks: asset paths, legend/adventure wiring, no external resources
npm run test:story   # Node tests of the six story graphs (reachability, endings, piano logic, Hoia rules, Baba Yaga's chores, the Sibyl's days, the Báthory evidence board)
npm run test:archive # Node tests of the Archive logic (unlock rules, no duplicates, old saves, persistence, secret card, castle windows) + the journal
npm run test:astro   # Node tests of the sky maths against known events (phases, solstices, culminations, special nights, rise/set, seasons)
npm run stars -- path/to/bsc5-short.json   # only to regenerate src/world/stars-data.js from the Yale Bright Star Catalogue
npx playwright install chromium   # once, for the browser tests
npm run test:e2e     # headless-Chromium end-to-end tests (site, the six adventures, endings, mobile/touch, Archive + reveal, journeys, v6 extras)
npm test             # everything above
```
Edit countries/legends in `js/data.js` (country codes: ISO-2, "UK" for the United Kingdom; a legend may carry a `mapLabel`, shown on its pin, card and story box, e.g. Báthory’s “Čachtice, Slovakia (then Kingdom of Hungary)”). To add a legend pin, add its `[lat, lon]` to `LEG` in `tools/build-geo.mjs` (same key as in `LEGENDS`) and run `npm run geo`. To add another adventure, copy the shape of `src/adventures/hoia/game.js` (the smallest of the three) or `src/adventures/skye/game.js` (`start(host, {onExit, onText})`), register it in `src/app.js` and add a card flag in `js/main.js`.

## Open issues / not verified
- **v9 / Elizabeth Báthory**: tested only with software WebGL (SwiftShader) in headless Chromium, on desktop and emulated phone/tablet viewports; not tried on a real integrated GPU, a real phone, Firefox or Safari, and the frame rate on modest hardware was not measured. The audio (synthesised) was not listened to by a person. The castle, the village and the rooms are free reconstructions, not surveys of the ruin; the castle’s interiors in 1614 are not documented, and the codex says so. The figure of about 18,000 florins for the Crown’s debt and the weight of the political motive are disputed among historians, and the game presents them as such. The Monster and Conspiracy endings were reached in the browser from a patched Act III state (their full routes are played in the story test).
- **v8 / the Sibyl**: tested only with software WebGL (SwiftShader) in headless Chromium, on desktop and emulated phone/tablet viewports. It was not tried on a real integrated GPU, on a real phone, or in Firefox/Safari; frame rate on modest hardware is designed for (merged and instanced geometry, no shadow maps, three point lights, fewer trees/rocks/crystals on weak GPUs, adaptive pixel ratio) but not measured. The game audio was not listened to by a person (it is synthesised and only checked to run without errors). The 330-day rule is the figure most retellings quote; La Sale’s own wording and the numbers in other retellings differ, and the codex says so.
- **v7, Baba Yaga**: the heaviest scene of the site (hundreds of birches and spruces, the fence of skulls, the hut's animated legs); it was only seen in software rendering. On slow machines it lowers its pixel ratio and drops the grass tufts and mushrooms. The chase cannot be lost (if she reaches you, you throw the towel or the comb without thinking): that is deliberate, the tale is about getting away. Abramtsevo was chosen for the map pin because Baba Yaga belongs to no single place.
- **v6**: the valley's new sounds were checked only as "played / not played" (no speakers here); their levels are a first guess. The Hoia forest is the heaviest of the three adventures in software rendering; on a slow machine it drops its canopy clumps and brambles and shortens the view (like Skye, it lowers the pixel ratio). The tilt was tested with simulated orientation events only, and the iOS permission prompt could not be tried. The sky chart does not show planets (not computed). Rise/set times have about a minute of precision.
- **v5, real GPUs not available here**: the flight, the reflections and the lantern light were only seen in software rendering (a few fps). Quality levels, dynamic resolution and the valley's sleep during adventures are there to keep modest machines smooth, but frame rates on real hardware were not measured.
- The castle's reflection is honest optics: with the camera on the overlook only the lower half of the castle is mirrored in the lake, so the "ruin" and the figure appear in that part (walls, gateway, hall windows).
- The Moon is often out of the picture: it is drawn where it really is. When it is high, its light still comes from its true direction; the caption says where it is. Precession since J2000 (0.37°) and refraction are ignored.
- On touch screens the constellation is summoned with the small ✦ button on each legend card (a tap on the card itself still opens the legend). Device tilt for the lantern (v6) was tested only with simulated orientation events; the iOS permission prompt could not be tried here.
- Development switches (not needed by visitors): `?sky=`, `?night=`, `?season=`, `?tour`, `?quality=`, `?navspeed=`, `?nav=0` (plain navigation), `?gl=0` (drawn landing), `?pagesky=0`, `?trans=none`, `?mist=`, `?refl=1|2`, `?reflscale=`.
- **Real-hardware performance was not measured.** The target (i5 4th/5th gen, integrated AMD, 16 GB) was not available. The design is light (SVG art, a 2D canvas with ~48 particles that pauses off-screen / in hidden tabs / with reduced motion and thins itself if frames get slow, no shadow maps in the games), but the numbers above come from software rendering only.
- **Real touch devices and real browsers other than headless Chromium were not tested** (touch was simulated).
- **The optional GLB Earth model was not tested** with a real file (the folder is intentionally absent); only the fallback was verified.
- Sound is synthesised and intentionally simple; it was not listened to on real speakers.
- The `node_modules` folder shipped with the project holds Windows binaries (esbuild). `npm run bundle` works on Windows; on other systems run `npm install` first. `js/bundle.js` is already built, so nothing needs rebuilding to run the site.

## Free resources to go further (things not built here)
**Real 3D models & animation (load with three.js `GLTFLoader`)**
- Quaternius (CC0 low-poly packs): https://quaternius.com/
- Kenney (CC0 assets, models + audio): https://kenney.nl/assets
- Poly Pizza (CC0/CC-BY low-poly models): https://poly.pizza/
- Sketchfab (filter "Downloadable" + Creative Commons): https://sketchfab.com/
- Mixamo (free character animations): https://www.mixamo.com/

**AI-generated 3D models (free/open-source; they need a GPU or an online account, so they can't run offline)**
- Microsoft TRELLIS (image/text → 3D, open source): https://github.com/microsoft/TRELLIS
- TripoSR (image → 3D, open source): https://github.com/VAST-AI-Research/TripoSR
- Try them in the browser via Hugging Face Spaces: https://huggingface.co/spaces
- Meshy and Tripo have limited free credits: https://www.meshy.ai/ · https://www.tripo3d.ai/
Export as `.glb`, put it in `assets/`, and load it with `GLTFLoader` (see https://threejs.org/docs/#examples/en/loaders/GLTFLoader).

**Textures, skies, satellite look**
- Poly Haven (CC0 textures/HDRIs): https://polyhaven.com/
- ambientCG (CC0 PBR textures): https://ambientcg.com/
- Natural Earth raster (shaded relief, for a textured globe): https://www.naturalearthdata.com/downloads/
- NASA Visible Earth (Blue Marble): https://visibleearth.nasa.gov/

**Sound & music**
- Freesound: https://freesound.org/ · OpenGameArt: https://opengameart.org/
(Everything currently uses synthesized WebAudio, so no audio files are needed.)

**Maps**
- More geodata: https://www.naturalearthdata.com/ · npm `world-atlas`: https://github.com/topojson/world-atlas
- Detailed offline street maps: MapLibre https://maplibre.org/ + Protomaps https://protomaps.com/

## Credits
Stars: Yale Bright Star Catalogue, 5th rev. ed. (Hoffleit & Warren 1991), via the JSON edition by Bretton Wade (MIT, github.com/brettonw/YaleBrightStarCatalog). Astronomy: low-precision algorithms after J. Meeus, *Astronomical Algorithms*. Borders: Natural Earth (public domain). 3D: three.js r170 (MIT). Geo math: d3-geo (ISC). Fonts: Cinzel, Outfit, Cormorant Garamond (SIL OFL 1.1; licence text for Cormorant in `css/fonts/cormorant-garamond-LICENSE.txt`, from the `@fontsource/cormorant-garamond` package). All artwork (SVG), adventure code, stories, models and sounds: original, generated by code for this project (no third-party assets). Historical background for Woolpit: William of Newburgh, *Historia rerum Anglicarum* and Ralph of Coggeshall, *Chronicon Anglicanum* (both 12th–13th c., public domain); for Skye: Martin Martin, *A Description of the Western Islands of Scotland* (1703) on second sight.
