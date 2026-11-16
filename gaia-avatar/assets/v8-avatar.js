/* Gaia avatar, version 8: the drawing and motion code.
   Exploration code. One file, no build step. The page is ../v8-gaia-avatar.html.
   Version 8 only changes the mouth on Thinking, Reading, Drafting and Measuring: a slight smile, a little less than Idle's. Two new sliders set it.
   Version 7 only changes three hard hat defaults, to the values Murillo sent on 2026-11-16: size, height and bob.
   Version 5 redraws the hard hat by the avatar's own rule: shapes are flat fills with no outline, and ink is only for marks on a shape.
   Defaults are the values Murillo tuned in version 2 and sent on 2026-11-16. */
(() => {
'use strict';

/* ───────── helpers ───────── */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbCss = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 60;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rrPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const p = new Path2D();
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
  return p;
}

/* ───────── colours ───────── */
const INK = hexRgb('#1B1A19'), PAPER = hexRgb('#FCFAF8');
const AMBER = hexRgb('#F8C97B'), SAFETY = hexRgb('#F7C531'), BLUSH = [226, 58, 60];
const COLOURS = [['Coral', '#FB6B4B'], ['Amber', '#F8C97B'], ['Orchid', '#EFB1F6'], ['Periwinkle', '#9FA7F8'], ['Sage', '#A9DCA2'], ['Sky', '#AED6F5'], ['Ink', '#1B1A19']];

/* ───────── tunable parameters: shape and motion (from version 1) ───────── */
const BASE_GROUPS = [
  { name: 'Shape', items: [
    { k: 'square', label: 'Squareness', min: 2.2, max: 9, step: 0.1, def: 4.4, hint: '2 is a circle. 9 is a hard square.' },
    { k: 'aspect', label: 'Width', min: 0.8, max: 1.25, step: 0.01, def: 1.04 },
    { k: 'tailLen', label: 'Tail length', min: 0, max: 0.7, step: 0.01, def: 0.36 },
    { k: 'tailW', label: 'Tail width', min: 0.15, max: 0.9, step: 0.01, def: 0.5 },
    { k: 'tailTip', label: 'Tail tip roundness', min: 0, max: 0.2, step: 0.005, def: 0.09 },
  ] },
  { name: 'Eye size and place', items: [
    { k: 'eyeW', label: 'Eye width', min: 0.08, max: 0.4, step: 0.005, def: 0.23 },
    { k: 'eyeH', label: 'Eye height', min: 0.12, max: 0.9, step: 0.01, def: 0.44, hint: 'Pill eyes only.' },
    { k: 'eyeGap', label: 'Space between the eyes', min: 0.25, max: 1.2, step: 0.01, def: 0.52 },
    { k: 'eyeRound', label: 'Eye roundness', min: 0, max: 1, step: 0.05, def: 1 },
    { k: 'slant', label: 'Eye slant', min: -25, max: 25, step: 1, def: 0, unit: '°' },
    { k: 'faceY', label: 'Face height', min: -0.5, max: 0.4, step: 0.01, def: -0.1, hint: 'Negative moves the face up.' },
  ] },
  { name: 'Depth', items: [
    { k: 'turn', label: 'How far the face slides', min: 0, max: 70, step: 1, def: 32, unit: '°' },
    { k: 'depth', label: 'How round the body feels', min: 0.5, max: 1.3, step: 0.01, def: 0.92, hint: 'Higher lets the face travel further before it narrows.' },
    { k: 'narrow', label: 'Features narrow near the edge', min: 0, max: 1.6, step: 0.05, def: 1 },
    { k: 'lead', label: 'Eyes move before the head', min: 0, max: 1, step: 0.05, def: 0.55 },
    { k: 'lean', label: 'Body follows the gaze', min: 0, max: 0.35, step: 0.01, def: 0.1 },
    { k: 'tilt', label: 'Body tilts into the gaze', min: 0, max: 16, step: 0.5, def: 5, unit: '°' },
    { k: 'squeeze', label: 'Body narrows mid-spin', min: 0, max: 0.5, step: 0.01, def: 0.14 },
  ] },
  { name: 'Motion', items: [
    { k: 'speed', label: 'Overall speed', min: 0.2, max: 2, step: 0.05, def: 1 },
    { k: 'snap', label: 'Snappiness', min: 0.4, max: 2.5, step: 0.05, def: 1, hint: 'How fast each part reaches its target.' },
    { k: 'bounce', label: 'Bounce', min: 0, max: 1, step: 0.05, def: 0.5, hint: 'How much each part overshoots before it settles.' },
    { k: 'squash', label: 'Squash and stretch', min: 0, max: 2, step: 0.05, def: 1 },
    { k: 'jelly', label: 'Lean on quick moves', min: 0, max: 2, step: 0.05, def: 1 },
    { k: 'hop', label: 'Hop height', min: 0, max: 2, step: 0.05, def: 1 },
    { k: 'tailLag', label: 'Tail trails behind', min: 0, max: 1, step: 0.05, def: 0.6 },
  ] },
  { name: 'Life', items: [
    { k: 'breath', label: 'Breathing', min: 0, max: 3, step: 0.1, def: 1 },
    { k: 'blinkRate', label: 'Blink rate', min: 0, max: 2.5, step: 0.1, def: 1 },
    { k: 'darts', label: 'Small eye movements', min: 0, max: 3, step: 0.1, def: 1 },
    { k: 'follow', label: 'Idle Gaia follows the pointer', type: 'toggle', def: true },
  ] },
  { name: 'Body flower transition', items: [
    { k: 'petals', label: 'Petals', min: 4, max: 9, step: 1, def: 6 },
    { k: 'petalDepth', label: 'Petal depth', min: 0, max: 0.6, step: 0.01, def: 0.3, hint: 'Zero turns the body bloom off.' },
    { k: 'bloomLen', label: 'Bloom length', min: 0.3, max: 2, step: 0.05, def: 0.9, unit: ' s' },
  ] },
  { name: 'Look', items: [
    { k: 'colour', label: 'Body colour', type: 'swatch', def: '#FB6B4B' },
    { k: 'eyeCol', label: 'Eye colour', type: 'seg', options: [['ink', 'Ink'], ['paper', 'Paper']], def: 'ink', hint: 'An ink body always gets paper eyes.' },
    { k: 'shadow', label: 'Ground shadow', min: 0, max: 0.3, step: 0.01, def: 0.07 },
    { k: 'backdrop', label: 'Stage backdrop', type: 'seg', options: [['cream', 'Cream'], ['white', 'White'], ['ink', 'Ink']], def: 'cream' },
  ] },
];

/* ───────── tunable parameters: the face and the props ───────── */
const FEATURE_GROUPS = [
  { name: 'Props that appear for one job', items: [
    { k: 'glassReading', label: 'Glasses on Reading', type: 'toggle', def: true },
    { k: 'glassDrafting', label: 'Glasses on Drafting', type: 'toggle', def: true },
    { k: 'glassThinking', label: 'Glasses on Thinking', type: 'toggle', def: false },
    { k: 'loupe', label: 'Magnifier on Measuring', type: 'toggle', def: true },
    { k: 'hardhat', label: 'Hard hat on Testing', type: 'toggle', def: true },
    { k: 'glassSize', label: 'Lens size', min: 0.14, max: 0.5, step: 0.01, def: 0.22 },
    { k: 'glassThick', label: 'Frame thickness', min: 0.02, max: 0.12, step: 0.005, def: 0.045 },
    { k: 'glassLens', label: 'Lens tint', min: 0, max: 0.7, step: 0.02, def: 0.38 },
    { k: 'hatStyle', label: 'Hard hat drawing', type: 'seg', def: 'tone', options: [['tone', 'Flat, two tones'], ['marks', 'Flat + ink lines'], ['outline', 'Outlined (v4)']], hint: 'Flat matches the body: a fill with no outline.' },
    { k: 'hatCol', label: 'Hard hat colour', type: 'seg', def: 'safety', options: [['amber', 'Brand amber'], ['safety', 'Safety yellow']] },
    { k: 'hatSize', label: 'Hard hat size', min: 0.6, max: 1.4, step: 0.02, def: 1.02 },
    { k: 'hatLift', label: 'How high the hat sits', min: 0.6, max: 1.05, step: 0.01, def: 0.79, hint: '1 puts the bottom of the brim on the top edge of the body. Lower values pull it down over the forehead.' },
    { k: 'hatSquare', label: 'Hat dome squareness', min: 2, max: 3.6, step: 0.05, def: 2.6, hint: 'Flat hats only. 2 is a plain ellipse. Higher echoes the body.' },
    { k: 'hatLine', label: 'Hat line thickness', min: 0.03, max: 0.14, step: 0.005, def: 0.07, hint: 'For the ink lines and the outlined hat.' },
    { k: 'hatShade', label: 'Shadow under the brim', min: 0, max: 0.3, step: 0.01, def: 0.12, hint: 'Flat hats only. A darker band on the body, like the ground shadow.' },
    { k: 'hatBob', label: 'How much the hat bobs', min: 0, max: 1, step: 0.05, def: 0.1 },
    { k: 'hatSlide', label: 'Hat ridge follows the gaze', min: 0, max: 2, step: 0.05, def: 1 },
  ] },
  { name: 'Brows', items: [
    { k: 'brows', label: 'Show brows', type: 'toggle', def: true },
    { k: 'browLen', label: 'Length', min: 0.06, max: 0.6, step: 0.01, def: 0.14 },
    { k: 'browThick', label: 'Thickness', min: 0.03, max: 0.16, step: 0.005, def: 0.1 },
    { k: 'browGap', label: 'Height above the eye', min: 0.02, max: 0.4, step: 0.01, def: 0.22 },
    { k: 'browCurve', label: 'Curve', min: -0.5, max: 0.8, step: 0.02, def: 0.22 },
    { k: 'browMove', label: 'How much they move', min: 0, max: 3, step: 0.05, def: 2 },
  ] },
  { name: 'Mouth', items: [
    { k: 'mouth', label: 'Show a mouth', type: 'toggle', def: true },
    { k: 'mouthW', label: 'Width', min: 0.06, max: 0.7, step: 0.01, def: 0.14 },
    { k: 'mouthY', label: 'Distance below the eyes', min: 0.15, max: 0.75, step: 0.01, def: 0.45 },
    { k: 'mouthThick', label: 'Line thickness', min: 0.03, max: 0.14, step: 0.005, def: 0.1 },
    { k: 'mouthMove', label: 'How much it moves', min: 0, max: 3, step: 0.05, def: 2 },
    { k: 'workSmile', label: 'Smile while working', min: -0.1, max: 0.6, step: 0.01, def: 0.25, hint: 'Thinking, Reading, Drafting and Measuring. 0 is a flat line. Idle smiles at 0.35.' },
    { k: 'workMouthW', label: 'Mouth width while working', min: 0.4, max: 1.2, step: 0.01, def: 0.9, hint: 'The same four states. 1 is the width Idle uses. A narrow mouth hides the smile.' },
  ] },
  { name: 'Cheeks', items: [
    { k: 'cheeks', label: 'Cheeks', type: 'seg', def: 'moments', options: [['off', 'None'], ['moments', 'Happy moments'], ['always', 'Always']] },
    { k: 'cheekSize', label: 'Cheek size', min: 0.06, max: 0.3, step: 0.01, def: 0.16 },
    { k: 'cheekTone', label: 'Cheek strength', min: 0, max: 1, step: 0.05, def: 0.35 },
  ] },
  { name: 'Eye style', items: [
    { k: 'eyeStyle', label: 'Style', type: 'seg', def: 'pill', options: [['pill', 'Pill'], ['dot', 'Dot'], ['duo', 'White + pupil']] },
    { k: 'pupil', label: 'Pupil size', min: 0.25, max: 0.9, step: 0.01, def: 0.9, hint: 'White and pupil style only. The pupils move inside the whites.' },
    { k: 'shine', label: 'Light dot in the eye', min: 0, max: 0.5, step: 0.01, def: 0 },
  ] },
  { name: 'Second bubble, from the symbol', items: [
    { k: 'echo', label: 'Show a second bubble behind', type: 'toggle', def: false },
    { k: 'echoOff', label: 'How far it peeks out', min: 0, max: 0.5, step: 0.01, def: 0.32 },
    { k: 'echoTint', label: 'How light it is', min: 0, max: 1, step: 0.02, def: 0.74 },
    { k: 'echoPar', label: 'Shifts against the gaze', min: 0, max: 0.4, step: 0.01, def: 0.13 },
  ] },
];

const DEFAULTS = {};
BASE_GROUPS.forEach((g) => g.items.forEach((it) => { DEFAULTS[it.k] = it.def; }));
FEATURE_GROUPS.forEach((g) => g.items.forEach((it) => { DEFAULTS[it.k] = it.def; }));
const STORE_KEY = 'bra2-93-gaia-avatar-v8';
/* values tuned in earlier versions carry over until version 8 saves its own. Versions 3 and 4 had a different hat, so their hat values are skipped. */
const HAT_KEYS = ['hatStyle', 'hatCol', 'hatLine', 'hatSquare', 'hatShade'];
const SOURCES = [[STORE_KEY, []], ['bra2-93-gaia-avatar-v7', []], ['bra2-93-gaia-avatar-v6', []], ['bra2-93-gaia-avatar-v5', []], ['bra2-93-gaia-avatar-v4', HAT_KEYS], ['bra2-93-gaia-avatar-v3', HAT_KEYS]];
const params = Object.assign({}, DEFAULTS);
try {
  const found = SOURCES.map(([key, skip]) => [localStorage.getItem(key), skip]).find(([text]) => text);
  if (found) { const saved = JSON.parse(found[0]); for (const k in DEFAULTS) if (typeof saved[k] === typeof DEFAULTS[k] && !found[1].includes(k)) params[k] = saved[k]; }
} catch (e) { /* storage blocked: defaults stand */ }
const saveParams = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(params)); } catch (e) { /* storage blocked */ } };

