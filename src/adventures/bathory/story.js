// ELIZABETH BÁTHORY — THE BLOOD COUNTESS: story, evidence and rules (pure logic, no DOM, no WebGL; tested from Node).
//
// HISTORY vs LEGEND vs INVENTION (every codex entry and every piece of evidence is labelled; nothing disputed is told as fact)
//  Historical: Elizabeth (Erzsébet) Báthory, born 7 August 1560 at Nyírbátor, married Ferenc Nádasdy on 8 May 1575, ran the
//  family's estates while he fought the Ottomans, widowed in 1604; King Matthias II had the Palatine György Thurzó investigate
//  her in 1610; notaries collected statements from March 1610 (52 by October, more than 300 by 1611), many of them hearsay;
//  she and four servants were arrested at the end of December 1610; the servants (Ilona Jó, Dorottya Szentes, Katarína Benická,
//  János Újváry) were tried in January 1611, three executed and one imprisoned for life; she was never tried; her son Pál and her
//  sons-in-law Miklós Zrínyi and György Drugeth agreed with Thurzó on confinement; she made a will in September 1610 and passed her
//  estates to her children; Thurzó wrote of a walled-up room, while records of a church visitation in July 1614 suggest house
//  arrest within the castle; the King repeatedly asked for a trial; she died at Čachtice on 21 August 1614.
//  Disputed: the figure of 650 victims (one servant's report of a book nobody produced); the weight of the Crown's debt to the
//  Nádasdy family (about 18,000 florins in some historians' accounts) as a motive; whether the case was a political frame-up.
//  Legend: the blood baths (first printed in 1729 by László Turóczi; absent from the testimonies, published in 1817), the
//  "Blood Countess", the walled-in countess, the vampire.
//  Invented for this game: the player (a clerk of the Hungarian Chamber sent in July 1614), Lőrinc Vass, Marta and her daughter
//  Anka, Gergely, Zuzana, Pavol, Castellan Orbán, Ilka; the household register, the burial register, the comb, every line of
//  dialogue (Elizabeth's included) and the four reports you can write.
import { applyFx } from "../../narrative/core.js";

export const SAVE_KEY = "moe.bathory.save.v1", ENDINGS_KEY = "moe.bathory.endings.v1", FINDS_KEY = "moe.bathory.finds.v1";
// act: 1 the village -> 2 the castle -> 3 the investigation (after meeting her) -> 4 the night of the report. area: village | castle | inside
export const initState = () => ({
  v: 1, act: 1, area: "village", know: 0, susp: 0, trust: 0, skin: 0, ending: null,
  rel: {}, flags: {}, items: { commission: true }, words: {}, clues: {}, notes: { n_frame: true, n_eb: true }, seen: {}, once: {}, links: {},
});

