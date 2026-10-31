// THE SIBYL OF THE APENNINES - story data and rules (pure logic, no DOM, no WebGL; tested from Node).
//
// SOURCES vs INVENTION (the codex labels every entry; nothing supernatural is presented as fact)
//  Literary sources: Andrea da Barberino, "Il Guerrin Meschino" (written c. 1410, printed 1473): the knight who does not know
//  his parents climbs to the Sibyl, stays a year, resists her ladies (who take the form of serpents once a week) and is not
//  given his answer. Antoine de La Sale, "Le Paradis de la reine Sibylle" (written in the late 1430s for Agnes of Burgundy,
//  Duchess of Bourbon): his own visit to the cave on 18 May 1420 from Montemonaco, which he describes up to the entrance, and
//  the tales he collected - the German knight and his squire, the rule of the days (retold as the eighth, the thirtieth and the
//  three hundred and thirtieth day; retellings differ), the journey to the Pope and the return to the mountain.
//  Local folklore: the Sibyl's fairies who come down at night to dance with the shepherds of Foce, Montemonaco and Montegallo,
//  their goat's hooves under long skirts, the run before dawn that cut the "Fairies' Road" into Monte Vettore; one telling of
//  the Sibyl as a prophetess condemned to the mountain until Judgement Day.
//  Invented for this game: the player, Lucia, Vittoria, Nicola, Biagio and Don Matteo, the medallion, the red thread that
//  counts the days, every line of dialogue (Antoine de La Sale is a real person; his words here are invented), the four endings.
//
// Meters (the narrative core's generic ones): know = LORE (what you have learned, 0..20), susp = ENCHANTMENT (how deeply the
// mountain holds you, 0..10). `day` counts the days spent in the kingdom: every temptation costs days, and enchantment makes
// them run faster. Past day 330 the way home is closed.
import { applyFx } from "../../narrative/core.js";

export const SAVE_KEY = "moe.sibilla.save.v1", ENDINGS_KEY = "moe.sibilla.endings.v1", FINDS_KEY = "moe.sibilla.finds.v1";
export const DAY_LIMIT = 330;
// act: 1 the village (dusk) -> 2 the mountain (night) -> 3 the kingdom -> 4 the queen. area: village | mountain | kingdom
export const initState = () => ({
  v: 1, act: 1, area: "village", stage: "village", know: 0, susp: 0, trust: 0, skin: 0, day: 0, ending: null, guide: null,
  rel: {}, flags: {}, items: { medallion: true }, words: {}, clues: {}, notes: { n_sibyl: true }, seen: {}, once: {},
});

/** days pass faster for the enchanted (1x .. 2.5x) */
export const dayRate = s => 1 + Math.min(10, s.susp) * 0.15;
export function addDays(s, n, ev = []) { const d = Math.max(1, Math.round(n * dayRate(s))), o = s.day; s.day += d; ev.push({ t: "days", d, from: o, to: s.day }); return ev; }
/** fx helper: the usual effects, plus days in the kingdom */
const F = (o, dn = 0) => (s, ev) => { applyFx(s, o, ev); if (dn) addDays(s, dn, ev); };
export const pastLimit = s => s.day > DAY_LIMIT;
/** the way out: in time, and not too enchanted to remember it (the thread or the blessing help) */
export const canReturn = s => !pastLimit(s) && (s.susp < 8 || !!s.items.thread || !!s.flags.blessed);
export const VILLAGE_TALKS = ["lasale_1", "priest_1", "shepherd_1", "singer_1", "vittoria_1"];
export const talksHeard = s => VILLAGE_TALKS.filter(k => s.seen[k]).length;
export const KINGDOM_FINDS = ["knight", "serpents", "time", "feast", "dance", "watch", "sleep"];
export const kingdomFound = s => KINGDOM_FINDS.filter(k => s.flags["k_" + k]).length;
export const knowsMother = s => !!(s.clues.medal_match && s.clues.medal_seen);

export const WHO = {
  narr: { name: "", style: "narr" }, you: { name: "You" },
  lasale: { name: "Antoine de La Sale", role: "a gentleman of Anjou" }, priest: { name: "Don Matteo", role: "the parish priest" },
  shepherd: { name: "Nicola", role: "an old shepherd" }, singer: { name: "Biagio", role: "a cantastorie" }, vittoria: { name: "Vittoria", role: "the herb-woman" },
  fairy: { name: "The dancer", role: "one of the Sibyl’s ladies" }, porter: { name: "The porter", role: "keeper of the crystal door" },
  knight: { name: "The German knight", role: "a guest of the kingdom" }, sibyl: { name: "The Sibyl", role: "Queen of the mountain" },
};

