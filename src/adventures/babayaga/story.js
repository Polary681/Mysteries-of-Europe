// BABA YAGA'S HUT - story data and rules (pure logic, no WebGL).
//
// SOURCES vs INVENTION
//  The adventure follows "Vasilisa the Beautiful" (Vasilisa Prekrasnaya), collected by Alexander Afanasyev in his
//  Narodnye russkie skazki (published 1855-1863): the stepmother who sends the girl for fire, the little doll from her dying
//  mother that must be fed, the white, red and black horsemen (Day, Sun, Night), the hut on chicken legs and the fence of
//  bones and skulls whose eyes light up at night, Baba Yaga flying in a mortar and sweeping her tracks with a broom, the
//  chores, the poppy seed to be cleaned of earth, the three pairs of hands, "not every question leads to good", the answer
//  "by my mother's blessing" and the skull given as fire. The flight with a towel that becomes a river and a comb that becomes
//  a forest, given by a cat the girl has fed, comes from another Afanasyev tale, "Baba Yaga". The words that turn the hut are
//  a formula found in many Russian tales. The order of the chores, the yard, the apprenticeship ending, the walk home and
//  every line of dialogue are written for this game. The CODEX labels each thing.
import { applyFx } from "../../narrative/core.js";

export const SAVE_KEY = "moe.babayaga.save.v1", ENDINGS_KEY = "moe.babayaga.endings.v1";
// phase: road (walking to the hut) -> gate (night, the hut turned away) -> tasks (the day of chores) -> return (Baba Yaga back)
//        -> lantern (walking home with the skull) | flight (running from her) ; ending
export const initState = () => ({
  v: 1, phase: "road", riders: {}, tasks: {}, piles: {}, inside: false, ending: null,
  flags: {}, items: { doll: true }, clues: {}, notes: { n_tale: true }, seen: {}, once: {},
});
export const TASKS = ["water", "sweep", "poppy", "supper"];
export const TASK_LABEL = { water: "Fill the barrel with water", sweep: "Sweep the yard", poppy: "Clean the poppy seed of earth", supper: "Cook the supper" };
export const tasksDone = s => TASKS.filter(t => s.tasks[t]).length;
export const piles = s => Object.keys(s.piles).length;

export const WHO = {
  narr: { name: "", style: "narr" }, you: { name: "You" }, yaga: { name: "Baba Yaga" }, doll: { name: "The little doll" }, cat: { name: "The cat" },
};