/* ───────── spring ───────── */
class Spring {
  constructor(x, k, z) { this.x = x; this.v = 0; this.t = x; this.k = k; this.z = z; }
  step(dt, km, zm) {
    const k = this.k * km, c = 2 * Math.sqrt(k) * this.z * zm;
    this.v += (-k * (this.x - this.t) - c * this.v) * dt;
    this.x += this.v * dt;
  }
}
const GRAVITY = 15;
const pointer = { x: 0, y: 0, active: false, last: 0 };

/* ───────── states: each one only sets targets, springs do the moving ───────── */
const IDLE_SMILE = 0.35;
/* the four working states share one slight smile, set in the panel. A flat, narrow mouth read as bored. */
const workMouth = (a, T) => { T.smile = a.P.workSmile; T.mouthW = a.P.workMouthW; };
const STATES = {
  idle: {
    name: 'Idle', what: 'Breathes, blinks and looks around. Follows your pointer.', status: 'Ask Gaia',
    tick(a, t, T) {
      T.pointer = 1; T.smile = IDLE_SMILE;
      if (t >= a.nextWander) {
        const centre = a.rand() < 0.3;
        a.wanderX = centre ? 0 : (a.rand() * 2 - 1) * 0.6; a.wanderY = centre ? 0 : (a.rand() * 2 - 1) * 0.3;
        a.nextWander = t + 1.5 + a.rand() * 2.8;
      }
      T.gx = a.wanderX; T.gy = a.wanderY;
    },
  },
  thinking: {
    name: 'Thinking', what: 'The eyes drift along the top edge. One brow lifts. The tail sways.', status: 'Thinking about your return policy…',
    tick(a, t, T) {
      T.gx = 0.52 * Math.sin(t * 0.8); T.gy = -0.64 + 0.12 * Math.cos(t * 1.6);
      T.roll = 0.07 * Math.sin(t * 0.8 - 0.9); T.offY = -0.04 + 0.025 * Math.sin(t * 1.3);
      T.eyeH = [0.86, 0.86]; T.lid = [0.16, 0.16];
      T.tailSwing = 0.34 * Math.sin(t * 2.4); T.tailLen = 0.9;
      workMouth(a, T); T.brow = [0.65, -0.15];
      if (a.every('idea', 3.4, 1.7)) a.blink(1);
    },
  },
  reading: {
    name: 'Reading', what: 'Puts on glasses. The eyes jump along a line, then return to start the next one.', status: 'Reading 2,559 of 3,104 tickets…',
    tick(a, t, T) {
      const line = 1.25, ph = (t % line) / line, ln = Math.floor(t / line) % 3;
      const stop = Math.min(3, Math.floor(ph * 4.6));
      T.gx = ph < 0.87 ? -0.5 + stop / 3 : -0.5; T.gy = 0.36 + ln * 0.08;
      T.eyeH = [0.72, 0.72]; T.lid = [0.22, 0.22]; T.roll = T.gx * 0.03;
      workMouth(a, T); T.brow = [-0.1, -0.1];
      if (a.every('page', line * 3, 0.01)) a.blink(1);
    },
  },
  drafting: {
    name: 'Drafting', what: 'Glasses on. Leans onto the tail and writes with it. Looks up between lines.', status: 'Drafting the “Cancel order” skill…',
    tick(a, t, T) {
      const line = 1.5, per = line * 3 + 0.9, c = t % per;
      if (c < line * 3) {
        const ph = (c % line) / line, writing = ph < 0.85, x = writing ? ph / 0.85 : 1 - (ph - 0.85) / 0.15;
        T.gx = 0.5; T.gy = 0.62; T.roll = 0.16 + (writing ? 0.02 * Math.sin(t * 19 + 1) : 0);
        T.offX = lerp(-0.15, 0.15, x); T.offY = writing ? 0.018 * Math.sin(t * 19) : -0.07;
        T.tailLen = 1.15; T.eyeH = [0.8, 0.8]; T.lid = [0.2, 0.2]; T.lidA = [0.22, 0.22];
        workMouth(a, T);
      } else {
        T.pointer = 0.7; T.gy = -0.1; T.roll = 0.04; T.eyeH = [1.04, 1.04]; T.smile = 0.55; T.brow = [0.3, 0.3];
        if (a.every('look', per, line * 3 + 0.25)) a.blink(1);
      }
    },
  },
  testing: {
    name: 'Testing', what: 'A hard hat drops on. Wide eyes check six points in order, with a small nod at each.', status: 'Testing 6 scenarios…',
    tick(a, t, T) {
      const pts = [[-0.58, -0.32], [0, -0.32], [0.58, -0.32], [0.58, 0.3], [0, 0.3], [-0.58, 0.3]];
      const step = 0.46, i = Math.floor(t / step) % 7;
      if (i < 6) { T.gx = pts[i][0]; T.gy = pts[i][1]; }
      T.eyeH = [1.14, 1.14]; T.eyeW = [1.1, 1.1];
      T.smile = 0; T.mouthOpen = 0.5; T.mouthW = 0.5;   /* brows stay low enough to clear the hard hat's brim */
      if (a.every('step', step)) { if (i < 6) a.nod(0.55); else a.blink(1); }
    },
  },
  waiting: {
    name: 'Waiting on you', what: 'Looks straight at you and tilts its head. Hops if you take long.', status: 'Waiting for your answer',
    tick(a, t, T) {
      const per = 4.4, side = (t % per) / per < 0.5 ? 1 : -1;
      T.pointer = 1; T.gy = 0.05; T.roll = 0.12 * side; T.tailSwing = -0.2 * side; T.eyeH = [1.06, 1.06];
      T.smile = 0.3; T.brow = [0.4, 0.4]; T.blush = 0.3;
      if (a.every('blink2', per, 1.3)) a.blink(2);
      if (a.every('ahem', per * 1.5, 3.1)) a.hop(0.35);
    },
  },
  approved: {
    name: 'Approved', what: 'Jumps, blooms into the flower and smiles.', status: 'Thanks, setting it up',
    tick(a, t, T) {
      const per = 4.6, c = t % per;
      if (a.every('cycle', per)) { a.hop(1); a.bloomPulse(); }
      if (c < 1.9) {
        T.cheek = [0.66, 0.66]; T.eyeW = [1.4, 1.4]; T.eyeH = [0.84, 0.84]; T.gy = -0.14;
        T.roll = 0.09 * Math.sin(c * 7) * Math.max(0, 1 - c / 1.9);
        T.smile = 1; T.mouthOpen = 0.7; T.blush = 1; T.echo = 1.5;
      } else {
        T.pointer = 1; T.gy = -0.02; T.eyeH = [1.05, 1.05]; T.smile = 0.7; T.blush = 0.6;
        if (a.every('hop2', per, 3.1)) a.hop(0.3);
      }
    },
  },
  measuring: {
    name: 'Measuring', what: 'One eye squints. The other sweeps slowly from side to side behind a magnifier.', status: 'Measuring · day 9 of 14',
    tick(a, t, T) {
      const s = Math.sin(t * 0.75);
      T.gx = 0.58 * s; T.gy = 0.12; T.eyeH = [0.5, 1.16]; T.eyeW = [1, 1.14]; T.lid = [0.3, 0];
      T.roll = 0.06 * s; T.offX = 0.06 * s;
      workMouth(a, T);
      if (a.every('tick', Math.PI / 0.75, Math.PI / 1.5)) a.nod(0.5);
    },
  },
  done: {
    name: 'Done', what: 'A full turn, a landing and a content smile.', status: 'Worked · +5 pts automation rate',
    tick(a, t, T) {
      const per = 5.6, c = t % per;
      if (a.every('cycle', per)) { a.hop(0.8); a.spinOnce(); }
      if (c < 0.85) { T.eyeH = [1.1, 1.1]; T.gy = -0.06; T.smile = 0.2; T.mouthOpen = 0.6; T.mouthW = 0.7; }
      else if (c < 2.8) { T.cheek = [0.72, 0.72]; T.eyeW = [1.42, 1.42]; T.eyeH = [0.8, 0.8]; T.gy = -0.06; T.roll = 0.05 * Math.sin(t * 1.5); T.smile = 1; T.blush = 0.8; }
      else {
        T.pointer = 1; T.smile = 0.6;
        if (c > 3.4 && c < 3.72) { T.pointer = 0; T.gy = 0.5; }
        if (a.every('nod', per, 3.4)) a.nod(0.7);
      }
    },
  },
  failed: {
    name: 'Couldn’t finish', what: 'Sags, shakes its head, then looks up at you.', status: 'Couldn’t reach Recharge',
    tick(a, t, T) {
      const per = 5.8, c = t % per;
      T.sag = 0.075; T.tailLen = 0.6; T.tailSwing = -0.32; T.roll = -0.035; T.smile = -0.7; T.echo = 0.5;
      if (c < 1.7) {
        const env = clamp((c - 0.35) / 0.2, 0, 1) * Math.max(0, 1 - (c - 0.35) / 1.2);
        T.gx = 0.36 * Math.sin((c - 0.35) * 9.5) * env; T.gy = 0.6;
        T.lid = [0.36, 0.36]; T.lidA = [-0.4, -0.4]; T.eyeH = [0.9, 0.9];
      } else if (c < 4) {
        T.pointer = 0.5; T.gy = -0.24; T.lid = [0.2, 0.2]; T.lidA = [-0.46, -0.46]; T.eyeH = [1.02, 1.02];
        if (a.every('slow', per, 2.7)) a.blink(1);
      } else {
        const s = (c - 4) / 1.8;
        T.offY = -0.05 * Math.sin(Math.PI * Math.min(1, s * 1.6)); T.gy = 0.3 + 0.3 * s; T.lid = [0.3, 0.3]; T.lidA = [-0.4, -0.4];
      }
    },
  },
  /* not shown in the page: used by the ?strip= check to sweep the gaze */
  turn: { name: 'Turn', what: '', status: '', tick(a, t, T) { T.gx = Math.sin(t * 2.2); T.gy = 0.5 * Math.sin(t * 1.1); T.smile = 0.35; } },
};
/* which prop a state shows, and the panel switch that allows it */
const PROPS = { reading: ['glasses', 'glassReading'], drafting: ['glasses', 'glassDrafting'], thinking: ['glasses', 'glassThinking'], measuring: ['magnifier', 'loupe'], testing: ['hard hat', 'hardhat'] };
const propOf = (P, state) => (PROPS[state] && P[PROPS[state][1]] ? PROPS[state][0] : '');
const STATE_ORDER = ['idle', 'thinking', 'reading', 'drafting', 'testing', 'waiting', 'approved', 'measuring', 'done', 'failed'];