/* ---------------- codex: kind = historical | literary | folklore | invented ---------------- */
export const CODEX = {
  n_sibyl: { kind: "folklore", title: "The Sibyl of the Apennines", text: "The Monti Sibillini take their name from the Sibilla Appenninica, a prophetess and queen said to live inside Monte Sibilla (2,173 m), in the Marche. Medieval tradition places an enchanted kingdom beyond a cave near the summit. She is a figure of legend; no historical woman is known behind her." },
  n_village: { kind: "historical", title: "Montemonaco", text: "Montemonaco is a real village of the Aso valley, at about 1,000 m, and the traditional starting point for the cave. The village you walk through is a reconstruction for the game, not a survey of the real one." },
  n_crown: { kind: "historical", title: "The crown of the mountain", text: "The summit of Monte Sibilla is ringed by a band of rock that people in the valley call its “crown”. The real cave opens just below it, at about 2,150 m." },
  n_lasale: { kind: "historical", title: "Antoine de La Sale (c. 1386 – c. 1461)", text: "A Provençal gentleman in the service of the house of Anjou. He climbed to the cave from Montemonaco on 18 May 1420 and described its entrance. Years later he wrote “Le Paradis de la reine Sibylle” for Agnes of Burgundy, Duchess of Bourbon. He is real; everything he says in this game is invented." },
  n_knight: { kind: "literary", title: "The German knight", text: "Among the tales La Sale collected is that of a German knight and his squire who entered the mountain, lived among its delights, came out in time and went to Rome for the Pope’s pardon. Refused, they returned to the Sibyl; the pardon, it is said, came too late. Retellings disagree on names and dates." },
  n_days: { kind: "literary", title: "The rule of the days", text: "In the tradition retold from La Sale, a guest may leave on the eighth day, the thirtieth, or the three hundred and thirtieth; whoever stays past that stays until the Day of Judgement. Retellings give different numbers. The game follows the 330 days most often quoted." },
  n_guerrin: { kind: "literary", title: "Guerrin Meschino", text: "Andrea da Barberino wrote “Il Guerrin Meschino” in Florence around 1410; it was first printed in 1473. Guerrino, who does not know his parents, seeks the Sibyl, stays a year, resists her and her ladies, and leaves without the answer he came for. The romance was loved for centuries, by shepherds of these mountains too." },
  n_cantastorie: { kind: "historical", title: "Cantastorie", text: "Street singers who told chivalric romances in Italian squares, often pointing at painted boards. Biagio is invented; tales like Guerrino’s were their stock in trade." },
  n_fall: { kind: "folklore", title: "Why she lives in a mountain", text: "One telling: the Sibyl hoped to be the mother of the Saviour; when another was chosen she rebelled, and was shut in the mountain until Judgement Day. Others remember a wise woman who taught healing herbs. The game lets both stand." },
  n_feet: { kind: "folklore", title: "The fairies’ feet", text: "The Sibyl’s ladies came down at night to Foce, Montemonaco and Montegallo and danced with the shepherds. They were beautiful, and they were recognised by their feet: goat’s hooves, hidden under long skirts." },
  n_road: { kind: "folklore", title: "The Fairies’ Road", text: "One night the fairies stayed too long at a dance. Surprised by dawn, they ran back to the mountain so fast that their hooves cut a line across Monte Vettore: the “Strada delle Fate”, in fact a geological fault at about 2,000 m." },
  n_saltarello: { kind: "historical", title: "The saltarello", text: "A leaping dance of central Italy. Instrumental saltarelli survive in a fourteenth-century Italian manuscript (London, British Library, Add. MS 29987), and the dance lived on in the folk music of the Marche and Abruzzo. The tune you hear is original." },
  n_stazzo: { kind: "invented", title: "The shepherd’s hut", text: "Stone huts like this sheltered shepherds on the summer pastures of the Apennines. The tally on its wall, and whoever scratched it, are invented." },
  n_shrine: { kind: "invented", title: "The ruined shrine", text: "The ruin and its worn inscription are invented. Names like “the Sibyl’s temple” do occur among the place names of these mountains." },
  n_cave: { kind: "historical", title: "The real cave", text: "A cave near the summit was visited for centuries by the curious, by would-be magicians and by pilgrims of the legend, and condemned by the Church. Its entrance has collapsed over time; today it cannot be entered. What lies beyond in this game is imagined." },
  n_doors: { kind: "literary", title: "The way in", text: "Retellings of the knight’s journey describe a terrifying way in: winds and noises at the mouth, a narrow passage over an abyss, doors of metal that never stop beating, and beyond them a door of crystal kept by a lady who asks the visitor’s name. The game stages them freely." },
  n_serpents: { kind: "literary", title: "Saturday", text: "In Barberino’s romance and in the tales La Sale heard, the queen and her ladies take the form of serpents once a week, from Friday night until Saturday has passed, and their guests are not supposed to see it." },
  n_time: { kind: "folklore", title: "Time under the hill", text: "Across Europe, those who visit a fairy realm return to find that years have passed in what felt like days. The mountain’s rule of days belongs to that family of tales." },
  n_tannhauser: { kind: "literary", title: "Tannhäuser", text: "The legend of the knight in the Sibyl’s mountain travelled north and became attached to Tannhäuser and the Venusberg, where a knight lives with Venus and seeks a pardon from the Pope that comes too late." },
  n_thread: { kind: "invented", title: "The red thread", text: "Vittoria’s thread, which counts your days in the kingdom, is the game’s invention." },
  n_lucia: { kind: "invented", title: "Lucia and the medallion", text: "Lucia of Foce, her sister Vittoria, the broken medallion and your own story are invented for this game." },
};
export const KIND_TAG = { historical: "Historical", literary: "Literary source", folklore: "Local folklore", invented: "Invented for this game" };

/* ---------------- clues (journal) ---------------- */
export const CLUE_TEXT = {
  errand: "You were left as a baby at the abbey, wrapped in blue wool, with half of a bronze medallion. They say the queen in the mountain knows every answer.",
  knight: "La Sale’s tale: a German knight lived in the mountain, came out, went to the Pope, and went back. Guests may leave on the 8th, 30th or 330th day.",
  days: "Whoever stays past the 330th day stays forever.",
  fall: "Don Matteo: the Sibyl was a prophetess shut in the mountain until Judgement Day. The Church forbids the climb.",
  dawn: "Nicola: the fairies must be back in the mountain before dawn.",
  feet: "Nicola: under their long skirts, the dancers have goat’s hooves.",
  basket: "Nicola found a baby in a basket below the crown one dawn, twenty years ago, and carried it to the monks.",
  meadow: "The fairies dance on the high meadow below the crown when the moon is up.",
  guerrin: "Biagio’s song: Guerrino asked the Sibyl who his parents were. She never answered; she tried to keep him instead.",
  ask: "Biagio: an answer from her is a door that closes. Bring her something she wants.",
  price: "Vittoria: the Sibyl never takes by force. She asks for what you do not value, and people give it.",
  lucia: "Vittoria’s sister Lucia went up dancing one midsummer, twenty years ago, carrying a child, and never came back.",
  medal_match: "Vittoria knew your half-medallion: Lucia took the other half up the mountain.",
  tally: "In the shepherd’s hut, hundreds of days scratched on the wall. Then they stop.",
  shrine: "A ruined shrine on the slope. Worn letters: “…REGINA… NON REDIT…”",
  cup: "You drank from the dancers’ cup. The climb was easy. Your head is full of music.",
  porter_lie: "The porter said there is no Lucia here. Her hands shook.",
  medal_seen: "The porter wears half of a bronze medallion at her throat.",
  feast: "You ate at the queen’s table. It tasted of every summer you remember.",
  dance: "You danced in the hall. The music never ended; the hours did.",
  serpents: "Saturday: in the lower garden the ladies’ dresses lie empty, and serpents coil in the dark pool.",
  time: "In the round window you saw the village above, and the season had changed.",
  sleep: "You slept in the garden. When you woke, the flowers were different.",
};
CLUE_TEXT.knightmet = "The German knight is still here. He went back to her after the Pope refused him. He warns: count your days, and stay out of the lower garden on Saturdays.";

