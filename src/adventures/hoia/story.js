// THE HOIA BACIU FOREST - story data and rules (pure logic, no WebGL).
//
// ATTESTED vs REPORTED vs INVENTED
//  Hoia Baciu is a real forest on the western edge of Cluj-Napoca, Romania. What is told about it is modern folklore and
//  "paranormal" reputation, not documented fact: twisted trees, a round clearing where little grows, lights, cold spots, the
//  feeling of being watched, people who lose track of time. Two stories are told again and again: a shepherd (named Baciu in some
//  tellings) who walked in with a flock of about two hundred sheep and was never seen again, and a young girl who went missing
//  and came back years later, it is said, in the same clothes and with no memory of the time. In 1968 a man named Emil Barnea
//  took photographs over the clearing that were published as showing a disc-shaped object; what they show is still argued about.
//  Everything that happens to YOU in this adventure (the watch, the traces, the endings) is invented. The CODEX labels each thing.
import { applyFx } from "../../narrative/core.js";

export const SAVE_KEY = "moe.hoia.save.v1", ENDINGS_KEY = "moe.hoia.endings.v1";
export const initState = () => ({
  v: 1, trace: {}, mins: 0, ending: null, flags: {}, items: { lantern: true, watch: true }, clues: {}, notes: { n_real: true }, seen: {}, once: {},
});
export const TRACES = ["t1", "t2", "t3", "t4", "t5"];
export const count = s => TRACES.filter(t => s.trace[t]).length;
export const hasAll = s => count(s) === TRACES.length;
// the watch: it runs (one in-game minute every few real seconds, s.mins) but every trace makes it fall further behind
export const watchTime = s => { const t = ((21 * 60 + 40 + Math.floor(s.mins || 0) - count(s) * 13) % 1440 + 1440) % 1440; return `${String((t / 60) | 0).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

export const WHO = { narr: { name: "", style: "narr" }, you: { name: "You" }, voice: { name: "A voice in the trees" } };

/* ---------------- codex ---------------- */
export const CODEX = {
  n_real: { kind: "historical", title: "A real forest", text: "Hoia Baciu is a real forest, roughly 250 to 300 hectares depending on the source, on the western edge of Cluj-Napoca, in Transylvania, Romania. People walk, run and cycle there every day. Its fame as one of the world’s “most haunted” forests comes from stories, books and television, not from any proven phenomenon." },
  n_trees: { kind: "uncertain", title: "The twisted trees", text: "Some of the trees in parts of the forest grow bent and crooked. Legend calls it the work of the forest itself. Ordinary explanations proposed include wind, soil and the way young trees grow back after cutting. None of them has been settled for every tree." },
  n_barnea: { kind: "uncertain", title: "The 1968 photographs", text: "On 18 August 1968, in the middle of the day, the military technician Emil Barnea photographed what he and his friends took for a disc-shaped object over the round clearing. The pictures made the forest famous. Whether they show anything unusual is disputed. The camera you find in this game is invented." },
  n_shepherd: { kind: "folklore", title: "The shepherd and his flock", text: "The most told story says a shepherd walked into the forest with about two hundred sheep and none of them came out. Many tellings say the forest takes its name from him. It is folklore: no record of the event is known. The tally stick in this game is invented." },
  n_girl: { kind: "folklore", title: "The girl who came back", text: "Another tale tells of a little girl who went missing in the forest and returned about five years later, in the same clothes, with no memory of where she had been. It is told as local lore, not as a documented case. The ribbon in this game is invented." },
  n_cold: { kind: "folklore", title: "Cold spots and being watched", text: "Visitors often describe sudden cold, nausea, anxiety or the feeling of being watched. These are personal reports. A dark forest at night can do a great deal to anyone’s nerves." },
  n_clearing: { kind: "uncertain", title: "The round clearing", text: "Near the middle of the forest lies a roughly circular clearing where little grows. Soil tests have been reported, with no agreed explanation of anything unusual. Legend says it is where time and people go missing." },
};

/* ---------------- endings ---------------- */
export const ENDINGS = {
  time: { id: "time", kicker: "Ending 1 of 4", title: "The Hour That Went Missing", cls: "e-time",
    paragraphs: s => [
      "You stand in the middle of the circle and wait. Nothing happens. The lantern burns steadily, the trees keep their distance, and the cold sits on your shoulders like a coat.",
      "Then you look down at the watch. It says one minute past the time it said when you stepped in. Your phone, when you find it, says something else entirely.",
      s.trace.t4 ? "On the way out, the girl’s ribbon in your pocket is as bright as the day it was tied. You decide not to think about that." : "On the way out the path is exactly where you left it, which somehow makes it worse.",
      "Back in Cluj, the first tram of the morning is already running. You never manage to account for the missing hours, and after a while you stop telling people about them.",
    ],
    notes: ["INVENTED ending, built on the folklore of lost time in Hoia Baciu (the girl who returned after years with no memory). No such case is documented."] },
  lights: { id: "lights", kicker: "Ending 2 of 4", title: "One Frame Left", cls: "e-lights",
    paragraphs: s => [
      "The lights come over the clearing without a sound: three, then five, drifting just above the tree line. You lift the old camera, wind on, and press the shutter on the last frame.",
      "When you lower it the sky is empty. There is only the smell of resin, and your own breath in the lantern light.",
      "Weeks later the negative comes back from the lab. It shows the clearing, the dark trees, and above them a soft pale blur that could be a light, or a smudge, or nothing at all. Everyone who sees it is sure what it is. Nobody agrees.",
    ],
    notes: ["INVENTED ending, inspired by Emil Barnea’s photographs of 18 August 1968, which made the forest famous and are still argued over. The camera and your photograph are invented."] },
  shepherd: { id: "shepherd", kicker: "Ending 3 of 4", title: "Two Hundred and One", cls: "e-shepherd",
    paragraphs: s => [
      "You follow the sheep track out of the circle. It is easy, almost too easy, as if someone had walked it a moment ago. In the lantern light you count the notches on the tally stick as you go: two hundred, worn smooth.",
      "At the edge of the forest the track simply ends, in short grass, under an ordinary sky. Somewhere far behind you, very faintly, a flock is moving off between the trees.",
      "At home you look at the stick again. There are two hundred and one notches now. The last one is fresh and pale, and you do not remember cutting it.",
    ],
    notes: ["INVENTED ending, built on the folk tale of the shepherd who vanished in the forest with about two hundred sheep. The story is lore, not a documented event; the tally stick is invented."] },
  leave: { id: "leave", kicker: "Ending 4 of 4", title: "The Watching Trees", cls: "e-leave",
    paragraphs: s => [
      count(s) ? "You decide that you have seen enough, and walk back towards the city lights." : "You decide that the forest can keep its stories, and walk back towards the city lights.",
      "At the edge of the trees you look back once. The trunks stand crooked and still, and for a moment it feels exactly as if they are looking back at you.",
      "Then a dog barks somewhere in the suburbs, a car passes, and the feeling is gone. You get home safely. Some stories are better left in the forest.",
    ],
    notes: ["INVENTED ending. The feeling of being watched is one of the most common things visitors report; it is a feeling, not a fact. Leaving is always a real choice."] },
};
export const ENDING_ORDER = ["time", "lights", "shepherd", "leave"];

/* ---------------- dialogue nodes ---------------- */
const nodes = {};
const N = (id, who, text, o = {}) => { nodes[id] = { id, who, text, ...o }; return nodes[id]; };
const trace = (t, extra = {}) => ({ fx: (s, ev) => { if (!s.trace[t]) { s.trace[t] = true; ev.push({ t: "event", id: "trace", n: t }); } applyFx(s, { toast: `Trace ${count(s)} of 5 found. The journal has a new entry.`, ...extra }, ev); } });

N("sign", "narr", "A wooden sign at the edge of the trees, with a city map of trails. Somebody has scratched a circle into the middle of the forest and written the date beside it, then crossed the date out.\n\nBehind you the lights of Cluj-Napoca. In front of you, the dark. Your old wristwatch says twenty to ten.", { fx: { note: ["n_real"], toast: "Codex updated (J)." } });

N("t1", "narr", "Here the trees grow wrong. Trunks bend sideways at knee height and then turn upward again, as if each one had been stopped mid-step. Two of them have grown into a ring you could crawl through.", { choices: [
  { t: "Crawl through the ring of trunks.", fx: { flag: "ring" }, go: "t1b" },
  { t: "Walk around it.", go: "t1b" },
] });
N("t1b", "narr", s => s.flags.ring ? "On the other side the air is a degree colder, and the watch on your wrist ticks twice, then not at all, then carries on as if nothing had happened." : "You walk round. The bark is smooth and cold, and every crooked trunk seems to lean a little toward the middle of the forest.", trace("t1", { note: ["n_trees"], clue: "trees" }));

N("t2", "narr", "An old metal tripod stands in the fern, legs rusted into the ground, pointing at a gap in the canopy. On a stump beside it, someone has left a leather camera case. Inside: a heavy old film camera. The counter says one frame left.", { choices: [
  { t: "Take the camera.", fx: { item: "camera", flag: "camera" }, go: "t2b" },
  { t: "Leave it where it is.", go: "t2b" },
] });
N("t2b", "narr", s => (s.flags.camera ? "It is heavier than it looks, and cold. " : "You leave the case closed. ") + "Through the gap in the trees you can see the clearing’s edge, and above it a patch of sky with no stars in it.\n\n(In 1968 a man named Emil Barnea photographed something over this forest. What his pictures show is still argued about. This camera is invented.)", trace("t2", { note: ["n_barnea"], clue: "camera" }));

N("t3", "narr", "A narrow track cuts through the undergrowth, trodden flat by many small hooves. It runs toward the clearing and stops there. In the mud lies a hazel stick, notched along its length.", { choices: [
  { t: "Pick up the stick and count the notches.", fx: { item: "tally", flag: "tally" }, go: "t3b" },
  { t: "Leave the stick and look at the track.", go: "t3b" },
] });
N("t3b", "narr", s => (s.flags.tally ? "Two hundred notches, cut by a careful hand, one for each animal. " : "The prints are small and sharp and very many, all going one way. ") + "Far off, for a second, you are sure you hear a sheep bell. Then only wind.\n\n(The tale of a shepherd who vanished here with about two hundred sheep is folklore. The stick is invented.)", trace("t3", { note: ["n_shepherd"], clue: "flock" }));

N("t4", "narr", "On a low branch, at the height of a child’s hand, a red ribbon is tied in a neat bow. It is bright, clean and dry, though everything around it is wet with dew.", { choices: [
  { t: "Untie the ribbon.", fx: { item: "ribbon", flag: "ribbon" }, go: "t4b" },
  { t: "Leave it tied.", fx: { flag: "left_ribbon" }, go: "t4b" },
] });
N("t4b", "narr", s => (s.flags.ribbon ? "The silk is warm, as if it had just been in someone’s hair. " : "You leave it where somebody tied it. ") + "There is a tale here of a little girl who went into the forest and came back five years later, in the same clothes, remembering nothing.\n\n(Local lore, not a documented case. The ribbon is invented.)", trace("t4", { note: ["n_girl"], clue: "ribbon" }));

N("t5", "narr", "You walk into cold as if into water. Your breath turns white in the lantern light. Behind you a twig cracks, then another, closer, and stops when you stop.", { choices: [
  { t: "Turn round and raise the lantern.", fx: { flag: "turned" }, go: "t5b" },
  { t: "Keep very still and listen.", go: "t5b" },
] });
N("t5b", "narr", s => (s.flags.turned ? "Nothing. Only trunks, very close together, and the lantern light shaking in your hand. " : "Nothing moves. The silence is so complete you can hear your own heart. ") + "The feeling of being watched does not go away; it just stops pretending.\n\n(Cold spots and the sense of being watched are the most reported things in Hoia Baciu. They are reports, not facts.)", trace("t5", { note: ["n_cold"], clue: "cold" }));

N("circle_early", "narr", s => `The clearing opens in front of you: almost perfectly round, ringed by black trees. The grass in it is short and thin and the ground is bare in patches. Something tells you to come back when you know the forest better.\n\n(You have found ${count(s)} of the 5 traces. Find at least 3 before you step in.)`, { fx: { note: ["n_clearing"] } });
N("circle", "narr", s => `You step into the round clearing. The wind stops at its edge. ${s.trace.t3 ? "The sheep track runs straight across it and out the far side, into trees that were not there a moment ago. " : ""}Above the tree line, pale lights are drifting${s.flags.camera ? ", and the camera is heavy round your neck" : ""}.`, { fx: { note: ["n_clearing"] }, choices: [
  { t: "Stand in the centre and wait.", go: "end_time" },
  { t: "Raise the camera to the lights.", if: s => !!s.flags.camera, go: "end_lights" },
  { t: "Follow the sheep track out of the circle.", if: s => !!s.flags.tally, go: "end_shepherd" },
  { t: "Step back out of the circle.", go: null },
] });

N("leave_ask", "narr", s => count(s) >= 3 ? "The trail back to the city is just behind you. You have come a long way in. Do you leave the forest now?" : "The trail back to the city is just behind you. Do you leave the forest, and its stories, behind?", { choices: [
  { t: "Leave the forest.", go: "end_leave" },
  { t: "Stay a little longer.", go: null },
] });

const endFx = id => (s, ev) => { s.ending = id; applyFx(s, { event: "ending" }, ev); };
N("end_time", "narr", "…", { fx: endFx("time") });
N("end_lights", "narr", "…", { fx: endFx("lights") });
N("end_shepherd", "narr", "…", { fx: endFx("shepherd") });
N("end_leave", "narr", "…", { fx: endFx("leave") });
export const NODES = nodes;

/* ---------------- rules ---------------- */
export function objectAvailable(id, s) {
  if (TRACES.includes(id)) return !s.trace[id];
  return id === "sign" || id === "circle" || id === "leave";
}
export function objectNode(id, s) {
  if (id === "circle") return count(s) >= 3 ? "circle" : "circle_early";
  if (id === "leave") return "leave_ask";
  return id;
}
export const labelFor = id => ({ sign: "Read the trail sign", t1: "Look at the twisted trees", t2: "Examine the tripod", t3: "Follow the track", t4: "Look at the ribbon", t5: "Stop in the cold", circle: "Step into the clearing", leave: "Leave the forest" }[id] || "Interact");
export function objective(s) {
  const n = count(s);
  if (s.ending) return "";
  if (n < 3) return `Look for traces of the forest’s stories (${n} / 5). Follow the pale lights between the trees.`;
  if (n < 5) return `The clearing will let you in now (${n} / 5 traces). Or keep searching the forest.`;
  return "You have found every trace. Go to the round clearing in the middle of the forest.";
}
export const defaultEnding = s => s.ending || "leave";
export const CLUE_TEXT = {
  trees: "The twisted grove: trunks bent at knee height, all leaning toward the middle of the forest. (Real trees, uncertain cause.)",
  camera: "The tripod: an old camera with one frame left, aimed at the sky over the clearing. (Inspired by the 1968 photographs; the camera is invented.)",
  flock: "The sheep track: many small hooves, all going one way, toward the clearing. (Folklore of the vanished shepherd; invented scene.)",
  ribbon: "The ribbon: bright and dry on a wet branch, at a child’s height. (Folklore of the girl who came back; invented object.)",
  cold: "The cold spot: breath turns white, and something stops when you stop. (A common report; invented scene.)",
};