/* ---------------- evidence ---------------- */
// kind: what it is; rel: how far it can be trusted (shown to the player); basis: historical | disputed | legend | invented | observed;
// tags: acc (supports the accusations) | pol (political / financial interests) | doubt (undermines certainty) | ctx (context)
export const EVIDENCE = {
  ev_king: { title: "The King’s letter", kind: "Official letter", rel: "Copy of a royal letter", basis: "historical", tags: ["pol"], where: "Given by the Palatine’s secretary",
    date: "Vienna, spring 1614", text: "King Matthias II writes again to the Palatine: the widow Báthory must be brought to trial, as the law requires. This is not the first such letter. The Palatine has found a reason to delay every time." },
  ev_walled: { title: "The Palatine’s description", kind: "Official letter", rel: "Written by the man who arrested her", basis: "historical", tags: [], where: "Shown by the Palatine’s secretary",
    date: "Copy of a letter of Palatine György Thurzó", text: "“She is kept in a walled-up chamber, the windows bricked, with a small opening through which food is passed.” The secretary calls it a merciful arrangement." },
  ev_marta: { title: "Marta’s daughter", kind: "Testimony", rel: "A mother’s grief; she saw nothing herself", basis: "invented", tags: ["acc"], where: "Marta, at the market",
    date: "Told in July 1614", text: "Marta’s daughter Anka went into service at the castle in 1607, fifteen years old. In the spring of 1608 a castle servant came to say she had died of a fever and was already buried. Marta was never shown the grave." },
  ev_rumour: { title: "The blood-bath story", kind: "Rumour", rel: "Nobody who tells it saw anything", basis: "legend", tags: [], where: "Overheard at the market",
    date: "Village talk", text: "“She bathes in the blood of girls to keep her skin young.” Everyone has heard it; nobody knows who said it first. (In history, this story first appears in print in 1729, more than a century later.)" },
  ev_gergely: { title: "Gergely’s memory", kind: "Testimony", rel: "A loyal old servant of the family", basis: "invented", tags: ["ctx"], where: "Old Gergely, by the well",
    date: "Told in July 1614", text: "For twenty years she ran the Nádasdy estates while her husband fought the Turks: the harvests, the accounts, the lawsuits, the defence of the villages. She paid for poor boys to study. She was hard with servants, he says — every great lady was — and harder than most." },
  ev_burials: { title: "The burial register", kind: "Parish record", rel: "A written record, but brief and partial", basis: "invented", tags: ["acc"], where: "The church, kept by Pavol the sexton",
    date: "1602–1610", text: "Between 1602 and 1610, eleven entries read “a girl from the castle” or “a maid of the lady”. Four of them add “buried at night” or “without the rites”. One, in April 1608, reads: “Anka, from the castle, of a fever.”" },
  ev_zuzana: { title: "Zuzana’s account", kind: "Testimony", rel: "An eyewitness of the household, not of any death", basis: "invented", tags: ["acc"], where: "Zuzana, at the wash-place",
    date: "Told in July 1614", text: "She washed the castle linen for three years. She saw girls with bruises and burns, heard crying behind doors, saw two carried out sick who did not come back. She never saw anyone killed. “I was not asked in 1610,” she says. “Nobody asks the washerwoman.”" },
  ev_testimonies: { title: "The witness statements", kind: "Investigation record", rel: "Hundreds of statements, many of them hearsay", basis: "historical", tags: ["acc", "doubt"], where: "The chest in the great hall",
    date: "March 1610 – 1611", text: "Notaries of the Palatine took statements from more than three hundred people. Many accuse the countess of cruelty to her maids and of deaths. Many repeat what the witness “heard from others”. Few describe what they saw with their own eyes." },
  ev_servants: { title: "The servants’ confessions", kind: "Trial record", rel: "Obtained under torture", basis: "historical", tags: ["acc"], where: "The lectern in the library",
    date: "January 1611", text: "Four of her household — Ilona Jó, Dorottya Szentes, János Újváry and Katarína Benická — were interrogated under torture. They described beatings and other cruelties against the maids and named their mistress as the one who ordered them." },
  ev_verdict: { title: "The verdict of January 1611", kind: "Trial record", rel: "A court’s judgement on the servants alone", basis: "historical", tags: ["acc"], where: "A shelf in the library",
    date: "January 1611", text: "Jó and Szentes were condemned to death by burning; Újváry was beheaded; Benická was sentenced to life imprisonment. The court called the countess guilty of the crimes — yet she herself was never summoned, heard or tried." },
  ev_650: { title: "The book of six hundred and fifty", kind: "Testimony", rel: "A report of a report; the book was never produced", basis: "disputed", tags: ["doubt"], where: "Ilka, quoting older servants",
    date: "From the 1611 statements", text: "A servant named Zsuzsanna told the investigators that an official, Jakab Szilvássy, had seen in one of the countess’s books a list of 650 names. No such book was ever produced, and Szilvássy did not mention it in his own statement." },
  ev_register: { title: "The household register", kind: "Household record", rel: "Kept by the castle clerks; incomplete", basis: "invented", tags: ["acc", "doubt"], where: "The writing desk in the library",
    date: "1595–1610", text: "Year by year, the maids hired for the household: dozens over fifteen years, not hundreds. Most have “sent home” or “married” beside their names. Nine have “died”. Fourteen have nothing at all — among them “Anka, from Csejte, 1607”." },
  ev_letter: { title: "A letter to her husband", kind: "Private letter", rel: "In her own hand; says nothing of the accusations", basis: "invented", tags: ["ctx"], where: "Her writing desk",
    date: "Sárvár, 1596", text: "“My dear lord, the children are well, God be thanked, and Anna has a new tooth. The wine from Csejte is better this year. I have sent the steward to settle the matter of the mill. Come home whole.” Practical, warm, entirely ordinary." },
  ev_will: { title: "Her will and settlement", kind: "Legal document", rel: "A genuine legal act", basis: "historical", tags: ["pol"], where: "The chest at the foot of her bed",
    date: "September 1610 and late 1610", text: "Months before her arrest she made her will, and then passed her estates to her children: Pál, Anna (wife of Miklós Zrínyi) and Katalin (wife of György Drugeth). Whatever happened to her, the lands would stay in the family." },
  ev_family: { title: "The family’s agreement", kind: "Correspondence", rel: "Letters between powerful men", basis: "historical", tags: ["pol"], where: "The locked chest in the storeroom",
    date: "1610–1611", text: "The Palatine, her son Pál Nádasdy and her sons-in-law Zrínyi and Drugeth discuss her fate. First a convent was proposed, then confinement for life at Csejte. No public trial: the family’s honour and its property would be spared." },
  ev_debt: { title: "The Crown’s debt", kind: "Accounts", rel: "Historians disagree on what it proves", basis: "disputed", tags: ["pol"], where: "The Nádasdy accounts, storeroom",
    date: "Accounts to 1610", text: "Ferenc Nádasdy lent large sums to the Crown for the war against the Turks. Some historians put the debt still owed to his widow at nearly 18,000 florins, and note that she pressed the court for it. Others argue it gave the King little real motive." },
  ev_ilka: { title: "Ilka’s account", kind: "Testimony", rel: "Came after the arrest; repeats what others say", basis: "invented", tags: ["doubt"], where: "Ilka, in the dining room",
    date: "Told in July 1614", text: "Ilka came to the castle in 1612. Everything she knows about the countess’s crimes she heard from older servants, who heard it from others. What she has seen: a quiet old lady who walks in the gallery every evening and complains of the cold." },
  ev_comb: { title: "The comb in the passage", kind: "Object", rel: "Physical, but whose?", basis: "invented", tags: ["acc", "doubt"], where: "The walled passage behind the library",
    date: "Undated", text: "A bone comb in a dusty niche at the end of a walled-up passage, the initials “D. Sz.” burnt into the handle. Beside it, a few coins and a rosary. Nothing else. No bones, no stains: only a place where someone hid something." },
  ev_freely: { title: "What you saw yourself", kind: "Your own observation", rel: "First-hand", basis: "observed", tags: ["doubt"], where: "Her apartments",
    date: "July 1614", text: "The countess received you in her own apartments — a bedchamber, a writing desk, a window onto the valley — and walks in the gallery when she pleases. Whatever her confinement is, it is not a walled cell." },
};
export const EVIDENCE_ORDER = Object.keys(EVIDENCE);
export const BASIS_TAG = { historical: "Historical record", disputed: "Disputed", legend: "Later legend", invented: "Invented for this game", observed: "Your observation" };

/* ---------------- connections between pieces of evidence ---------------- */
// type: corroborates | contradicts | motive | context ; tag counts toward a conclusion
export const LINKS = [
  { id: "l_hearsay", a: "ev_testimonies", b: "ev_servants", type: "corroborates", tag: "acc", text: "The village’s statements and the servants’ confessions accuse her of the same things, in the same terms." },
  { id: "l_anka", a: "ev_marta", b: "ev_burials", type: "corroborates", tag: "acc", text: "Anka is in the burial register: April 1608, “from the castle, of a fever”. Marta was told the truth about the date, at least." },
  { id: "l_wash", a: "ev_zuzana", b: "ev_burials", type: "corroborates", tag: "acc", text: "Zuzana saw sick girls carried out; the register records girls from the castle buried at night. Two independent sources point the same way." },
  { id: "l_blank", a: "ev_marta", b: "ev_register", type: "corroborates", tag: "acc", text: "“Anka, from Csejte, 1607”: in the household register her departure is left blank — the castle never wrote down what became of her." },
  { id: "l_court", a: "ev_servants", b: "ev_verdict", type: "context", tag: "acc", text: "The court took the confessions as proof, and called the countess guilty on their strength — without ever hearing her." },
  { id: "l_motive", a: "ev_king", b: "ev_debt", type: "motive", tag: "pol", text: "The King demands a trial. A conviction could have stripped her of her property — and some historians argue, of the money he owed her." },
  { id: "l_lands", a: "ev_will", b: "ev_family", type: "motive", tag: "pol", text: "She passed her lands to her children before her arrest; her son and sons-in-law then agreed with the Palatine that she should never be tried." },
  { id: "l_spared", a: "ev_family", b: "ev_verdict", type: "motive", tag: "pol", text: "The servants were burned within days of the arrest; the mistress they accused was spared any trial, as her family and the Palatine had agreed." },
  { id: "l_baths", a: "ev_rumour", b: "ev_testimonies", type: "contradicts", tag: "doubt", text: "Not one of the hundreds of statements mentions bathing in blood. The most famous part of the story is the one the records do not contain." },
  { id: "l_count", a: "ev_650", b: "ev_register", type: "contradicts", tag: "doubt", text: "The household register lists dozens of maids over fifteen years, not hundreds. Six hundred and fifty does not fit the castle’s own books." },
  { id: "l_chain", a: "ev_650", b: "ev_ilka", type: "context", tag: "doubt", text: "Ilka heard of the 650 from women who heard it from Zsuzanna, who heard it from Szilvássy, who never confirmed it. Every link is a rumour." },
  { id: "l_cell", a: "ev_walled", b: "ev_freely", type: "contradicts", tag: "doubt", text: "The Palatine wrote of a walled-up room with a hatch for food. You found her in her own apartments, walking in her gallery. Someone’s account is not true." },
  { id: "l_dorka", a: "ev_comb", b: "ev_servants", type: "contradicts", tag: "doubt", text: "“D. Sz.”: Dorottya Szentes, called Dorka, one of the condemned servants. The hiding place may have been hers, not her mistress’s — and her confession named her mistress." },
  { id: "l_manager", a: "ev_letter", b: "ev_gergely", type: "corroborates", tag: "ctx", text: "Her letter and Gergely’s memory agree: a literate, practical, demanding manager of a great estate. It proves nothing about the crimes — only that she was more than the legend." },
];
export const LINK_TYPE = { corroborates: "Corroborates", contradicts: "Contradiction", motive: "Motive", context: "Context" };
export const findLink = (a, b) => LINKS.find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a)) || null;

