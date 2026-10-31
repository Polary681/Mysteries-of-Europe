// ASTRONOMY (pure maths: no three.js, no DOM, no art). Everything the sky needs from the real date and time:
// the Sun and the Moon (position, phase, bright limb), sidereal time and the rotation that carries the J2000 star
// catalogue onto the local horizon. Low-precision algorithms (Meeus, "Astronomical Algorithms", ch. 25/47, truncated;
// GMST from IAU 1982): about 0.01 deg for the Sun and 0.2 deg for the Moon, far below what a picture can show.
// Precession since J2000 (about 0.37 deg in 2026) and refraction are ignored on purpose.
//
// Frames: equatorial vectors have x towards RA 0h, z towards the north celestial pole. Local vectors are ENU
// (x = east, y = north, z = up). Azimuth is measured from north through east, in degrees.

/** The reference place of the landing valley: a clearly defined European location (documented in the README). */
export const REF = Object.freeze({
  name: "Brocken, Harz Mountains", country: "Germany", lat: 51.7991, lon: 10.6156, tz: "Europe/Berlin",
  why: "The Brocken is the misty, spruce-covered summit where German folklore gathers the witches on Walpurgis Night.",
});

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R);
export const norm360 = a => ((a % 360) + 360) % 360;
/** Julian date of a JS Date */
export const julian = date => date.getTime() / 86400000 + 2440587.5;
const days2000 = date => julian(date) - 2451545.0;

/** mean obliquity of the ecliptic (deg) */
const obliquity = T => 23.439291 - 0.0130042 * T;
function eclToEq(lon, lat, eps) {
  const x = cos(lat) * cos(lon), y = cos(lat) * sin(lon), z = sin(lat);
  const ye = y * cos(eps) - z * sin(eps), ze = y * sin(eps) + z * cos(eps);
  return { ra: norm360(Math.atan2(ye, x) * R2D), dec: Math.asin(Math.max(-1, Math.min(1, ze))) * R2D };
}

/** The Sun: apparent ecliptic longitude, RA/Dec (deg), distance (km). */
export function sun(date) {
  const d = days2000(date), T = d / 36525;
  const M = norm360(357.52911 + 35999.05029 * T), L0 = norm360(280.46646 + 36000.76983 * T);
  const Cc = (1.914602 - 0.004817 * T) * sin(M) + 0.019993 * sin(2 * M) + 0.000289 * sin(3 * M);
  const lon = norm360(L0 + Cc), e = 0.016708634, v = M + Cc;
  const dist = 149597870.7 * 1.000001018 * (1 - e * e) / (1 + e * cos(v));
  return { lon, lat: 0, dist, ...eclToEq(lon, 0, obliquity(T)) };
}

/** The Moon: geocentric ecliptic longitude/latitude, RA/Dec (deg), distance (km). */
export function moon(date) {
  const d = days2000(date), T = d / 36525;
  const Lp = norm360(218.3164477 + 481267.88123421 * T);   // mean longitude
  const D = norm360(297.8501921 + 445267.1114034 * T);     // mean elongation
  const M = norm360(357.5291092 + 35999.0502909 * T);      // Sun's mean anomaly
  const Mp = norm360(134.9633964 + 477198.8675055 * T);    // Moon's mean anomaly
  const F = norm360(93.2720950 + 483202.0175233 * T);      // argument of latitude
  const lon = norm360(Lp + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D) + 0.213618 * sin(2 * Mp)
    - 0.185116 * sin(M) - 0.114332 * sin(2 * F) + 0.058793 * sin(2 * D - 2 * Mp) + 0.057066 * sin(2 * D - M - Mp)
    + 0.053322 * sin(2 * D + Mp) + 0.045758 * sin(2 * D - M) - 0.040923 * sin(M - Mp) - 0.034720 * sin(D) - 0.030383 * sin(M + Mp)
    + 0.015327 * sin(2 * D - 2 * F) - 0.012528 * sin(Mp + 2 * F) + 0.010980 * sin(Mp - 2 * F) + 0.010675 * sin(4 * D - Mp));
  const lat = 5.128122 * sin(F) + 0.280602 * sin(Mp + F) + 0.277693 * sin(Mp - F) + 0.173237 * sin(2 * D - F)
    + 0.055413 * sin(2 * D - Mp + F) + 0.046271 * sin(2 * D - Mp - F) + 0.032573 * sin(2 * D + F) + 0.017198 * sin(2 * Mp + F);
  const dist = 385000.56 - 20905.355 * cos(Mp) - 3699.111 * cos(2 * D - Mp) - 2955.968 * cos(2 * D) - 569.925 * cos(2 * Mp) + 48.888 * cos(M);
  return { lon, lat, dist, ...eclToEq(lon, lat, obliquity(T)) };
}

