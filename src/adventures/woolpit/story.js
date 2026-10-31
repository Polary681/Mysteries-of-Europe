// THE GREEN CHILDREN OF WOOLPIT - story data and rules (pure logic, no WebGL).
//
// HISTORICAL vs INVENTED
//  Historical (from the 12th-century chronicles of William of Newburgh and Ralph of Coggeshall): two green-skinned children
//  found at the wolf pits of Woolpit in King Stephen's reign; strange clothes and speech; they refused food until they found raw
//  broad beans; the boy sickened and died; the girl lost her green colour and learned English; she spoke of "St Martin's Land",
//  a twilight country, bells and a cave; Sir Richard de Calne of Wykes (named by Ralph) took her into his household; William says
//  she later married a man from King's Lynn.
//  INVENTED for this game: every character except Sir Richard's name and the two children (Edith, Hugh, Father Aldwin, Mother Maud,
//  Walter), all dialogue, the player character, the clues (no tracks, cloth scrap, bell reaction), the language-learning mechanic,
//  the mob scene, the hollow where the bells ring, the boy who may live, and endings other than "The Servant of Wykes".
import { applyFx } from "../../narrative/core.js";

export const SAVE_KEY = "moe.woolpit.save.v1", ENDINGS_KEY = "moe.woolpit.endings.v1";

export const initState = () => ({
  v: 1, act: 1, trust: 0, susp: 0, know: 0, skin: 0, where: "pits", boy: "well", fluent: false, calmed: false, ending: null, girlWish: null, day: 1,
  rel: { edith: 0, aldwin: 0, hugh: 0, maud: 0, richard: 0, walter: 0 },
  flags: {}, items: { bread: true }, words: {}, clues: {}, notes: { n_invented: true, n_source: true }, seen: {}, once: {},
});

export const CLUE_TEXT = {
  refuse_bread: "The children refuse bread, even when it is offered by hand.",
  beans: "They eat raw broad beans eagerly. (Historical: both chroniclers report this.)",
  bells: "The word “sen-mar” (bell) makes the girl weep, and she is drawn to the sound.",
  light_hurts: "Daylight hurts their eyes: she speaks of the sun as something that “hurts”.",
  cloth: "Their clothes are woven from a fine grey-green cloth with no seams. (Invented clue.)",
  origin: "She speaks of cattle, her father, bells, a river, and “dark, then light”.",
  no_tracks: "There are no tracks of any kind around the wolf pits. (Invented clue.)",
  cloth_scrap: "A scrap of the strange cloth, cool to the touch, snagged on a thorn. (Invented clue.)",
};
export const WORDS = { bread: "o-kha", water: "nuhai", bean: "vel-ni", bell: "sen-mar", sun: "ael-ro" };
export const WHO = {
  narr: { name: "", style: "narr" }, you: { name: "You" }, girl: { name: "The girl" }, boy: { name: "The boy" },
  edith: { name: "Edith", role: "Reaper" }, hugh: { name: "Hugh", role: "Reeve" }, aldwin: { name: "Father Aldwin", role: "Priest" },
  maud: { name: "Mother Maud", role: "Herb-wife" }, richard: { name: "Sir Richard de Calne", role: "Lord of Wykes" }, walter: { name: "Walter", role: "Travelling clerk" },
};

/* ---------------- codex: what is history and what is made up ---------------- */
export const CODEX = {
  n_invented: { kind: "invented", title: "What is invented here", text: "Edith, Hugh the reeve, Father Aldwin, Mother Maud and Walter the clerk are invented, as are all the conversations, the player character, the clues you find, the language-learning game, the mob scene and the hollow where the bells ring. Only the broad outline of the story comes from the chronicles." },
  n_source: { kind: "historical", title: "The two chroniclers", text: "The story is told by two 12th-century English chroniclers: William of Newburgh (Historia rerum Anglicarum, c. 1189) and Ralph of Coggeshall (Chronicon Anglicanum, 1220s). Both set it in the reign of King Stephen (1135–1154). Their accounts differ in details, and William says his informants were unnamed." },
  n_pits: { kind: "historical", title: "The wolf pits", text: "William of Newburgh says the children were found beside one of the wolf pits that gave Woolpit its name, and places the discovery at harvest time." },
  n_green: { kind: "historical", title: "Green skin, strange speech", text: "Both chroniclers describe a boy and a girl with green skin, unfamiliar clothes and a language nobody understood." },
  n_beans: { kind: "historical", title: "The raw beans", text: "Both chroniclers say the children refused all food for days, until they found raw broad beans, which they ate eagerly. Slowly they learned to eat ordinary food." },
  n_boy: { kind: "uncertain", title: "The boy", text: "Both accounts say the boy fell ill and died, and that the girl survived and gradually lost her green colour. Some tellings place his death soon after baptism; the sources summarised here do not agree on the details." },
  n_calne: { kind: "historical", title: "Sir Richard de Calne of Wykes", text: "Ralph of Coggeshall names Sir Richard de Calne of Wykes as his source and says the girl worked for many years in his household. Sir Richard's lines in this game are invented." },
  n_land: { kind: "uncertain", title: "St Martin’s Land", text: "William says the girl called her homeland “St Martin’s Land”, a country of twilight. Both mention bells; Ralph adds a cave and says everything there was green. Where, or what, this land was has never been settled." },
  n_lynn: { kind: "historical", title: "The girl’s later life", text: "William of Newburgh says the girl later married a man from King’s Lynn, about 40 miles away, and was still living there not long before he wrote." },
  n_later: { kind: "uncertain", title: "Later theories", text: "Later writers called the story a hoax (William Camden, 1586) or tried to identify St Martin’s Land with a real place such as Fornham St Martin (Paul Harris, 1998). A popular modern name for the girl, “Agnes”, comes from a 1990s theory, not from the chronicles. Nothing has been proven." },
  n_language: { kind: "invented", title: "Learning their words", text: "In the chronicles the children simply learn English over time. The idea that you must learn their words by showing them things is a game mechanic." },
};

