// THE ARCHIVE: collectible cards and relics, unlocked by REAL progress in the site.
//
// Design rules
//  - Nothing here owns the adventure progress. The sources of truth stay where they already were:
//      moe.woolpit.endings.v1  /  moe.skye.endings.v1  /  moe.hoia.endings.v1  /  moe.babayaga.endings.v1  /  moe.sibilla.endings.v1  /  moe.bathory.endings.v1
//    (written by the adventures), and moe.sibilla.finds.v1 / moe.bathory.finds.v1 (objects those adventures record the moment you obtain them)
//    and, for the short Hoia text story (which had no storage before), the `textEnds` map below. The two original Hoia relics accept
//    EITHER record (cond.alt): a save that earned them through the text story keeps them now that Hoia is also a 3D adventure.
//  - A card is unlocked ONLY when its condition is true in those real records. `sync()` re-evaluates every condition,
//    so saves made with a previous version of the site unlock their cards too (no reveal animation: they get a "new" badge).
//  - Unlocks are monotonic and idempotent: running sync() twice, finishing the same ending twice or reloading changes nothing.
//  - Storage goes through shared/save.js (localStorage, in-memory fallback): works offline, no accounts, no server.
import { load, save } from "./save.js";
import { ENDINGS_KEY as WOOLPIT_ENDINGS, ENDINGS as WOOLPIT_ENDING_DEFS } from "../adventures/woolpit/story.js";
import { ENDINGS_KEY as SKYE_ENDINGS, ENDINGS as SKYE_ENDING_DEFS } from "../adventures/skye/story.js";
import { ENDINGS_KEY as HOIA_ENDINGS, ENDINGS as HOIA_ENDING_DEFS } from "../adventures/hoia/story.js";
import { ENDINGS_KEY as BABAYAGA_ENDINGS, ENDINGS as BABAYAGA_ENDING_DEFS } from "../adventures/babayaga/story.js";
import { ENDINGS_KEY as SIBILLA_ENDINGS, ENDINGS as SIBILLA_ENDING_DEFS, FINDS_KEY as SIBILLA_FINDS } from "../adventures/sibilla/story.js";
import { ENDINGS_KEY as BATHORY_ENDINGS, ENDINGS as BATHORY_ENDING_DEFS, FINDS_KEY as BATHORY_FINDS, SAVE_KEY as BATHORY_SAVE } from "../adventures/bathory/story.js";

export const KEY = "moe.archive.v1";

/* ------------------------------------------------------------------ the legends */
export const LEGENDS = {
  woolpit: { id: "woolpit", title: "The Green Children of Woolpit", place: "Woolpit, Suffolk · England", country: "England", era: "12th century", color: "#9cba84", scene: "woolpit", adventure: true, endings: 6 },
  hoia:    { id: "hoia", title: "The Hoia Baciu Forest", place: "Cluj-Napoca · Romania", country: "Romania", era: "20th century reports", color: "#a08ac0", scene: "hoia", adventure: true, endings: 4 },
  skye:    { id: "skye", title: "The Ghost Pianist of the Isle of Skye", place: "Isle of Skye · Scotland", country: "Scotland", era: "An original story", color: "#93b6cb", scene: "skye", adventure: true, endings: 4 },
  babayaga: { id: "babayaga", title: "Baba Yaga’s Hut", place: "The Russian forest · East Slavic tales", country: "Russia", era: "Fairy tales, collected 1855–1863", color: "#e39a3b", scene: "babayaga", adventure: true, endings: 4 },
  sibilla: { id: "sibilla", title: "The Sibyl of the Apennines", place: "Monte Sibilla, Montemonaco · Italy", country: "Italy", era: "Medieval legend, 15th-century sources", color: "#c9a0dc", scene: "sibilla", adventure: true, endings: 4 },
  bathory: { id: "bathory", title: "Elizabeth Báthory — The Blood Countess", place: "Čachtice (Csejte) · Slovakia, then Kingdom of Hungary", country: "Slovakia", era: "Historical case, 1610–1614", color: "#8a2a3a", scene: "bathory", adventure: true, endings: 4 },
};
export const LEGEND_ORDER = ["woolpit", "hoia", "skye", "babayaga", "sibilla", "bathory"];
/** the Archivist's Seal keeps the rule it was earned under in v7: a relic from each of these four legends (unchanged, so no
    old unlock condition moves; the Sibilla adventure has its own seal) */
