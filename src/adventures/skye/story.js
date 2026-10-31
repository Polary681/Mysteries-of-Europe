// THE GHOST PIANIST OF SKYE - story data and rules (pure logic, no WebGL).
//
// ATTESTED vs INVENTED
//  I searched for a traditional Skye legend of a ghost pianist and found none in the folklore sources I could check. The project's legend card
//  is therefore treated as a creative starting point: the headland, the house, the pianist (called only "she"), her tune, and every
//  scene here are invented for this game. Real background used as inspiration: the Highland Clearances (e.g. Boreraig and Suisnish on Skye,
//  cleared in the 1850s), Gaelic song traditions, "second sight" as recorded on Skye by Martin Martin (1703), and the tradition of MacCrimmon's
//  Lament, a farewell tune said to foretell a death. See CODEX below (each entry is labelled historical / uncertain / invented).
import { applyFx } from "../../narrative/core.js";

export const SAVE_KEY = "moe.skye.save.v1", ENDINGS_KEY = "moe.skye.endings.v1";
export const initState = () => ({
  v: 1, trust: 0, susp: 0, know: 0, frag: {}, tide: false, perfect: true, ending: null, played: 0, hard: false, lastNote: null,
  rel: {}, flags: {}, items: { lantern: true }, words: {}, clues: {}, notes: { n_original: true }, seen: {}, once: {},
});

/* ---------------- the lament ---------------- */
export const KEYS = ["A", "B", "C", "D", "E", "F", "G", "A"]; // A natural minor, low A to high A
export const FREQ = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440];
export const PHRASES = [[5, 4, 3, 2], [3, 4, 5, 5], [6, 5, 4, 3], [2, 3, 2, 1], [5, 6, 7, 8], [7, 5, 3, 1]]; // 1-based key numbers; phrase n is revealed by echo n
export const OUTSIDE = [1, 2, 3, 4, 5], LAST = 6;
export const count = s => Object.keys(s.frag).length;
export const outside = s => OUTSIDE.filter(i => s.frag[i]).length;
export const hasAll = s => count(s) === 6;
export const phraseText = p => PHRASES[p].map(k => KEYS[k - 1]).join(" ");

// Plays the lament phrase by phrase. The very last note may fall home (key 1, "the lament as written") or rise (key 8, "the other note").
export class PianoRun {
  constructor(found) { this.found = found; this.reset(); }
  reset() { this.p = 0; this.i = 0; this.mistakes = 0; this.alt = false; }
  known(p) { return !!this.found[p + 1]; }
  expected() { return this.p < 6 && this.known(this.p) ? PHRASES[this.p][this.i] : null; }
  press(k) {
    if (this.p >= 6) return { ok: false, blocked: true };
    if (!this.known(this.p)) return { ok: false, blocked: true };
    const exp = PHRASES[this.p][this.i], last = this.p === 5 && this.i === 3, ok = k === exp || (last && k === 8);
    if (!ok) { this.mistakes++; this.i = 0; return { ok: false }; }
    if (last && k === 8) this.alt = true;
    this.i++;
    if (this.i === 4) { const done = this.p; this.p++; this.i = 0; return { ok: true, phraseDone: done, finished: this.p === 6, alt: this.alt }; }
    return { ok: true };
  }
}

export const WHO = {
  narr: { name: "", style: "narr" }, you: { name: "You" }, ghost: { name: "The pianist" },
};