/* ---------------- endings ---------------- */
export const ENDINGS = {
  servant: { id: "servant", kicker: "Ending 1 of 6", title: "The Servant of Wykes", cls: "e-servant",
    paragraphs: s => [
      "Sir Richard de Calne takes the girl into his household at Wykes. Her skin pales to the colour of any Suffolk girl’s, her English grows quick and sharp, and she carries water and linen for many years, sometimes laughing too loudly, sometimes staring at the sky at dusk.",
      s.boy === "dead" ? "In the churchyard a small mound is tended by a girl who will never say whose it is." : "",
      "Years later she marries a man from King’s Lynn. When travellers ask about Saint Martin’s Land she tells it differently every time, and nobody can say which version is true. Maybe all of them are.",
    ].filter(Boolean),
    notes: ["This ending is the closest to the chronicles: Ralph of Coggeshall says the girl served in Sir Richard’s household, and William of Newburgh says she married a man from King’s Lynn. Everything else, including how you got her there, is invented."] },
  both: { id: "both", kicker: "Ending 2 of 6", title: "Two Children, One Village", cls: "e-both",
    paragraphs: s => [
      "Both children stay. The boy grows strong on beans, bread and stubbornness, and by the next harvest the green has faded from them both. They scramble across the stubble with the other children, who stop being afraid of them sooner than their parents do.",
      s.where === "manor" ? "At Wykes, Sir Richard lets the boy sweep the stables and the girl learn her letters beside his clerk." : "They grow up in the village, belonging to everyone and to no one.",
      "Some evenings, when the wind comes from the wood, they stop and listen. They never speak of what they hear. Nobody asks.",
    ],
    notes: ["INVENTED. In both chronicles the boy dies. Here, your care gives him a different story, which is exactly why the legend has so many versions."] },
  bells: { id: "bells", kicker: "Ending 3 of 6", title: "The Bells Answer", cls: "e-bells",
    paragraphs: s => [
      s.flags.rang_bell ? "You ring the little bell. For a moment the air holds its breath, and then, far inside the mist, other bells answer, sweeter than any in Suffolk." : "You let go of her hand. Far inside the mist, a thin and sweet ringing begins, and the girl turns her face toward it like a flower toward light.",
      s.boy === "lives" ? "The brother takes her other hand. Together they step between the roots, and the mist closes behind them without a sound." : "She walks into the mist without looking back, and the mist closes behind her without a sound.",
      "At dawn there is nothing at the hollow but dew. The reapers swear the wolf pits were never so quiet. Walter writes in his book: “They came, and they went, and I could not say whence.”",
    ],
    notes: ["INVENTED. In the chronicles the girl stays and grows up in England. This ending asks what would happen if the land of twilight could still be reached. The bells, the cave and the twilight country are all in the chronicles; the hollow and the farewell are not."] },
  font: { id: "font", kicker: "Ending 4 of 6", title: "The Quiet Font", cls: "e-font",
    paragraphs: s => [
      "Father Aldwin gives the girl a place in the church’s care. She is baptised on a grey morning, and the water on her forehead feels, she says afterward, like rain on a country she cannot remember.",
      "She learns psalms she half understands and sweeps the nave each dawn. Slowly, the twilight country becomes a dream she cannot hold. When pilgrims ask where she is from, she smiles and says, “Here.”",
      s.flags.heard_tale ? "You are the only one who remembers the story she once told you. You keep it, quietly, like a small bell in a pocket." : "Nobody remembers to ask her anything more.",
    ],
    notes: ["INVENTED. Baptism features in some tellings of the story, but the chronicles do not say the girl entered the church’s care, or that she forgot her homeland."] },
  omen: { id: "omen", kicker: "Ending 5 of 6", title: "The Omen", cls: "e-omen",
    paragraphs: s => [
      s.flags.fled_mob ? "You and the girl slip into the dark wood while the torches burn on the green. You never learn whether she found her bells, or only the cold." : "The village does what villages do with what they fear: it looks away. The girl is sent beyond the last field before the next harvest, with a loaf and a blessing that sounds like a warning.",
      "In the autumn, a travelling clerk writes in his book: “A marvel appeared at Woolpit, and an omen, and was gone.”",
      "The wolf pits stay empty. Children dare each other to touch them at dusk, and nobody can say why their hands go cold.",
    ],
    notes: ["INVENTED. The chronicles do not describe the village turning on the children; this ending shows how fear can decide a story."] },
  ink: { id: "ink", kicker: "Ending 6 of 6", title: "The Chronicler’s Ink", cls: "e-ink",
    paragraphs: s => [
      "Walter listens until the candle burns low and writes down every word the girl says, even the parts that do not make sense. He does not tidy the marvel into a sermon.",
      "Years pass, and others retell the tale. Monks copy it, and a chronicler hears it from a knight called de Calne and puts it in a book. Nobody remembers that it began with a harvest-time argument at the edge of a field.",
      "The girl’s own words survive, odd and green and impossible: a land without a sun, a river, a sound of bells. Whether they describe a country, a dream, or something else, the ink does not say.",
    ],
    notes: ["Two chroniclers really did write this story down: William of Newburgh, from “several trustworthy sources” he does not name, and Ralph of Coggeshall, who names Sir Richard de Calne. Walter and this particular conversation are invented."] },
};
export const ENDING_ORDER = ["servant", "both", "bells", "font", "omen", "ink"];

/* ---------------- helpers ---------------- */
const nodes = {};
const N = (id, who, text, o = {}) => { nodes[id] = { id, who, text, ...o }; return nodes[id]; };
const u = s => Object.keys(s.words).length;
const clueCount = s => Object.keys(s.clues).length;
const bye = { t: "Leave.", go: null };

/* =====================  ACT 1 - THE WOLF PITS  ===================== */
N("a1_arrive", "narr", "Woolpit, Suffolk, in the reign of King Stephen. It is harvest time. A shout rolls across the stubble, and the reapers drop their sickles.\n\nBeside the old wolf pits that gave the village its name, two children huddle together: a boy and a girl. Their skin is green, a pale and living green, like a leaf held up to the sun. Their clothes are made of a cloth nobody here has ever seen.",
  { fx: { note: ["n_pits", "n_green"], toast: "Codex updated: the wolf pits." }, go: "a1_edith" });
N("a1_edith", "edith", "Mother of God… Are they sick? Look at their skin! Look at their clothes! There is not a cart track nor a hoofprint on this whole field. Where did they come from?", {
  choices: [
    { t: "Kneel slowly and hold out an open hand.", fx: { trust: 1, flag: "gentle" }, go: "a1_gentle" },
    { t: "Offer them your bread.", fx: { flag: "bread_offered" }, go: "a1_bread" },
    { t: "Step back. Someone must fetch the reeve.", fx: { susp: 1, flag: "called_reeve" }, go: "a1_crowd" },
    { t: "Ask Edith to keep everyone back and quiet.", fx: { rel: { edith: 1 }, flag: "kept_calm" }, go: "a1_calm" },
  ] });