export const SEAL_LEGENDS = ["woolpit", "hoia", "skye", "babayaga"];

/* ------------------------------------------------------------------ card definitions
   type    : "legend" (open from the start) | "relic" (unlocked by an ending) | "seal" (meta reward)
   basis   : what the relic stands on. kind = historical | folklore | mixed | invented  (never present invention as history)
   hint    : shown while the card is sealed (never the name)
   cond    : the real condition. { k:"start" } | { k:"ending", adv, id, alt?:{legend,node} } | { k:"text", legend, node } | { k:"eachLegend" }
             | { k:"find", adv, id } (an object recorded by an adventure when obtained) | { k:"anyEnding", adv, among } (one of these endings)
             (alt = the same ending reached in a short text story also counts)          */
const L = (id, basisKind, basisText, blurb) => ({
  id: "legend-" + id, type: "legend", legend: id, name: LEGENDS[id].title, place: LEGENDS[id].place, tag: "Case file", symbol: "scene-" + id,
  blurb, basis: { kind: basisKind, text: basisText }, hint: "", why: "A case file open from the start: the Archive begins with the legends themselves.", cond: { k: "start" },
});
const R = (legend, id, name, symbol, blurb, basisKind, basisText, hint, why, cond) => ({
  id: legend + "-" + id, type: "relic", legend, name, place: LEGENDS[legend].place, tag: "Relic", symbol, blurb, basis: { kind: basisKind, text: basisText }, hint, why, cond,
});