/* ───────── avatar ───────── */
const avatars = [];
class Avatar {
  /* o.look: feature values fixed for this avatar. Everything else follows the panel. */
  constructor(host, o) {
    this.host = host; this.px = o.px; this.state = o.state || 'idle';
    this.P = o.look ? Object.assign(Object.create(params), o.look) : params;
    this.rand = rng(o.seed || 1); this.fixedColour = o.colour || null; this.detached = !!o.detached;
    this.box = Math.ceil(this.px * 2.9); this.cyK = 0.5;   /* room above the head for the hard hat to fall in */
    const c = this.canvas = document.createElement('canvas');
    this.dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    c.width = c.height = Math.round(this.box * this.dpr);
    c.style.width = c.style.height = this.box + 'px';
    c.style.left = (this.px / 2 - this.box / 2) + 'px';
    c.style.top = (this.px / 2 - this.box * this.cyK) + 'px';
    host.style.width = this.px + 'px'; host.style.height = Math.round(this.px * 1.3) + 'px';
    host.appendChild(c);
    this.ctx = c.getContext('2d');
    const S = (x, k, z) => new Spring(x, k, z);
    this.s = {
      eyeX: S(0, 420, 0.8), eyeY: S(0, 420, 0.8), headX: S(0, 150, 0.62), headY: S(0, 150, 0.62),
      bodyX: S(0, 70, 0.5), bodyY: S(0, 70, 0.5), roll: S(0, 110, 0.45), offX: S(0, 130, 0.55), offY: S(0, 130, 0.55),
      squash: S(0, 260, 0.32), sag: S(0, 60, 0.9), skew: S(0, 140, 0.4),
      eyeHL: S(1, 380, 0.75), eyeHR: S(1, 380, 0.75), eyeWL: S(1, 380, 0.75), eyeWR: S(1, 380, 0.75),
      lidL: S(0, 300, 0.85), lidR: S(0, 300, 0.85), lidAL: S(0, 300, 0.85), lidAR: S(0, 300, 0.85),
      cheekL: S(0, 260, 0.7), cheekR: S(0, 260, 0.7),
      tailLen: S(1, 120, 0.5), tailSwing: S(0, 80, 0.35), bloom: S(0, 120, 0.5), spin: S(0, 38, 0.78),
      /* version 2 */
      smile: S(0.3, 200, 0.6), mouthOpen: S(0, 260, 0.55), mouthW: S(1, 200, 0.7),
      browL: S(0, 300, 0.5), browR: S(0, 300, 0.5), browAL: S(0, 300, 0.6), browAR: S(0, 300, 0.6),
      blush: S(0, 90, 0.9), glasses: S(0, 170, 0.5), loupe: S(0, 170, 0.5),
      echo: S(1, 90, 0.45), echoX: S(0, 60, 0.45), echoY: S(0, 60, 0.45), hat: S(0, 150, 0.42),
    };
    this.lift = 0; this.vLift = 0; this.air = false; this.pendingHop = null;
    this.t = this.rand() * 10; this.st = 0; this.marks = {};
    this.nextBlink = this.t + 1 + this.rand() * 3; this.blinkAt = -10; this.blinkN = 1;
    this.nextDart = this.t + 1; this.dartX = 0; this.dartY = 0;
    this.wanderX = 0; this.wanderY = 0; this.nextWander = 0;
    this.col = hexRgb(this.fixedColour || this.P.colour); this.colFrom = this.col; this.colTo = this.col; this.colT = 1;
    this.bloomUntil = -1; this.bloomRot = 0;
    this.tip = null; this.tipV = { x: 0, y: 0 }; this.acc = null; this.accV = { x: 0, y: 0 };
    this.ph = this.rand() * TAU; this.visible = true; this.geo = null; this.T = {};
    this.s.echoX.x = this.s.echoX.t = -this.P.echoOff; this.s.echoY.x = this.s.echoY.t = -this.P.echoOff * 0.9;   /* the second bubble starts in place */
    avatars.push(this);
  }