/* ---------------- codex ---------------- */
export const CODEX = {
  n_tale: { kind: "historical", title: "Where the story comes from", text: "“Vasilisa the Beautiful” was collected by the folklorist Alexander Afanasyev and published in his Russian Folk Tales (1855–1863). Ivan Bilibin’s illustrations of it (1899–1900), with the three horsemen and the hut in the woods, are among the most famous images of Russian fairy tales. This adventure follows the tale, and says where it does not." },
  n_yaga: { kind: "folklore", title: "Baba Yaga", text: "Baba Yaga is the old woman of the forest in East Slavic fairy tales, told in Russia, Ukraine and Belarus, with relatives across Central and Eastern Europe. She can devour people or help them; she is often called “bony leg”, and she flies in a mortar, steering with the pestle and sweeping away her tracks with a broom. She belongs to the tales, not to any one place." },
  n_doll: { kind: "folklore", title: "The little doll", text: "In the tale, Vasilisa’s mother gives her a little doll before she dies: feed it and ask its advice, and it will help. The doll does most of the impossible work while Vasilisa sleeps." },
  n_riders: { kind: "folklore", title: "The three horsemen", text: "On her way Vasilisa is passed by a white horseman, and day breaks; by a red one, and the sun rises; by a black one, and night falls. Baba Yaga later calls them her bright Day, her red Sun and her dark Night. Other versions of the tale give the colours other meanings." },
  n_fence: { kind: "folklore", title: "The fence of bones", text: "Baba Yaga’s hut stands inside a fence made of human bones, topped with skulls whose eyes glow in the dark. In the tale, the skulls’ eyes are the only light in the clearing at night." },
  n_hut: { kind: "folklore", title: "The hut on chicken legs", text: "The hut on chicken legs (izbushka na kurikh nozhkakh) turns round when the hero says the old words: “Little hut, little hut, turn your back to the forest and your front to me!” The formula appears in many Russian tales. In 1883 the painter Viktor Vasnetsov designed a garden pavilion called the “Hut on Chicken Legs” at the Abramtsevo estate near Moscow, which is where the map pin stands." },
  n_hands: { kind: "folklore", title: "The three pairs of hands", text: "Baba Yaga calls her “faithful servants”, and three pairs of hands appear out of nowhere to grind her grain and press oil from the poppy seed. When Vasilisa is invited to ask questions, she asks about the horsemen but not about the hands: “not every question leads to good”." },
  n_skull: { kind: "folklore", title: "Fire from the fence", text: "Asked how she finished the work, Vasilisa answers “by my mother’s blessing”. Baba Yaga wants no blessed ones in her house: she sends her away with a skull from the fence, its eyes burning, as the fire she came for." },
  n_flight: { kind: "folklore", title: "The towel and the comb", text: "In Afanasyev’s tale “Baba Yaga”, a girl sent to the witch feeds the witch’s cat, and the cat gives her a towel and a comb. Pursued, she throws the towel and it becomes a wide river; then the comb, and it becomes a dense forest Baba Yaga cannot get through. Here the cat is the one on the stove." },
  n_invented: { kind: "invented", title: "What this game adds", text: "The yard and its chores in this order, sorting the poppy seed with your own hands, the apprenticeship ending, the walk home with the skull and all the dialogue are written for this game. Nothing here is a lost version of the tale." },
};

/* ---------------- endings ---------------- */
export const ENDINGS = {
  lantern: { id: "lantern", kicker: "Ending 1 of 4", title: "Fire from the Fence", cls: "e-lantern",
    paragraphs: s => [
      "You walk home through the night forest with a skull on a stick. Its eyes burn steadily; the birches step out of the dark one by one and step back in behind you.",
      s.flags.cat_fed ? "Somewhere behind you, a cat is purring on a stove. You will never be sure it was not laughing." : "Behind you the hut stands up, turns its back to the forest path, and is only logs again.",
      "In the tale, the skull’s eyes did the rest: the stepmother and her daughters, who had sent the girl to be eaten, were ashes by morning. Here you only know that your house was never cold again.",
    ],
    notes: ["This is the ending of the tale (Afanasyev, “Vasilisa the Beautiful”): the answer “by my mother’s blessing” and the skull given as fire are in the story. The walk home is told here in your own steps."] },
  flight: { id: "flight", kicker: "Ending 2 of 4", title: "Over River and Forest", cls: "e-flight",
    paragraphs: s => [
      "You ran. Behind you the mortar came thundering down the path, the pestle pounding the air, the broom sweeping away her own tracks.",
      "The towel became a river, wide and black, and she howled on its bank. The comb became a forest so thick that not even Baba Yaga could gnaw her way through it.",
      s.flags.cat_fed ? "You come out of the trees at dawn with nothing in your hands but the knowledge you were warned not to ask for. Some say the cat still smiles about it." : "You come out of the trees at dawn with nothing in your hands but the knowledge you were warned not to ask for.",
    ],
    notes: ["The flight with the towel and the comb comes from Afanasyev’s tale “Baba Yaga”, where a girl who fed the witch’s cat escapes this way. Asking about the hands is the question Vasilisa does NOT ask; what happens after it here is borrowed from the other tale."] },
  stay: { id: "stay", kicker: "Ending 3 of 4", title: "The Mortar’s Apprentice", cls: "e-stay",
    paragraphs: s => [
      "You stay. The first night she teaches you which mushrooms answer when called. The second, how to say the words so that the hut kneels. On the third she lets you hold the pestle.",
      "The mortar lifts off the ground as if it had been waiting for you. Below, the fence of bones turns in a slow circle, and the skulls’ eyes follow you over the tops of the birches.",
      "In the villages they still tell of a girl who went to Baba Yaga for fire and never came back. They are not quite right. You come back every winter, in a mortar, sweeping away your tracks.",
    ],
    notes: ["INVENTED ending. In the tales Baba Yaga sometimes rewards and teaches those who work well and speak wisely, but no tale makes Vasilisa her apprentice."] },
  leave: { id: "leave", kicker: "Ending 4 of 4", title: "The Birch Path", cls: "e-leave",
    paragraphs: s => [
      s.phase === "road" ? "You turn back before you ever see the hut. Behind you, far away, something very large clucks." : "You turn your back on the hut and the fence of bones, and walk into the dark between the birches.",
      "The little doll in your pocket is warm. Whenever the path forks, it stirs; you follow it, and the forest lets you go.",
      "You come home without fire. The house is cold, the stepmother is furious, and you are alive. Some nights that is the whole story.",
    ],
    notes: ["INVENTED ending. In the tale Vasilisa cannot go home without fire. The doll that guides her through the forest is in the tale."] },
};
export const ENDING_ORDER = ["lantern", "flight", "stay", "leave"];