export const CARDS = [
  L("woolpit", "historical",
    "Two 12th-century chroniclers, William of Newburgh and Ralph of Coggeshall, record green children found at the wolf pits of Woolpit. Whether it was myth, a mistranslation or truth is unknown.",
    "Two children with green skin appear in a village in the 12th century."),
  L("hoia", "folklore",
    "Hoia Baciu is a real forest at the edge of Cluj-Napoca. The lights, the cold and the bare clearing are reported tales and modern folklore, not proven phenomena.",
    "Twisted trees, lights in the sky and a clearing where nothing grows."),
  L("skye", "invented",
    "No documented ghost-pianist legend of Skye was found in the folklore sources checked, so this story is an original one. The Highland Clearances and Gaelic song are real background.",
    "A nighttime melody drifts from an abandoned house on the cliff."),
  L("babayaga", "folklore",
    "Baba Yaga belongs to the fairy tales of Russia, Ukraine and Belarus. “Vasilisa the Beautiful”, the tale this adventure follows, was collected by Alexander Afanasyev and published in 1855–1863. No place or person is claimed as real.",
    "A hut on chicken legs, a fence of skulls with burning eyes, and the witch who flies in a mortar."),
  L("sibilla", "folklore",
    "The Sibilla Appenninica is a figure of medieval legend and local folklore of the Monti Sibillini. Andrea da Barberino’s romance “Il Guerrin Meschino” (c. 1410) and Antoine de La Sale’s “Le Paradis de la reine Sibylle” (written in the late 1430s, after his visit of 18 May 1420) are the literary sources. No historical woman is known behind her.",
    "A prophetess queen inside a mountain of the Marche, her fairies who dance with shepherds, and a kingdom where days run away."),
  L("bathory", "historical",
    "Elizabeth Báthory (1560–1614) was a real Hungarian noblewoman. In 1610–11 more than three hundred statements, many of them hearsay, accused her of killing young women in her service; four servants were tried and confessed under torture; she was never tried and was confined at Čachtice until her death. The 650 victims and the blood baths are later legend; how far the accusations were true is still debated.",
    "A Hungarian countess walled up in her own castle, hundreds of accusations — and a legend of blood that historians still argue about."),

  R("woolpit", "servant", "The Wykes Household Ledger", "ledger",
    "A household account in a careful hand: linen, water, and a servant who sometimes stared at the sky at dusk.",
    "historical", "Ralph of Coggeshall says the girl served in Sir Richard de Calne’s household; William of Newburgh says she married a man from King’s Lynn. The ledger itself is an invented object.",
    "The ending that stays closest to the chronicles.",
    ending => `You reached the ending “${ending}” in The Green Children of Woolpit.`, { k: "ending", adv: "woolpit", id: "servant" }),
  R("woolpit", "both", "The Shared Bowl", "bowl",
    "A wooden bowl with two spoon-marks worn into it. In the chronicles the boy does not survive; here, someone made sure he did.",
    "invented", "INVENTED. In both chronicles the boy dies. Here your care gives him a different story, which is exactly why the legend has so many versions.",
    "A fate the chroniclers never recorded: both children live.",
    ending => `You reached the ending “${ending}” in The Green Children of Woolpit.`, { k: "ending", adv: "woolpit", id: "both" }),
  R("woolpit", "bells", "The Little Bell of the Hollow", "bell",
    "A small hand bell, cold as river water. When it rings, something far away seems to answer.",
    "mixed", "The bells, the cave and the twilight country are in the chronicles. The hollow in the mist and the farewell are invented; in the chronicles the girl stays in England.",
    "Follow the sound the girl cannot stop listening to.",
    ending => `You reached the ending “${ending}” in The Green Children of Woolpit.`, { k: "ending", adv: "woolpit", id: "bells" }),
  R("woolpit", "font", "The Font Ewer", "font",
    "A plain church jug. She said the water felt like rain on a country she could not remember.",
    "invented", "INVENTED. Baptism features in some tellings, but the chronicles do not say the girl entered the church’s care or forgot her homeland.",
    "Ask the church for help.",
    ending => `You reached the ending “${ending}” in The Green Children of Woolpit.`, { k: "ending", adv: "woolpit", id: "font" }),
  R("woolpit", "omen", "The Omen in the Margin", "margin",
    "A clerk’s marginal note, nothing more: a marvel, an omen, and then gone.",
    "invented", "INVENTED. The chronicles do not describe the village turning on the children; this ending shows how fear can decide a story.",
    "Fear decides what the village does.",
    ending => `You reached the ending “${ending}” in The Green Children of Woolpit.`, { k: "ending", adv: "woolpit", id: "omen" }),
  R("woolpit", "ink", "The Chronicler’s Inkhorn", "ink",
    "A horn of dried ink and a worn quill. It kept a story nobody could explain, and left it unexplained.",
    "historical", "Two chroniclers really did write this story down: William of Newburgh and Ralph of Coggeshall (who names Sir Richard de Calne). The scribe Walter and this conversation are invented.",
    "Someone has to write the words down.",
    ending => `You reached the ending “${ending}” in The Green Children of Woolpit.`, { k: "ending", adv: "woolpit", id: "ink" }),

  R("skye", "peace", "The Last Bar", "bar",
    "A single page of music, ending at last on the note that was missing.",
    "invented", "INVENTED. The pianist and her tune come from this story, not from a traditional Skye legend. The Highland Clearances that haunt her story are historical.",
    "Give the tune the ending it was written to have.",
    ending => `You reached the ending “${ending}” in The Ghost Pianist of Skye.`, { k: "ending", adv: "skye", id: "peace" }),
  R("skye", "other", "The Other Note", "highnote",
    "A high A, written in a hand that is neither yours nor hers, as if the tune had chosen hope.",
    "invented", "INVENTED. Rewriting a tune so that it ends in hope is the idea behind the “other note”. It is not a feature of any attested Gaelic lament.",
    "End it differently.",
    ending => `You reached the ending “${ending}” in The Ghost Pianist of Skye.`, { k: "ending", adv: "skye", id: "other" }),
  R("skye", "stay", "The Tide-Stained Score", "score",
    "A score warped by salt water, with two sets of fingermarks: one on the low notes, one on the high.",
    "invented", "INVENTED. This ending echoes the legend card (“play for me until the tide comes in”), which is a project starting point and not an attested folk tale.",
    "Do not stop playing.",
    ending => `You reached the ending “${ending}” in The Ghost Pianist of Skye.`, { k: "ending", adv: "skye", id: "stay" }),
  R("skye", "leave", "Four Falling Notes", "notes4",
    "Four notes falling like a sigh. You can never remember what should come after them.",
    "invented", "INVENTED. Not every story gets finished, and some are better left alone: leaving is also a real choice.",
    "Some stories are better left unfinished.",
    ending => `You reached the ending “${ending}” in The Ghost Pianist of Skye.`, { k: "ending", adv: "skye", id: "leave" }),

  R("hoia", "time", "The Watch That Lost Its Hour", "watch",
    "A pocket watch stopped at an hour no dial has. Its owner never agreed on how long they were gone.",
    "folklore", "Stories of lost time, and of a girl who vanished in the forest and returned five years later with no memory, are local lore. They are not documented facts.",
    "Step into the circle, and wait.",
    ending => `You reached the ending “${ending}” in The Hoia Baciu Forest (or the ending where time bends, in its short story).`, { k: "ending", adv: "hoia", id: "time", alt: { legend: "hoia", node: "d" } }),
  R("hoia", "watching", "The Watching Trees", "trees",
    "You looked back from the edge of the forest, and the trees seemed to look back at you.",
    "folklore", "Hoia Baciu is often called one of the most “haunted” places in the world. That is its reputation, not a verified fact.",
    "Leave the forest while you still can.",
    ending => `You reached the ending “${ending}” in The Hoia Baciu Forest (or left the forest safely, in its short story).`, { k: "ending", adv: "hoia", id: "leave", alt: { legend: "hoia", node: "e" } }),
  R("hoia", "negative", "The 1968 Negative", "negative",
    "A strip of film with one frame exposed: dark trees, a round clearing, and a pale blur that everyone reads differently.",
    "mixed", "On 18 August 1968 Emil Barnea photographed what he took for a disc over the clearing; the pictures are real and still argued about. Your camera and your photograph are invented.",
    "One frame left, and something in the sky.",
    ending => `You reached the ending “${ending}” in The Hoia Baciu Forest.`, { k: "ending", adv: "hoia", id: "lights" }),
  R("hoia", "tally", "The Shepherd’s Tally Stick", "tally",
    "A hazel stick with a notch for every sheep. There were two hundred. Now there are two hundred and one.",
    "folklore", "The shepherd who vanished with about two hundred sheep is the forest’s best-known tale, and many say it gave the forest its name. It is folklore, not a recorded event; the stick is invented.",
    "Follow the flock that never came out.",
    ending => `You reached the ending “${ending}” in The Hoia Baciu Forest.`, { k: "ending", adv: "hoia", id: "shepherd" }),

  R("babayaga", "lantern", "The Skull Lantern", "skull",
    "A skull on a birch stick. Its eyes still burn, and they look where you look.",
    "folklore", "In Afanasyev’s “Vasilisa the Beautiful” Baba Yaga gives the girl a skull from her fence, eyes blazing, as the fire she came for. This lantern is the game’s object.",
    "Answer as the girl in the tale answered.",
    ending => `You reached the ending “${ending}” in Baba Yaga’s Hut.`, { k: "ending", adv: "babayaga", id: "lantern" }),
  R("babayaga", "flight", "The Comb and the Towel", "comb",
    "A wet linen towel and a wooden comb with three teeth missing. One became a river, the other a forest.",
    "folklore", "In Afanasyev’s tale “Baba Yaga” a girl who fed the witch’s cat escapes with a towel that becomes a river and a comb that becomes a forest. Here they belong to the question you were warned not to ask.",
    "Ask the question you were warned not to ask.",
    ending => `You reached the ending “${ending}” in Baba Yaga’s Hut.`, { k: "ending", adv: "babayaga", id: "flight" }),
  R("babayaga", "stay", "The Mortar and Pestle", "mortar",
    "A wooden mortar, scorched underneath, and a pestle worn smooth by three hundred years of rowing through the air.",
    "mixed", "Baba Yaga flying in a mortar, steering with the pestle and sweeping her tracks with a broom is a well-known image of the tales. Becoming her apprentice is INVENTED for this game.",
    "Do the impossible work with your own hands, and stay.",
    ending => `You reached the ending “${ending}” in Baba Yaga’s Hut.`, { k: "ending", adv: "babayaga", id: "stay" }),
  R("babayaga", "leave", "The Little Doll", "doll",
    "A rag doll with a painted face, warm to the touch. When the path forks, it stirs.",
    "folklore", "Vasilisa’s doll, given by her dying mother, fed and asked for help, is in Afanasyev’s tale. Going home without fire is INVENTED: in the tale the girl cannot.",
    "Some walks are better left unfinished.",
    ending => `You reached the ending “${ending}” in Baba Yaga’s Hut.`, { k: "ending", adv: "babayaga", id: "leave" }),

  R("sibilla", "notebook", "La Sale’s Notebook", "notebook",
    "A small book bound in calfskin. On the first page, in a careful French hand: “18 May 1420. Montemonaco. To the mountain tomorrow.” The rest is blank, waiting for you.",
    "mixed", "Antoine de La Sale really climbed to the Sibyl’s cave from Montemonaco on 18 May 1420 and later wrote “Le Paradis de la reine Sibylle”. The notebook he gives you is INVENTED.",
    "A Frenchman in the village wants to know what lies beyond the door.",
    () => "Antoine de La Sale gave you his notebook in Montemonaco, to write down what you would see inside the mountain.", { k: "find", adv: "sibilla", id: "notebook" }),
  R("sibilla", "dance", "The Fairy’s Ribbon", "ribbon",
    "A ribbon of silk the colour of dawn, left round your wrist on the high meadow. It never frays, and on summer nights it smells of thyme.",
    "folklore", "The Sibyl’s fairies who come down to dance with the shepherds and must be home before dawn, and the “Fairies’ Road” cut by their hooves into Monte Vettore, are folklore of the Sibillini. The ribbon is the game’s object.",
    "Some dances are better not finished. Some are better never stopped.",
    ending => `You reached the ending “${ending}” in The Sibyl of the Apennines.`, { k: "ending", adv: "sibilla", id: "dance" }),
  R("sibilla", "return", "The Upward Hourglass", "hourglass",
    "A little hourglass of rock crystal from under the mountain. Its sand runs upward. Out in the daylight it has slowed almost to a stop, as if it were waiting for you to go back.",
    "invented", "Leaving the kingdom in time follows Guerrino, who walked out after a year (Barberino), and the knight of La Sale’s tale who came out before the last day. The hourglass is INVENTED.",
    "Refuse the queen, and walk out before the last day.",
    ending => `You reached the ending “${ending}” in The Sibyl of the Apennines.`, { k: "ending", adv: "sibilla", id: "return" }),
  R("sibilla", "knowledge", "The Sibyl’s Leaf", "leaf",
    "A dry leaf with a single line written on it in a hand older than the Latin alphabet. You can read it. Nobody else can.",
    "mixed", "Sibyls writing their prophecies on leaves comes from the classical tradition (Virgil’s Cumaean Sibyl, in the “Aeneid”). The Apennine Sibyl answering at a price is INVENTED: in Barberino’s romance she never answers Guerrino.",
    "Ask her, and pay what she asks.",
    ending => `You reached the ending “${ending}” in The Sibyl of the Apennines.`, { k: "ending", adv: "sibilla", id: "knowledge" }),
  R("sibilla", "kingdom", "The Unwithering Rose", "rose",
    "A rose from the gardens under the mountain, picked a hundred years ago or yesterday. It has not wilted. It does not smell of anything you can name.",
    "mixed", "The rule that a guest who stays past the last day stays until Judgement Day is from the tradition La Sale recorded. The rose, and your life among the Sibyl’s court, are INVENTED.",
    "Stay. Or forget to count.",
    ending => `You reached the ending “${ending}” in The Sibyl of the Apennines.`, { k: "ending", adv: "sibilla", id: "kingdom" }),
  {
    id: "sibilla-seal", type: "seal", legend: "sibilla", name: "The Sibyl’s Seal", place: "The throne under Monte Sibilla", tag: "Seal", symbol: "sibseal",
    blurb: "A seal of dark gold: a crowned mountain, and beneath it a door. It is warm, as if someone had only just let go of it.",
    basis: { kind: "invented", text: "A symbol made for this project. The crowned mountain recalls the ring of rock that people in the valley call the crown of Monte Sibilla." },
    hint: "Stand before the queen under the mountain, and answer her.", why: "You completed The Sibyl of the Apennines: you stood before the queen and answered her.", cond: { k: "anyEnding", adv: "sibilla", among: ["return", "knowledge", "kingdom"] },
  },
  R("bathory", "letter", "Her Letter to Ferenc", "letter",
    "A folded sheet in a firm Hungarian hand: the price of wheat at Sárvár, a cough that will not go, a son who has grown. Nothing about anything else.",
    "mixed", "Elizabeth Báthory was well educated and wrote letters in Hungarian, and some of her correspondence survives. This letter and its words are INVENTED for the game.",
    "Her writing desk keeps something no court ever read.",
    () => "You found a private letter from the countess to her husband on her writing desk at Csejte.", { k: "find", adv: "bathory", id: "letter" }),
  R("bathory", "monster", "The Witness Roll", "roll",
    "A long roll of statements, name after name, sealed with the Palatine’s wax. Most begin: “I have heard it said…”",
    "historical", "Thurzó’s notaries collected statements from 1610 into 1611, more than three hundred in all, and the trial records of January 1611 survive. Many statements are hearsay. The roll as an object is the game’s.",
    "Write that the accusations are substantially proven, and be able to defend it.",
    ending => `You reached the ending “${ending}” in Elizabeth Báthory — The Blood Countess.`, { k: "ending", adv: "bathory", id: "monster" }),
  R("bathory", "conspiracy", "The Crown’s Debt", "coin",
    "A gold florin of King Matthias II, and an IOU it was never enough to pay.",
    "mixed", "The Crown owed the Nádasdy family a large sum, and the Báthory lands mattered to powerful relatives; historians such as László Nagy argued the case was political. How much this explains is DISPUTED, and the coin is the game’s.",
    "Follow the money, and the men who never wanted a trial.",
    ending => `You reached the ending “${ending}” in Elizabeth Báthory — The Blood Countess.`, { k: "ending", adv: "bathory", id: "conspiracy" }),
  R("bathory", "unanswered", "The Countess’s Portrait", "portrait",
    "A copy of the portrait, the face pale above a lace collar. Look long enough and the expression changes with what you believe.",
    "mixed", "The well-known portrait of Elizabeth Báthory is a later copy of a lost original. Leaving the case open is the position of many careful historians. This little copy is the game’s.",
    "Write down what the records establish, and what they only repeat.",
    ending => `You reached the ending “${ending}” in Elizabeth Báthory — The Blood Countess.`, { k: "ending", adv: "bathory", id: "unanswered" }),
  R("bathory", "palatine", "The Sealed Report", "sealed",
    "A report in a fair clerk’s hand, sealed before it was read. Your signature is at the bottom.",
    "invented", "INVENTED: no such report exists. It stands for the official version of 1610–11, which kept the countess from any trial and her lands within the family.",
    "Sign what you are given.",
    ending => `You reached the ending “${ending}” in Elizabeth Báthory — The Blood Countess.`, { k: "ending", adv: "bathory", id: "palatine" }),
  {
    id: "bathory-seal", type: "seal", legend: "bathory", name: "The Báthory Family Seal", place: "Čachtice (Csejte) Castle", tag: "Seal", symbol: "teeth",
    blurb: "Red wax pressed with three teeth set in a jaw, the old arms of the Báthory of Ecsed. The impression is sharp, as if the matrix had never been used.",
    basis: { kind: "historical", text: "The Báthory arms bear three horizontal teeth (traditionally dragon’s or wolf’s teeth). This wax impression is made for the game." },
    hint: "Write a report of your own on the countess — and be able to defend it.", why: "You completed Elizabeth Báthory — The Blood Countess with a report you could defend.", cond: { k: "anyEnding", adv: "bathory", among: ["monster", "conspiracy", "unanswered"] },
  },
  {
    id: "seal-archivist", type: "seal", legend: "all", name: "The Archivist’s Seal", place: "The Archive", tag: "Seal", symbol: "seal",
    blurb: "Every legend, a relic from each, one seal. The Archive recognises someone who followed every thread.",
    basis: { kind: "invented", text: "A symbol made for this project’s archive. It does not copy any real institution’s seal." },
    hint: "Recover at least one relic from each of the first four legends: Woolpit, Hoia Baciu, Skye and Baba Yaga.", why: "You recovered a relic from every one of the first four legends.", cond: { k: "eachLegend" },
  },
  // a SECRET card: not a relic (the relic count and the Seal ignore it). It is earned in the landing valley, by catching
  // a will-o'-the-wisp before it fades (see src/world/wisps.js). Shown in the Archive as a sealed card until found.
  {
    id: "secret-wisp", type: "secret", legend: "secret", name: "The Will-o’-the-Wisp", place: "The valley below the castle", tag: "Secret", symbol: "wisp",
    blurb: "A cold blue-green light that drifted between the spruces and, for once, did not get away.",
    basis: { kind: "folklore", text: "Will-o’-the-wisps (ignis fatuus, “foolish fire”) appear in folklore across Europe: lights over marsh and forest said to lead travellers astray. Burning marsh gas has been proposed as an explanation; nothing is proven." },
    hint: "Something in the valley only shows itself to those who are quick.", why: "You caught a will-o’-the-wisp in the valley below the castle before it faded.", cond: { k: "secret", id: "wisp" },
  },
];
export const CARD = Object.fromEntries(CARDS.map((c, i) => (c.no = i + 1, [c.id, c])));
export const RELICS = CARDS.filter(c => c.type === "relic" || c.type === "seal");
export const SECRETS = CARDS.filter(c => c.type === "secret");

