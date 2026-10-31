// THE ARCHIVIST'S MARGINALIA and A EUROPEAN BESTIARY: text content only (no DOM).
//
// - NOTES are handwritten asides by the Archivist, the fictional keeper of this archive. They are flavour, written in
//   character, and never add a historical claim the case files do not already make.
// - BESTIARY entries describe beliefs as beliefs ("said to", "in the tales"). `basis` uses the Archive's own labels
//   (folklore | literary | mixed | natural) and `links` only names a legend of this site when the connection is real
//   (`rel` says what kind: the creature appears in it, or shares its land, or a later reading tied the two).
export const ARCHIVIST = "A.";   // the Archivist's initial, signed under every note

/** key: an Archive card id (legend-*, relics, seals, the secret) or "beast:<id>" */
export const NOTES = {
  "legend-woolpit": "Newburgh and Coggeshall agree on the green, and on very little else. Neither of them saw the children.",
  "legend-hoia": "My compass behaved itself in that forest. My watch did not. I have stopped asking it why.",
  "legend-skye": "I searched the collections for this tale and found nothing. I wrote it down anyway: some houses are owed a story.",
  "legend-babayaga": "Every version disagrees about her, except on one point: be polite to the hut.",
  "legend-sibilla": "La Sale climbed to the mouth of the cave and wisely went no further. I copied his page and did the same.",
  "legend-bathory": "Over three hundred statements, and most begin “I have heard it said”. Count the witnesses, not the rumours.",
  "woolpit-ink": "The ink is dry, the question is not.",
  "woolpit-bells": "Rung once, in the reading room. Nobody admits to hearing it.",
  "hoia-time": "Wound it twice. It keeps excellent time, just not ours.",
  "hoia-negative": "Hold it to the lamp. The lights are there; what they were is not.",
  "skye-other": "Played it on the archive’s harmonium. The note after it was not mine.",
  "babayaga-lantern": "Do not leave it on the shelf facing the door. It watches.",
  "babayaga-leave": "She is still warm from the pocket she travelled in.",
  "sibilla-notebook": "His hand is steadier than mine. He was writing for a duchess; I write for whoever comes next.",
  "sibilla-return": "The sand runs upward. I have learned not to turn it over.",
  "bathory-letter": "A wife writing to her husband about servants, linen and health. That is what frightens me about it.",
  "bathory-unanswered": "I filed this one under “open”. It has stayed open for four hundred years.",
  "seal-archivist": "Not a copy of any real seal. I carved it myself, and badly.",
  "secret-wisp": "It went out in my hand. I am told that is the lucky outcome.",
  "beast:blackshuck": "If he walks beside you on the lane, do not count his footsteps aloud.",
  "beast:brocken": "Our own sky is reckoned from that summit. I keep the window shut on the last night of April.",
  "beast:wisp": "Caught one, once. See the secret drawer of the Archive.",
  "beast:babayaga": "Filed between the case file and the cookery books, for reasons she would understand.",
};
export const noteFor = id => NOTES[id] || "";

export const BASIS = { folklore: "Folklore", literary: "Folklore & literature", mixed: "Folklore & documented report", natural: "Folklore & natural phenomenon" };

/**
 * id, name, also (other names), origin (country / region), basis, text (concise), links [{ legend|href, rel }]
 * art: key of the plate drawn in src/ui/bestiary-art.js
 */