/** Greenwich mean sidereal time (deg) */
export function gmst(date) {
  const d = days2000(date), T = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000);
}
/** local sidereal time (deg) at a longitude (deg, east positive) */
export const lst = (date, lon) => norm360(gmst(date) + lon);

/** equatorial (ra, dec, deg) -> local ENU unit vector and alt/az, for a latitude and a local sidereal time */
export function toHorizontal(ra, dec, lat, LST) {
  const H = LST - ra;
  const e = -cos(dec) * sin(H), n = cos(lat) * sin(dec) - sin(lat) * cos(dec) * cos(H), u = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H);
  return { e, n, u, alt: Math.asin(Math.max(-1, Math.min(1, u))) * R2D, az: norm360(Math.atan2(e, n) * R2D) };
}
/** Row-major 3x3 matrix taking an equatorial unit vector (J2000) to the local ENU frame. */
export function eqToEnuMatrix(lat, LST) {
  // v1 = Rz(-LST) v ; east = v1.y ; north = cos(lat) v1.z - sin(lat) v1.x ; up = sin(lat) v1.z + cos(lat) v1.x
  const c = cos(LST), s = sin(LST), cl = cos(lat), sl = sin(lat);
  return [
    -s, c, 0,                       // east  = -sin(LST) x + cos(LST) y
    -sl * c, -sl * s, cl,           // north
    cl * c, cl * s, sl,             // up
  ];
}
/** equatorial unit vector of (ra, dec) in degrees */
export const eqVector = (ra, dec) => [cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec)];

/** Lunar phase seen from the Earth: illuminated fraction 0..1, phase angle, waxing flag, age (0..1 of a synodic month), name. */
export function moonPhase(date) {
  const S = sun(date), Mo = moon(date);
  const cosPsi = sin(S.dec) * sin(Mo.dec) + cos(S.dec) * cos(Mo.dec) * cos(S.ra - Mo.ra), psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)));
  const i = Math.atan2(S.dist * Math.sin(psi), Mo.dist - S.dist * Math.cos(psi));            // phase angle (rad)
  const fraction = (1 + Math.cos(i)) / 2, elong = norm360(Mo.lon - S.lon), waxing = elong < 180, age = elong / 360;
  const name = fraction < 0.03 ? "New moon" : fraction > 0.97 ? "Full moon"
    : Math.abs(fraction - 0.5) < 0.06 ? (waxing ? "First quarter" : "Last quarter")
    : fraction < 0.5 ? (waxing ? "Waxing crescent" : "Waning crescent") : (waxing ? "Waxing gibbous" : "Waning gibbous");
  return { fraction, phaseAngle: i * R2D, waxing, age, name };
}

/** Topocentric correction of the Moon's altitude (parallax, up to ~1 deg near the horizon). */
export const moonParallax = (alt, distKm) => Math.asin(6378.14 / distKm * cos(alt)) * R2D;