/* ------------------------------------------------------------------ the real sources of truth */
const ENDING_TITLES = { woolpit: WOOLPIT_ENDING_DEFS, skye: SKYE_ENDING_DEFS, hoia: HOIA_ENDING_DEFS, babayaga: BABAYAGA_ENDING_DEFS, sibilla: SIBILLA_ENDING_DEFS, bathory: BATHORY_ENDING_DEFS };
/** every ending id of a legend, in story order (for the Traveller's journal) */
export const endingIds = adv => Object.keys(ENDING_TITLES[adv] || {});
export const endingTitle = (adv, id) => (ENDING_TITLES[adv] && ENDING_TITLES[adv][id] && ENDING_TITLES[adv][id].title) || id;
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

function readEnv() {
  const st = readStore();
  return { woolpit: obj(load(WOOLPIT_ENDINGS, {})), skye: obj(load(SKYE_ENDINGS, {})), hoia: obj(load(HOIA_ENDINGS, {})), babayaga: obj(load(BABAYAGA_ENDINGS, {})), sibilla: obj(load(SIBILLA_ENDINGS, {})), bathory: obj(load(BATHORY_ENDINGS, {})), finds: { sibilla: obj(load(SIBILLA_FINDS, {})), bathory: obj(load(BATHORY_FINDS, {})) }, text: obj(st.textEnds), secrets: obj(st.secrets) };
}
function met(c, env) {
  const k = c.cond.k;
  if (k === "start") return true;
  if (k === "ending") return !!env[c.cond.adv][c.cond.id] || !!(c.cond.alt && env.text[c.cond.alt.legend + ":" + c.cond.alt.node]);
  if (k === "text") return !!env.text[c.cond.legend + ":" + c.cond.node];
  if (k === "secret") return !!env.secrets[c.cond.id];
  if (k === "find") return !!(env.finds[c.cond.adv] && env.finds[c.cond.adv][c.cond.id]);
  if (k === "anyEnding") return c.cond.among.some(id => !!(env[c.cond.adv] && env[c.cond.adv][id]));
  if (k === "eachLegend") {
    const has = l => RELICS.some(r => r.type === "relic" && r.legend === l && r.cond.k === "ending" && met(r, env));
    return SEAL_LEGENDS.every(has);
  }
  return false;
}