N("a1_gentle", "narr", "The girl flinches, then watches your hand for a long time. The boy hides his face in her sleeve. At last she speaks, in soft, quick words of no tongue you have ever heard.", { go: "a1_girl" });
N("a1_girl", "girl", "I do not know this place. Where is the road? Where has the sound gone?", { kid: true, req: 99, go: "a1_crowd" });
N("a1_bread", "narr", "You break your bread and hold out a piece. The girl sniffs it and recoils as if from smoke. The boy turns his face away. They will not touch it, and they will not take it from your hand.", { fx: { flag: "bread_refused", know: 1, clue: "refuse_bread" }, go: "a1_crowd" });
N("a1_calm", "edith", "Aye. Aye, you are right. Steady now, all of you! They are children, whatever else they are. Nobody shouts.", { go: "a1_crowd" });
N("a1_crowd", "hugh", s => (s.flags.called_reeve ? "You did well to send for me. " : "") + (s.flags.gentle ? "You touched them? Bold of you, or foolish. " : "") + "Stand clear, all of you! Devil’s work, or fairy-folk, or a trick of the harvest heat. I want none of it in my fields.", { go: "a1_aldwin" });
N("a1_aldwin", "aldwin", "Peace, Hugh. Whatever they are, they are children first, and God’s creatures. They are hungry and frightened. They must be fed and sheltered tonight.", { go: "a1_maud" });
N("a1_maud", "maud", "Nothing good comes up out of the ground. Mark me. And yet… look at them. They do not even know to be afraid of us properly.", { go: "a1_where" });
N("a1_where", "narr", "All eyes turn to you. You found them first, and the girl will not let go of your sleeve. Where should the children go?", {
  choices: [
    { t: "To Sir Richard de Calne, at Wykes. He has a hall, and food to spare.", fx: { set: { where: "manor" }, rel: { richard: 1 }, flag: "to_manor" }, go: "a1_end" },
    { t: "To Father Aldwin, at the church.", fx: { set: { where: "church" }, rel: { aldwin: 1 }, flag: "to_church" }, go: "a1_end" },
    { t: "Hide them in Edith’s barn, away from the crowd.", fx: { set: { where: "barn" }, rel: { edith: 1 }, susp: 1, trust: 1, flag: "to_barn" }, go: "a1_end" },
    { t: "Let Reeve Hugh decide.", fx: { set: { where: "reeve" }, susp: 2, trust: -1, rel: { hugh: 1 }, flag: "to_reeve" }, go: "a1_end" },
  ] });
N("a1_end", "narr", s => ({
  manor: "You lead the children across the fields toward Wykes. The girl keeps looking back at the stubble, as if she had left something there.",
  church: "You lead the children to the church, where the old stone walls hold the evening chill. The boy stares at the bell rope as if it were a snake.",
  barn: "You hide the children in Edith’s barn. Edith spreads straw and says nothing, which is its own kind of kindness.",
  reeve: "Hugh bars the children in his storehouse “for the village’s safety”. Through the slats, the girl’s eyes find yours and do not let go.",
}[s.where]), { go: "a2_open" });

/* =====================  ACT 2 - THE DAYS WITHOUT BREAD  ===================== */
N("a2_open", "narr", "Dawn. The children have touched nothing. They accept water, but not bread, not milk, not pottage. Nobody knows what they eat, or whether they will go on eating at all.\n\nSomething has to be found. Talk to the villagers, and look around the village and the fields.", { fx: { set: { act: 2 }, event: "act2" } });

// the children
N("boy_a2", "boy", "…", { kid: true, req: 99, fx: {}, go: "boy_a2b" });
N("boy_a2b", "narr", s => s.flags.fed ? "The boy is eating a little now. He watches you with solemn eyes, and when you nod he nods back, a half second late, as if copying a gesture he does not yet understand." : "The boy is pale and very quiet. He leans against his sister, and his breathing is shallow. He needs food soon.");
N("kids_hub", "narr", s => {
  const where = { manor: "the manor", church: "the church", barn: "Edith’s barn", reeve: "Hugh’s storehouse" }[s.where];
  return `The children sit close together in ${where}. The girl watches you steadily; the boy is silent. ` + (u(s) ? `You have learned ${u(s)} of their words.` : "You cannot understand a word they say.");
}, { choices: [
  { t: "Show them the bread.", if: s => s.items.bread, once: "k_bread", go: "k_bread" },
  { t: "Offer a cup of fresh well water.", if: s => s.items.water, once: "k_water", go: "k_water" },
  { t: "Show them the raw broad beans.", if: s => s.items.bean, once: "k_bean", go: "k_bean" },
  { t: "Ring the little handbell.", if: s => s.items.bell, once: "k_bell", go: "k_bell" },
  { t: "Give the boy Mother Maud’s herb tonic.", if: s => s.items.tonic, once: "k_tonic", go: "k_tonic" },
  { t: "Point to the sun.", once: "k_sun", go: "k_sun" },
  { t: "Study their strange clothes.", once: "k_cloth", go: "k_cloth" },
  { t: "Sit quietly beside them.", if: s => !s.flags.sat_a2, go: "k_sit" },
  { t: "Try to ask where they come from.", if: s => u(s) >= 2 && !s.flags.asked_home, go: "k_ask" },
  { t: "Leave them for now.", go: null },
] });
N("k_bread", "girl", "O-kha. O-kha. No.", { kid: true, req: 1, hint: "“…o-kha… no.”", fx: { word: "bread", flag: "learned_bread", toast: "You learn their word for “bread”: o-kha." }, go: "k_bread2" });
N("k_bread2", "narr", "She pushes it away gently, the way you would refuse a gift you do not want to insult. Whatever they eat, it is not baked grain.", { go: "kids_hub" });
N("k_water", "narr", "The girl takes the cup in both hands, sniffs, and drinks as if she had been dry for days. She says a short word and holds out the cup again: “Nuhai.”", { fx: { word: "water", trust: 1, skin: 0.05, toast: "You learn their word for “water”: nuhai." }, go: "kids_hub" });
N("k_bean", "narr", "You lay a stalk of raw broad beans on the straw. The children go absolutely still. Then the boy snatches a pod, splits it with his thumbnail and eats the beans, one by one, leaving the pod. The girl follows. Neither lifts their eyes until the stalk is bare.",
  { fx: { word: "bean", trust: 2, know: 1, skin: 0.3, flag: ["fed", "fed_by_you"], note: "n_beans", clue: "beans", toast: "They eat! Raw beans are what they can eat. Codex updated." }, go: "kids_hub" });