/* ---------------- dialogue nodes ---------------- */
const nodes = {};
const N = (id, who, text, o = {}) => { nodes[id] = { id, who, text, ...o }; return nodes[id]; };
const task = t => (s, ev) => { if (!s.tasks[t]) { s.tasks[t] = true; ev.push({ t: "event", id: "task", n: t }); } };

N("start", "narr", "The last candle in the house has gone out. Your stepmother did it on purpose, and you both know it.\n\n“Go to Baba Yaga in the forest,” she says, “and ask her for a light.” Nobody comes back from Baba Yaga. In your apron pocket, your dead mother’s little doll is warm.", { fx: { note: ["n_tale", "n_doll"], clue: "errand" }, go: "start2" });
N("start2", "doll", "Do not be afraid. Feed me when you can, and listen to me. Hold me close (L) and I will tell you the way.", { fx: { toast: "Codex updated (J)." } });

N("rider_white", "narr", "A horseman gallops past, all in white: white horse, white harness, a white cloak streaming. And the sky behind the birches begins to pale.", { fx: { note: "n_riders", clue: "white" } });
N("rider_red", "narr", "Another horseman thunders by, all in red, on a red horse. The sun comes up, and the dew on the birch leaves turns to fire.", { fx: { clue: "red" } });
N("rider_black", "narr", "A third horseman: black horse, black harness, black cloak. He gallops straight to the gate in the fence and vanishes, as if the earth had swallowed him. Night falls at once.\n\nAnd in the fence, the eyes of the skulls begin to glow.", { fx: { note: "n_fence", clue: "black", set: { phase: "gate" } } });

N("hut_back", "narr", "The hut stands on two enormous chicken legs, with its back to you: no door, no steps, only logs. It shifts its weight from one foot to the other like a hen in the cold. Somewhere above you, it clucks.", { fx: { note: "n_hut" }, choices: [
  { t: "Say the old words: “Little hut, little hut, turn your back to the forest and your front to me!”", fx: { event: "hut_turn" }, go: null },
  { t: "Knock on the logs.", once: true, go: "hut_knock" },
  { t: "Walk away.", go: null },
] });
N("hut_knock", "narr", "The logs are warm, like the flank of an animal. Something deep inside them clucks again. The hut does not turn.\n\nIn your pocket the doll stirs: there are words for this.", { go: "hut_back" });