/* ------------------------------------------------------------------ store */
const fresh = () => ({ v: 1, cards: {}, revealed: {}, textEnds: {}, opened: {}, secrets: {} });
function readStore() {
  const s = load(KEY, null);
  if (!s || typeof s !== "object") return fresh();
  return { v: 1, cards: obj(s.cards), revealed: obj(s.revealed), textEnds: obj(s.textEnds), opened: obj(s.opened), secrets: obj(s.secrets) };
}
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function emit(newIds) {
  listeners.forEach(f => { try { f(newIds); } catch (e) { console.error(e); } });
  try { if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new CustomEvent("moe:archive", { detail: { unlocked: newIds } })); } catch (e) { /* optional */ }
}

/** Re-evaluates every card against the real progress. Returns the cards that became unlocked just now. */
export function sync(via = "sync") {
  const st = readStore(), env = readEnv(), added = [];
  for (const c of CARDS) {
    if (!st.cards[c.id] && met(c, env)) { st.cards[c.id] = { at: Date.now(), via }; added.push(c); }
  }
  if (added.length) { save(KEY, st); emit(added.map(c => c.id)); }
  return added;
}

/** Call right after an adventure wrote its ending to ITS save (the condition is re-checked here, nothing is trusted blindly). */
export function recordEnding(adv, endingId) { return sync(`ending:${adv}:${endingId}`); }
/** The Hoia text story had no storage: terminal nodes are recorded here. */
export function recordTextEnding(legend, node) {
  if (!LEGENDS[legend]) return [];
  if (!cardForText(legend, node)) return [];   // only real endings with a relic are recorded
  const st = readStore(), k = legend + ":" + node;
  if (!st.textEnds[k]) { st.textEnds[k] = Date.now(); save(KEY, st); }
  return sync(`text:${k}`);
}
/** A secret found in the landing valley (e.g. "wisp"). Idempotent: returns the cards unlocked now ([] if it was already found). */
export function recordSecret(id) {
  if (!CARDS.some(c => c.cond.k === "secret" && c.cond.id === id)) return [];
  const st = readStore();
  if (!st.secrets[id]) { st.secrets[id] = Date.now(); save(KEY, st); }
  return sync(`secret:${id}`);
}
export const hasSecret = id => !!readStore().secrets[id];
export const textEndingsFound = legend => Object.keys(readStore().textEnds).filter(k => k.startsWith(legend + ":")).length;