N("k_bell", "narr", s => s.trust >= 2 ? "At the first note, the girl goes rigid. Tears spill down her cheeks and she whispers: “Sen-mar… sen-mar.” She seizes your wrist, as if to stop you from putting the bell down. Whatever this sound means to her, it is not fear." : "At the first note, the girl whips round, eyes shining wet. “Sen-mar,” she breathes, and the boy covers his ears. She shrinks back from you, but she keeps looking at the bell.",
  { fx: (s, ev) => { applyFx(s, { word: "bell", know: 2, clue: "bells", flag: "heard_bells_hint", toast: "You learn their word for “bell”: sen-mar." }, ev); }, go: "k_bell2" });
N("k_bell2", "narr", "In the chronicles, the children said they had followed the sound of bells. Whatever they remember, it begins there.", { fx: { trust: 1 }, go: "kids_hub" });
N("k_tonic", "narr", "The boy sniffs the bitter tonic, makes a face, and drinks it all in one swallow. After a while, a little of the grey leaves his cheeks.", { fx: { trust: 1, flag: "tonic_given", drop: "tonic" }, go: "kids_hub" });
N("k_sun", "girl", "Ael-ro… ael-ro. Hurts.", { kid: true, req: 2, hint: "“…ael-ro… hurts.”", fx: { word: "sun", know: 1, clue: "light_hurts", toast: "You learn their word for “sun”: ael-ro." }, go: "k_sun2" });
N("k_sun2", "narr", "She squints at the sky, shades her eyes, and points to a dim patch of cloud, then makes a gesture like a dusk settling. Perhaps their world has less light than yours.", { go: "kids_hub" });
N("k_cloth", "narr", "The weave is fine and even, a dull grey-green that holds light like wet slate. Nobody in the village recognises the dye, and there are no seams where you expect them. [Invented clue]", { fx: { know: 1, clue: "cloth" }, go: "kids_hub" });
N("k_sit", "narr", "You sit with them for a long while and say nothing. The boy leans against your arm. The girl stops watching your hands and starts watching your face.", { fx: { trust: 1, flag: "sat_a2" }, go: "kids_hub" });
N("k_ask", "girl", "Far. Cattle… my father’s. The bells. Dark, then light. The river. Where is…?", { kid: true, req: 2, hint: "“…cattle… father… bells… river…”", fx: { know: 2, flag: "asked_home", clue: "origin" }, go: "kids_hub" });

// ---- Edith ----
N("edith_first", "edith", s => s.where === "barn" ? "They are in my barn, so they are my business. I will not turn them out, whatever Hugh says." : "I keep thinking of those eyes. They looked at all of us as if we were the strange ones.", { go: "edith_hub" });
N("edith_hub", "edith", s => s.act >= 3 ? "Edith looks up from her work, and some of the worry has gone from her face." : "Edith wipes her hands on her apron. “What do you need?”", { choices: [
  { t: "How are the children?", once: "e_kids", go: "e_kids" },
  { t: "Is there any food they might take?", once: "e_food", if: s => s.act === 2, go: "e_food" },
  { t: "Is the village afraid of them?", once: "e_village", go: "e_village" },
  { t: "Thank you for standing by us.", once: "e_thanks", if: s => s.rel.edith >= 1, go: "e_thanks" },
  { t: "If the village turns on the girl, would you speak for her?", once: "e_promise", if: s => s.rel.edith >= 1 && s.act >= 2, go: "e_promise" },
  bye ] });
N("e_kids", "edith", s => s.flags.fed ? "They are eating at last, bless them. Not what I would give a child, but eating is eating." : s.where === "barn" ? "They stare out at my bean rows as if it were a feast. I never thought anything of it, but they do not stop looking." : "I hear they will take nothing but water. It is a cruel thing to watch.", { go: "edith_hub" });
N("e_food", "edith", "I have offered milk, pottage, honey-bread… nothing. Go and ask Mother Maud. She is sharp, even when she is sour. She says hungry things want growing things, not baked or boiled ones.", { fx: { flag: "maud_hint_via_edith", rel: { edith: 0 } }, go: "edith_hub" });
N("e_village", "edith", s => s.susp >= 4 ? "Afraid? Hugh has been muttering in the alehouse every night. Some shut their doors when the children pass. Do something soon." : "Some are afraid, some are curious, most are just tired from the harvest. It can still go either way.", { go: "edith_hub" });
N("e_thanks", "edith", "Do not thank me. You are the one who knelt in the stubble and held out a hand. That is what I will remember.", { fx: { rel: { edith: 1 } }, go: "edith_hub" });
N("e_promise", "edith", "If it comes to that, I will stand beside you. I will not let the whole village run at one frightened child.", { fx: { flag: "edith_backs" }, go: "edith_hub" });

// ---- Hugh ----
N("hugh_first", "hugh", s => s.flags.to_reeve ? "They are in my storehouse, and they stay there until I am satisfied. Do not look at me like that. Somebody has to be careful." : "Come to ask me to be kind? Kindness is cheap. Harvests are not.", { go: "hugh_hub" });
N("hugh_hub", "hugh", s => s.susp >= 5 ? "Hugh’s jaw is tight. “Make it quick.”" : "Hugh folds his arms. “What is it?”", { choices: [
  { t: "What do you think they are?", once: "h_think", go: "h_think" },
  { t: "They are only children, Hugh.", once: "h_children", go: "h_children" },
  { t: "Will you help feed them?", once: "h_help", if: s => s.rel.hugh >= 1 && s.act === 2, go: "h_help" },
  { t: "Please let them go to Sir Richard or the church.", once: "h_release", if: s => s.where === "reeve", go: "h_release" },
  bye ] });