/* ---------------- endings ---------------- */
export const ENDINGS = {
  dance: { id: "dance", kicker: "Ending 1 of 4", title: "The Fairies’ Road", cls: "e-dance",
    paragraphs: s => [
      "You danced. The saltarello leapt from one star to the next, and the dancers spun you until you could not tell your hands from theirs.",
      "Then the sky paled over the Adriatic. Someone cried out, and they ran: up the mountain, faster than goats, and where their hooves struck the rock they left a long pale scar across the slope.",
      `You wake at sunrise alone on the meadow, with a silk ribbon round your wrist${s.items.thread ? ", tied beside Vittoria’s red thread" : ""}. You never find the cave. Every summer, on the night of the dance, you climb back and wait.`,
    ],
    notes: ["The fairies who must be home before dawn, and the “Fairies’ Road” their hooves cut into Monte Vettore, are local folklore of the Sibillini. Staying on the meadow and never finding the cave is this game’s ending."] },
  return: { id: "return", kicker: "Ending 2 of 4", title: "The Return", cls: "e-return",
    paragraphs: s => [
      knowsMother(s) ? "At the crystal door the porter takes your hand. She cannot cross the threshold; you cannot stay. She closes your fingers over her half of the medallion, and the two halves click into one." : "You turn your back on the queen and walk out, past the crystal door, between the beating doors, over the bridge, into the wind.",
      `The light at the mouth of the cave is white. Snow lies on the crown of the mountain. ${s.items.thread ? `Your thread says you were gone ${s.day} days.` : "You have no idea how long you were gone."} Below, Montemonaco is smoking its winter chimneys.`,
      knowsMother(s) ? "Vittoria opens the door before you knock. She looks at the whole medallion in your palm, and at your face, and lets you in." : "You never learn your mother’s name. You learn instead how to live without the answer, which, Biagio says, is the end of Guerrino’s story too.",
      s.items.notebook ? "In the spring a letter comes from France, asking whether you went in. You write back that you did, and that some doors are best described from the outside." : "Years later a Frenchman’s book describes the cave’s mouth with great care, and goes no further. You understand him perfectly.",
    ],
    notes: ["Refusing the Sibyl and leaving in time echoes Guerrino, who left after a year without his answer (Andrea da Barberino, c. 1410), and the knight of La Sale’s tale who came out in time. The rest is this game’s story."] },
  knowledge: { id: "knowledge", kicker: "Ending 3 of 4", title: "The Sibyl’s Answer", cls: "e-knowledge",
    paragraphs: s => [
      "The Sibyl writes your answer on a leaf, and lets the leaf go. It drifts across the hall, and for a moment every leaf of her garden is a page.",
      "Your mother’s name was Lucia. She came up dancing, carrying you, and stayed. She asked for one more day, and lost the door; you, born mortal, did not. She carried you to the threshold, and a shepherd found you at dawn. She keeps the crystal door still.",
      s.flags.paid === "name" ? "You paid with your name. At the abbey the brothers greet you politely, as a stranger. In Montemonaco nobody remembers the traveller who asked so many questions. Vittoria looks at you a long time, as if at a word on the tip of her tongue, and gives you bread." : "You paid with the Frenchman’s notebook. When Antoine de La Sale writes his book for the Duchess of Bourbon, he describes the mouth of the cave with great care, and says he went no further. He is telling the truth: you took the rest.",
      "You know who you are. It weighs exactly what she said it would.",
    ],
    notes: ["In Barberino’s romance the Sibyl never gives Guerrino the answer he came for. Here she does, at a price. La Sale did write that he went only as far as the entrance; the reason given here is fiction."] },
  kingdom: { id: "kingdom", kicker: "Ending 4 of 4", title: "The Kingdom Under the Mountain", cls: "e-kingdom",
    paragraphs: s => [
      pastLimit(s) ? `You were her guest for ${s.day} days. The three hundred and thirtieth went by while you were laughing at something, and the doors closed without a sound.` : "You stay. The queen smiles as if you had said something old and true, and the doors close without a sound.",
      knowsMother(s) || s.flags.told ? "Every evening you sit with Lucia by the crystal door and tell her about the village, the sheepfolds, the sister who still sets a place for her at Christmas. She listens as if it were a story about someone else." : "The garden never wilts. The music never stops. Nobody here asks you who your mother was, and after a while you stop asking too.",
      "On summer nights you go down with the ladies to the threshing floors of Foce and dance with the shepherds, and you are always home before dawn. Your feet have begun to feel strange in your shoes.",
    ],
    notes: ["The rule that guests who stay past the last day stay until Judgement Day is from the tradition La Sale recorded. Joining the dancers who visit the villages, from local folklore. Your story is this game’s."] },
};
export const ENDING_ORDER = ["dance", "return", "knowledge", "kingdom"];
/** endings reached in the queen's hall: they complete the adventure (the Sibyl's Seal) */
export const QUEEN_ENDINGS = ["return", "knowledge", "kingdom"];

/* ---------------- dialogue nodes ---------------- */
const nodes = {};
const N = (id, who, text, o = {}) => { nodes[id] = { id, who, text, ...o }; return nodes[id]; };
const BYE = { t: "Leave the conversation.", go: null };

/* ===== ACT I — the village ===== */
N("start", "narr", "Montemonaco, in the Marche. An evening in May, 1420.\n\nYou were left at the abbey gate as a newborn, wrapped in blue wool, with half of a bronze medallion tied round your neck. Nobody could ever tell you more. Above the village, the mountain of the Sibyl wears its crown of rock against the sunset, and in every valley of these hills they say the same thing: the queen inside it knows every answer.", { fx: { note: ["n_village", "n_crown"], clue: "errand" }, go: "start2" });
N("start2", "you", "Someone in this village knows the way up. Before night falls, I need to hear what they know.", { go: null });

N("lasale_1", "lasale", s => s.items.notebook ? "Ah, my fellow investigator. Have you filled any pages yet? No? The mountain will wait for us both, I think." : "Another traveller who looks at that mountain the way I do. Antoine de La Sale, in the service of the house of Anjou. I have come to see the famous cave of the Sibyl with my own eyes, so that I may write of it truthfully. The people here tell me a great many things — half of them, I suspect, to frighten a Frenchman.", { fx: { note: "n_lasale" }, choices: [
  { t: "What have they told you?", go: "lasale_tales" },
  { t: "Have you been up there yet?", go: "lasale_climb" },
  { t: "I am going up tonight. Not just to the mouth: inside.", if: s => s.seen.lasale_tales && s.seen.lasale_climb && !s.items.notebook && !s.flags.lasale_refused, go: "lasale_deal" },
  BYE] });
N("lasale_tales", "lasale", "That in their grandfathers’ time a German knight and his squire went into the mountain and found a kingdom: delights, ladies, a queen. A guest may leave on the eighth day, or the thirtieth, or the three hundred and thirtieth. Whoever stays past that stays until the Day of Judgement.\n\nThe knight came out in time, they say, and went to Rome for the Pope’s pardon. The Pope refused him. So he went back to her. I find I cannot stop thinking about that.", { fx: { note: ["n_knight", "n_days", "n_tannhauser"], clue: ["knight", "days"], know: 2 }, go: "lasale_1" });
N("lasale_climb", "lasale", "Tomorrow, with two men of the village as guides. They will take me to the mouth and not one step further, they tell me, and I am inclined to let them. I intend to see the entrance, measure it with a rope, and set it down in ink. Honesty, you see, is cheaper than courage.", { go: "lasale_1" });
N("lasale_deal", "lasale", "Inside! Then you are braver than I am, or poorer in good sense. Here.\n\nHe presses a small bound notebook into your hands. “Write what you see, if you see anything. If you come back, I should like to read it. If you do not… well. It is a good notebook.”", { choices: [
  { t: "Take the notebook.", fx: { item: "notebook", rel: { lasale: 2 }, know: 1, event: "notebook" }, go: "lasale_took" },
  { t: "Keep it, sir. I may not come back to give it to you.", fx: { flag: "lasale_refused" }, go: "lasale_kept" }] });