export const isUnlocked = id => !!readStore().cards[id];
export const unlockedIds = () => Object.keys(readStore().cards);
export const cardForEnding = (adv, id) => CARDS.find(c => c.cond.k === "ending" && c.cond.adv === adv && c.cond.id === id) || null;
const textCond = c => (c.cond.k === "text" ? c.cond : c.cond.alt) || null;
export const cardForText = (legend, node) => CARDS.find(c => { const t = textCond(c); return t && t.legend === legend && t.node === node; }) || null;
export const unlockedAt = id => { const c = readStore().cards[id]; return c ? c.at : 0; };
export const isRevealed = id => !!readStore().revealed[id];
export function markRevealed(...ids) { const st = readStore(); let ch = false; for (const id of ids) if (st.cards[id] && !st.revealed[id]) { st.revealed[id] = true; ch = true; } if (ch) { save(KEY, st); emit([]); } }
export function markOpened(legend) { const st = readStore(); if (!st.opened[legend]) { st.opened[legend] = Date.now(); save(KEY, st); emit([]); } }
/** Unlocked but never revealed or opened: shown with a "new" badge. */
export const isNew = id => { const st = readStore(); return !!st.cards[id] && !st.revealed[id] && CARD[id].type !== "legend"; };

export function progress() {
  const st = readStore(), got = id => !!st.cards[id];
  const relics = RELICS, have = relics.filter(r => got(r.id)).length;
  return { total: CARDS.length, unlocked: CARDS.filter(c => got(c.id)).length, relics: relics.length, relicsUnlocked: have, complete: have === relics.length };
}