export const BESTIARY = [
  { id: "babayaga", name: "Baba Yaga", also: "Баба-яга", origin: "Russia, Ukraine, Belarus · East Slavic tales", basis: "literary",
    text: "An old woman of the deep forest who lives in a hut that stands on chicken legs, flies in a mortar steering with the pestle and sweeps away her tracks with a broom. In the tales she may devour the careless, yet she also helps those who are brave and polite, as in “Vasilisa the Beautiful”, collected by Alexander Afanasyev.",
    links: [{ legend: "babayaga", rel: "She keeps the hut in this legend" }] },
  { id: "leshy", name: "The Leshy", also: "Леший, “the one of the forest”", origin: "Russia and the Slavic lands", basis: "folklore",
    text: "The master of the forest in East Slavic belief. He can be as tall as the trees or as small as the grass, mimics voices and leads travellers in circles until they turn their clothes inside out or put their shoes on the wrong feet. Herders and hunters made bargains and offerings to keep him friendly.",
    links: [{ legend: "babayaga", rel: "Same forest of the tales" }] },
  { id: "fate", name: "The Sibyl’s Fairies", also: "le Fate della Sibilla", origin: "Monti Sibillini · Marche and Umbria, Italy", basis: "folklore",
    text: "Local tradition says the maidens of the Sibyl came down from her mountain at night to dance with the young people of the villages around Foce, Montemonaco and Montegallo, and had to be back before dawn. They were known by the goat’s hooves hidden under their skirts. A long scar across Monte Vettore is still called the Fairies’ Road, said to have been made as they fled at daybreak.",
    links: [{ legend: "sibilla", rel: "They dance on the meadow in this legend" }] },
  { id: "wisp", name: "The Will-o’-the-Wisp", also: "ignis fatuus · Irrlicht · feu follet · fuochi fatui", origin: "Across Europe", basis: "natural",
    text: "Pale, wandering lights over marsh and forest, said to lead travellers off the path into bog or water. Different regions explained them as lost souls, mischievous spirits or the markers of buried treasure. Burning marsh gas has been proposed as a natural cause; it has never been fully demonstrated.",
    links: [{ href: "#card/secret-wisp", rel: "One drifts through the Archive’s own valley" }, { legend: "hoia", rel: "Unexplained lights are among the reports" }] },
  { id: "fairfolk", name: "The Fair Folk", also: "the Good Neighbours · the Gentry", origin: "Britain and Ireland", basis: "folklore",
    text: "The people of a hidden country beside our own, neither angels nor the dead, who could be generous or cruel and took offence easily. People avoided naming them directly and used polite names instead. Later writers have wondered whether the green children of Woolpit, who spoke of a twilit “St Martin’s Land”, were taken for visitors from such a place.",
    links: [{ legend: "woolpit", rel: "One later reading of this legend" }] },
  { id: "blackshuck", name: "Black Shuck", also: "the black dog of East Anglia", origin: "Norfolk and Suffolk, England", basis: "mixed",
    text: "A huge black dog with burning eyes said to walk the lanes and coasts of East Anglia, often taken as an omen. A pamphlet by Abraham Fleming tells how, in a storm on 4 August 1577, a black dog burst into the churches of Bungay and Blythburgh in Suffolk; the scorch marks on Blythburgh’s door are still pointed out as his.",
    links: [{ legend: "woolpit", rel: "Same county: Suffolk" }] },
  { id: "eachuisge", name: "The Each-uisge", also: "the water-horse", origin: "Scottish Highlands and Islands", basis: "folklore",
    text: "A water-horse of the sea lochs, held to be more dangerous than the river kelpie. It appears as a fine horse, or as a handsome young man, and invites a rider onto its back; the rider sticks fast to its skin and is carried down into the loch.",
    links: [{ legend: "skye", rel: "Same waters: the Highland lochs" }] },
  { id: "strigoi", name: "The Strigoi", also: "strigoi morți · strigoi vii", origin: "Romania", basis: "folklore",
    text: "In Romanian belief, the troubled dead who rise to harm the living (strigoi morți), and living people born to it whose souls wander at night (strigoi vii). They were blamed for sickness, failed harvests and dry cows; garlic on doors and windows was a common protection, especially on the eves of St George and St Andrew.",
    links: [{ legend: "hoia", rel: "Same land: Transylvania" }] },
  { id: "upir", name: "The Upír", also: "the revenant of the Slavic lands", origin: "Slovakia, Bohemia and Central Europe", basis: "mixed",
    text: "A dead man who would not stay in his grave, blamed for deaths in his village. Fear of such revenants spread through the Habsburg lands in the early 18th century, when officials reported exhumations, and the reports gave Western Europe the word “vampire”.",
    links: [{ legend: "bathory", rel: "Later fiction drew her into vampire lore; the historical case holds nothing supernatural" }] },
  { id: "banshee", name: "The Banshee", also: "bean sí, “woman of the fairy mound”", origin: "Ireland", basis: "folklore",
    text: "A woman of the otherworld whose keening is heard before a death in certain old Irish families. She may be glimpsed combing her long hair; in related Scottish tales a washer at the ford rinses the clothes of those about to die.",
    links: [] },
  { id: "brocken", name: "The Witches of the Brocken", also: "Walpurgisnacht", origin: "Harz Mountains, Germany", basis: "literary",
    text: "German folklore gathered the witches on the Brocken, the highest peak of the Harz, on Walpurgis Night (30 April to 1 May); Goethe set a scene of Faust there. The summit also names the Brocken spectre, a real effect of light: your own shadow cast on the mist, ringed with colour.",
    links: [{ href: "#intro", rel: "The Archive’s valley lies beneath its sky" }] },
];
export const BEAST = Object.fromEntries(BESTIARY.map(b => [b.id, b]));
/** bestiary entries tied to a legend of the site */
export const beastsOf = legend => BESTIARY.filter(b => b.links.some(l => l.legend === legend));