N("lasale_took", "lasale", "Good. One honest page is worth a hundred marvellous ones. Remember that, when she starts talking.", { go: null });
N("lasale_kept", "lasale", "Then come back anyway, and tell me with your mouth. I shall be at the inn for three more days.", { go: null });

N("priest_1", "priest", "You have the look of someone about to do something foolish, and the mountain is the usual foolishness here. Necromancers come from beyond the Alps to ask her for gold and spells. The Church forbids it, and so do I.", { fx: { note: "n_cave" }, choices: [
  { t: "Is she a demon, then?", go: "priest_evil" },
  { t: "What about the fairies?", go: "priest_fairies" },
  { t: "Will you bless me before I go?", once: "bless", go: "priest_bless" },
  BYE] });
N("priest_evil", "priest", "A damned soul, not a demon. They say she was a prophetess who expected to be chosen for the greatest honour a woman was ever given, and when another was chosen she rebelled. So she was shut in the mountain until Judgement Day. She is lonely, child. Lonely things are dangerous.", { fx: { note: "n_fall", clue: "fall", know: 1 }, go: "priest_1" });
N("priest_fairies", "priest", "Her ladies come down on summer nights and dance on the threshing floors with the young men. Every spring I tell the girls of Foce to stay in, and every summer somebody does not.", { go: "priest_1" });
N("priest_bless", "priest", "He sighs, and makes the sign of the cross over you. “It will not stop you. Nothing stops the young. But it may remind you, down there, that there is a world that wants you back.”", { fx: { flag: "blessed", toast: "Don Matteo’s blessing: in the kingdom, temptation will hold you a little less." }, go: "priest_1" });

N("shepherd_1", "shepherd", "Eh. When I was as young as you, they came down to the threshing floor at Foce on summer nights. Beautiful women in long skirts. They danced the saltarello better than any girl of the valley, and they never, ever let you walk them home.", { fx: { note: "n_saltarello" }, choices: [
  { t: "Why not?", go: "shepherd_dawn" },
  { t: "Was there anything strange about them?", go: "shepherd_feet" },
  { t: "Where do they dance now?", go: "shepherd_meadow" },
  { t: "Did you ever find anything up on the mountain?", if: s => s.seen.shepherd_feet && s.seen.shepherd_dawn, once: "basket", go: "shepherd_basket" },
  BYE] });
N("shepherd_dawn", "shepherd", "They had to be back in the mountain before dawn. One night they lingered, and when the cock crowed they ran so fast up the side of the Vettore that they cut a road in the rock. You can see it from the pass: the Fairies’ Road.", { fx: { note: "n_road", clue: "dawn", know: 1 }, go: "shepherd_1" });
N("shepherd_feet", "shepherd", "He lowers his voice. “Their feet. Once, as we spun, the skirt of the girl in my arms flew up. Hooves, child. Neat little goat’s hooves, like a kid’s. I said nothing. You say nothing, if you want to dance again.”", { fx: { note: "n_feet", clue: "feet", know: 1 }, go: "shepherd_1" });
N("shepherd_meadow", "shepherd", "On the high meadow below the crown, when the moon is up. Follow the trail past my old hut. You will hear them before you see them.", { fx: { clue: "meadow" }, go: "shepherd_1" });
N("shepherd_basket", "shepherd", "He is quiet for a long time. “Twenty summers ago, at dawn, below the crown: a basket on a rock, and in it a child in blue wool, crying fit to wake the dead. I carried it down to the monks and told the priest I found it by the road. A man should not have to explain the mountain to a priest.”", { fx: { clue: "basket", know: 2, rel: { shepherd: 1 } }, go: "shepherd_1" });

N("singer_1", "singer", "Gather round, gather round! The tale of Guerrino, called the Wretched, who knew neither his father nor his mother, and climbed the Sibyl’s mountain to ask!", { fx: { note: "n_cantastorie" }, choices: [
  { t: "Sing it.", go: "singer_song" },
  { t: "Is any of it true?", go: "singer_true" },
  { t: "I am like Guerrino. I do not know my mother.", if: s => s.seen.singer_song, once: "singer_you", go: "singer_you" },
  BYE] });
N("singer_song", "singer", "♪ …and the Sibyl received him with honour, and her ladies were fair beyond telling. A year he stayed, and every Saturday the ladies went away, and he found them in the dark of the garden turned to serpents. He asked the queen who his parents were. She smiled, and gave him wine, and gave him music, and never gave him the answer. And after a year Guerrino walked out into the wind, and went to Rome to be forgiven. ♪", { fx: { note: ["n_guerrin", "n_serpents"], clue: "guerrin", know: 2 }, go: "singer_1" });
N("singer_true", "singer", "True? Messer Andrea of Barberino wrote it down in Florence, not a dozen years ago, and I sing it. What is written and sung is true enough to earn my supper.", { go: "singer_1" });
N("singer_you", "singer", "He stops strumming. “Then do not do what Guerrino did. He asked her straight out, and she would not answer, because an answer is a door that closes behind you. Bring her something she wants. Queens are like singers: they work for pay.”", { fx: { clue: "ask", know: 1 }, go: "singer_1" });

N("vittoria_1", "vittoria", "The priest calls her a damned soul. The singer calls her a temptress. That Frenchman calls her a curiosity. My grandmother called her the Wise One: she taught the women of these valleys which herb heals and which one kills.", { choices: [
  { t: "What does she want from those who come?", go: "vittoria_price" },
  { t: "How do I keep from staying forever?", if: s => !s.items.thread, go: "vittoria_thread" },
  { t: "Did you ever go up there?", go: "vittoria_sister" },
  { t: "Show her your half of the medallion.", if: s => s.seen.vittoria_sister && !s.clues.medal_match, go: "vittoria_medal" },
  BYE] });
N("vittoria_price", "vittoria", "What anyone wants: what you have and do not value. She never takes by force. She asks, and people give. That is the whole trick of her.", { fx: { clue: "price", know: 1 }, go: "vittoria_1" });
N("vittoria_thread", "vittoria", "Count. Everyone who stays forgets to count. Give me your wrist.\n\nShe ties a red woollen thread around it, tight. “Down there it will tighten a little every day. When it is a ring, you have no days left. Do not let them cut it.”", { fx: { item: "thread", note: "n_thread", toast: "Vittoria’s red thread: in the kingdom it will count your days." }, go: "vittoria_1" });
N("vittoria_sister", "vittoria", "Not I. My sister did. Lucia. She went up dancing one midsummer night, twenty years ago, and never came down. She was carrying a child; nobody in the village knew it but me. I still set a place for her at Christmas. Foolish.", { fx: { clue: "lucia", know: 2 }, go: "vittoria_1" });
N("vittoria_medal", "vittoria", "She goes white. She takes the half-medallion in two fingers as if it might burn.\n\n“Our mother’s. Broken in two the day Lucia went up: she took one half and left me the other, and I buried mine with our mother. Where did you…” She looks at your face, then away. “Go up, then. Go up and ask the porter at the crystal door what she wears at her throat.”", { fx: { clue: "medal_match", note: "n_lucia", know: 2, rel: { vittoria: 2 } }, go: "vittoria_1" });