/* ---------------- counting the case ---------------- */
export const has = (s, id) => !!s.clues[id];
export const evidenceCount = s => EVIDENCE_ORDER.filter(id => s.clues[id]).length;
export const linkCount = s => LINKS.filter(l => s.links[l.id]).length;
const tagEv = (s, t) => EVIDENCE_ORDER.filter(id => s.clues[id] && EVIDENCE[id].tags.includes(t)).length;
const tagLinks = (s, t) => LINKS.filter(l => s.links[l.id] && l.tag === t).length;
export const caseState = s => ({
  acc: { ev: tagEv(s, "acc"), links: tagLinks(s, "acc"), needEv: 5, needLinks: 2 },
  pol: { ev: tagEv(s, "pol"), links: tagLinks(s, "pol"), needEv: 3, needLinks: 2 },
  doubt: { ev: tagEv(s, "doubt"), links: tagLinks(s, "doubt"), needEv: 0, needLinks: 2, needTotal: 8 },
});
export const monsterReady = s => { const c = caseState(s).acc; return c.ev >= c.needEv && c.links >= c.needLinks; };
export const conspiracyReady = s => { const c = caseState(s).pol; return c.ev >= c.needEv && c.links >= c.needLinks; };
export const unansweredReady = s => caseState(s).doubt.links >= 2 && evidenceCount(s) >= 8;
/** connecting two pieces of evidence (the investigation board): returns { link, isNew } or null */
export function connect(s, a, b, ev = []) {
  if (!s.clues[a] || !s.clues[b] || a === b) return null;
  const l = findLink(a, b); if (!l) return null;
  const isNew = !s.links[l.id]; if (isNew) { s.links[l.id] = true; if (l.tag === "doubt") s.know += 1; ev.push({ t: "link", id: l.id }); }
  return { link: l, isNew };
}

export const VILLAGE_TALKS = ["marta_1", "gergely_1", "sexton_1", "zuzana_1"];
export const talksHeard = s => VILLAGE_TALKS.filter(k => s.seen[k]).length;
export const canClimb = s => !!s.seen.secretary_1 && talksHeard(s) >= 2;
export const chambersOpen = s => evidenceCount(s) >= 4;
export const finalReady = s => s.act === 3 && evidenceCount(s) >= 10 && linkCount(s) >= 3;

export const WHO = {
  narr: { name: "", style: "narr" }, you: { name: "You" },
  secretary: { name: "Lőrinc Vass", role: "secretary to the Palatine" }, marta: { name: "Marta", role: "a market woman" }, gergely: { name: "Old Gergely", role: "once a steward of the Nádasdy estates" },
  sexton: { name: "Pavol", role: "the sexton" }, zuzana: { name: "Zuzana", role: "a washerwoman" }, castellan: { name: "Castellan Orbán", role: "keeper of Csejte castle" },
  ilka: { name: "Ilka", role: "a young maid" }, elizabeth: { name: "Elizabeth Báthory", role: "Countess, widow of Ferenc Nádasdy" },
};

/* ---------------- codex: historical | disputed | legend | invented ---------------- */
export const CODEX = {
  n_eb: { kind: "historical", title: "Elizabeth Báthory (1560–1614)", text: "Erzsébet Báthory was born on 7 August 1560 at Nyírbátor into one of the most powerful families of Hungary. On 8 May 1575 she married Ferenc Nádasdy. While he fought the Ottomans she ran the family’s estates and business. He died in 1604; she died at Čachtice (Csejte) on 21 August 1614." },
  n_frame: { kind: "invented", title: "Your role", text: "You are a clerk of the Hungarian Chamber sent to Csejte in July 1614 to report on the widow Báthory. The clerk, the secretary Lőrinc Vass, Marta, Anka, Gergely, Zuzana, Pavol, the castellan Orbán and Ilka are invented, and so is every line spoken in this game — Elizabeth’s included." },
  n_cachtice: { kind: "historical", title: "Čachtice / Csejte", text: "The castle stands on a limestone hill above the village of Čachtice (Hungarian: Csejte). Built in the thirteenth century and enlarged in the fifteenth and sixteenth, it was in Nyitra County of the Kingdom of Hungary; today it is in Slovakia. It has been a ruin since 1708. The village and castle you explore are free reconstructions." },
  n_investigation: { kind: "historical", title: "The investigation", text: "In 1610 King Matthias II charged the Palatine György Thurzó with investigating the accusations. From March 1610 notaries collected statements: 52 by October, more than 300 by 1611. Many witnesses reported what they had heard from others." },
  n_arrest: { kind: "historical", title: "The arrest", text: "At the end of December 1610 Thurzó came to Csejte and arrested the countess and four of her servants. She was never brought before a court." },
  n_trial: { kind: "historical", title: "The servants’ trial", text: "In January 1611 Ilona Jó, Dorottya Szentes, János Újváry and Katarína Benická were tried; their confessions had been taken under torture. Jó and Szentes were burned, Újváry beheaded, Benická imprisoned for life. The court described the countess as guilty, without hearing her." },
  n_family: { kind: "historical", title: "The family’s arrangement", text: "Thurzó settled her fate with her son Pál Nádasdy and her sons-in-law Miklós Zrínyi and György Drugeth: first a convent was discussed, then confinement for life at Csejte. Her property stayed in the family. The King repeatedly asked for a trial; Thurzó kept postponing it." },
  n_will: { kind: "historical", title: "Her will", text: "She wrote a will in September 1610 and, late in 1610, arranged for her estates to pass to her children." },
  n_confinement: { kind: "historical", title: "Walled in?", text: "Thurzó wrote that she was kept in a walled-up room. Records of a church visitation to Csejte in July 1614 suggest instead that she could move about within the castle — a house arrest. The bricked-in countess is part of the legend." },
  n_650: { kind: "disputed", title: "Six hundred and fifty", text: "The famous number comes from one servant, Zsuzsanna, who said an official had seen a list of 650 names in one of the countess’s books. The book was never produced and the official did not confirm it. The number has never been verified." },
  n_blood: { kind: "legend", title: "The blood baths", text: "The story that she bathed in the blood of girls to stay young first appeared in print in 1729, in László Turóczi’s “Tragica Historia”. The witness statements, published in 1817, never mention it. The rumour you hear in the village is placed there by this game, so you can test it against the records." },
  n_debt: { kind: "disputed", title: "The Crown’s debt", text: "Ferenc Nádasdy had lent money to the Crown for the Turkish wars; some historians put the sum owed to his widow at nearly 18,000 florins and see it as a motive for the King. Others reply that the debt was modest and that the King gained nothing from her confinement." },
  n_conspiracy: { kind: "disputed", title: "Victim or murderer?", text: "Historians such as László Nagy and Irma Szádeczky-Kardoss have argued that she was the victim of a politically and financially motivated frame-up. Others hold that the volume of testimony shows the accusations were substantially true. The debate is not closed." },
  n_legend: { kind: "legend", title: "The Blood Countess", text: "After her death the story grew: the blood baths, the vampire, the comparisons with Dracula, novels and films — among them Jozef Nižnánsky’s Slovak novel “Čachtická pani”, written before the Second World War. Much of what people “know” about her comes from this later legend." },
  n_portrait: { kind: "historical", title: "Her portrait", text: "The best-known portrait of Elizabeth Báthory, in the Hungarian National Museum, was probably painted in the first half of the seventeenth century — perhaps after her death. No one can be sure how faithful it is." },
  n_arms: { kind: "historical", title: "The Báthory arms", text: "The Báthory of Ecsed bore three horizontal teeth in their arms, often called dragon’s or wolf’s teeth. Her husband’s family, the Nádasdy, bore a duck among reeds. Both shields hang in the great hall of this game." },
  n_house: { kind: "invented", title: "The rooms of the castle", text: "The great hall, library, dining room, gallery, storeroom, her apartments and the walled passage are imagined. Arcades and sgraffito were common in the Renaissance houses of Upper Hungary; their use here is a free reconstruction." },
};
export const KIND_TAG = { historical: "Historical", disputed: "Disputed by historians", legend: "Later legend", invented: "Invented for this game" };

