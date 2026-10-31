// THE CONSTELLATIONS OF THE LEGENDS (art, not astronomy): each legend has its own asterism in the page sky, rising in the
// compass direction of the place where it happened, as seen from the reference place of the valley (astro.REF).
// Figures are drawn in degrees on the sky (u to the right, v up), around an anchor (azimuth = true bearing of the place,
// altitude = how far it is: the farther the legend, the lower it stands towards its horizon).
import { REF, bearing, distanceKm } from "./astro.js";

const PLACES = {
  woolpit: { lat: 52.24, lon: 0.89, name: "Woolpit, Suffolk" },
  hoia: { lat: 46.77, lon: 23.53, name: "Hoia Baciu, Cluj" },
  skye: { lat: 57.3, lon: -6.2, name: "Isle of Skye" },
  babayaga: { lat: 56.234, lon: 37.97, name: "Abramtsevo, near Moscow" },
  sibilla: { lat: 42.9, lon: 13.262, name: "Monte Sibilla, the Marche" },
  bathory: { lat: 48.725, lon: 17.761, name: "Čachtice Castle (Csejte)" },
};
/** Each figure: stars [u, v, brightness 0..1] in degrees, lines as index pairs, and its symbol's name */
const FIGURES = {
  // two children holding hands
  woolpit: {
    symbol: "Two children, hand in hand",
    stars: [[-5.2, 5.2, 0.9], [-5, 3.4, 0.55], [-7.6, 1.4, 0.5], [-2.6, 1.6, 0.6], [-5, 0, 0.6], [-6.4, -3.6, 0.7], [-3.6, -3.6, 0.55],
            [0, 1.4, 1], [4.8, 4.6, 0.85], [4.7, 2.9, 0.55], [7.2, 1.1, 0.5], [4.6, -0.4, 0.6], [3.4, -3.9, 0.55], [6, -3.9, 0.7]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 7], [1, 4], [4, 5], [4, 6], [7, 9], [8, 9], [9, 10], [9, 11], [11, 12], [11, 13]],
  },
  // a twisted tree over a bare clearing
  hoia: {
    symbol: "The twisted tree",
    stars: [[0, -4.6, 0.8], [0.8, -2, 0.55], [-0.6, 0.4, 0.65], [0.6, 2.4, 0.6], [-3.4, 2.6, 0.7], [-5.2, 4.6, 0.55], [3.6, 3.6, 0.65], [5.4, 5.2, 0.85],
            [0.2, 5.6, 0.5], [-3.8, -5.6, 0.45], [3.8, -5.4, 0.45]],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [3, 6], [6, 7], [3, 8], [0, 9], [0, 10]],
  },
  // a falling melody: a quaver and its echo
  skye: {
    symbol: "The ghost pianist's note",
    stars: [[-3.2, -3.8, 0.9], [-1.4, -3.2, 0.6], [-2.4, -5, 0.55], [-0.6, -3.4, 0.55], [-0.6, 3.8, 0.8], [2.2, 2.2, 0.6], [3, -0.2, 0.7],
            [4.6, -2.8, 0.5], [5.6, -4.4, 0.45]],
    lines: [[2, 0], [0, 1], [1, 3], [3, 2], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
  },
  // the hut on chicken legs: a gabled house standing on two bent legs
  babayaga: {
    symbol: "The hut on chicken legs",
    stars: [[-3.4, 0.6, 0.6], [3.4, 0.6, 0.6], [3.4, 3.8, 0.55], [0, 6.4, 0.95], [-3.4, 3.8, 0.55], [-1.6, -2.2, 0.5], [-2.6, -4.6, 0.65], [1.6, -2.2, 0.5], [2.6, -4.6, 0.65], [-4.2, -5.2, 0.4], [4.2, -5.2, 0.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [4, 2], [0, 5], [5, 6], [6, 9], [1, 7], [7, 8], [8, 10]],
  },
  // the crowned mountain: a broad peak with the ring of rock on its summit, and the door below it
  sibilla: {
    symbol: "The Sibyl’s crown",
    stars: [[-7, -4.6, 0.6], [-3.4, 0.6, 0.55], [-1.6, 3.4, 0.7], [0, 5.8, 0.95], [1.6, 3.4, 0.7], [3.4, 0.6, 0.55], [7, -4.6, 0.6], [-2.6, 2.2, 0.4], [2.6, 2.2, 0.4], [0, -1.4, 0.85], [-0.9, 4.8, 0.45], [0.9, 4.8, 0.45]],
    lines: [[0, 1], [1, 7], [7, 2], [2, 10], [10, 3], [3, 11], [11, 4], [4, 8], [8, 5], [5, 6], [7, 8], [1, 9], [9, 5]],
  },
  // the three teeth of the Báthory arms, set one above another and tapering to their points, inside the curve of a jaw
  bathory: {
    symbol: "The three teeth",
    stars: [[-5, 4, 0.75], [4.6, 4.8, 0.95], [4.6, 3.4, 0.4], [-5, 0.6, 0.7], [4.6, 1.4, 0.85], [4.6, 0, 0.4], [-5, -2.8, 0.7], [4.6, -2, 0.85], [4.6, -3.4, 0.4], [-6.4, -5.4, 0.5], [0, -7, 0.6], [6.4, -5.4, 0.5]],
    lines: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [6, 7], [7, 8], [8, 6], [9, 10], [10, 11]],
  },
};
export const CONSTELLATIONS = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => {
  const az = bearing(REF.lat, REF.lon, p.lat, p.lon), km = distanceKm(REF.lat, REF.lon, p.lat, p.lon);
  const alt = Math.max(36, Math.min(62, 66 - km / 60));   // nearer legends stand higher in the sky
  return [k, { key: k, place: p.name, az, alt, km: Math.round(km), ...FIGURES[k] }];
}));