N("gate_wait", "narr", s => `The north gate opens onto the mule track to the mountain. Night is coming, and you know almost nothing about what waits up there. Talk to the people of the village first (${talksHeard(s)} / 3 heard).`, { go: null });
N("gate_go", "narr", "Beyond the north gate the mule track climbs into beech woods, then into open pasture, then into rock. The crown of the mountain is a black notch against the last of the light.", { choices: [
  { t: "Climb toward the Sibyl’s mountain.", fx: { set: { act: 2, area: "mountain", stage: "trail" }, event: "act2" }, go: null },
  { t: "Not yet.", go: null }] });

/* ===== ACT II — the mountain ===== */
N("act2_start", "narr", "The village lights drop away behind you. Above, the moon. Ahead, the beeches close over the track like the nave of a church, and somewhere very high and very far, a thin music is playing.", { fx: { note: "n_time" }, go: null });
N("cross", "narr", "A wayside cross of weathered wood. Ribbons, a child’s shoe, a tin heart nailed to the post: gifts left by people asking the cross for someone to come back down.", { fx: { know: 1 }, go: null });
N("stazzo", "narr", "An abandoned shepherd’s hut, its roof fallen in. On the inside wall someone has scratched a tally: hundreds of strokes in groups of five, row after row. Then the rows stop, in the middle of a group.", { fx: { note: "n_stazzo", clue: "tally", know: 1 }, go: null });
N("shrine", "narr", "Three broken columns and a fallen lintel, older than the village. Worn letters on the stone: “…REGINA… NON REDIT…”. The queen… does not return? Or: he who goes does not return. The moss has eaten the rest.", { fx: { note: "n_shrine", clue: "shrine", know: 1 }, go: null });

N("fairy_1", "fairy", s => s.clues.meadow ? "A traveller on the mountain at the hour of the dance. Nicola told you where to find us; I can smell his sheep on your story. Will you dance with us, or only watch?" : "A traveller on the mountain at the hour of the dance. Will you dance with us, or will you only watch?", { fx: { note: "n_saltarello", flag: "met_fairies" }, choices: [
  { t: "Dance.", go: "fairy_dance" },
  { t: "Watch their feet as they spin.", if: s => s.clues.feet && !s.seen.fairy_feet, go: "fairy_feet" },
  { t: "I am looking for the Queen of the mountain.", go: "fairy_queen" }] });
N("fairy_feet", "fairy", "The skirts fly. Under the silk you see a small, neat hoof, black as polished horn. The dancer sees you see.\n\n“Courteous eyes look at faces,” she says. “But someone told you the truth. Who?”", { choices: [
  { t: "An old shepherd. Nicola.", fx: { rel: { fairy: 1 }, know: 1 }, go: "fairy_nicola" },
  { t: "No one. I guessed.", fx: { rel: { fairy: -1 } }, go: "fairy_1b" }] });
N("fairy_nicola", "fairy", "Nicola! He danced well, and he kept his mouth shut for fifty years. Tell him the tallest one remembers.", { go: "fairy_1b" });
N("fairy_1b", "fairy", "Well? The moon will not wait for you.", { choices: [
  { t: "Dance.", go: "fairy_dance" },
  { t: "I am looking for the Queen of the mountain.", go: "fairy_queen" }] });
N("fairy_queen", "fairy", "Everyone is looking for her. Few are invited. What will you give the dancers for the way?", { choices: [
  { t: "A dance.", go: "fairy_dance" },
  { t: "Nothing. I will find the way myself.", fx: { set: { guide: "none" }, know: 1 }, go: "fairy_alone" }] });
N("fairy_alone", "fairy", "Then climb, little goat. Keep the crown on your left hand and the wind in your face, and when the wind starts to smell of flowers, you are there. Mind the doors.", { fx: { event: "fairies_leave" }, go: null });
N("fairy_dance", "narr", "The music takes your feet before you have agreed to anything. The ring opens, closes around you, and the mountain spins: moon, crown, moon, the lights of Montemonaco far below, moon.", { fx: { flag: "danced" }, choices: [
  { t: "While you dance, ask the way to the queen.", go: "fairy_ask" },
  { t: "Forget the queen. Dance until dawn.", go: "fairy_dawn" }] });
N("fairy_ask", "fairy", "She laughs into your ear. “And why should we show you the way?”", { choices: [
  { t: "Because you must be home before dawn, and so must I.", if: s => s.clues.dawn, fx: { rel: { fairy: 2 }, know: 1 }, go: "fairy_guide" },
  { t: "Because I am Lucia’s child.", if: s => s.clues.lucia && (s.clues.medal_match || s.clues.basket), fx: { rel: { fairy: 2 } }, go: "fairy_lucia" },
  { t: "Please.", go: "fairy_cup" }] });
N("fairy_guide", "fairy", "Clever. Somebody has been listening to old men. Come, then: we go home the short way, and you may follow, if you can keep up.", { fx: { set: { guide: "fairy" }, event: "guided" }, go: null });
N("fairy_lucia", "fairy", "The music stops. Every dancer turns to look at you, and for a moment their faces are not young at all.\n\n“Lucia keeps the door now,” the tallest says quietly. “Come. We will take you to her. Do not tell her we said so.”", { fx: { set: { guide: "fairy" }, clue: "porter_hint", event: "guided" }, go: null });
N("fairy_cup", "fairy", "She holds out a silver cup, brimming. “Drink, and the climb will be light as a dance.”", { choices: [
  { t: "Drink.", fx: { susp: 3, clue: "cup", set: { guide: "fairy" }, event: "guided" }, go: "fairy_drank" },
  { t: "Refuse, politely.", fx: { know: 1, set: { guide: "none" } }, go: "fairy_refused" }] });
N("fairy_drank", "narr", "It tastes of cold water and honey and something under both. The mountain tilts; your feet stop weighing anything. The dancers take your hands.", { go: null });
N("fairy_refused", "fairy", "As you like. The mountain is long, and the night is short. Keep the crown on your left hand.", { fx: { event: "fairies_leave" }, go: null });
N("fairy_dawn", "narr", "You dance. You dance until the stars go thin and the east turns the colour of ashes, and the tallest dancer looks up, and screams.", { fx: { set: { ending: "dance" } }, go: null });