/* ---------------- endings: your report ---------------- */
const SOURCES = "What the sources can establish: Elizabeth Báthory was accused in 1610 on the strength of more than three hundred statements, many of them hearsay; four of her servants confessed under torture and were condemned in January 1611; she was never tried, and died in confinement at Čachtice on 21 August 1614. The blood baths first appear in print in 1729; the figure of 650 rests on one servant’s report of a book nobody produced. Whether political and financial interests shaped the case is still argued by historians.";
export const ENDINGS = {
  monster: { id: "monster", kicker: "Ending 1 of 4", title: "The Monster", cls: "e-monster",
    paragraphs: s => [
      "You write that the accusations are substantially proven. You list the statements, the confessions, the register’s empty columns" + (s.clues.ev_burials ? ", the girls buried at night" : "") + (s.links.l_anka || s.links.l_blank ? ", and a name: Anka, fifteen, from Csejte" : "") + ".",
      "The Chamber files your report. The King writes once more for a trial. The Palatine once more finds a reason to wait. On 21 August 1614 the countess complains of cold hands, and does not wake in the morning. No court will ever hear her.",
      s.flags.paid_marta ? "In the autumn you send Marta a copy of the one line about her daughter. It is not justice. She keeps it in the chest with Anka’s Sunday ribbon." : "Your report is copied, quoted, embroidered. Within a century there are blood baths in it that you never wrote. You would not recognise your countess.",
    ],
    notes: [`What you concluded: that the accusations were substantially true. Many historians share that view, resting on the sheer number of witnesses.`, SOURCES] },
  conspiracy: { id: "conspiracy", kicker: "Ending 2 of 4", title: "The Conspiracy", cls: "e-conspiracy",
    paragraphs: s => [
      "You write that the case against the widow Báthory cannot be separated from what her fall was worth to others: a King in her debt, a Palatine who arrested her and then refused to try her, a family that kept her lands by keeping her silent.",
      `Lőrinc Vass reads your report in the village inn, slowly, and folds it in four. “It will be filed,” he says. It is. ${s.flags.eliza_respect ? "The countess sends you, by the castellan, a single line: “You read the right ledgers. Now read them again.”" : "Nobody answers it."}`,
      "She dies in August. The money is never paid. Three hundred years later, historians open the same letters you opened, and argue about them as you did.",
    ],
    notes: ["What you concluded: that political and financial interests shaped the accusations. Some historians argue this; others think the testimony is too abundant to be explained by a plot.", SOURCES] },
  unanswered: { id: "unanswered", kicker: "Ending 3 of 4", title: "The Unanswered History", cls: "e-unanswered",
    paragraphs: s => [
      "You draw a line down the middle of the page. On the left: what the records establish. On the right: what they only repeat. The right-hand column is longer.",
      `You write about ${[s.links.l_baths && "the blood baths no witness mentioned", s.links.l_count && "six hundred and fifty names in a book nobody saw", s.links.l_cell && "a walled-up room that turned out to have a gallery", s.links.l_dorka && "a servant’s comb in a hiding place", s.links.l_chain && "a number passed from mouth to mouth"].filter(Boolean).slice(0, 3).join(", ") || "contradictions"}. And about the girls, who were real, and whose deaths nobody ever properly examined.`,
      "Your conclusion is one line: the truth cannot be established from these records. It is the only report on the countess that nobody ever quotes.",
    ],
    notes: ["What you concluded: that the evidence is contradictory and the full truth cannot be known. Many careful historians end in the same place.", SOURCES] },
  palatine: { id: "palatine", kicker: "Ending 4 of 4", title: "The Palatine’s Version", cls: "e-palatine",
    paragraphs: s => [
      `You sign the report Lőrinc Vass wrote for you${evidenceCount(s) > 3 ? ", though you had begun to read for yourself" : " before you ever climbed the hill"}. It says what the Palatine has said since 1610: an abominable case, handled with mercy and discretion, a noble family spared a public shame.`,
      "The secretary sands your signature and smiles. “History,” he says, “is mostly a question of who holds the pen. Today, as it happens, it was you.”",
      "She dies in August, in the castle above you. The story outlives everyone in it, and grows: the walled-up room, the blood, the six hundred and fifty. Your name is on the first page of it.",
    ],
    notes: ["INVENTED ending: no such report exists. It shows how an official version can become history without anyone examining it.", SOURCES] },
};
export const ENDING_ORDER = ["monster", "conspiracy", "unanswered", "palatine"];
export const REPORT_ENDINGS = ["monster", "conspiracy", "unanswered"];