/* ---------------- codex ---------------- */
export const CODEX = {
  n_original: { kind: "invented", title: "Is this a real legend?", text: "I could not find a traditional Skye tale of a ghost pianist in the folklore sources I checked. The project’s legend card is a creative starting point, so this adventure is an original story. The headland, the house, the pianist, the tune and every scene are invented. Nothing here should be taken as documented folklore." },
  n_clear: { kind: "historical", title: "The Highland Clearances", text: "From the 18th to the 19th century many Highland families were evicted from their land, often to make room for sheep, and many emigrated. On Skye, villages such as Boreraig and Suisnish were cleared in the 1850s. The village in this game is invented, but the kind of loss it shows is real history." },
  n_second: { kind: "historical", title: "Second sight", text: "A belief in “second sight”, glimpses of future events, was widely reported in the Highlands and Islands. Martin Martin, who came from Skye, described it in his book A Description of the Western Islands of Scotland (1703). In this game, the idea inspires the echoes you hear." },
  n_gaelic: { kind: "historical", title: "Gaelic songs", text: "The Gaelic-speaking Highlands and Islands have a rich tradition of songs: lullabies, work songs and laments. The lament in this game is invented and written for a piano, which is not a traditional Gaelic instrument." },
  n_maccrimmon: { kind: "uncertain", title: "MacCrimmon’s Lament", text: "The MacCrimmons were hereditary pipers to the MacLeods of Dunvegan on Skye. Tradition says one of them, Donald Ban, composed a farewell tune before leaving, foreseeing that he would not return. Accounts of the story differ, and what is attributed to the family is partly tradition. It inspired the idea of a tune that mourns before the loss is known." },
  n_tide: { kind: "invented", title: "Tidal causeways", text: "Many real Scottish islets can be reached on foot only at low tide. The causeway to the house is invented, but the danger is real. Never cross a tidal causeway without checking the tide tables." },
};

/* ---------------- endings ---------------- */
export const ENDINGS = {
  peace: { id: "peace", kicker: "Ending 1 of 4", title: "The Last Tune", cls: "e-peace",
    paragraphs: s => [
      "The last note falls home, and the whole house seems to breathe out. The pianist lifts her hands from the keys as if they were suddenly very light.",
      s.flags.read_letter ? "“You read his letter,” she says. “Then someone knows he was coming back.”" : "“I never knew how it ended,” she says. “Now I do.”",
      "At dawn the sea has drawn back from the causeway. You walk out across the wet stones, and behind you the piano stays silent. Some say the house on the Point has never sounded so peaceful.",
    ],
    notes: ["INVENTED ending. The pianist and her tune come from this game, not from any traditional Skye legend. The Clearances that haunt her story are historical."] },
  other: { id: "other", kicker: "Ending 2 of 4", title: "The Other Note", cls: "e-other",
    paragraphs: s => [
      "You let the last note rise instead of fall. The high A hangs over the room like a lit window, and for a moment nobody knows whether it is an ending at all.",
      "The pianist laughs: a short, startled sound, the first in more than a century. “That is not how it was written,” she says. “That is how it should have gone.”",
      "In the morning there is a new last bar on the music stand, in handwriting that is not yours and not hers. The house keeps playing the lament that way: unfinished, and open to the sea.",
    ],
    notes: ["INVENTED ending. Rewriting a tune so that it ends in hope is the idea behind the “other note”. It is not a feature of any attested Gaelic lament."] },
  stay: { id: "stay", kicker: "Ending 3 of 4", title: "Until the Tide Comes In", cls: "e-stay",
    paragraphs: s => [
      "You do not stop. She plays the low notes, you play the high ones, and the lament goes round and round like the sea around the Point.",
      "The tide comes in. The windows turn black, then silver, then black again. At some point you notice that you are no longer sure which of you is the ghost.",
      "In the morning the causeway is open, and the house is empty. Passing walkers say that on stormy nights, two pianists play there now.",
    ],
    notes: ["INVENTED ending, and the one that most closely echoes the legend card (“play for me until the tide comes in”). The card itself is a project starting point, not an attested folk tale."] },
  leave: { id: "leave", kicker: "Ending 4 of 4", title: "The Unfinished Tune", cls: "e-leave",
    paragraphs: s => [
      s.tide ? "" : "You turn your back on the Point and leave before the music is finished. The road is wet and the car starts at the first try.",
      count(s) >= 5 ? "You had almost every piece. That is the worst part." : "You had only a few of the pieces: a handful of notes, a feeling of being listened to.",
      "For weeks afterwards, on quiet evenings, the same four notes come back to you, falling like a sigh. You can never remember what should come after them.",
    ].filter(Boolean),
    notes: ["INVENTED ending. Not every story gets finished, and some are better left alone. This ending is here so that leaving is also a real choice."] },
};
export const ENDING_ORDER = ["peace", "other", "stay", "leave"];

