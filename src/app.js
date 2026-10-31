// Entry point of the 3D bundle. Exposes window.MOE3D for the classic script js/main.js.
import { createGlobe } from "./globe.js";
import { start as runner } from "./games/runner.js";
import { start as letters } from "./games/letters.js";
import { start as map3d } from "./games/map3d.js";
import { start as forest } from "./games/forest.js";
import { start as woolpit } from "./adventures/woolpit/game.js";
import { start as skye } from "./adventures/skye/game.js";
import { start as hoia } from "./adventures/hoia/game.js";
import { start as babayaga } from "./adventures/babayaga/game.js";
import { start as sibilla } from "./adventures/sibilla/game.js";
import { start as bathory } from "./adventures/bathory/game.js";
import { sfx } from "./common.js";
import * as archive from "./shared/archive.js";
import * as journal from "./shared/journal.js";
import * as traveller from "./shared/traveller.js";
import * as ui from "./ui/index.js";
import { createNavigator, parseHash, SECTIONS } from "./nav/navigator.js";
import { mapPoint } from "./nav/transitions.js";

window.MOE3D = {
  createGlobe,
  games: { runner, letters, map3d, forest },
  adventures: { woolpit, skye, hoia, babayaga, sibilla, bathory },
  setMuted: m => { sfx.muted = !!m; },
  archive, journal, traveller, ui,   // collectible cards, the Archivist's journal of sightings + the new visual layer (see src/shared/archive.js, src/ui/)
  nav: { createNavigator, parseHash, SECTIONS, mapPoint },   // the cinematic navigation (src/nav/)
};
