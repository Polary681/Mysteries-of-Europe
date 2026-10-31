// Unit tests of the real-sky maths (src/world/astro.js, sky.js) against known events.   node tests/astro.test.mjs
const A = await import("../src/world/astro.js");
const S = await import("../src/world/sky.js");
const { CONSTELLATIONS } = await import("../src/world/constellations.js");
const { STAR_COUNT, STARS } = await import("../src/world/stars-data.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const near = (a, b, d) => Math.abs(a - b) <= d;

// phases (published times, UTC): full moon 2026-10-26 04:12, new moon 2026-11-09 07:02, first quarter 2026-06-21 21:55
ok(A.moonPhase(new Date("2026-10-26T04:12Z")).fraction > 0.995, "full moon of 26 Oct 2026 is fully lit");
ok(A.moonPhase(new Date("2026-11-09T07:02Z")).fraction < 0.005, "new moon of 9 Nov 2026 is dark");
const fq = A.moonPhase(new Date("2026-06-21T21:55Z")); ok(near(fq.fraction, 0.5, 0.03) && fq.waxing, `first quarter of 21 Jun 2026 is half lit and waxing (${fq.fraction.toFixed(3)})`);
// the Sun: solstices and equinox (UTC)
ok(near(A.sun(new Date("2026-12-21T20:50Z")).lon, 270, 0.02), "Sun at 270 deg at the December 2026 solstice");
ok(near(A.sun(new Date("2026-06-21T08:24Z")).lon, 90, 0.02), "Sun at 90 deg at the June 2026 solstice");
ok(near(A.sun(new Date("2026-03-20T14:46Z")).lon, 0, 0.02) || near(A.sun(new Date("2026-03-20T14:46Z")).lon, 360, 0.02), "Sun at 0 deg at the March 2026 equinox");
// sidereal time and the horizon
ok(near(A.gmst(new Date("2000-01-01T12:00:00Z")), 280.46, 0.01), "GMST at J2000.0 is 280.46 deg");
const sirius = A.toHorizontal(101.29, -16.72, A.REF.lat, 101.29); ok(near(sirius.alt, 90 - A.REF.lat - 16.72, 0.05) && near(sirius.az, 180, 0.1), "Sirius culminates due south at 90 - lat + dec");
const polaris = A.toHorizontal(37.95, 89.26, A.REF.lat, 123); ok(near(polaris.alt, A.REF.lat, 0.8) && (polaris.az > 358 || polaris.az < 2), "Polaris stands at the latitude, due north");
// the Moon's distance and the parallax correction stay physical
const m = A.moon(new Date("2026-10-30T00:00Z")); ok(m.dist > 356000 && m.dist < 407000, "Moon distance within perigee/apogee");
// the catalogue
ok(STAR_COUNT > 2000 && STARS.length === STAR_COUNT * 4, `${STAR_COUNT} catalogue stars`);
ok(STARS[0] === 1013 && STARS[2] === -146, "the brightest star is Sirius (RA 101.3, V -1.46)");
// bearings of the legends from the Brocken (W, NW, ESE)
ok(near(CONSTELLATIONS.woolpit.az, 277, 3) && near(CONSTELLATIONS.skye.az, 306, 3) && near(CONSTELLATIONS.hoia.az, 116, 3), "constellations rise towards their places (W, NW, ESE)");
// special nights (art), decided by the local evening date at the reference place
ok(S.specialNight(new Date("2026-10-31T21:00Z")).id === "samhain", "31 Oct evening is Samhain");
ok(S.specialNight(new Date("2026-11-01T02:00Z")).id === "samhain", "the small hours of 1 Nov still belong to Samhain night");
ok(S.specialNight(new Date("2026-06-23T21:30Z")).id === "stjohn", "23 Jun evening is St John's Eve");
ok(S.specialNight(new Date("2026-12-21T21:00Z")).id === "solstice", "21 Dec 2026 evening is the solstice night");
ok(S.specialNight(new Date("2026-12-23T21:00Z")) === null && S.specialNight(new Date("2026-10-30T21:00Z")) === null, "ordinary nights are ordinary");
// the scene is always a night: in daylight it shows the coming night
const day = S.sceneTime(new Date("2026-07-01T11:00Z")); ok(day.tonight && A.skyAt(day.date).sun.alt < -14, "daylight shows tonight's sky instead");
const nightT = S.sceneTime(new Date("2026-01-10T23:00Z")); ok(!nightT.tonight && nightT.live, "at night the sky is live");
// the valley's orientation keeps the Moon and the stars consistent with each other
const w = S.enuToWorld([0, 1, 0], 180); ok(near(w[2], 1, 1e-9) && near(w[0], 0, 1e-9), "facing south, north is behind the camera (+z)");
const e = S.enuToWorld([1, 0, 0], 180); ok(near(e[0], -1, 1e-9), "facing south, east is on the left (-x)");
// v6: rise and set times (checked against published almanac values for Berlin, 52.52 N 13.405 E, to within 3 minutes)
{ const berlin = { lat: 52.52, lon: 13.405 }, hm = d => d.toLocaleTimeString("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }), mins = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const close = (got, want) => Math.abs(mins(got) - mins(want)) <= 3;
  const jun = A.riseSet("sun", new Date("2026-06-21T00:00:00+02:00"), new Date("2026-06-21T23:59:00+02:00"), berlin);
  ok(jun.length === 2 && jun[0].type === "rise" && close(hm(jun[0].date), "04:43") && close(hm(jun[1].date), "21:33"), `Berlin, 21 Jun: sunrise 04:43, sunset 21:33 (${jun.map(e => hm(e.date)).join(", ")})`);
  const dec = A.riseSet("sun", new Date("2026-12-21T00:00:00+01:00"), new Date("2026-12-21T23:59:00+01:00"), berlin);
  ok(dec.length === 2 && close(hm(dec[0].date), "08:15") && close(hm(dec[1].date), "15:54"), `Berlin, 21 Dec: sunrise 08:15, sunset 15:54 (${dec.map(e => hm(e.date)).join(", ")})`);
  const mo = A.riseSet("moon", new Date("2026-10-29T12:00Z"), new Date("2026-10-31T12:00Z"));
  ok(mo.length >= 3 && mo.every((e, i) => !i || e.type !== mo[i - 1].type), "the Moon rises and sets alternately over two days");
  ok(A.NAMED_STARS.length >= 20 && A.NAMED_STARS.every(([n, ra, dec, m]) => n && ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && m < 2.2), "named bright stars have valid coordinates"); }
// v6: seasons are art, decided by the local month at the reference place
ok(S.seasonOf(new Date("2026-01-15T21:00Z")).id === "winter" && S.seasonOf(new Date("2026-04-15T21:00Z")).id === "spring" && S.seasonOf(new Date("2026-07-15T21:00Z")).id === "summer" && S.seasonOf(new Date("2026-10-15T21:00Z")).id === "autumn", "the four seasons follow the scene date");
ok(S.seasonOf(new Date("2026-11-30T23:30Z")).id === "winter" && S.seasonOf(new Date("2026-11-30T22:30Z")).id === "autumn", "the season uses the local date (23:30 UTC on 30 Nov is already 1 Dec in Germany)");
ok(Object.values(S.SEASONS).every(x => x.grade.length === 3 && x.mist > 0 && x.snow >= 0), "season profiles are complete");
ok(S.tonight(new Date("2026-02-01T21:00Z")).season.id === "winter", "tonight() reports the season");
console.log(fails ? `\n${fails} FAILED` : "\nALL ASTRONOMY TESTS PASSED"); process.exit(fails ? 1 : 0);