N("mouth", "narr", s => `The mouth of the cave is a low slit in the rock at the foot of the crown, barely wide enough to crawl through. A wind comes out of it — warm, impossible at this height, smelling of flowers that do not grow on any mountain.${s.items.notebook ? " You think of La Sale and his rope, and of what he will measure tomorrow." : ""}`, { fx: { note: ["n_cave", "n_crown"], flag: "at_mouth" }, choices: [
  { t: "Crawl inside.", fx: { set: { act: 3, area: "kingdom", stage: "bridge", day: 1 }, event: "act3" }, go: null },
  { t: "Not yet.", go: null }] });

/* ===== ACT III — the kingdom ===== */
N("k_enter", "narr", "Stone presses your back and your chest, then lets go. You stand at the head of a bridge no wider than a cart, over a darkness that has no bottom, and the wind hits you like a hand.", { fx: { note: "n_doors" }, go: null });
N("doors_seen", "narr", "Two doors of dark bronze, taller than a church, swing shut and fly open, shut and open, with a sound like the end of the world. There is a moment, each time, when the way is clear.", { go: null });
N("porter_1", "porter", s => `A woman in grey stands before a door of crystal, holding a lantern. She is not young and not old.${s.items.thread ? " Her eyes go at once to the red thread at your wrist." : ""}\n\n“Who knocks at the crystal door?”`, { fx: { note: "n_doors" }, choices: [
  { t: "A traveller from Montemonaco.", go: "porter_in" },
  { t: "My name is my own.", fx: { rel: { porter: 1 } }, go: "porter_name" },
  { t: "I am looking for Lucia of Foce.", if: s => s.clues.lucia, go: "porter_lucia" }] });
N("porter_name", "porter", "“Good,” she says, very quietly. “Keep it. Here they collect names.”", { go: "porter_in" });
N("porter_lucia", "porter", "The lantern swings in her hand. “There is no one here by that name,” she says, and you see her knuckles go white on the handle.", { fx: { clue: "porter_lie" }, go: "porter_in" });
N("porter_in", "porter", s => `The crystal door opens without a sound. “The queen receives her guests when she chooses. Until then the kingdom is yours.${s.items.thread ? " You have a thread; good. Look at it often." : " Count your days. Nobody here will count them for you."}”`, { fx: F({ set: { stage: "kingdom" }, event: "crystal" }, 6), go: null });
N("porter_2", "porter", s => s.clues.medal_seen ? "She keeps her hand at her throat now when you pass. “The queen will send for you,” she says. “Do not keep her waiting. Do not stay too long either.”" : "The porter watches the door, her lantern steady. At her throat something small and bronze catches the light.", { choices: [
  { t: "Ask about the half-medallion at her throat.", if: s => s.items.medallion && !s.clues.medal_seen, go: "porter_medal" },
  { t: "Tell her about Vittoria.", if: s => s.clues.medal_seen && s.clues.medal_match && !s.flags.told, fx: { flag: "told" }, go: "porter_vittoria" },
  BYE] });
N("porter_medal", "porter", s => s.clues.medal_match ? "You hold up your half. She looks at it, and her hand closes over her own, and for a long moment she cannot speak.\n\n“Broken things are not allowed to leave,” she says at last. “Go and see the queen. Please. Before your days run out.”" : "She closes her hand over it. “A broken thing,” she says. “Broken things are not allowed to leave.” She does not look at your half, very carefully.", { fx: { clue: "medal_seen", know: 2 }, go: null });
N("porter_vittoria", "porter", "“She still sets a place for me?” The porter laughs, and the laugh breaks in the middle. “Tell her… no. Tell her nothing. Tell her the bread is good here.”", { fx: { know: 1 }, go: null });

N("knight_1", "knight", "A man in rusted mail sits at the edge of the lake, skimming stones that never sink. “Another one. Do you count? I counted, once. I walked out on the day before the last day, with my squire, and went to Rome on my knees.”", { fx: F({ note: ["n_knight", "n_days"], clue: "knightmet", know: 2, flag: "k_knight" }, 25), choices: [
  { t: "What did the Pope say?", go: "knight_pope" },
  { t: "Do you regret coming back?", go: "knight_regret" },
  { t: "What should I beware of here?", go: "knight_warn" },
  BYE] });
N("knight_pope", "knight", "He shut his book in my face. So I came back to the only door that was still open to me. They tell me his messengers came to the mountain afterwards with my pardon. Too late, of course. Everything in this story arrives too late.", { fx: { note: "n_tannhauser" }, go: "knight_1" });
N("knight_regret", "knight", "Every day. And not at all. That is the kingdom.", { go: "knight_1" });
N("knight_warn", "knight", "Count your days. Do not eat everything you are offered. And on Saturdays, stay out of the lower garden. The ladies go there on Friday at midnight, and what lies in the pool on Saturday is not something a guest is meant to see.", { fx: { note: "n_serpents", know: 1 }, go: "knight_1" });

N("feast", "narr", "A long table under the luminous trees: figs in May, grapes, white bread, wine the colour of the light. Nobody is eating. Everything is perfectly fresh.", { choices: [
  { t: "Eat, just a little.", fx: F({ susp: 2, clue: "feast", flag: "k_feast", event: "feast" }, 55), go: "feast_ate" },
  { t: "Leave it.", fx: { know: 1, flag: "k_feast_refused" }, go: null }] });
N("feast_ate", "narr", "It tastes of every summer you remember and some you do not. When you look up, the candles on the table have burned down and been replaced. More than once.", { go: null });
N("feast_empty", "narr", "The table is laid again, fresh as ever, as if nobody had touched it.", { go: null });
N("bench", "narr", "A marble bench under a tree whose flowers smell of sleep.", { choices: [
  { t: "Rest for a moment.", fx: F({ susp: 2, clue: "sleep", flag: "k_sleep" }, 110), go: "bench_slept" },
  { t: "Stay on your feet.", fx: { know: 1 }, go: null }] });
N("bench_slept", "narr", "You close your eyes for a moment. When you open them, the tree is in fruit, and the fruit is falling, and the flowers are back.", { go: null });
N("dancers", "fairy", "In the hall the ladies of the meadow are dancing again, slower here, as if underwater. The tallest one holds out her hand. “You came. Dance with us while you wait for her.”", { choices: [
  { t: "Dance.", fx: F({ susp: 2, clue: "dance", flag: "k_dance", rel: { fairy: 1 } }, 80), go: "dancers_danced" },
  { t: "Watch, and count the dancers.", fx: { know: 1, flag: "k_watch" }, go: "dancers_watch" }] });