N("yaga_meet", "yaga", "Fie, fie! It smells of a Russian soul! Who is there? Who is standing in my yard?", { fx: { note: "n_yaga" }, choices: [
  { t: "“It is I, grandmother. My stepmother sent me to you for fire.”", go: "yaga_deal" },
  { t: "Hide behind the well.", go: "yaga_found" },
] });
N("yaga_found", "yaga", "Hiding from me, in my own yard? My nose is longer than your shadow, girl. Come out where I can see you.", { go: "yaga_deal" });
N("yaga_deal", "yaga", "I know your stepmother. Fire, is it? Very well. Stay with me and work for it. If you work well, you shall have fire. If not, you shall be my supper.", { go: "yaga_tasks" });
N("yaga_tasks", "yaga", "Sleep now on the bench. At dawn I fly. Before I am back: fill the barrel with water, sweep the yard, cook my supper, and clean the poppy seed of earth, every grain of it.", { fx: { clue: "tasks", event: "night_pass" } });

N("well", "narr", s => s.items.bucket ? "You already carry a full bucket. The barrel stands by the porch." : "A deep well with a wooden roof. The rope is cold and wet, and a long way down something gleams.", { choices: [
  { t: "Draw a bucket of water.", if: s => !s.items.bucket && !s.tasks.water, fx: { item: "bucket" }, go: null },
  { t: "Leave it.", go: null },
] });
N("well_done", "narr", "The well is quiet. The barrel by the porch is already full.");
N("barrel_pour", "narr", "You tip the bucket into the barrel. The water goes in black and comes up silver. The barrel is full.", { fx: (s, ev) => { delete s.items.bucket; task("water")(s, ev); } });
N("barrel_empty", "narr", "A big empty barrel by the porch. The water has to come from the well.");
N("broom", "narr", "Baba Yaga’s second broom leans against the porch: birch twigs bound with something you prefer not to look at closely.", { choices: [
  { t: "Take the broom.", fx: { item: "broom" }, go: null },
  { t: "Leave it.", go: null },
] });
N("pile_need", "narr", "A heap of leaves, feathers and small bones blown against the fence. You need a broom.");

N("inside_first", "narr", "Inside, the hut is bigger than it looked: a great white stove, a table, benches, bunches of herbs hanging from the beams, and on the stove a black cat that watches you with yellow eyes and does not blink.");
N("poppy", "narr", "On the table stands a bowl of poppy seed mixed with black earth, every grain of it. Cleaning it would take a lifetime.", { choices: [
  { t: "Pick the earth out yourself, grain by grain.", fx: { event: "poppy_self" }, go: null },
  { t: "Give the doll a crust of bread and ask her to help.", fx: { event: "poppy_doll", flag: "fed_doll" }, go: null },
  { t: "Not now.", go: null },
] });
N("poppy_done", "narr", "The bowl is full of clean poppy seed, blue-black and glistening. Not a speck of earth is left.");
N("stove", "narr", s => s.tasks.water ? "The stove is ready. There is a pot, the barrel is full, and there are turnips, groats and a cabbage that is older than you are." : "The pot is dry, and so is the barrel by the porch. Fetch water first.", { choices: [
  { t: "Light the stove and cook the supper.", if: s => s.tasks.water && !s.tasks.supper, fx: (s, ev) => task("supper")(s, ev), go: "stove_cooked" },
  { t: "Leave it for now.", go: null },
] });
N("stove_cooked", "narr", "The fire takes at once, as if it had been waiting. Soon the hut smells of cabbage soup and kasha, and the cat on the stove sits up.");
N("stove_done", "narr", "The supper is ready and keeping warm in the stove.");
N("cat", "cat", s => s.flags.cat_fed ? "Mrrr. Long as I have served her, she never gave me so much as a bone. You gave me soup." : s.tasks.supper ? "Mrrrow. That soup smells very good. Very, very good." : "The cat looks at you, and then at the empty pot, and then at you again.", { choices: [
  { t: "Give the cat some of the supper.", if: s => s.tasks.supper && !s.flags.cat_fed, fx: { flag: "cat_fed", toast: "The cat purrs. It will remember." }, go: "cat_thanks" },
  { t: "Leave the cat alone.", go: null },
] });
N("cat_thanks", "cat", "Purr. Remember, girl: a towel and a comb. You never know when you will need them.");