N("h_think", "hugh", "An omen. Either a blessing or a curse, and I have never seen a blessing come with green skin. A man who guesses wrong about omens loses his harvest, or his village.", { fx: { know: 0 }, go: "hugh_hub" });
N("h_children", "hugh", s => s.trust >= 1 || s.flags.gentle ? "…They did not scream when you went near them. That is true. I will think on it." : "They are children who came out of the ground. That is the whole trouble.", { fx: (s, ev) => { if (s.trust >= 1 || s.flags.gentle) applyFx(s, { susp: -1, rel: { hugh: 1 } }, ev); else applyFx(s, { susp: 1 }, ev); }, go: "hugh_hub" });
N("h_help", "hugh", "Hm. I will send a sack of flour and some honey. It will do no good if they will not eat, but nobody can say Hugh let children starve.", { fx: { flag: "hugh_help", susp: -1 }, go: "hugh_hub" });
N("h_release", "hugh", s => s.rel.hugh >= 1 || s.trust >= 2 ? "Fine. Take them to the manor. Let Sir Richard bear the blame if it goes wrong." : "No. Not until I am sure what they are.", { fx: s => { if (s.rel.hugh >= 1 || s.trust >= 2) { s.where = "manor"; s.flags.to_manor = true; s.susp = Math.max(0, s.susp - 1); } else s.susp = Math.min(10, s.susp + 1); }, go: "hugh_hub" });

// ---- Father Aldwin ----
N("aldwin_first", "aldwin", "The church has stood through famines and fevers, and it will stand through green children too. Whatever else is true, they are guests of the house of God.", { go: "aldwin_hub" });
N("aldwin_hub", "aldwin", s => s.act >= 3 ? "Father Aldwin makes the sign of the cross absent-mindedly. “Child. What troubles you?”" : "Father Aldwin looks up from his psalter. “What troubles you, child?”", { choices: [
  { t: "What should be done for them?", once: "ald_adv", go: "ald_adv" },
  { t: "May I borrow the little handbell?", once: "ald_bell", if: s => !s.items.bell && !s.flags.bell_given && !s.flags.stolen_bell, go: "ald_bell" },
  { t: "Is it wrong to wonder if they are not of this world?", once: "ald_doubt", go: "ald_doubt" },
  { t: "Would the church shelter the girl, if it came to that?", once: "ald_shelter", if: s => s.act >= 3 && s.rel.aldwin >= 1, go: "ald_shelter" },
  bye ] });
N("ald_adv", "aldwin", "They must be fed, and when they understand us, they should be baptised, for their souls’ sake. Should we hurry this, or wait until they can speak for themselves?", { choices: [
  { t: "Let us wait until they can speak for themselves.", fx: { flag: "baptism_wait", rel: { aldwin: 1 } }, go: "ald_adv_wait" },
  { t: "Baptise them soon, for their souls’ sake.", fx: { flag: "baptism_rush", rel: { aldwin: 1 } }, go: "ald_adv_rush" },
] });
N("ald_adv_wait", "aldwin", "Patience. A wise answer. We will wait for them to tell us what they believe.", { go: "aldwin_hub" });
N("ald_adv_rush", "aldwin", "Then it shall be done soon. May God forgive us if we are too hasty.", { go: "aldwin_hub" });
N("ald_bell", "aldwin", s => s.rel.aldwin >= 1 ? "The little bell? Gladly. A bell calls the faithful and the lost alike. Bring it back safely." : "The altar bell is not a toy. Why do you want it?", { choices: [
  { t: "Explain that the girl might respond to its sound.", if: s => s.rel.aldwin >= 0, fx: { item: "bell", flag: "bell_given", rel: { aldwin: 1 } }, go: "aldwin_hub" },
  { t: "Say nothing, and take it when nobody is looking later.", fx: { item: "bell", flag: "stolen_bell", rel: { aldwin: -1 } }, go: "aldwin_hub" },
  { t: "Never mind.", go: "aldwin_hub" },
] });
N("ald_doubt", "aldwin", "God made a world larger than my small parish. I do not know what they are, and I am not ashamed to say so. Kindness does not require certainty.", { fx: { rel: { aldwin: 1 } }, go: "aldwin_hub" });
N("ald_shelter", "aldwin", "If it comes to it, yes. The church is no great house, but a girl can sleep warm there, and nobody will call her a devil under my roof.", { fx: { flag: "aldwin_shelter" }, go: "aldwin_hub" });

// ---- Mother Maud ----
N("maud_first", "maud", "Mother Maud squints at you. “You are the one who found them. Good. Come here, I have something to say to you.”", { go: "maud_hub" });
N("maud_hub", "maud", "Maud sorts dried herbs into bundles without looking up. “Well?”", { choices: [
  { t: "What do you know of folk like these?", once: "m_folk", go: "m_folk" },
  { t: "The boy is weak. Do you have a remedy?", once: "m_tonic", if: s => s.act === 2 && !s.items.tonic && !s.flags.tonic_given, go: "m_tonic" },
  { t: "Do you think they should be driven out?", once: "m_driven", go: "m_driven" },
  bye ] });
N("m_folk", "maud", "Old tales of folk who live under hills, in a country of twilight. Nobody who goes there comes back the same. I do not say they are evil. I say they are not ours. And hungry things want growing things: green and living, not baked or boiled. Think on that.", { fx: { flag: "maud_hint", note: "n_land", know: 1 }, go: "maud_hub" });
N("m_tonic", "maud", s => s.rel.maud >= 1 ? "A tonic for the boy. Willow bark, honey, a little thyme. Take it. Bring me news." : "A remedy costs something. Your bread would do for a trade.", { choices: [
  { t: "Give her your bread.", if: s => s.items.bread && s.rel.maud < 1, fx: { item: "tonic", drop: "bread", rel: { maud: 1 } }, go: "maud_hub" },
  { t: "Take the tonic gratefully.", if: s => s.rel.maud >= 1, fx: { item: "tonic" }, go: "maud_hub" },
  { t: "Never mind.", go: "maud_hub" },
] });
N("m_driven", "maud", "Did I say so? I say be careful what you call a miracle, and be careful what you call a monster. Both words are easy.", { fx: { rel: { maud: 1 }, susp: 0 }, go: "maud_hub" });

// ---- Sir Richard de Calne ----
N("richard_first", "richard", "Sir Richard de Calne receives you in his hall: a lean man with ink on his cuffs and an odd light in his eyes. “So you are the one who found them. Tell me exactly what you saw.”", { fx: { note: "n_calne" }, choices: [
  { t: "Tell him exactly what you saw.", fx: { rel: { richard: 1 }, flag: "richard_truth" }, go: "richard_hub" },
  { t: "Say they are surely angels.", fx: { susp: -1 }, go: "richard_hub" },
  { t: "Say they might be dangerous.", fx: { susp: 1, rel: { richard: -1 } }, go: "richard_hub" },
] });
N("richard_hub", "richard", s => s.act >= 3 ? "Sir Richard studies you thoughtfully. “Well?”" : "Sir Richard steeples his fingers. “What else would you tell me?”", { choices: [
  { t: "Would you take the children into your hall?", once: "r_take", if: s => s.where !== "manor", go: "r_take" },
  { t: "How does a lord hear of such a story so fast?", once: "r_source", go: "r_source" },
  { t: "Could the girl serve in your household, in time?", once: "r_service", if: s => s.rel.richard >= 1 && s.act >= 2, go: "r_service" },
  bye ] });