N("dancers_danced", "narr", "One saltarello, you tell yourself. Then another. The music has no end; you only notice that the hours do, when you stop.", { go: null });
N("dancers_watch", "narr", "Twelve dancers, then eleven, then twelve again. None of them is ever out of breath. Their skirts never quite lift.", { go: null });
N("window", "narr", s => `A round window of rock crystal set in the cavern wall. Through it, as if from very high up, you see Montemonaco — ${seasonAt(s.day)}`, { fx: F({ clue: "time", note: "n_time", know: 1, flag: "k_time" }, 3), go: null });
N("pool", "narr", s => (s.flags.k_knight ? "The knight told you to stay out of the lower garden on Saturdays. " : "") + "Below the garden, a dark pool. On the bank, laid out neatly, the silk dresses of the ladies — empty. Something moves in the black water: long, coiling, slow. Many of them.", { fx: F({ note: "n_serpents", clue: "serpents", know: 3, flag: "k_serpents", event: "serpents" }, 7), go: "pool2" });
N("pool2", "narr", "A serpent lifts its head above the water and looks at you with the tallest dancer’s eyes. Then it is Sunday, and the pool is only a pool.", { go: null });

N("summons", "narr", "Somewhere a single bell is struck, and every light in the kingdom turns towards the palace on the island. The ladies stop dancing. The queen is ready to receive you.", { fx: { flag: "summoned" }, go: null });
N("throne_door", "narr", "The doors of the throne hall stand open. Beyond them, gold light, and a figure seated very still.", { choices: [
  { t: "Enter.", fx: { set: { act: 4, stage: "queen" }, event: "act4" }, go: null },
  { t: "Not yet.", go: null }] });

/* ===== ACT IV — the queen ===== */
N("sibyl_1", "sibyl", s => `So. Another one who climbed my mountain at night, crossed my bridge, ducked between my doors${s.clues.porter_lie ? ", and frightened my porter" : ""}. Come closer. I like to see the faces of those who want something from me.\n\nShe is very tall, and very old, and beautiful the way a mountain is. ${s.items.thread ? `Her eyes rest on your red thread. “${s.day} days,” she says. “Your herb-woman ties a good knot.”` : "“You have not counted your days,” she says. “How restful.”"}`, { fx: { note: "n_fall" }, go: "sibyl_why" });
N("sibyl_why", "sibyl", "Tell me why you came. Choose carefully. I will hold you to it.", { choices: [
  { t: "To learn who my mother was.", go: "sibyl_mother" },
  { t: "To see whether you are real.", if: s => s.know >= 6, go: "sibyl_real" },
  { t: "A Frenchman wants to know what lies beyond your door.", if: s => s.items.notebook, go: "sibyl_lasale" },
  { t: "Your dancers brought me.", if: s => s.guide === "fairy", go: "sibyl_fairy" }] });
N("sibyl_mother", "sibyl", "The past. Everyone asks me for the past or the future, and the past is dearer: the future I can always change my mind about.", { fx: { flag: "why_mother" }, go: "sibyl_offer" });
N("sibyl_real", "sibyl", "Am I real? I was a prophetess when your village was a sheepfold. Your priest says I was proud, and punished. I was proud. Perhaps I was punished. Or perhaps I chose a mountain over a world that wanted me silent, and the world told the story the other way round. It usually does.", { fx: { rel: { sibyl: 1 }, know: 1, flag: "why_real" }, go: "sibyl_offer" });
N("sibyl_lasale", "sibyl", "Antoine. He will come to my door tomorrow, measure it with a rope, and go home. He will write a fine book for a duchess, and he will be honest: he will say he went no further. I like honest men. They are so rarely interesting.", { fx: { flag: "why_lasale" }, go: "sibyl_offer" });
N("sibyl_fairy", "sibyl", "My ladies like you. That is not a recommendation; they like a great many things they later break.", { fx: { flag: "why_fairy" }, go: "sibyl_offer" });
N("sibyl_offer", "sibyl", s => pastLimit(s)
  ? `Here is the truth about your bargain: there is none left to make. You have been my guest for ${s.day} days. The three hundred and thirtieth went by while you were busy being happy. I know who carried you to the abbey, and why, and I will tell you for nothing — what is given to my own people costs nothing.`
  : `Here is what I offer. I know who carried you to the abbey, and why. I will tell you. But knowledge that costs nothing weighs nothing.${knowsMother(s) ? "\n\nShe tilts her head. “Though I think you have been reading over my shoulder.”" : ""}`, { choices: [
  { t: "What is the price?", if: s => !pastLimit(s), go: "sibyl_price" },
  { t: "I think I already know. The porter is my mother.", if: s => knowsMother(s), go: "sibyl_already" },
  { t: "I don’t want it. I want to go home.", if: s => canReturn(s), go: "sibyl_refuse" },
  { t: "I want to go home… (but you can no longer remember the way home)", if: s => !pastLimit(s) && !canReturn(s), go: "sibyl_lost" },
  { t: "Let me stay here, with you.", if: s => !pastLimit(s), go: "sibyl_stay" },
  { t: "Then tell me, and let me stay.", if: s => pastLimit(s), go: "sibyl_free" }] });
N("sibyl_lost", "sibyl", "You open your mouth to say “home”, and find the word is empty: a cup with nothing in it. You have drunk and eaten and danced too much of my kingdom. Never mind. Choose again.", { go: "sibyl_offer" });
N("sibyl_price", "sibyl", s => `I ask only for what you will not miss until it is gone. Your name, for instance. Above, they will forget it: the monks, the village, everyone who ever called you.${s.items.notebook ? " Or that little book the Frenchman gave you. Then he will write only what he saw at my door, and not one word of mine." : ""}${s.clues.ask ? "\n\nBiagio was right: queens work for pay." : ""}`, { choices: [
  { t: "Take my name.", fx: { set: { paid: "name" }, flag: "paid_name" }, go: "sibyl_truth" },
  { t: "Take the notebook.", if: s => s.items.notebook, fx: { set: { paid: "notebook" }, drop: "notebook", flag: "paid_notebook" }, go: "sibyl_truth" },
  { t: "No. Keep your answer.", if: s => canReturn(s), go: "sibyl_refuse" },
  { t: "Ask her something else.", go: "sibyl_offer" }] });
N("sibyl_truth", "sibyl", "Twenty summers ago a girl from Foce danced with my ladies and followed them in. She was carrying you. You were born in my garden on her three hundred and twentieth day. On the three hundred and thirtieth she could have walked out with you in her arms. She asked me for one more day — one more dance. I gave it to her. I give what is asked.\n\nIn the morning the door was closed to her and open to you, because you were born mortal. She carried you to the threshold and could not cross it. A shepherd found you at dawn. Her name is Lucia. You have met her. She keeps my crystal door.", { fx: (s, ev) => { s.flags.paid = s.paid; applyFx(s, { set: { ending: "knowledge" } }, ev); }, go: null });
N("sibyl_refuse", "sibyl", s => knowsMother(s)
  ? "You found your answer without paying me for it. That has happened twice in a thousand years. Go, then, with my blessing, such as it is. The porter will walk you to the door; she will not be able to go further. Say goodbye properly. You will not have another chance."
  : "Then go, with my blessing, such as it is. Few refuse me courteously. Fewer still refuse me at all. Guerrino did; he went to Rome and was forgiven, and was bored for the rest of his life.", { fx: { set: { ending: "return" } }, go: null });