  /* one-off moves */
  setState(name) {
    if (name === this.state || !STATES[name]) return;
    this.state = name; this.st = 0; this.marks = {}; this.nextWander = 0;
    this.blink(1); this.nod(1.1);
  }
  every(key, period, offset = 0) {
    const n = Math.floor((this.st - offset) / period), prev = this.marks[key] === undefined ? -1 : this.marks[key];
    if (n > prev) { this.marks[key] = n; return true; }
    return false;
  }
  blink(n) { this.blinkAt = this.t; this.blinkN = n; }
  blinkOpen() {
    let tau = this.t - this.blinkAt;
    if (this.blinkN === 2 && tau >= 0.3) tau -= 0.3;
    if (tau < 0 || tau > 0.27) return 1;
    if (tau < 0.07) return 1 - ease(tau / 0.07);
    if (tau < 0.11) return 0;
    return ease((tau - 0.11) / 0.16);
  }
  hop(h) { if (this.air || this.pendingHop || this.P.hop <= 0) return; this.pendingHop = { at: this.t + 0.11, v: Math.sqrt(2 * GRAVITY * 0.62 * h * this.P.hop) }; }
  nod(v) { this.s.squash.v += v * this.P.squash; }
  spinOnce() { this.s.spin.t += TAU; }
  bloomPulse() { if (this.P.petalDepth > 0) this.bloomUntil = this.t + this.P.bloomLen * 0.6; }
  setColour(hex, animate) {
    const to = hexRgb(hex);
    if (!animate) { this.col = this.colFrom = this.colTo = to; this.colT = 1; return; }
    this.colFrom = this.col.slice(); this.colTo = to; this.colT = -0.45; this.bloomPulse();
  }