N("r_take", "richard", s => s.rel.richard >= 1 && s.susp <= 5 ? "Yes. I will send a cart to fetch them. A household can bear a little strangeness." : "I cannot house what the village fears, and I have not heard enough from you to overrule them.", { fx: s => { if (s.rel.richard >= 1 && s.susp <= 5) { s.where = "manor"; s.flags.to_manor = true; s.rel.richard = Math.min(5, s.rel.richard + 1); } }, go: "richard_hub" });
N("r_source", "richard", "Marvels travel faster than carts. I will tell this story to anyone who asks. I have a feeling that someday a monk will write it down, whatever any of us would prefer.", { go: "richard_hub" });
N("r_service", "richard", "If the girl wishes it, and the Church permits it, there is a place for her. I will not command it. I would rather she chose.", { fx: { flag: "richard_service" }, go: "richard_hub" });

// ---- Walter ----
N("walter_first", "walter", "Walter, a clerk in travel-stained black, looks up from his book. “I collect marvels, you see. The Abbot likes them. I have never been so lucky as to arrive before one was finished.”", { go: "walter_hub" });
N("walter_hub", "walter", "Walter dips his quill. “Yes?”", { choices: [
  { t: "What are you writing?", once: "w_what", go: "w_what" },
  { t: "Share what you have learned about the children.", once: "w_share", if: s => clueCount(s) >= 1, go: "w_share" },
  { t: "Do you believe they are what they say?", once: "w_belief", go: "w_belief" },
  bye ] });
N("w_what", "walter", "Everything. The wolf pits, the harvest, the colour of the girl’s skin at noon and at dusk. A clerk’s duty is to write what he sees, and to wonder at what he cannot.", { go: "walter_hub" });
N("w_share", "walter", s => clueCount(s) >= 3 ? "Remarkable. A cloth no loom here could make, bells, an odd light… I will write down only what you have actually seen, and I will not tidy it up." : "Too little to write down. Bring me something stranger, or something truer.", { fx: s => { if (clueCount(s) >= 3) { s.flags.walter_trust = true; s.rel.walter = Math.min(5, s.rel.walter + 2); s.know = Math.min(20, s.know + 1); } }, go: "walter_hub" });
N("w_belief", "walter", "They say they come from a land of twilight. I have read of stranger things. Some say a hoax, some say a dream, some say the other world. I say: write it down, and let people decide.", { fx: { note: "n_later" }, go: "walter_hub" });

// ---- other objects ----
N("ex_pits", "narr", "The wolf pits are deep and old, ringed with thorns. In the stubble around them there is not a single cart track, hoofprint or footprint except the villagers’ own. Nobody arrived here by any road. [Invented clue]", { fx: { know: 1, clue: "no_tracks" } });
N("ex_cloth", "narr", "A scrap of grey-green cloth is snagged on a thorn. It is cool to the touch and does not smell of any dye or animal you know. You tuck it into your sleeve. [Invented clue]", { fx: { know: 1, clue: "cloth_scrap", item: "cloth" } });
N("ex_well", "narr", "You draw a bucket of cold water and fill a clay cup.", { fx: { item: "water" } });
N("ex_beans", "narr", s => s.items.bean ? "The bean rows are heavy with pods. You already have a stalk." : "Edith’s bean rows are heavy with fat green pods. A whole stalk comes away easily in your hand. Beans that you can eat raw… and green things are what hungry things want.", { fx: { item: "bean" } });
N("ex_bell", "narr", s => s.items.bell ? "The altar rail is bare: you already have the handbell." : "A small bronze handbell sits on the altar rail, worn smooth by years of hands.", {
  choices: [{ t: "Ask Father Aldwin first.", go: "ald_bell" }, { t: "Take it quietly.", if: s => !s.items.bell, fx: { item: "bell", flag: "stolen_bell", rel: { aldwin: -1 } }, go: null }, { t: "Leave it.", go: null }] });
N("ex_grave", "narr", "A small wooden cross marks a fresh mound at the edge of the churchyard. Somebody has laid a handful of raw broad beans on it.", {});
N("rest", "narr", s => s.flags.fed ? "You have done what you can for now. Lie down in the straw and let the night pass." : "You lie awake. The children have not truly eaten. Whatever happens in the night, it will not be you who decides it.", { choices: [{ t: "Rest until dawn.", go: "rest_go" }, { t: "Not yet.", go: null }] });
N("rest_go", "narr", "You sleep. Dawn comes, and then other dawns, and the days run together…", { fx: (s, ev) => { restOutcome(s, ev); }, go: "a3_open" });
N("a3_open", "narr", s => {
  const boy = s.boy === "lives" ? "The boy is thin but strong now, trailing his sister everywhere." : "The boy grows weaker each day, though he never complains.";
  const food = s.flags.fed === "self" ? "At dawn you found bean stalks torn open in the garden: hunger had made the girl bolder than caution." : "";
  return `Days pass. The girl has begun to speak the village’s tongue, slowly, with strange stresses, and her skin has faded toward the colour of everyone else’s. ${food} ${boy}`.replace(/\s+/g, " ").trim();
}, { fx: { set: { act: 3, fluent: true } }, go: s => (s.boy === "weak" ? "a3_boy" : null) });
N("a3_boy", "narr", "The bell tolls. The boy has died in his sleep, gently, as if he had simply stopped being able to stay. The girl is sitting beside him when you arrive, not crying, only holding his hand. What do you do?", { fx: { set: { boy: "dead" }, note: "n_boy", susp: 1 }, choices: [
  { t: "Stay with her through the night.", fx: { trust: 2 }, go: "a3_boy2" },
  { t: "Fetch Father Aldwin to bless him.", fx: { rel: { aldwin: 1 }, flag: "boy_blessed", susp: -1 }, go: "a3_boy2" },
  { t: "Leave her to grieve alone.", fx: { trust: -1 }, go: "a3_boy2" },
] });
N("a3_boy2", "narr", "In the morning, a small wooden cross stands at the edge of the churchyard. The village has gone quiet. The girl asks, in her halting English, whether she may sit beside it each evening.", { fx: { event: "boy_dead_scene" } });