N("sibyl_already", "sibyl", "She is silent for a long moment, and then she laughs, a real laugh, startled out of her. “You read the story before I could tell it. Then what do you want of me?”", { fx: { rel: { sibyl: 2 } }, choices: [
  { t: "Let her come home with me.", go: "sibyl_lucia" },
  { t: "Let me stay with her.", go: "sibyl_stay" }] });
N("sibyl_lucia", "sibyl", "That I cannot give: her days ran out long ago, and I keep my rules, or I am nothing. But I can give you this. Walk out, and she will walk with you as far as the door.", { choices: [
  { t: "Walk out with her as far as the door.", if: s => canReturn(s), fx: { set: { ending: "return" } }, go: null },
  { t: "Then I stay.", go: "sibyl_stay" }] });
N("sibyl_stay", "sibyl", "Stay, then. The days will stop counting themselves; you will stop counting them too. You will be happy here. I promise you that, and I do not make promises lightly.", { fx: { set: { ending: "kingdom" } }, go: null });
N("sibyl_free", "sibyl", "Your mother’s name is Lucia. She came up dancing, carrying you, and stayed one day too long; you, born mortal, were carried out. She keeps my crystal door. Now you will keep my kingdom with her. Welcome home.", { fx: { set: { ending: "kingdom" }, flag: "told" }, go: null });

export const NODES = nodes;
export const ENTRIES = ["start", "lasale_1", "priest_1", "shepherd_1", "singer_1", "vittoria_1", "gate_wait", "gate_go", "act2_start", "cross", "stazzo", "shrine", "fairy_1", "mouth",
  "k_enter", "doors_seen", "porter_1", "porter_2", "knight_1", "feast", "feast_empty", "bench", "dancers", "window", "pool", "summons", "throne_door", "sibyl_1"];

/** what the window shows: the season above, from the days below (the story starts in May) */
export function seasonAt(day) {
  const m = (4 + Math.floor(day / 30.4)) % 12;
  const S = ["deep in snow, the chimneys smoking", "under late snow", "brown and wet with the thaw", "green with spring", "white with hawthorn, as it was the night you left", "golden with the harvest", "parched in the August heat", "loud with the grape harvest", "under the smoke of the chestnut fires", "bare and grey with November rain", "white with the first snow", "buried in midwinter snow"];
  return `${S[m]}. ${day > 300 ? "The thread at your wrist is almost a ring." : day > 120 ? "It is not May any more." : "It cannot have been that long."}`;
}

/* ---------------- world interaction rules ---------------- */
export function talkNode(id, s) {
  if (s.ending) return null;
  if (s.act === 1 && s.area === "village") return { lasale: "lasale_1", priest: "priest_1", shepherd: "shepherd_1", singer: "singer_1", vittoria: "vittoria_1" }[id] || null;
  if (s.act === 3 && id === "porter") return s.stage === "door" ? "porter_1" : s.stage === "kingdom" ? "porter_2" : null;
  if (s.act === 3 && id === "knight" && s.stage === "kingdom") return "knight_1";
  if (s.act === 3 && id === "fairy" && s.stage === "kingdom") return "dancers";
  if (s.act === 4 && id === "sibyl") return "sibyl_1";
  return null;
}
export function objectAvailable(id, s) {
  if (s.ending) return false;
  if (["gate"].includes(id)) return s.act === 1;
  if (["cross", "stazzo", "shrine"].includes(id)) return s.act === 2 && !s.seen[id];
  if (id === "mouth") return s.act === 2;
  if (["feast", "bench", "window", "pool"].includes(id)) return s.act === 3 && s.stage === "kingdom" && (id === "feast" || !s.seen[id]);
  if (id === "throne") return s.act === 3 && s.stage === "kingdom" && !!s.flags.summoned;
  return false;
}
export function objectNode(id, s) {
  if (id === "gate") return talksHeard(s) >= 3 ? "gate_go" : "gate_wait";
  if (id === "feast") return s.flags.k_feast ? "feast_empty" : "feast";
  if (id === "throne") return "throne_door";
  return id;
}
export const labelFor = (id, s) => ({
  lasale: "Talk to Antoine de La Sale", priest: "Talk to Don Matteo", shepherd: "Talk to Nicola", singer: "Listen to Biagio", vittoria: "Talk to Vittoria",
  gate: "Take the mountain path", cross: "Look at the wayside cross", stazzo: "Search the shepherd’s hut", shrine: "Read the ruined shrine", mouth: "Enter the cave",
  porter: s.stage === "door" ? "Knock at the crystal door" : "Speak to the porter", knight: "Speak to the knight", fairy: "Join the dancers", feast: "Look at the table",
  bench: "Rest on the bench", window: "Look through the crystal window", pool: "Go down to the lower garden", throne: "Enter the throne hall", sibyl: "Approach the queen",
}[id] || "Interact");
/** the kingdom sends for you once you have learned two of its rules, or after two months in it */
export const readyForQueen = s => s.act === 3 && s.stage === "kingdom" && !s.flags.summoned && (kingdomFound(s) >= 2 || s.day >= 60);

export function objective(s) {
  if (s.ending) return "";
  if (s.act === 1) return talksHeard(s) < 3 ? `Ask the people of Montemonaco about the Sibyl’s mountain (${talksHeard(s)} / 3 heard).` : "Take the mountain path at the north gate, or keep asking: the village knows more than it says.";
  if (s.act === 2) {
    if (!s.flags.met_fairies) return s.clues.meadow ? "Climb the trail. The dancers gather on the high meadow, on the right of the track." : "Climb the trail toward the crown of Monte Sibilla. Listen for music.";
    return "Reach the cave at the foot of the crown of rock, at the top of the trail.";
  }
  if (s.act === 3) {
    if (s.stage === "bridge") return "Cross the bridge over the abyss. Lean into the wind.";
    if (s.stage === "doors") return "Pass between the beating bronze doors while they stand open.";
    if (s.stage === "door") return "Knock at the crystal door.";
    if (s.flags.summoned) return "The queen is waiting. Cross to the palace and enter the throne hall.";
    return `Explore the kingdom and learn its rules (${Math.min(2, kingdomFound(s))} / 2). Every pleasure here costs days.`;
  }
  if (s.act === 4) return "Speak with the Sibyl.";
  return "";
}
export const defaultEnding = s => s.ending || "return";
/** text for the HUD day counter */
export const dayText = s => s.items.thread ? `Day ${s.day} of ${DAY_LIMIT}` : "Day ? — you are not counting";