N("yaga_back", "yaga", "Fie! Still alive, and still here? Let us see.\n\nThe yard swept. The barrel full. The supper cooked. The poppy seed clean… Hm. I cannot complain of anything.", { go: "yaga_hands" });
N("yaga_hands", "yaga", "My faithful servants! Take the poppy seed and press me its oil!", { fx: { note: "n_hands", event: "hands" } });
N("yaga_ask", "yaga", "Why do you stand there like a stump? You have a tongue. Ask me something.", { choices: [
  { t: "“Who was the white horseman I met on the road?”", go: "riders_ans" },
  { t: "“Grandmother, what are the hands that serve you?”", go: "hands_q" },
] });
N("riders_ans", "yaga", "That was my bright Day. The red one is my red Sun, and the black one is my dark Night. All three are my faithful servants. Ask more!", { choices: [
  { t: "“And the three pairs of hands?”", go: "hands_q" },
  { t: "“That is enough. They say that to know too much is to grow old too soon.”", go: "yaga_how" },
] });
N("yaga_how", "yaga", "Good. Not every question leads to good. You asked only about what you saw outside my hut. Now you answer me: how did you finish all my work?", { choices: [
  { t: "“By my mother’s blessing.”", go: "blessed" },
  { t: "“With my own two hands.”", if: s => !!s.flags.poppy_self, go: "own_hands" },
] });
N("blessed", "yaga", "Blessing! I want no blessed ones in my house. Out you go!", { go: "skull_given" });
N("skull_given", "narr", "She pulls a skull from the fence, sets it on a stick and pushes it into your hands. Its eyes are burning.\n\n“There is your fire for your stepmother,” says Baba Yaga. “Take it, and go.”", { fx: { item: "skull", note: "n_skull", set: { phase: "lantern" }, event: "lantern" } });
N("own_hands", "yaga", "Your own hands… I saw the bowl. Hands that can pick earth out of poppy seed do not come to my yard every century. Stay with me. I will teach you to steer a mortar.", { choices: [
  { t: "Stay with Baba Yaga.", go: "end_stay" },
  { t: "“No, grandmother. I must bring the fire home.”", go: "decline" },
] });
N("decline", "yaga", "Pah. The young always want to go home. Then take your fire.", { go: "skull_given" });
N("hands_q", "yaga", "Not every question leads to good! Ask too much, and you grow old too soon.\n\nThe hands are mine, and what happens in my hut stays in my hut. Those who carry my secrets out of the yard… I eat.\n\nShe goes into the hut, and you hear her lighting the big stove.", { fx: { note: "n_flight", set: { phase: "flight" }, event: "flight" } });
N("flight_cat", "cat", "Psst! She is heating the stove for you. Here, a towel and a comb. When you hear her close behind you, throw the towel. Then the comb. Run!", { fx: { item: ["towel", "comb"] } });
N("flight_doll", "doll", "Run! There is a towel on the line by the well and a comb on the bench. Take them. When she is close, throw the towel; then the comb. Run!", { fx: { item: ["towel", "comb"] } });

N("edge", "narr", s => s.phase === "road" ? "Behind you, the path leads back to the village and the cold, dark house." : "The forest path leads back to the village. Without fire, the house will be cold.", { choices: [
  { t: "Go home without fire.", go: "end_leave" },
  { t: "Not yet.", go: null },
] });
N("home_lantern", "narr", "The birches thin out. Ahead, under the stars, the roofs of the village. The skull’s eyes turn towards your stepmother’s house, and burn brighter.", { go: "end_lantern" });
N("home_flight", "narr", "You burst out of the trees into the open field. Behind you the comb-forest stands like a wall, and from somewhere inside it comes a long, furious howl.", { go: "end_flight" });

const endFx = id => (s, ev) => { s.ending = id; applyFx(s, { event: "ending" }, ev); };
N("end_lantern", "narr", "…", { fx: endFx("lantern") });
N("end_flight", "narr", "…", { fx: endFx("flight") });
N("end_stay", "narr", "…", { fx: endFx("stay") });
N("end_leave", "narr", "…", { fx: endFx("leave") });
export const NODES = nodes;