/* ---- the girl, after she has learned some English ---- */
N("girl_hub", "girl", s => s.trust >= 4 ? "The girl smiles shyly. “Hello, friend.”" : "The girl watches you cautiously. “Hello.”", { choices: [
  { t: "Where do you come from?", once: "g_home", go: s => s.trust >= 4 ? "g_tale_full" : "g_tale_part" },
  { t: "The bells… do you still hear them?", once: "g_bells", if: s => (s.flags.heard_tale || s.flags.heard_tale_part) && s.trust >= 3, go: "g_bells" },
  { t: "I am sorry about your brother.", once: "g_grief", if: s => s.boy === "dead", go: "g_grief" },
  { t: "How is your brother?", once: "g_boy", if: s => s.boy === "lives", go: "g_boy" },
  { t: "Do you like the food here now?", once: "g_food", go: "g_food" },
  { t: "Teach me a word of yours.", once: "g_word", go: "g_word" },
  bye ] });
N("g_tale_full", "girl", "We lived in Saint Martin’s Land. There is no sun there, only twilight, like the hour after the sun goes down, and everything is green. A great river divides us from a bright country we can see but never reach. We kept our father’s cattle. One day we followed them into a cave, and heard bells, so sweet. We walked a long time. Then the sun struck us, so hot and so bright. We fell down. When we woke, you were there.", { fx: { know: 3, trust: 1, flag: "heard_tale", note: "n_land" }, go: "girl_hub" });
N("g_tale_part", "girl", "A far land. Twilight there. There were bells. I will tell you more when I know you better.", { fx: { know: 1, flag: "heard_tale_part" }, go: "girl_hub" });
N("g_bells", "girl", "Sometimes. When the wind comes from the wood, at dusk, near the old hollow beyond the wolf pits. Very faint. It makes my chest hurt.", { fx: { know: 1, flag: "heard_bells_detail" }, choices: [
  { t: "Would you go back, if you could?", fx: s => { s.girlWish = s.trust >= 5 ? "return" : "unsure"; }, go: "g_wish" },
  { t: "Do you want to stay here?", fx: s => { s.girlWish = (s.flags.to_manor || s.flags.to_church || s.rel.edith >= 1) ? "stay" : "unsure"; }, go: "g_wish" },
  { t: "We do not have to decide now.", go: "girl_hub" },
] });
N("g_wish", "girl", s => s.girlWish === "return" ? "I think… yes. I would be afraid. But I would go. I miss the twilight. I miss the sound." : s.girlWish === "stay" ? "People here are kind, when they forget what colour I was. I would stay, if I could keep the bells in my head." : "I do not know. Half of me is still there. Half of me likes honey.", { go: "girl_hub" });
N("g_grief", "girl", "He was brave. He never asked for anything. He kept listening for the bells, even at the end.", { fx: { trust: 1, flag: "grief_shared" }, go: "girl_hub" });
N("boy_a3", "boy", "Honey! Honey is good. The goose is bad. Sen-mar… sometimes. In the night.", { go: null });
N("g_boy", "girl", "He is better! He eats everything. He argues with the geese. I think the geese are winning.", { go: "girl_hub" });
N("g_food", "girl", "Bread is good now, with honey. At first it was like eating stones. Do you think they will stop being afraid of me, when I am not green any more?", { fx: { trust: 1, susp: -1 }, go: "girl_hub" });
N("g_word", "girl", "Sen-mar is “bell”. Nuhai is “water”. Ael-ro is “sun”… though we have no sun, only a word for what hurt our eyes.", { fx: { trust: 1 }, go: "girl_hub" });