  update(dtReal) {
    const P = this.P, s = this.s, T = this.T;
    const dt = dtReal * P.speed; if (dt <= 0) return;
    this.t += dt; this.st += dt;

    /* 1. the state sets targets */
    T.gx = 0; T.gy = 0; T.roll = 0; T.offX = 0; T.offY = 0; T.sag = 0; T.pointer = 0;
    T.eyeH = [1, 1]; T.eyeW = [1, 1]; T.lid = [0, 0]; T.lidA = [0, 0]; T.cheek = [0, 0]; T.tailLen = 1; T.tailSwing = 0;
    T.smile = 0.3; T.mouthOpen = 0; T.mouthW = 1; T.brow = [0, 0]; T.browA = [0, 0]; T.blush = 0; T.echo = 1;
    STATES[this.state].tick(this, this.st, T);
    const prop = propOf(P, this.state);

    /* 2. life that runs under every state */
    if (P.blinkRate > 0 && this.t >= this.nextBlink) { this.blink(this.rand() < 0.18 ? 2 : 1); this.nextBlink = this.t + (2.2 + this.rand() * 3.2) / P.blinkRate; }
    if (this.t >= this.nextDart) { this.dartX = (this.rand() * 2 - 1) * 0.07 * P.darts; this.dartY = (this.rand() * 2 - 1) * 0.045 * P.darts; this.nextDart = this.t + 0.7 + this.rand() * 2; }
    let gx = T.gx, gy = T.gy;
    if (P.follow && T.pointer > 0 && pointer.active && !this.detached) {
      const r = this.host.getBoundingClientRect(), U = this.px / 2;
      const dx = (pointer.x - (r.left + r.width / 2)) / (U * 4.5), dy = (pointer.y - (r.top + this.px / 2)) / (U * 4.5);
      const m = Math.sqrt(1 + dx * dx + dy * dy);
      gx = lerp(gx, (dx / m) * 1.05, T.pointer); gy = lerp(gy, (dy / m) * 1.05, T.pointer);
    }
    gx += this.dartX; gy += this.dartY;

    s.eyeX.t = gx; s.eyeY.t = gy; s.headX.t = gx; s.headY.t = gy; s.bodyX.t = gx; s.bodyY.t = gy;
    s.roll.t = T.roll; s.offX.t = T.offX; s.offY.t = T.offY; s.sag.t = T.sag;
    s.eyeHL.t = T.eyeH[0]; s.eyeHR.t = T.eyeH[1]; s.eyeWL.t = T.eyeW[0]; s.eyeWR.t = T.eyeW[1];
    s.lidL.t = T.lid[0]; s.lidR.t = T.lid[1]; s.lidAL.t = T.lidA[0]; s.lidAR.t = T.lidA[1];
    s.cheekL.t = T.cheek[0]; s.cheekR.t = T.cheek[1];
    s.tailLen.t = T.tailLen; s.tailSwing.t = T.tailSwing;
    s.bloom.t = this.t < this.bloomUntil ? 1 : 0;
    s.smile.t = T.smile; s.mouthOpen.t = T.mouthOpen; s.mouthW.t = T.mouthW;
    s.browL.t = T.brow[0]; s.browR.t = T.brow[1]; s.browAL.t = T.browA[0]; s.browAR.t = T.browA[1];
    s.blush.t = T.blush; s.echo.t = T.echo;
    s.glasses.t = prop === 'glasses' ? 1 : 0; s.loupe.t = prop === 'magnifier' ? 1 : 0; s.hat.t = prop === 'hard hat' ? 1 : 0;
    s.echoX.t = -P.echoOff * s.echo.x * Math.cos(s.spin.x) - s.bodyX.x * P.echoPar;
    s.echoY.t = -P.echoOff * 0.9 * s.echo.x - s.bodyY.x * P.echoPar * 0.6;

    /* 3. springs and the hop, in small steps */
    let crouch = 0;
    if (this.pendingHop) {
      crouch = 0.13 * P.squash;
      if (this.t >= this.pendingHop.at) { this.vLift = this.pendingHop.v; this.air = true; this.pendingHop = null; crouch = 0; }
    }
    const km = P.snap, zm = lerp(1.55, 0.45, P.bounce);
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) {
      if (this.air) {
        this.vLift -= GRAVITY * h; this.lift += this.vLift * h;
        if (this.lift <= 0) { const impact = -this.vLift; this.lift = 0; this.vLift = 0; this.air = false; s.squash.v += Math.min(impact, 7) * 0.5 * P.squash; }
      }
      s.squash.t = this.air ? -clamp(Math.abs(this.vLift) * 0.03, 0, 0.11) * P.squash : crouch;
      const before = s.offX.x + s.bodyX.x * P.lean;
      for (const k in s) s[k].step(h, km, zm);
      const vx = (s.offX.x + s.bodyX.x * P.lean - before) / h;
      s.skew.t = clamp(-vx * 0.045 * P.jelly, -0.22, 0.22);
    }
    s.squash.x = clamp(s.squash.x, -0.3, 0.4);
    if (s.spin.t !== 0 && Math.abs(s.spin.t - s.spin.x) < 0.002 && Math.abs(s.spin.v) < 0.002) { s.spin.x = 0; s.spin.t = 0; s.spin.v = 0; }
    this.bloomRot += dt * 2.2 * clamp(s.bloom.x, 0, 1);
    if (this.colT < 1) { this.colT = Math.min(1, this.colT + dt / 0.38); const e = ease(this.colT); this.col = this.colFrom.map((v, i) => lerp(v, this.colTo[i], e)); }