/* ---------------- dialogue nodes ---------------- */
const nodes = {};
const N = (id, who, text, o = {}) => { nodes[id] = { id, who, text, ...o }; return nodes[id]; };
const frag = (n, extra = {}) => ({ fx: (s, ev) => { if (!s.frag[n]) { s.frag[n] = true; ev.push({ t: "event", id: "frag", n }); } applyFx(s, { toast: `Echo ${count(s)} of 6 found. The journal now has a new phrase.`, ...extra }, ev); } });

N("board", "narr", "A weathered information board stands at the end of the road. Half of it is covered with moss. It says that the Point was once the site of a small township, emptied in the 19th century, and that visitors should not cross the causeway to the old house after dark, because of the tides.\n\nBeneath, someone has scratched four notes into the wood, then thought better of it. (The board is invented. The Clearances are not.)", { fx: { note: ["n_original", "n_clear", "n_tide"], toast: "Codex updated." } });

N("f1", "narr", "The old pier is silver with salt. When you step onto its end, the wind drops, and you hear four notes, quiet and falling, like a sigh. They seem to come from the water.", { go: "f1b" });
N("f1b", "narr", "The lantern light swims on the black water. For a moment there are people on this shore with bundles in their arms, and a boat pulling out into the dusk. Among them a young woman stands with her hands curled as if around keys that are not there.", { go: "f1c" });
N("f1c", "narr", "She is not leaving. She has been promised work at the big house on the Point, where there is a piano, and she means to play them away. In the dusk, the music follows the boat as far as the sound will carry.\n\n(In the real Clearances, families were forced out all over Skye. This woman and her tune are invented.)", frag(1, { note: ["n_clear"], clue: "pier" }));

N("f2", "narr", "The ruined township lies in the bracken, a row of roofless stone walls with grass for floors. One hearth still has its flat stone. The air above it is oddly warm, and you can hear a phrase of music, as clear as a kettle on the boil.", { choices: [
  { t: "Rest your hand on the cold hearthstone.", fx: { trust: 1, flag: "touched_hearth" }, go: "f2b" },
  { t: "Pick up the old wooden spoon in the ashes.", fx: { trust: -1, flag: "took_spoon", item: "spoon" }, go: "f2b" },
  { t: "Listen, and leave everything as it is.", fx: { trust: 1 }, go: "f2b" },
] });
N("f2b", "narr", s => s.flags.took_spoon ? "The spoon is light and smooth, worn by many hands. The music in the air hesitates, then goes on more softly, as if someone had noticed." : "Someone sat here, in this very spot, and the stone remembers. You see her: the same young woman, with ash on her sleeve, helping an old woman pack three pots and a blanket. She says nothing at all.", { go: "f2c" });
N("f2c", "narr", "All the families on the Point packed that day. She went up to the house to play, because she could not stand to watch them walk away. You understand that the tune is not for the people who left: it is for the place that was left behind.", frag(2, { clue: "hearth", note: "n_gaelic" }));

N("f3", "narr", "The standing stone leans on the ridge like a tired man. The rain is coming sideways. When you put your hand on the lichen, a rising phrase of music rolls out of the stone, as if the whole hill were an instrument.", { go: "f3b" });
N("f3b", "narr", "You see a young man in a rough coat, kneeling at the foot of this stone. He is giving his sister a letter, and promising that he will come back on the spring tide, to take her to the new country, and she will play the piano in a hall with a hundred windows.", { go: "f3c" });
N("f3c", "narr", "She wrote a phrase for his return. It rises, step by step, as if climbing a hill in the dark.\n\n(Some Highlanders in old stories were said to have “second sight”: a glimpse of the future. Martin Martin, from Skye, wrote about it in 1703. In this game it only inspires the echoes.)", frag(3, { clue: "promise", note: "n_second" }));