/* ---------------- dialogue ---------------- */
const nodes = {};
const N = (id, who, text, o = {}) => { nodes[id] = { id, who, text, ...o }; return nodes[id]; };
const BYE = { t: "Leave the conversation.", go: null };

/* ===== ACT I — the village of Čachtice ===== */
N("start", "narr", "Čachtice — Csejte, in Nyitra County of the Kingdom of Hungary. July 1614.\n\nThe Hungarian Chamber has sent you, a junior clerk with a good hand and no reputation, to report on the widow of Ferenc Nádasdy, held for three and a half years in the castle on the hill. The King wants a trial. The Palatine does not. Everyone in Vienna wants a report. Above the roofs, the castle watches the road.", { fx: { note: ["n_cachtice", "n_investigation"] }, go: "start2" });
N("start2", "you", "Before I climb that hill I should learn what this village thinks — and find the Palatine’s man, who is expecting me at the inn.", { go: null });

N("secretary_1", "secretary", s => s.seen.secretary_1 ? "Still here? The castle is not going anywhere. Neither, I promise you, is the countess." : "The Chamber’s clerk! Lőrinc Vass, secretary to His Excellency the Palatine. You will want this — the King’s latest letter, so you know what Vienna is impatient about. And this: His Excellency’s own account of her confinement.", { fx: { clue: ["ev_king", "ev_walled"], note: ["n_arrest", "n_trial"] }, choices: [
  { t: "Why has there been no trial in three years?", go: "secretary_trial" },
  { t: "What do you expect my report to say?", go: "secretary_report" },
  { t: "Sign the report he has prepared, and go home.", go: "secretary_sign_ask" },
  BYE] });
N("secretary_trial", "secretary", "Because a trial would be a public shame for one of the first families of the kingdom, for her children, for the memory of her husband — a hero of the Turkish wars. His Excellency chose discretion. Her servants were punished. She is confined for life. What more would a trial give anyone, except the lawyers?", { fx: { note: "n_family" }, go: "secretary_1" });
N("secretary_report", "secretary", "To save you trouble, I have written it. Fair copy, Latin and Hungarian. It confirms the facts, praises His Excellency’s mercy, and recommends that matters stay as they are. You need only sign. The castle is a hard climb in July.", { fx: { flag: "offered_report" }, go: "secretary_1" });
N("secretary_sign_ask", "narr", "He slides the fair copy across the table, with the ink already uncorked. Every line is in place except your name.", { choices: [
  { t: "Sign it.", fx: { set: { ending: "palatine" } }, go: null },
  { t: "Not before I have seen for myself.", fx: { flag: "refused_report" }, go: "secretary_refused" }] });
N("secretary_refused", "secretary", "As you wish. It will keep. Ask for me at the inn when you are tired of climbing.", { go: null });

N("marta_1", "marta", s => s.seen.marta_1 ? "Did you go up there yet? Did you ask her?" : "You are the one from Vienna. Buy something or move along — no. Wait. You are going up there?", { choices: [
  { t: "What do people say about the countess?", go: "marta_say" },
  { t: "Did you know anyone who worked at the castle?", go: "marta_anka" },
  { t: "I will ask about Anka. I promise.", if: s => s.seen.marta_anka && !s.flags.paid_marta, fx: { flag: "paid_marta", rel: { marta: 2 } }, go: "marta_promise" },
  BYE] });
N("marta_say", "marta", "That she killed girls. That she bathes in their blood to keep young — my neighbour swears to it, and she has never been further than the mill. I don’t know about blood. I know about my daughter.", { fx: { clue: "ev_rumour", note: "n_blood" }, go: "marta_1" });
N("marta_anka", "marta", "Anka. Fifteen, and clever with a needle. She went up to serve in 1607 — good wages, a place in a great house. In the spring a man came down and said she had died of a fever and was already in the ground. I never saw where. Nobody from Vienna asked me in 1610. You are asking now.", { fx: { clue: "ev_marta" }, go: "marta_1" });
N("marta_promise", "marta", "She does not cry. She nods once, as if you had paid for something, and turns back to her onions.", { go: "marta_1" });

N("gergely_1", "gergely", "Sit, sit. My knees are older than the castle. You want to know about my lady? I served the Nádasdy family thirty years.", { choices: [
  { t: "What was she like?", go: "gergely_like" },
  { t: "And the accusations?", go: "gergely_acc" },
  BYE] });
N("gergely_like", "gergely", "Clever. Clever like a man is allowed to be. While my lord was away killing Turks she ran everything: harvests, rents, lawsuits, the soldiers on the walls. She read Latin and German and wrote her own letters. She paid for poor boys to go to school. She was hard. They were all hard. She was harder.", { fx: { clue: "ev_gergely", note: "n_eb" }, go: "gergely_1" });
N("gergely_acc", "gergely", "Girls died up there. I won’t tell you they didn’t. Girls died everywhere, of fevers, of beatings, of childbed. But six hundred? Blood in a bath? You don’t get to be as old as me believing everything you hear at a well. Ask who got her lands. Then ask who wanted them.", { fx: { know: 1 }, go: "gergely_1" });

N("sexton_1", "sexton", "Pavol, sexton. The pastor is away at the synod. You want the registers? Everyone from Vienna wants the registers, and nobody wants to read them properly.", { choices: [
  { t: "Show me the burials from the castle.", go: "sexton_burials" },
  { t: "Did the old pastor ever complain?", go: "sexton_pastor" },
  BYE] });
N("sexton_burials", "narr", "He opens a stained ledger on the font cover and turns the pages for you with a wetted thumb, 1602 to 1610. Here and there, the same words: “a girl from the castle”.", { fx: { clue: "ev_burials" }, go: "sexton_1" });
N("sexton_pastor", "sexton", "Complain! The old pastor quarrelled with the castle for years: girls brought down to be buried at night, coffins nobody would open, no rites. He wrote letters about it. Some say those letters began everything. Some say he had his own quarrels with her. Both can be true.", { fx: { know: 1 }, go: "sexton_1" });

N("zuzana_1", "zuzana", s => s.flags.zuzana_open ? "I told you what I saw. That is all of it." : "I have washing to do.", { choices: [
  { t: "I am not here to accuse anyone. I only want to know what you saw.", if: s => !s.flags.zuzana_open && (s.clues.ev_burials || s.flags.paid_marta), go: "zuzana_open" },
  { t: "You worked at the castle, didn’t you?", if: s => !s.flags.zuzana_open, go: "zuzana_refuse" },
  BYE] });
N("zuzana_refuse", "zuzana", "She beats a sheet against the stone, hard, and does not look up. “Ask the Palatine. He knows everything. He wrote it all down.”", { go: null });
N("zuzana_open", "zuzana", "She wrings the sheet out slowly. “Three years I washed their linen. I saw girls with bruises, with burns on their hands. I heard crying behind the doors. Twice I saw a girl carried out sick who never came back. I never saw anyone killed. I was not asked in 1610. Nobody asks the washerwoman.”", { fx: { clue: "ev_zuzana", flag: "zuzana_open" }, go: null });