/** Everything about the sky at a date, for a place. Pure data. */
export function skyAt(date, place = REF) {
  const LST = lst(date, place.lon), S = sun(date), Mo = moon(date);
  const sh = toHorizontal(S.ra, S.dec, place.lat, LST), mh = toHorizontal(Mo.ra, Mo.dec, place.lat, LST);
  const malt = mh.alt - moonParallax(mh.alt, Mo.dist);
  const mu = Math.sin(malt * D2R), mc = Math.cos(malt * D2R), maz = mh.az * D2R;
  return {
    date, place, lst: LST, eqToEnu: eqToEnuMatrix(place.lat, LST),
    sun: { alt: sh.alt, az: sh.az, enu: [sh.e, sh.n, sh.u], lon: S.lon },
    moon: { alt: malt, az: mh.az, enu: [mc * Math.sin(maz), mc * Math.cos(maz), mu], dist: Mo.dist, ...moonPhase(date) },
  };
}

/** Initial great-circle bearing (deg from north) from one place to another. */
export function bearing(lat1, lon1, lat2, lon2) {
  const y = sin(lon2 - lon1) * cos(lat2), x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(lon2 - lon1);
  return norm360(Math.atan2(y, x) * R2D);
}
/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Compass point name for an azimuth. */
export const compass = az => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(norm360(az) / 22.5) % 16];

/** Rise and set of the Sun or the Moon at a place, between two dates: [{ type: "rise"|"set", date }], in time order.
 *  Upper limb on a horizon with standard refraction (altitude -0.833 deg; the Moon's altitude is already topocentric).
 *  Found by sampling every 10 minutes and bisecting each crossing to about 20 seconds. */
export function riseSet(body, from, to, place = REF) {
  const alt = d => { const LST = lst(d, place.lon), p = body === "sun" ? sun(d) : moon(d), h = toHorizontal(p.ra, p.dec, place.lat, LST).alt; return (body === "sun" ? h : h - moonParallax(h, p.dist)) + 0.833; };
  const out = [], step = 600000; let t0 = from.getTime(), a0 = alt(from);
  for (let t1 = t0 + step; t0 < to.getTime(); t0 = t1, t1 += step) {
    const a1 = alt(new Date(Math.min(t1, to.getTime()))); if ((a0 < 0) !== (a1 < 0)) {
      let lo = t0, hi = Math.min(t1, to.getTime()), al = a0;
      for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2, am = alt(new Date(m)); if ((am < 0) === (al < 0)) { lo = m; al = am; } else hi = m; }
      out.push({ type: a1 > 0 ? "rise" : "set", date: new Date((lo + hi) / 2) });
    }
    a0 = a1;
  }
  return out;
}
/** The bright stars a visitor can name (J2000 RA/Dec in degrees, V magnitude). Used by the sky chart. */
export const NAMED_STARS = [
  ["Sirius", 101.29, -16.72, -1.46], ["Arcturus", 213.92, 19.18, -0.05], ["Vega", 279.23, 38.78, 0.03], ["Capella", 79.17, 46.0, 0.08],
  ["Rigel", 78.63, -8.2, 0.13], ["Procyon", 114.83, 5.22, 0.34], ["Betelgeuse", 88.79, 7.41, 0.5], ["Altair", 297.7, 8.87, 0.77],
  ["Aldebaran", 68.98, 16.51, 0.86], ["Antares", 247.35, -26.43, 0.96], ["Spica", 201.3, -11.16, 0.97], ["Pollux", 116.33, 28.03, 1.14],
  ["Fomalhaut", 344.41, -29.62, 1.16], ["Deneb", 310.36, 45.28, 1.25], ["Regulus", 152.09, 11.97, 1.35], ["Castor", 113.65, 31.89, 1.58],
  ["Bellatrix", 81.28, 6.35, 1.64], ["Alioth", 193.51, 55.96, 1.77], ["Dubhe", 165.93, 61.75, 1.79], ["Mirfak", 51.08, 49.86, 1.79],
  ["Polaris", 37.95, 89.26, 1.98], ["Hamal", 31.79, 23.46, 2.0], ["Algol", 47.04, 40.96, 2.1], ["Alpheratz", 2.1, 29.09, 2.06],
];