/** Status of a legend for the Legends cards and the map pins. */
const SAVE_KEYS = { woolpit: "moe.woolpit.save.v1", skye: "moe.skye.save.v1", hoia: "moe.hoia.save.v1", babayaga: "moe.babayaga.save.v1", sibilla: "moe.sibilla.save.v1", bathory: BATHORY_SAVE }, ENDING_KEYS = { woolpit: WOOLPIT_ENDINGS, skye: SKYE_ENDINGS, hoia: HOIA_ENDINGS, babayaga: BABAYAGA_ENDINGS, sibilla: SIBILLA_ENDINGS, bathory: BATHORY_ENDINGS };
/** The endings found for a legend: the adventure's own record, plus (Hoia) the endings reached in the short text story, mapped to the same ids. */
export function endingsFoundFor(legend) {
  const found = new Set(Object.keys(obj(load(ENDING_KEYS[legend], {}))));
  const st = readStore(); for (const c of CARDS) if (c.legend === legend && c.cond.k === "ending" && c.cond.alt && st.textEnds[c.cond.alt.legend + ":" + c.cond.alt.node]) found.add(c.cond.id);
  return found;
}
export function legendStatus(legend) {
  const def = LEGENDS[legend], found = endingsFoundFor(legend).size, s = load(SAVE_KEYS[legend], null), hasSave = !!(s && s.s && !s.s.ending);
  const state = found >= def.endings ? "mastered" : found > 0 ? "completed" : hasSave ? "inprogress" : "available";
  return { state, found, total: def.endings, hasSave };
}
export const STATE_LABEL = { available: "Adventure available", inprogress: "In progress", completed: "Completed", mastered: "All endings found" };

/** Text for the "why you got it" line. */
export function whyText(card) {
  if (card.cond.k === "ending") return card.why(endingTitle(card.cond.adv, card.cond.id));
  if (card.cond.k === "find") return card.why();
  return typeof card.why === "function" ? card.why() : card.why;
}
export const hintText = card => card.hint || "";
/** wording of the state chip: legends without a 3D adventure are "stories" */
export const stateLabel = (legend, state) => (state === "available" && !LEGENDS[legend].adventure ? "Story available" : STATE_LABEL[state]);
export const KIND_LABEL = { historical: "Historical basis", folklore: "Folklore", mixed: "Mixed: history and invention", invented: "Invented" };

/** Used by tests and "reset collection". Never touches the adventure saves. */
export function _resetArchiveOnly() { save(KEY, fresh()); emit([]); }