    this.pose(dt);
  }

  /* a point that trails behind its resting place: used by the tail tip and by what sits on the head */
  trail(pos, vel, rest, lag, max, dt) {
    const kk = lerp(1400, 100, lag), cc = 2 * Math.sqrt(kk) * lerp(1, 0.32, lag);
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) {
      vel.x += (-kk * (pos.x - rest[0]) - cc * vel.x) * h; vel.y += (-kk * (pos.y - rest[1]) - cc * vel.y) * h;
      pos.x += vel.x * h; pos.y += vel.y * h;
    }
    const dx = pos.x - rest[0], dy = pos.y - rest[1], d = Math.hypot(dx, dy);
    if (d > max) { pos.x = rest[0] + (dx / d) * max; pos.y = rest[1] + (dy / d) * max; }
  }

  /* 4. turn spring values into shapes */
  pose(dt) {
    const P = this.P, s = this.s, box = this.box, U = this.px / 2;
    const cx = box / 2, cy = box * this.cyK;
    const bloom = clamp(s.bloom.x, 0, 1.25), b1 = Math.min(1, bloom), spin = s.spin.x;
    const br = Math.sin(this.t * 1.5 + this.ph) * P.breath;
    const sx = (1 + s.squash.x * 0.85) * (1 + s.sag.x * 0.8) * (1 - 0.007 * br) * (1 - P.squeeze * Math.sin(spin) ** 2);
    const sy = (1 - s.squash.x) * (1 - s.sag.x) * (1 + 0.016 * br) * (1 - 0.04 * s.bodyY.x);
    const roll = s.roll.x + s.bodyX.x * P.tilt * Math.PI / 180 + 0.012 * P.breath * Math.sin(this.t * 0.53 + this.ph * 2);
    const ox = s.bodyX.x * P.lean + s.offX.x, oy = s.bodyY.x * P.lean * 0.6 + s.offY.x - this.lift;
    const k = s.skew.x, cr = Math.cos(roll), sr = Math.sin(roll), pv = 0.7;
    const W = (x, y) => { const x1 = x * sx, y1 = 1 + (y - 1) * sy, x2 = x1 + k * (1 - y1) * 0.5, yy = y1 - pv; return [cx + (cr * x2 - sr * yy + ox) * U, cy + (sr * x2 + cr * yy + pv + oy) * U]; };

    /* body: a superellipse that can grow petals */
    const a = lerp(P.aspect, 1, b1), nn = lerp(P.square, 2, b1), N = this.px < 40 ? 60 : 144, ex = -1 / nn, grow = 1 + 0.05 * bloom;
    const d = P.petalDepth, amp = Math.min(1.12, Math.pow(bloom, 1.4));
    const radius = (th) => Math.pow(Math.pow(Math.abs(Math.cos(th) / a), nn) + Math.pow(Math.abs(Math.sin(th)), nn), ex);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU;
      const r = radius(th) * grow * lerp(1, (1 + d * 0.35) * (1 - d + d * Math.pow(Math.abs(Math.cos(P.petals * 0.5 * (th - this.bloomRot))), 0.7)), amp);
      pts.push(W(r * Math.cos(th), r * Math.sin(th)));
    }

    /* second bubble: the back square of the Gorgias symbol */
    let echo = null;
    if (P.echo && b1 < 0.9) {
      const sc = 0.94 * (1 - b1), ex2 = s.echoX.x, ey2 = s.echoY.x, M = this.px < 40 ? 40 : 96;
      echo = [];
      for (let i = 0; i < M; i++) { const th = (i / M) * TAU, r = radius(th) * sc; echo.push(W(r * Math.cos(th) + ex2, r * Math.sin(th) + ey2)); }
    }

    /* tail: the bottom-right corner of the Gorgias symbol, pulled to a point */
    const tl = P.tailLen * Math.max(0, s.tailLen.x) * Math.max(0, 1 - bloom);
    let tail = null;
    if (tl > 0.015) {
      const u = Math.cos(spin), w = P.tailW, yb = 0.86, c0 = u * a;
      const p1 = [c0 - w * (0.5 + 0.5 * u), yb], p2 = [c0 + w * (0.5 - 0.5 * u), yb];
      const pc = [u >= 0 ? p2[0] : p1[0], yb * (1 - Math.abs(u))];
      const mx = (p1[0] + p2[0]) / 2, sw = s.tailSwing.x - s.bodyX.x * 0.12, cs = Math.cos(sw), ss = Math.sin(sw);
      const dx = c0 - mx, dy = 1 + tl - yb;
      const rest = W(mx + cs * dx - ss * dy, yb + ss * dx + cs * dy);
      if (!this.tip) { this.tip = { x: rest[0], y: rest[1] }; this.tipV = { x: 0, y: 0 }; }
      this.trail(this.tip, this.tipV, rest, P.tailLag, U * 0.3, dt);
      tail = { p1: W(p1[0], p1[1]), p2: W(p2[0], p2[1]), pc: W(pc[0], pc[1]), tip: [this.tip.x, this.tip.y], r: P.tailTip * U };
    } else { this.tip = null; }

    /* hard hat: it follows a point that trails behind the top of the head, so it bobs on every nod */
    let hat = null;
    if (s.hat.x > 0.02 || s.hat.t > 0) {
      const rest = W(0, -P.hatLift);
      if (!this.acc) { this.acc = { x: rest[0], y: rest[1] }; this.accV = { x: 0, y: 0 }; }
      this.trail(this.acc, this.accV, rest, P.hatBob, U * 0.2, dt);
      hat = { rest, tip: [this.acc.x, this.acc.y] };
    } else { this.acc = null; }

    /* face: every feature sits on an invisible sphere.
       pop > 0 puts a feature in front of the eyes, so it slides further. lead = 0 ignores the quick eye movement. */
    const maxA = P.turn * Math.PI / 180, Rf = P.depth, nar = Math.min(1, P.narrow);
    const proj = (x0, y0, pop = 0, lead = 1) => {
      const hx = s.headX.x + P.lead * lead * (s.eyeX.x - s.headX.x), hy = s.headY.x + P.lead * lead * (s.eyeY.x - s.headY.x);
      const ax = Math.asin(clamp(x0 / Rf, -0.97, 0.97)), ay = Math.asin(clamp(y0 / (Rf * 0.85), -0.97, 0.97));
      const ang = hx * maxA + spin + ax, bet = hy * maxA * 0.8 + ay, ca = Math.cos(ang), cb = Math.cos(bet), R = Rf * (1 + pop);
      const ws = Math.pow(clamp(ca / Math.cos(ax), 0, 1.25), P.narrow);
      return {
        vis: ca > 0.03 && cb > 0.03 && ws > 0.02,
        x: R * Math.sin(ang) * cb / Math.cos(ay), y: P.faceY + R * 0.85 * Math.sin(bet),
        ws, hs: lerp(1, clamp(cb / Math.cos(ay), 0, 1.2), 0.5 * nar),
        tilt: -(Math.sin(ang) * Math.sin(bet) - Math.sin(ax) * Math.sin(ay)) * 0.9 * nar,
      };
    };
    const eyes = [-1, 1].map((sg) => { const e = proj(sg * P.eyeGap / 2, 0); e.sg = sg; e.tilt += P.slant * Math.PI / 180; return e; });

    const O = W(0, 0), X = W(1, 0), Y = W(0, 1);
    this.geo = { pts, echo, tail, hat, eyes, proj, m: [X[0] - O[0], X[1] - O[1], Y[0] - O[0], Y[1] - O[1], O[0], O[1]], cx, cy, ox, a, U, b1 };
  }

  draw() {
    const g = this.geo; if (!g) return;
    const P = this.P, s = this.s, ctx = this.ctx, U = g.U;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.box, this.box);
    const dark = lum(this.col) < 0.25;
    const bodyCol = rgbCss(this.col);
    const ink = dark ? PAPER : INK;                       /* line colour for features: always contrasts with the body */
    const eyeRgb = dark || P.eyeCol === 'paper' ? PAPER : INK;
    const fine = this.px >= 32, mid = this.px >= 24;      /* small avatars drop the small features */
    const smooth = (path, pts) => {
      const N = pts.length, mid2 = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], m0 = mid2(pts[N - 1], pts[0]);
      path.moveTo(m0[0], m0[1]);
      for (let i = 0; i < N; i++) { const p = pts[i], m = mid2(p, pts[(i + 1) % N]); path.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
      path.closePath();
    };

    if (P.shadow > 0 && this.px >= 32) {
      const up = clamp(this.lift, 0, 1.2);
      ctx.fillStyle = `rgba(27,26,25,${P.shadow * (1 - 0.5 * up)})`;
      ctx.beginPath(); ctx.ellipse(g.cx + g.ox * U * 0.8, g.cy + U * (1 + P.tailLen + 0.16), U * g.a * (0.7 - 0.22 * up), U * 0.075 * (1 - 0.3 * up), 0, 0, TAU); ctx.fill();
    }

    if (g.echo) {
      const back = new Path2D(); smooth(back, g.echo);
      ctx.fillStyle = rgbCss(dark ? mix(this.col, PAPER, P.echoTint * 0.42) : mix(this.col, PAPER, P.echoTint)); ctx.fill(back);
    }

    /* body and tail go into one path, so their shared edge is drawn once */
    ctx.fillStyle = bodyCol;
    const body = new Path2D(); smooth(body, g.pts);
    if (g.tail) {
      const t = g.tail;
      let seq = [t.pc, t.p2, t.tip, t.p1], area = 0;
      for (let i = 0; i < 4; i++) { const p = seq[i], n = seq[(i + 1) % 4]; area += p[0] * n[1] - n[0] * p[1]; }
      if (area < 0) seq = seq.slice().reverse(); /* same direction as the body, or the overlap would cut a hole */
      body.moveTo(seq[0][0], seq[0][1]);
      for (let i = 1; i < 4; i++) { const p = seq[i], n = seq[(i + 1) % 4]; if (p === t.tip) body.arcTo(p[0], p[1], n[0], n[1], t.r); else body.lineTo(p[0], p[1]); }
      body.closePath();
    }
    ctx.fill(body);

    if (g.hat) this.drawHat(ctx, g, body, 'shadow');   /* under the face, so the shadow never covers the brows */

    /* the face, clipped to the body */
    ctx.save(); ctx.clip(body); ctx.transform(g.m[0], g.m[1], g.m[2], g.m[3], g.m[4], g.m[5]);
    const open = this.blinkOpen();
    const opt = this.px <= 40 ? lerp(1.45, 1, clamp((this.px - 16) / 24, 0, 1)) : 1;
    const inkCss = rgbCss(ink);

    if (P.cheeks !== 'off' && fine) {
      const al = P.cheeks === 'always' ? 1 : clamp(s.blush.x, 0, 1);
      if (al > 0.02) {
        ctx.fillStyle = rgbCss(mix(this.col, BLUSH, dark ? 0.5 : 0.16 + 0.5 * P.cheekTone), al);
        [-1, 1].forEach((sg) => { const p = g.proj(sg * (P.eyeGap / 2 + 0.2), 0.3, 0, 0.5); if (!p.vis) return; ctx.beginPath(); ctx.ellipse(p.x, p.y, P.cheekSize * p.ws, P.cheekSize * 0.7 * p.hs, 0, 0, TAU); ctx.fill(); });
      }
    }
    if (P.mouth && mid) {
      const p = g.proj(0, P.mouthY, 0.04, 0.6);
      if (p.vis) {
        const mw = P.mouthW * opt * Math.max(0.2, s.mouthW.x) * p.ws, sm = clamp(s.smile.x, -1.3, 1.3) * P.mouthMove, op = clamp(s.mouthOpen.x, 0, 1.2) * P.mouthMove;
        const dt2 = sm * mw * 0.3 - op * mw * 0.1, db = dt2 + op * mw * 0.75;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
        ctx.beginPath(); ctx.moveTo(-mw / 2, 0); ctx.quadraticCurveTo(0, dt2 * 2, mw / 2, 0); ctx.quadraticCurveTo(0, db * 2, -mw / 2, 0); ctx.closePath();
        ctx.fillStyle = inkCss; ctx.strokeStyle = inkCss; ctx.lineWidth = P.mouthThick * opt; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (op > 0.04) ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    g.eyes.forEach((e, i) => {
      if (!e.vis) return;
      const R = i ? 'R' : 'L', style = P.eyeStyle, duo = style === 'duo';
      const bw = style === 'pill' ? P.eyeW : style === 'dot' ? P.eyeW * 1.3 : P.eyeW * 1.66;
      const bh = style === 'pill' ? P.eyeH : style === 'dot' ? P.eyeW * 1.36 : Math.max(P.eyeH * 1.02, P.eyeW * 1.8);
      let w = bw * opt * Math.max(0.05, duo ? 1 + (s['eyeW' + R].x - 1) * 0.3 : s['eyeW' + R].x) * e.ws;
      const hOpen = bh * opt * Math.max(0.05, s['eyeH' + R].x) * e.hs;
      const hShut = Math.min(hOpen, Math.max(P.eyeW * opt * 0.36, 1.3 / U));
      const h = lerp(hShut, hOpen, open);
      w *= 1 + 0.22 * (1 - open);
      const ch = clamp(s['cheek' + R].x, 0, 1.1), lid = clamp(s['lid' + R].x, 0, 1);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.tilt);
      const shape = rrPath(-w / 2, -h / 2, w, h, (Math.min(w, h) / 2) * (style === 'pill' ? P.eyeRound : 1));
      const closing = ease((Math.max(1 - open, Math.min(1, ch * 1.5)) - 0.55) / 0.45);   /* white eyes turn to an ink line once they are nearly shut, or smiling */
      ctx.fillStyle = rgbCss(duo ? mix(PAPER, INK, dark ? 0 : closing) : eyeRgb); ctx.fill(shape); ctx.clip(shape);
      if (duo && closing < 0.95) {
        const pr = (Math.min(w, hOpen) / 2) * P.pupil, px = clamp(s.eyeX.x, -1, 1) * (w / 2 - pr * 0.7), py = clamp(s.eyeY.x, -1, 1) * (hOpen / 2 - pr * 0.7);
        ctx.fillStyle = rgbCss(INK, 1 - closing); ctx.beginPath(); ctx.ellipse(px, py, pr * Math.min(1, e.ws + 0.15), pr, 0, 0, TAU); ctx.fill();
        if (P.shine > 0 && fine) { ctx.fillStyle = rgbCss(PAPER, 1 - closing); ctx.beginPath(); ctx.arc(px + pr * 0.32, py - pr * 0.36, pr * P.shine * 1.1, 0, TAU); ctx.fill(); }
      } else if (!duo && P.shine > 0 && fine && eyeRgb === INK) { ctx.fillStyle = rgbCss(PAPER); ctx.beginPath(); ctx.arc(w * 0.14, -h * 0.2, w * 0.5 * P.shine, 0, TAU); ctx.fill(); }
      ctx.fillStyle = bodyCol;   /* lids and the smiling cut are the body colour, drawn only inside the eye */
      if (lid > 0.01) { ctx.save(); ctx.translate(0, -h / 2 + lid * h); ctx.rotate(-e.sg * s['lidA' + R].x); ctx.fillRect(-w * 1.6, -h * 1.6, w * 3.2, h * 1.6); ctx.restore(); }
      if (ch > 0.01) { const rc = Math.max(w * 1.15, h * 0.55); ctx.beginPath(); ctx.arc(0, h / 2 + rc - ch * h * 0.78, rc, 0, TAU); ctx.fill(); }
      ctx.restore();

      if (P.brows && fine) {
        const raise = ((s['eyeH' + R].x - 1) * 0.5 - lid * 0.35 + ch * 0.3 + s['brow' + R].x) * P.browMove;
        const b = g.proj(e.sg * P.eyeGap / 2, -(bh * opt / 2 + P.browGap) - raise * 0.16, 0.06, 1);
        if (b.vis) {
          const L = P.browLen * b.ws, ang = b.tilt + P.slant * Math.PI / 180 - e.sg * (s['lidA' + R].x * 0.9 + s['browA' + R].x) * P.browMove;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
          ctx.strokeStyle = inkCss; ctx.lineWidth = P.browThick; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, -P.browCurve * P.browLen * 0.5, L / 2, 0); ctx.stroke(); ctx.restore();
        }
      }
    });

    const gs = clamp(s.glasses.x, 0, 1.3), lp = clamp(s.loupe.x, 0, 1.3);
    if ((gs > 0.03 || lp > 0.03) && mid) {
      const rings = [-1, 1].map((sg, i) => {
        const sc = i ? Math.max(gs, lp) : gs; if (sc < 0.05) return null;
        const p = g.proj(sg * P.eyeGap / 2, 0, 0.1, 0); if (!p.vis) return null;
        const r = P.glassSize * opt * sc * (i ? 1 + 0.22 * Math.max(0, lp - gs) : 1);
        return { x: p.x, y: p.y - (1 - Math.min(1, sc)) * 0.3, rx: r * Math.max(0.15, p.ws), ry: r };
      });
      ctx.strokeStyle = inkCss; ctx.lineWidth = P.glassThick * opt; ctx.lineCap = 'round';
      rings.forEach((r) => { if (!r) return; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, TAU); if (P.glassLens > 0) { ctx.fillStyle = rgbCss(PAPER, P.glassLens); ctx.fill(); } ctx.stroke(); });
      const [l, r] = rings;
      if (l && r) { ctx.beginPath(); ctx.moveTo(l.x + l.rx, l.y - l.ry * 0.1); ctx.quadraticCurveTo((l.x + r.x) / 2, Math.min(l.y, r.y) - l.ry * 0.32, r.x - r.rx, r.y - r.ry * 0.1); ctx.stroke(); }
      if (r && lp - gs > 0.3) { const q = (lp - gs); ctx.lineWidth = P.glassThick * opt * 1.7; ctx.beginPath(); ctx.moveTo(r.x + r.rx * 0.74, r.y + r.ry * 0.74); ctx.lineTo(r.x + r.rx * 0.74 + 0.17 * q, r.y + r.ry * 0.74 + 0.19 * q); ctx.stroke(); }
    }
    ctx.restore();

    if (g.hat) this.drawHat(ctx, g, body, 'hat');
  }

  /* hard hat for Testing. It falls on from above and lands with a bounce.
     The ridge slides across the dome with the gaze, so the hat turns with the head while staying flat.
     Flat styles follow the avatar's own rule: a shape is a fill with no outline, and ink is only for marks on a shape. */
  drawHat(ctx, g, body, part) {
    const P = this.P, s = this.s, h = clamp(s.hat.x, 0, 1.25); if (h < 0.02) return;
    const U = g.U, land = Math.min(1, h), sc = P.hatSize * lerp(0.7, 1, h), small = this.px < 32;
    const dx = g.hat.tip[0] - g.hat.rest[0], dy = g.hat.tip[1] - g.hat.rest[1];
    const yaw = clamp(s.headX.x, -1.2, 1.2) * Math.cos(s.spin.x) * P.hatSlide, pitch = clamp(s.headY.x, -1.2, 1.2) * P.hatSlide;
    const shell = near(this.col, AMBER) ? PAPER : P.hatCol === 'safety' ? SAFETY : AMBER, deep = mix(shell, [208, 128, 22], 0.42);
    const alpha = clamp(h * 3, 0, 1) * (1 - g.b1), line = Math.max(P.hatLine, 1.1 / (U * sc));
    const place = () => {
      ctx.translate(dx, dy - (1 - land) * 0.9 * U);
      ctx.transform(g.m[0], g.m[1], g.m[2], g.m[3], g.m[4], g.m[5]);
      ctx.translate(0, -P.hatLift); ctx.rotate((dx / U) * 0.9 - (1 - land) * 0.5); ctx.scale(sc, sc);
    };
    if (P.hatStyle === 'outline') { if (part === 'shadow') return; ctx.save(); ctx.globalAlpha = alpha; place(); this.hatOutlined(ctx, yaw, pitch, shell, line, small); ctx.restore(); return; }

    /* measures, in body units. y = 0 is the bottom of the brim at its centre. */
    const n = P.hatSquare, rx = 0.74, ry = 0.82 - pitch * 0.05, by = -0.27, bw = 0.21;   /* dome: the top half of a superellipse, like the body */
    const domeY = (x) => by - ry * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / rx, n)), 1 / n);
    const rw = 0.19, bx = yaw * 0.04, top = domeY(0) - 0.085, swing = yaw * 0.34;
    const dome = new Path2D(); dome.moveTo(-rx, by + 0.1);
    for (let i = 0; i <= 44; i++) { const a = Math.PI + (Math.PI * i) / 44, c = Math.cos(a), sn = Math.sin(a); dome.lineTo(rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), by - ry * Math.pow(Math.abs(sn), 2 / n)); }
    dome.lineTo(rx, by + 0.1); dome.closePath();
    /* the ridge is a stripe from the top of the dome to the brim. Its top stays put and its lower end swings with the gaze,
       the way a line running over a ball would. That one curve is what makes the flat hat turn. */
    const edge = (side, t) => [swing * Math.sin(t * Math.PI / 2) * (1 + 0.1 * side * Math.sign(swing) * t) + side * rw * lerp(1, 1.2, t), lerp(top + 0.1, by + 0.12, t)];
    const stripe = new Path2D();
    for (let i = 0; i <= 12; i++) { const q = edge(-1, i / 12); if (i) stripe.lineTo(q[0], q[1]); else stripe.moveTo(q[0], q[1]); }
    for (let i = 12; i >= 0; i--) { const q = edge(1, i / 12); stripe.lineTo(q[0], q[1]); }
    stripe.closePath();
    /* the brim is one thick curve with round ends: the same kind of mark as the mouth and the brows, only larger */
    const brim = () => { ctx.beginPath(); ctx.moveTo(-0.9 + bx, by + 0.03); ctx.quadraticCurveTo(bx, by + 0.3 + pitch * 0.05, 0.9 + bx, by + 0.03); ctx.stroke(); };
    const tone = P.hatStyle === 'tone';

    /* a flat shadow under the brim seats the hat on the head. It is clipped to the body, so it only shows once the hat has landed. */
    if (part === 'shadow') {
      if (P.hatShade <= 0) return;
      ctx.save(); ctx.clip(body); ctx.globalAlpha = alpha; place(); ctx.translate(0, 0.09);
      ctx.strokeStyle = rgbCss(mix(this.col, INK, P.hatShade)); ctx.lineWidth = bw; ctx.lineCap = 'round'; brim(); ctx.restore();
      return;
    }

    ctx.save(); ctx.globalAlpha = alpha; place(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = rgbCss(shell); ctx.fill(dome);
    ctx.fillStyle = rgbCss(tone ? deep : shell); ctx.fill(rrPath(-rw, top, rw * 2, 0.3, 0.085));   /* the ridge rises above the dome */
    ctx.save(); ctx.clip(dome);
    if (tone) ctx.fill(stripe);
    else if (!small) {
      /* ink version: only the two edges of the stripe are drawn */
      ctx.strokeStyle = rgbCss(INK); ctx.lineWidth = line; ctx.beginPath();
      [-1, 1].forEach((side) => { for (let i = 1; i <= 11; i++) { const q = edge(side, i / 12); if (i > 1) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } });
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = rgbCss(tone ? deep : shell); ctx.lineWidth = bw; brim();
    ctx.restore();
  }

  /* version 4's hat, kept for comparison: one shape with an ink outline all round */
  hatOutlined(ctx, yaw, pitch, shell, line, small) {
    const rx = 0.78, ry = 0.84 - pitch * 0.05, by = -0.22;
    const domeY = (x) => by - ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
    const rc = yaw * 0.2, rw = 0.2, xl = rc - rw, xr = rc + rw;
    const rtop = domeY(rc) - 0.08, bx = yaw * 0.04, sag = 0.17 + pitch * 0.04;
    const hat = new Path2D();
    hat.moveTo(-0.99 + bx, -0.05);
    hat.quadraticCurveTo(-1.08 + bx, -0.11, -1.0 + bx, -0.17);
    hat.quadraticCurveTo(-0.9 + bx * 0.5, -0.2, -rx, by);
    hat.ellipse(0, by, rx, ry, 0, Math.PI, TAU - Math.acos(xl / rx));
    hat.arcTo(xl, rtop, rc, rtop, 0.075); hat.arcTo(xr, rtop, xr, domeY(xr), 0.075); hat.lineTo(xr, domeY(xr));
    hat.ellipse(0, by, rx, ry, 0, TAU - Math.acos(xr / rx), TAU);
    hat.quadraticCurveTo(0.9 + bx * 0.5, -0.2, 1.0 + bx, -0.17);
    hat.quadraticCurveTo(1.08 + bx, -0.11, 0.99 + bx, -0.05);
    hat.quadraticCurveTo(bx, sag, -0.99 + bx, -0.05);
    hat.closePath();
    ctx.fillStyle = rgbCss(shell); ctx.fill(hat);
    ctx.strokeStyle = rgbCss(INK); ctx.lineWidth = line; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(hat);
    if (small) return;
    const low = rc * 1.3, yEnd = by - ry * 0.3;
    ctx.beginPath();
    ctx.moveTo(xl, domeY(xl) + 0.02); ctx.lineTo(low - rw - 0.035, yEnd);
    ctx.moveTo(xr, domeY(xr) + 0.02); ctx.lineTo(low + rw + 0.035, yEnd);
    ctx.stroke();
    const seam = (t) => { const u = 1 - t; return [u * u * -rx + 2 * u * t * (bx + yaw * 0.1) + t * t * rx, u * u * by + 2 * u * t * (by + 0.21 + pitch * 0.03) + t * t * by]; };
    const mark = (t0, t1) => { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const q = seam(lerp(t0, t1, i / 6)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.stroke(); };
    const slide = yaw * 0.05;
    mark(0.38 + slide, 0.62 + slide); mark(0.03, 0.115); mark(0.885, 0.97);
  }
}

window.GaiaV8 = { params, DEFAULTS, BASE_GROUPS, FEATURE_GROUPS, COLOURS, STATES, STATE_ORDER, propOf, Avatar, avatars, pointer, saveParams, hexRgb };
})();