N("road_wait", "narr", s => `The road to the castle climbs out of the village between vineyards and oak woods. ${s.seen.secretary_1 ? "" : "The Palatine’s secretary is waiting for you at the inn. "}You should know more before you climb (${talksHeard(s)} / 2 villagers heard).`, { go: null });
N("road_go", "narr", "The road climbs out of the village between vineyards and oak woods, and the castle grows above you with every bend: walls on walls, the old tower like a horseshoe, the light going amber on the limestone.", { choices: [
  { t: "Climb to the castle.", fx: { set: { act: 2, area: "castle" }, event: "act2" }, go: null },
  { t: "Not yet.", go: null }] });

/* ===== ACT II — the castle ===== */
N("castellan_1", "castellan", s => s.seen.castellan_1 ? (chambersOpen(s) ? "The countess knows you are here. She will receive you in her apartments, through the gallery." : "Read what you like. The countess will receive you when you know what you are asking.") : "The clerk from the Chamber. Orbán, castellan. Welcome to Csejte. You will find the records in the hall and the library; the storeroom is locked, the countess’s apartments more so. She has asked to see you — when you have read enough to ask her something worth answering.", { fx: { note: ["n_house", "n_arms"] }, choices: [
  { t: "Is she truly walled in?", go: "castellan_walled" },
  { t: "May I have the key to the storeroom?", if: s => !s.items.storekey, go: "castellan_key" },
  BYE] });
N("castellan_walled", "castellan", "He looks at you a long moment. “His Excellency’s letters say many things. I keep the keys. You will see.”", { go: "castellan_1" });
N("castellan_key", "castellan", s => s.clues.ev_king ? "The King’s own letter. Well — the Chamber has a right to the Nádasdy accounts, I suppose. Here. The chest of letters inside is the family’s; you will need her leave for that one." : "The storeroom holds the family’s accounts. Not for a clerk without the King’s authority.", { fx: (s, ev) => { if (s.clues.ev_king) applyFx(s, { item: "storekey" }, ev); }, go: "castellan_1" });

N("hall_chest", "narr", "A heavy chest below the dais, iron-bound, unlocked. Inside, tied in bundles by year and village, the copies of the statements taken by the Palatine’s notaries.", { fx: { clue: "ev_testimonies" }, go: null });
N("hall_fire", "narr", "The fire in the great hall is lit in July: the countess feels the cold, the castellan says. Above the mantel the Báthory arms — three teeth — and beside them the Nádasdy arms, a duck among reeds.", { fx: { note: "n_arms" }, go: null });
N("library_lectern", "narr", "On the lectern, a fat bound copy of the proceedings of January 1611, the servants’ confessions written out in a careful chancery hand. The margin notes that each was “examined under torture”.", { fx: { clue: "ev_servants", note: "n_trial" }, go: null });
N("library_shelf", "narr", "Between a Latin herbal and a German chronicle, a thin printed sheet: the sentence of the court, and its strange last paragraph, which calls the countess guilty and decides nothing about her.", { fx: { clue: "ev_verdict" }, go: null });
N("library_desk", "narr", "The household register, fifteen years of it, is in the drawer of the writing desk. Somebody has read it before you: there are thumbprints on the pages for 1607 and 1608. Behind the bookcase to your left, a draught moves the candle flame.", { fx: { clue: "ev_register", flag: "draught" }, go: null });
N("library_case", "narr", s => s.flags.draught ? "The draught comes from behind the bookcase. You run your hand along the carved frame — and one panel gives, swinging inward onto darkness and old air." : "A tall bookcase of dark oak: chronicles, sermons, books of accounts.", { fx: (s, ev) => { if (s.flags.draught) applyFx(s, { flag: "passage_open", event: "passage" }, ev); }, go: null });
N("passage_niche", "narr", "At the end of the walled passage, a niche in the stone. In it, wrapped in a rag: a bone comb with “D. Sz.” burnt into the handle, a few coins, a wooden rosary. Nothing else. No bones, no stains. Only a hiding place.", { fx: { clue: "ev_comb" }, go: null });
N("ilka_1", "ilka", s => s.seen.ilka_1 ? "The countess walks in the gallery every evening, you know. Like a ghost, but she complains like a grandmother." : "Oh! Sir — you gave me a fright. I’m Ilka. I lay the table and keep the fires. I came in 1612, after… after everything.", { choices: [
  { t: "What do the other servants say about her?", go: "ilka_say" },
  { t: "Is she ever allowed out of her rooms?", go: "ilka_rooms" },
  BYE] });
N("ilka_say", "ilka", "The old ones whisper that she killed six hundred and fifty girls. One of them says Zsuzsanna said a gentleman saw it written in a book. Nobody ever saw the book. I asked.", { fx: { clue: ["ev_650", "ev_ilka"], note: "n_650" }, go: "ilka_1" });
N("ilka_rooms", "ilka", "Allowed? She walks in the gallery every evening, and the castellan lets the priests in to see her. Last week they came from the bishop and talked to her for an hour. Walled in? Who said that?", { fx: { note: "n_confinement", know: 1 }, go: "ilka_1" });
N("store_accounts", "narr", "Ledgers of the Nádasdy estates, decades of them. In a separate wallet, notes of money lent to the Crown for the Turkish war, with the sums still owed added up, and added up again, in a woman’s hand.", { fx: { clue: "ev_debt", note: "n_debt" }, go: null });
N("store_chest", "narr", s => s.flags.eliza_leave ? "The family’s chest opens with the small key the countess gave you. Letters, sealed and unsealed: the Palatine to Pál Nádasdy, to Count Zrínyi, to Count Drugeth; their answers. A convent is proposed, then refused. Confinement for life. No trial. Her property is mentioned more often than she is." : "A locked chest carved with the Nádasdy duck among its reeds. The castellan said you would need her leave.", { fx: (s, ev) => { if (s.flags.eliza_leave) applyFx(s, { clue: "ev_family", note: ["n_family", "n_conspiracy"] }, ev); }, go: null });
N("chamber_desk", "narr", "Her writing desk: quills, sand, a little Venetian mirror, a bundle of letters to her husband tied with faded ribbon. The top one is from Sárvár, 1596.", { fx: { clue: "ev_letter", event: "letter" }, go: null });
N("chamber_chest", "narr", s => s.flags.eliza_leave ? "At the foot of the bed, the chest she told you about. Copies of her will of September 1610, and of the deeds by which, before the year was out, she gave her lands to her children." : "A chest at the foot of the canopied bed. It is not yours to open.", { fx: (s, ev) => { if (s.flags.eliza_leave) applyFx(s, { clue: "ev_will", note: "n_will" }, ev); }, go: null });
N("gallery_portrait", "narr", "A portrait of a young woman in black and gold, pale, with a high lace collar and pearls in her hair. The painter has made her very still. You cannot tell whether he liked her.", { fx: { note: "n_portrait" }, go: null });
N("chambers_locked", "narr", s => `The door to the countess’s apartments is shut, a guard beside it. “When the castellan says,” he grunts. (Evidence gathered: ${evidenceCount(s)} / 4.)`, { go: null });
N("store_locked", "narr", "The storeroom door is locked. The castellan has the key.", { go: null });