/* ---------------- rules ---------------- */
// objects the player can use, by phase. pile1..3 and the doors are handled by the game itself.
export function objectAvailable(id, s) {
  switch (id) {
    case "edge": return s.phase === "road" || s.phase === "gate" || s.phase === "tasks";
    case "hut": return s.phase === "gate";
    case "well": case "barrel": return s.phase === "tasks" && !s.inside && (id === "well" || !s.tasks.water);
    case "broom": return s.phase === "tasks" && !s.inside && !s.items.broom && !s.tasks.sweep;
    case "pile1": case "pile2": case "pile3": return s.phase === "tasks" && !s.inside && !s.piles[id];
    case "door": return s.phase === "tasks" && !s.inside;
    case "exit": return s.inside;
    case "stove": return s.inside && s.phase === "tasks" && !s.tasks.supper;   // once the supper is cooked, the cat on the stove is what matters
    case "poppy": case "cat": return s.inside && s.phase === "tasks";
  }
  return false;
}
export function objectNode(id, s) {
  if (id === "well") return s.tasks.water ? "well_done" : "well";
  if (id === "poppy") return s.tasks.poppy ? "poppy_done" : "poppy";
  if (id === "stove") return s.tasks.supper ? "stove_done" : "stove";
  if (id === "hut") return "hut_back";
  if (id === "barrel") return s.items.bucket ? "barrel_pour" : "barrel_empty";
  return id;
}
export const labelFor = (id, s) => ({
  edge: "Go back home", hut: "Speak to the hut", well: s.tasks.water ? "Look into the well" : "Draw water", barrel: "Pour water into the barrel", broom: "Take the broom",
  pile1: s.items.broom ? "Sweep the leaves" : "Look at the leaves", pile2: s.items.broom ? "Sweep the leaves" : "Look at the leaves", pile3: s.items.broom ? "Sweep the leaves" : "Look at the leaves",
  door: "Go into the hut", exit: "Go out into the yard", poppy: "Look at the bowl of poppy seed", stove: s.tasks.supper ? "Look at the stove" : "Cook the supper", cat: "Talk to the cat",
}[id] || "Interact");
export function objective(s) {
  if (s.ending) return "";
  if (s.phase === "road") return "Follow the forest path to Baba Yaga’s hut. Hold L to ask the doll the way.";
  if (s.phase === "gate") return "Go through the gate in the fence of bones, and speak to the hut.";
  if (s.phase === "tasks") {
    const left = TASKS.filter(t => !s.tasks[t]);
    if (!left.length) return "All the work is done. Wait for Baba Yaga.";
    if (left.includes("water") && s.items.bucket) return "Carry the bucket to the barrel by the porch.";
    if (left.includes("sweep") && s.items.broom) return `Sweep the three heaps of leaves in the yard (${piles(s)} / 3).`;
    return `Before nightfall: ${left.map(t => TASK_LABEL[t].toLowerCase()).join("; ")}.`;
  }
  if (s.phase === "lantern") return "Carry the fire home: follow the forest path back to the village.";
  if (s.phase === "flight") return "Run! Follow the path out of the forest. When she is close, throw the towel (E), then the comb.";
  return "";
}
export const defaultEnding = s => s.ending || "leave";
export const CLUE_TEXT = {
  errand: "Your stepmother sent you to Baba Yaga for fire. Your mother’s doll is in your pocket. (The tale.)",
  white: "A white horseman passed, and day broke. (The tale.)",
  red: "A red horseman passed, and the sun rose. (The tale.)",
  black: "A black horseman passed, and night fell: the skulls on the fence lit up. (The tale.)",
  tasks: "Baba Yaga’s orders: fill the barrel, sweep the yard, cook the supper, clean the poppy seed. (The tale has similar chores; this list is the game’s.)",
};