N("f4", "narr", "At the back of the sea cave the air is cold and strangely still. A green glass bottle rests in a crack in the rock, with a curl of paper inside. And from somewhere deep in the stone, someone plays a halting phrase again and again, as if testing it.", { choices: [
  { t: "Draw out the paper and read it.", fx: { know: 1, trust: 1, flag: "read_letter" }, go: "f4b" },
  { t: "Take the bottle without opening it.", fx: { trust: -1, flag: "took_bottle" }, go: "f4b" },
  { t: "Leave it in its crack.", fx: { trust: 1 }, go: "f4b" },
] });
N("f4b", "narr", s => s.flags.read_letter ? "The ink has almost gone. “I will come on the spring tide. Wait for me. Play the one about the boats.” It is signed with a single letter, C. Then there is nothing but salt." : s.flags.took_bottle ? "The glass is heavy and cold. You cannot hear the phrase any more, only the sea. You have the feeling that you have taken something that was not ready to be taken." : "You leave the bottle where it is. The halting phrase goes on, and seems, for an instant, to grow more confident.", { go: "f4c" });
N("f4c", "narr", "The spring tide came, and the boat did not. The sea brought the bottle, but not the man. She sat here and tried to play what she felt, over and over, with her fingers on the cold rock.", frag(4, { clue: "cave" }));

N("f5", "narr", "The chapel has no roof. Rooks rise from the gravestones, and the rain falls on the font. In the doorway, a stump of candle stands in a niche. Over the wind, you hear a slow, heavy phrase, which sounds like footsteps and like grief.", { choices: [
  { t: "Light the candle with your lantern.", fx: { trust: 1, flag: "lit_candle" }, go: "f5b" },
  { t: "Bow your head and say nothing.", fx: { trust: 1 }, go: "f5b" },
  { t: "Walk on, the weather is getting worse.", fx: { trust: 0 }, go: "f5b" },
] });
N("f5b", "narr", s => s.flags.lit_candle ? "The little flame stands up straight in the draught, as if listening. The notes come more clearly: she must have written this one here, kneeling." : "You stand in the doorway. A hundred and seventy years of rain have worn the names off the stones, but the phrase is clear, as if she had only just left.", { go: "f5c" });
N("f5c", "narr", "She wrote the lament when the last news came. A ship lost, in a storm, in the first year; no names on the list that she knew, and no names that she did not. She turned it into the heaviest phrase of her tune.\n\n(MacCrimmon’s Lament, a Skye tune, is said by tradition to mourn someone before they are gone. The accounts differ.)", frag(5, { clue: "lament", note: "n_maccrimmon" }));

N("f6_locked", "narr", "The music stand by the piano is empty, except for a rusty clip. A draught comes down from the broken roof, and with it, a whisper that you cannot quite catch. You feel that the missing page is somewhere out on the Point, still waiting for someone to find the rest of the tune.");
N("f6", "narr", "A single yellowed page is clipped to the music stand. It was not there before, or you did not see it. There are five phrases on it, in a careful hand, and then a sixth, unfinished, with a blank where the last bar should be.", { go: "f6b" });
N("f6b", "narr", "The air by the piano turns cold. In the black window glass a figure sits on the stool, her back to you, perfectly still, her hands over the keys. When she speaks, it is as if the words had been written in the dust.", { go: "f6c" });
N("f6c", "ghost", s => s.trust >= 2 ? "You came back for all of it. Thank you. I never finished it. I never knew how it ended. Play it for me?" : "You have been in my house, and on my shore. I do not know whether to trust you. But I have waited a long time. Will you play it for me?", { go: "f6d" });
N("f6d", "narr", "The page has a last line, in smaller writing: “Play for me until the tide comes in.”\n\nThrough the broken windows, you can hear the sea beginning to climb.", frag(6, { clue: "last_page" }));

N("piano_locked", "narr", s => `The piano answers with a hollow thunk, and the keys are cold under your fingers. You only know ${count(s)} of the 6 echoes of the tune. You cannot play what you have not heard.`);
N("tide_close", "narr", "Behind you, there is a long sigh, the sound of water finding its way. By the time you turn round, the causeway has gone, and the sea is washing over it, black and smooth.\n\nThe house waits ahead of you, with one window lit.", { fx: { event: "tide", set: { tide: true }, note: "n_tide" } });
N("leave_ask", "narr", s => s.tide ? "The causeway is under black water. There is no way off the Point until morning." : count(s) >= 6 ? "You have all the pieces. Do you really want to go?" : "The road home is just up the hill. Do you leave the Point, and the music, behind?", { choices: [
  { t: "Leave Skye tonight.", if: s => !s.tide, go: "end_leave" },
  { t: "Stay a little longer.", go: null },
] });