/* ===== the countess: the first meeting (opens Act III) ===== */
N("eliza_1", "elizabeth", "She is standing at the window when you come in, a small woman in black velvet with a white lace collar, a fortune in pearls in her hair. She does not turn at once.\n\n“You may stop pretending to admire the furniture. You are the Chamber’s clerk. Thurzó writes that I live in a walled-up room with a hole for my soup. Look around you, clerk. Does this look like a hole?”", { fx: { clue: "ev_freely", note: "n_confinement", set: { act: 3 } }, go: "eliza_open" });
N("eliza_open", "elizabeth", "Well? You have climbed my hill. Ask.", { choices: [
  { t: "I have come to hear your account, my lady.", once: "e_acc", go: "eliza_account" },
  { t: "Four of your servants confessed. They named you.", if: s => s.clues.ev_servants, once: "e_serv", go: "eliza_servants" },
  { t: "In the village they say you bathe in blood.", if: s => s.clues.ev_rumour, once: "e_blood", go: "eliza_blood" },
  { t: "The Crown owes your family a fortune.", if: s => s.clues.ev_debt, once: "e_debt", go: "eliza_debt" },
  { t: "A girl called Anka died here in 1608.", if: s => s.clues.ev_marta, once: "e_anka", go: "eliza_anka" },
  { t: "That is enough for today.", go: "eliza_q" }] });
N("eliza_account", "elizabeth", "My account. As if I had been asked for it in four years. Thurzó came at Christmas with soldiers, ate my supper, and took me up this hill. He heard three hundred people who had heard something. He did not hear me. Write that down first, clerk, before you write anything else.", { go: "eliza_open" });
N("eliza_servants", "elizabeth", "Confessed. On the rack a woman will confess to being a horse, if you ask her twice. Helena, Dorka, poor little Ficko — they said what the men with the irons wanted. Then they were burned so that nobody could ever ask them again. Convenient, wouldn’t you say?", { go: "eliza_open" });
N("eliza_blood", "elizabeth", "She laughs, a short, real laugh. “The village says the Turks have tails. Blood, for my skin? Look at my skin, clerk. I am fifty-three. If I had found a cure for that, the Emperor would have married me.”", { go: "eliza_open" });
N("eliza_debt", "elizabeth", "Now you are reading the right ledger. My husband lent the Crown money to fight the Turks, and the Crown found it easier to accuse his widow than to pay her. — Or perhaps not. Perhaps I am only an old woman who wants to be owed something. You will have to decide which, won’t you?", { fx: { rel: { elizabeth: 1 } }, go: "eliza_open" });
N("eliza_anka", "elizabeth", "She is silent long enough for the candle to gutter. “I had many maids. Some ran away. Some married. Some died — of fevers, of the pox, of their own foolishness. I do not remember every name. Does that make me a monster, or only a great lady? In Vienna, I think, they are the same thing.”", { fx: { flag: "asked_anka" }, go: "eliza_open" });
N("eliza_q", "elizabeth", "Now I will ask you something. When the King reads your report — will he be reading about me, or about himself?", { choices: [
  { t: "About you. That is my task.", go: "eliza_end_cold" },
  { t: "About whoever wrote the evidence.", fx: { rel: { elizabeth: 2 }, flag: "eliza_respect" }, go: "eliza_end_warm" },
  { t: "I don’t know yet.", fx: { rel: { elizabeth: 1 } }, go: "eliza_end_warm" }] });
N("eliza_end_cold", "elizabeth", s => (s.rel.elizabeth || 0) >= 1 ? "Honest, at least. Very well. My will and my deeds are in the chest at the foot of my bed, and the family’s letters are in the chest in the storeroom. Here is the little key. Read them, and then tell me what my task was." : "Then you will write what everyone writes. Go and do it. The castellan will show you out.", { fx: (s, ev) => { if ((s.rel.elizabeth || 0) >= 1) applyFx(s, { flag: "eliza_leave", toast: "The countess gave you leave to open her chests." }, ev); }, go: null });
N("eliza_end_warm", "elizabeth", "A clerk who reads. How unfashionable. My will and my deeds are in the chest at the foot of my bed, and my family’s letters in the chest in the storeroom — here is the little key. Read who wanted what. Then come back, when the candles are lit, and tell me what you will write.", { fx: { flag: "eliza_leave", toast: "The countess gave you leave to open her chests." }, go: null });
N("eliza_again", "elizabeth", "Not now. I walk in the gallery at this hour. Come back when you have finished reading — the castellan will send for you.", { go: null });

/* ===== ACT IV — the night of the report ===== */
N("summons", "castellan", "The castellan finds you with a candle in his hand. “Night has fallen. She asks for you. She says you will have finished reading by now, and that she would rather hear your verdict before Vienna does.”", { fx: { set: { act: 4 }, event: "act4" }, go: null });
N("eliza_final", "elizabeth", s => `The candles are lit. She sits by the cold stove with a shawl over the velvet${s.flags.eliza_respect ? ", and nods to the other chair" : ""}.\n\n“My castellan tells me you have read every page in this castle${s.clues.ev_comb ? " — and found a passage I had nearly forgotten myself" : ""}. Well, clerk? Ask your last questions. Then go and write.”`, { go: "eliza_final_q" });
N("eliza_final_q", "elizabeth", "Ask.", { choices: [
  { t: "The register: girls hired, and no line for when they left.", if: s => s.clues.ev_register, once: "f_reg", go: "eliza_f_register" },
  { t: "Dorottya Szentes left her comb in a walled passage.", if: s => s.clues.ev_comb, once: "f_comb", go: "eliza_f_comb" },
  { t: "Your family made sure you would never be tried.", if: s => s.clues.ev_family, once: "f_fam", go: "eliza_f_family" },
  { t: "Thurzó wrote that you are walled in. Why?", if: s => s.links.l_cell, once: "f_cell", go: "eliza_f_cell" },
  { t: "Did you do what they say?", once: "f_did", go: "eliza_f_did" },
  { t: "I have heard enough.", go: "eliza_f_end" }] });