/* ---- dusk, the mob and the finale ---- */
N("dusk_gate", "narr", "You sit on the bench on the green. The light is going. You could wait for dusk now, or keep talking to people first.", { choices: [{ t: "Wait for dusk.", fx: { event: "dusk" }, go: s => duskOutcome(s) }, { t: "Not yet.", go: null }] });
N("mob_open", "hugh", "She has brought a curse on us! The harvest was poor, and the boy is dead, and what next? Out with her, before worse comes!", { fx: { event: "mob_scene" }, choices: [
  { t: "Stand in front of the girl and speak for her.", if: s => s.rel.edith >= 1 || s.flags.edith_backs, fx: { susp: -3, flag: "calmed", set: { calmed: true } }, go: "mob_edith" },
  { t: "Call on Father Aldwin to claim sanctuary.", if: s => s.rel.aldwin >= 1, fx: { susp: -3, flag: "calmed", set: { calmed: true } }, go: "mob_aldwin" },
  { t: "Call on Sir Richard de Calne’s protection.", if: s => s.rel.richard >= 1, fx: { susp: -3, flag: "calmed", set: { calmed: true } }, go: "mob_richard" },
  { t: "Tell the crowd what the girl has told you.", if: s => s.flags.heard_tale && s.know >= 5, fx: { susp: -3, flag: "calmed", set: { calmed: true } }, go: "mob_truth" },
  { t: "Slip away with the girl into the dusk.", if: s => s.trust >= 3, fx: { flag: "fled_mob" }, go: s => s.flags.heard_bells_detail ? "hollow_arrive" : "end_omen" },
  { t: "Say nothing.", go: "end_omen" },
] });
N("mob_edith", "edith", "Hugh Reeve, you are a good man. Look at that child and tell me you see a curse. Ah, no? Then put your torches down.", { go: "mob_calm" });
N("mob_aldwin", "aldwin", "This girl is in the care of the Church. Anyone who lays a hand on her answers to God, and to me.", { go: "mob_calm" });
N("mob_richard", "richard", "In my household the girl has a place. If this village will not keep her in peace, then Wykes will.", { go: "mob_calm" });
N("mob_truth", "narr", "You tell them what the girl told you: the twilight, the river, the bells. As you speak, the torches droop. A story, it turns out, is harder to fear than a stranger.", { go: "mob_calm" });
N("mob_calm", "hugh", "…Perhaps I spoke too quickly. We will talk in the morning. Go home, all of you.", { go: "finale" });
N("finale", "narr", s => `Dusk settles over Woolpit, soft and violet. The girl waits by the well, a thin figure in a borrowed cloak, with the question in her eyes: What will become of me? ${s.flags.heard_bells_detail ? "A thin wind brings, or seems to bring, the faintest ringing from the wood." : ""} ${s.flags.calmed ? "The torches have gone home." : ""}`.replace(/\s+/g, " ").trim(), { fx: { event: "finale" }, choices: [
  { t: "Walk with her to the hollow where she hears the bells.", if: s => s.flags.heard_bells_detail && s.trust >= 3, go: "hollow_arrive" },
  { t: "Ask Sir Richard de Calne to take her into his household.", if: s => s.rel.richard >= 1, go: "end_manor" },
  { t: "Ask Father Aldwin to give her a place in the church’s care.", if: s => s.rel.aldwin >= 1, go: "end_font" },
  { t: "Tell Walter everything, so that her true story is written down.", if: s => s.flags.walter_trust && s.know >= 7, go: "end_ink" },
  { t: "Leave her fate to the reeve and the village.", go: "end_omen" },
] });
N("hollow_arrive", "narr", "At the forest’s edge, beyond the wolf pits, the mist lies thick and silver between the roots. Nothing grows in the hollow itself. And then you hear it, thin and sweet, from very far away: bells.", { fx: { event: "hollow" }, choices: [
  { t: "Let her go toward the bells.", go: "end_bells" },
  { t: "Ring the little bell to answer them.", if: s => s.items.bell, fx: { flag: "rang_bell" }, go: "end_bells" },
  { t: "Ask her to stay.", go: s => s.boy === "lives" ? "end_both" : s.trust >= 6 ? "end_manor" : "end_bells" },
] });
N("end_manor", "narr", "…", { fx: (s, ev) => { s.ending = s.boy === "lives" ? "both" : "servant"; applyFx(s, { event: "ending", note: "n_lynn" }, ev); } });
N("end_both", "narr", "…", { fx: (s, ev) => { s.ending = "both"; applyFx(s, { event: "ending" }, ev); } });
N("end_bells", "narr", "…", { fx: (s, ev) => { s.ending = "bells"; applyFx(s, { event: "ending" }, ev); } });
N("end_font", "narr", "…", { fx: (s, ev) => { s.ending = "font"; applyFx(s, { event: "ending" }, ev); } });
N("end_ink", "narr", "…", { fx: (s, ev) => { s.ending = "ink"; applyFx(s, { event: "ending" }, ev); } });
N("end_omen", "narr", "…", { fx: (s, ev) => { s.ending = "omen"; applyFx(s, { event: "ending" }, ev); } });

export const NODES = nodes;

/* =====================  RULES  ===================== */
// first-contact nodes
const FIRST = { edith: "edith_first", hugh: "hugh_first", aldwin: "aldwin_first", maud: "maud_first", richard: "richard_first", walter: "walter_first" };
export function talkNode(id, s) {
  if (id === "girl") return s.fluent ? "girl_hub" : "kids_hub";
  if (id === "boy") return s.fluent ? (s.boy === "lives" ? "boy_a3" : null) : "boy_a2";
  if (FIRST[id]) return s.seen[FIRST[id]] ? `${id}_hub` : FIRST[id];
  return null;
}
export const OBJECTS = { pits: "ex_pits", cloth: "ex_cloth", well: "ex_well", beans: "ex_beans", bell: "ex_bell", grave: "ex_grave", bed: "rest", bench: "dusk_gate" };
export function objectNode(id, s) {
  if (id === "cloth" && s.items.cloth) return null;
  return OBJECTS[id] || null;
}
export function objectAvailable(id, s) {
  switch (id) {
    case "pits": return s.act >= 2;
    case "cloth": return s.act === 2 && !s.items.cloth;
    case "well": return s.act === 2;
    case "beans": return s.act === 2;
    case "bell": return s.act === 2 && !s.items.bell;
    case "grave": return s.boy === "dead";
    case "bed": return s.act === 2;
    case "bench": return s.act === 3;
  }
  return false;
}
export function objective(s) {
  if (s.act === 1) return s.seen.a1_arrive ? "Decide where the children should go." : "Follow the shouting to the wolf pits.";
  if (s.act === 2) return s.flags.fed ? "The children are eating. Learn more about them, then rest on the hay when you are ready." : "Find something the children will eat. Talk to the villagers and search the village.";
  if (s.seen.hollow_arrive) return "Decide what happens to the girl at the hollow.";
  if (s.seen.mob_open || s.seen.finale) return "Decide what becomes of the girl.";
  if (s.act === 3) return s.flags.heard_tale || s.flags.heard_tale_part ? "Talk to the villagers. When you are ready, wait for dusk on the bench at the village green." : "Talk to the girl: she can speak a little now.";
  return "";
}
export function labelFor(id, s) {
  const names = { girl: "Talk to the girl", boy: "Look at the boy", edith: "Talk to Edith", hugh: "Talk to Hugh", aldwin: "Talk to Father Aldwin", maud: "Talk to Mother Maud", richard: "Talk to Sir Richard", walter: "Talk to Walter",
    pits: "Examine the wolf pits", cloth: "Pick up the scrap of cloth", well: "Draw water", beans: "Pick broad beans", bell: "Examine the handbell", grave: "Look at the grave", bed: "Rest until dawn", bench: "Sit and wait for dusk" };
  return names[id] || "Interact";
}

/* ---- end of Act 2 (called when the player rests) ---- */
export function restOutcome(s, events = []) {
  const lines = [];
  if (!s.flags.fed) {
    applyFx(s, { flag: "fed", trust: -1, susp: 2, skin: 0.2, flag2: null }, events); s.flags.fed = "self"; s.flags.boy_weak = true;
    lines.push("The children were not fed in time. Driven by hunger, the girl found the bean rows herself in the night.");
  }
  // the boy's fate: the chronicles say he died. Careful, well-timed help can change that (invented).
  s.boy = (s.flags.fed_by_you && s.trust >= 3 && s.flags.tonic_given && !s.flags.baptism_rush) ? "lives" : "weak";
  s.skin = Math.min(1, Math.max(s.skin, 0.5) + 0.3); s.day += 3; s.fluent = true; s.act = 3;
  applyFx(s, { event: "act3" }, events);
  return lines;
}
export function duskOutcome(s) { return s.susp >= 6 && !s.calmed ? "mob_open" : "finale"; }

export const defaultEnding = s => s.ending || "omen";