N("fin_before_last", "ghost", "One more. I never wrote the last bar. I never knew whether it falls home, or rises, or simply stops. You decide. Or stay with me, and we will play until the tide comes in.", { choices: [
  { t: "Play the last phrase.", fx: { event: "resume_piano" }, go: null },
  { t: "Stay and play with her, until the tide comes in.", go: "end_stay" },
  { t: "Lift your hands from the keys, for now.", fx: { event: "close_piano" }, go: null },
] });
N("fin_peace", "ghost", s => s.trust >= 2 ? "Home. It falls home. Thank you for listening to all of it." : "Home. It was always going to fall home. I only needed someone to play it.", { go: "end_peace" });
N("fin_other", "ghost", "Up? It goes up? …Oh. Oh, that is better. That is so much better.", { go: "end_other" });
const endFx = id => (s, ev) => { s.ending = id; applyFx(s, { event: "ending" }, ev); };
N("end_peace", "narr", "…", { fx: endFx("peace") });
N("end_other", "narr", "…", { fx: endFx("other") });
N("end_stay", "narr", "…", { fx: endFx("stay") });
N("end_leave", "narr", "…", { fx: endFx("leave") });
export const NODES = nodes;

/* ---------------- rules ---------------- */
export const OBJECTS = { board: "board", f1: "f1", f2: "f2", f3: "f3", f4: "f4", f5: "f5", f6: "f6", piano: "piano_locked", leave: "leave_ask" };
export function objectAvailable(id, s) {
  switch (id) {
    case "f1": case "f2": case "f3": case "f4": case "f5": return !s.frag[+id[1]];
    case "f6": return !s.frag[6];
    case "piano": return true;
    case "board": return true;
    case "leave": return true;
  }
  return false;
}
export function objectNode(id, s) {
  if (id === "f6") return outside(s) >= 3 ? "f6" : "f6_locked";
  return OBJECTS[id] || null;
}
export const labelFor = (id, s) => ({ board: "Read the board", f1: "Listen at the end of the pier", f2: "Examine the hearth", f3: "Touch the standing stone", f4: "Search the cave", f5: "Enter the chapel", f6: s.frag[6] ? "Look at the music stand" : "Look at the music stand", piano: hasAll(s) ? "Sit at the piano" : "Try the piano", leave: "Leave the Point" }[id] || "Interact");
export function objective(s) {
  const o = outside(s);
  if (s.ending) return "";
  if (s.tide && !s.frag[6]) return "Find the last page of the tune in the house. Check the music stand.";
  if (hasAll(s)) return "Sit at the piano and play the lament. Follow the glowing keys.";
  if (o === 0) return "Follow the faint piano music across the headland. Hold L to listen for echoes.";
  if (o < 5) return `Find the echoes of the tune (${o} / 5 outside). Hold L to listen, and follow the lights.`;
  return "You have all the outside echoes. Cross the causeway to the house at the end of the Point.";
}
export const defaultEnding = s => s.ending || "leave";
// the tide closes the causeway the first time the player crosses it toward the house with all five outside echoes
export const tideDue = s => !s.tide && outside(s) === 5;
export const CLUE_TEXT = {
  pier: "At the pier: four falling notes, and a woman who stayed behind to play the boats away. (Invented.)",
  hearth: "In the ruined township: she watched the families pack and leave. The tune is for the place left behind. (Invented.)",
  promise: "At the standing stone: her brother promised to return on the spring tide. A rising phrase for his return. (Invented.)",
  cave: "In the sea cave: a bottle with a letter, and a phrase tried again and again. The spring tide came, but the boat did not. (Invented.)",
  lament: "In the chapel: she wrote the heaviest phrase when the news came. (Invented.)",
  last_page: "The last page: “Play for me until the tide comes in.” The final bar is blank. (Quoted from the legend card; invented story.)",
};