N("eliza_f_register", "elizabeth", "Servants run away, clerk. Servants die of fever. And clerks love empty columns — you can write anything in an empty column. What do you see written in that one?", { go: "eliza_final_q" });
N("eliza_f_comb", "elizabeth", "Dorka. She was with me twenty years. She hid her savings in the walls like a squirrel — she thought I did not know. What did you imagine she kept there? Bones? Or only a frightened woman’s coins, for the day the men with irons came?", { go: "eliza_final_q" });
N("eliza_f_family", "elizabeth", "My family made sure I would keep breathing. And that they would keep my lands. Both things can be love, clerk. Both things can be the opposite. You may write whichever suits Vienna.", { go: "eliza_final_q" });
N("eliza_f_cell", "elizabeth", "Because a woman in a walled room is a better story than a widow in an armchair. Thurzó knows that the King reads stories, not ledgers. And because a jailer who bricks up the windows sounds very stern, and very merciful, at the same time.", { go: "eliza_final_q" });
N("eliza_f_did", "elizabeth", s => `She looks at you for a long time, and you understand that she has been asked this before, by better men, and has never answered. “Which part, clerk? That I was hard? Yes. That girls died in my houses? Yes. That I am what they will say I was? ${s.flags.eliza_respect ? "That, you will decide. You are the first one who has asked me instead of telling me." : "That, they decided before you were born."}”`, { go: "eliza_final_q" });
N("eliza_f_end", "elizabeth", "Then go and write it. They will all read it, except me. — Leave the candle. I feel the cold.", { fx: { flag: "final_done" }, go: null });

N("report", "narr", s => `The writing desk in the library. Paper, sand, the Chamber’s seal. ${s.flags.final_done ? "Everything you have learned is in your journal." : "You could write now — or first finish what you came to do."}\n\nWhat will your report conclude?${!monsterReady(s) && !conspiracyReady(s) && !unansweredReady(s) ? "\n\n(You do not yet have the evidence to defend any conclusion of your own. Open the investigation board in your journal (J): gather evidence and connect the pieces that belong together.)" : ""}`, { choices: [
  { t: "The accusations are substantially proven.", if: s => s.flags.final_done && monsterReady(s), fx: { set: { ending: "monster" } }, go: null },
  { t: "Political and financial interests shaped the accusations.", if: s => s.flags.final_done && conspiracyReady(s), fx: { set: { ending: "conspiracy" } }, go: null },
  { t: "The truth cannot be established from these records.", if: s => s.flags.final_done && unansweredReady(s), fx: { set: { ending: "unanswered" } }, go: null },
  { t: "Sign the Palatine’s report as it was written for you.", fx: { set: { ending: "palatine" } }, go: null },
  { t: "Not yet.", go: null }] });

export const NODES = nodes;
export const ENTRIES = ["start", "secretary_1", "marta_1", "gergely_1", "sexton_1", "zuzana_1", "road_wait", "road_go", "castellan_1", "hall_chest", "hall_fire", "library_lectern", "library_shelf", "library_desk", "library_case",
  "passage_niche", "ilka_1", "store_accounts", "store_chest", "chamber_desk", "chamber_chest", "gallery_portrait", "chambers_locked", "store_locked", "eliza_1", "eliza_again", "summons", "eliza_final", "report"];

/* ---------------- world interaction rules ---------------- */
export function talkNode(id, s) {
  if (s.ending) return null;
  if (s.area === "village") return { secretary: "secretary_1", marta: "marta_1", gergely: "gergely_1", sexton: "sexton_1", zuzana: "zuzana_1" }[id] || null;
  if (id === "castellan") return s.area !== "village" ? "castellan_1" : null;
  if (id === "ilka") return s.area === "inside" ? "ilka_1" : null;
  if (id === "elizabeth") return s.area !== "inside" ? null : s.act === 2 && chambersOpen(s) ? "eliza_1" : s.act === 4 && !s.flags.final_done ? "eliza_final" : s.act === 3 ? "eliza_again" : null;
  return null;
}
const ONCE_OBJ = ["hall_chest", "library_lectern", "library_shelf", "library_desk", "passage_niche", "store_accounts", "chamber_desk", "gallery_portrait", "hall_fire"];
export function objectAvailable(id, s) {
  if (s.ending) return false;
  if (id === "road") return s.act === 1;
  if (id === "door_in") return s.area === "castle";
  if (id === "door_out") return s.area === "inside";
  if (s.area !== "inside") return false;
  if (ONCE_OBJ.includes(id)) return !s.seen[id];
  if (id === "library_case") return !s.flags.passage_open;
  if (id === "store_chest") return !s.clues.ev_family;
  if (id === "chamber_chest") return !s.clues.ev_will;
  if (id === "chambers_door") return !chambersOpen(s);
  if (id === "store_door") return !s.items.storekey;
  if (id === "report") return s.act >= 2;
  return false;
}
export function objectNode(id, s) {
  if (id === "road") return canClimb(s) ? "road_go" : "road_wait";
  if (id === "chambers_door") return "chambers_locked";
  if (id === "store_door") return "store_locked";
  return id;
}
export const labelFor = (id, s) => ({
  secretary: "Talk to Lőrinc Vass", marta: "Talk to Marta", gergely: "Talk to Old Gergely", sexton: "Talk to Pavol", zuzana: "Talk to Zuzana", castellan: "Talk to the castellan", ilka: "Talk to Ilka",
  elizabeth: "Speak to the countess", road: "Take the road to the castle", door_in: "Enter the palace", door_out: "Go out to the courtyard",
  hall_chest: "Open the chest", hall_fire: "Look at the fireplace", library_lectern: "Read the bound proceedings", library_shelf: "Search the shelves", library_desk: "Open the desk drawer",
  library_case: s.flags.draught ? "Search the bookcase" : "Look at the bookcase", passage_niche: "Search the niche", store_accounts: "Read the accounts", store_chest: "Open the family chest",
  chamber_desk: "Look at her writing desk", chamber_chest: "Open the chest", gallery_portrait: "Look at the portrait", chambers_door: "Knock at her door", store_door: "Try the storeroom door", report: "Write your report",
}[id] || "Interact");

export function objective(s) {
  if (s.ending) return "";
  if (s.act === 1) {
    if (!s.seen.secretary_1) return "Find the Palatine’s secretary at the inn on the square, and hear the village.";
    return talksHeard(s) < 2 ? `Ask the villagers about the countess (${talksHeard(s)} / 2 heard).` : "Take the road to the castle at the north end of the village — or keep listening.";
  }
  if (s.act === 2) {
    if (s.area === "castle") return "Speak to the castellan in the courtyard, then enter the palace.";
    return chambersOpen(s) ? "The countess will receive you. Her apartments are through the gallery, east of the hall." : `Search the hall, the library and the dining room for records (${evidenceCount(s)} / 4 pieces of evidence).`;
  }
  if (s.act === 3) {
    const n = evidenceCount(s), l = linkCount(s);
    return n >= 10 && l >= 3 ? "Wait for the countess to send for you." : `Investigate: gather evidence (${n} / 10) and connect related pieces on the board in your journal, J (${l} / 3).`;
  }
  if (s.act === 4) return s.flags.final_done ? "Write your report at the desk in the library." : "The countess is waiting in her apartments.";
  return "";
}
export const defaultEnding = s => s.ending || "palatine";
