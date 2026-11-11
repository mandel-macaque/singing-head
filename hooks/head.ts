// The head: CHIMERA's wireframe head in a few hundred lines. Its proportions and palette come
// from CHIMERA's anatomy3d.ts and profile.ts (body cm: x forward, y up, z to the side,
// glottis at the origin); it is projected here to an SVG whose SMIL animation sings along.
import type { Show } from '../types'
import type { Phrase } from './lyrics'
import type { Seg } from './synth'

type Pt = [number, number]
type P3 = [number, number, number]
type Table = readonly (readonly [number, number])[]

const V = { blue: '#4fb6f2', blueMid: '#3487c4', blueDim: '#1f5f8c', frame: '#133954', green: '#5be381', red: '#ff5d40', pink: '#ff73cf', white: '#eef6f8', amber: '#ffb340' }

const WIDTH: Table = [[-4.6, 5.3], [0, 5.4], [2.5, 5.5], [4.5, 5.25], [6.5, 5.5], [8.5, 6.1], [10.5, 6.6], [12.5, 7.0], [15, 7.3], [17.5, 7.65], [19.5, 7.4], [21, 6.5], [22.2, 4.6], [23.0, 1.0]]
const PLANE: Table = [[3.4, 5.9], [4.6, 6.2], [5.7, 6.15], [6.5, 6.2], [8.0, 6.35], [9.5, 6.35], [10.6, 6.55], [11.6, 6.75], [12.6, 6.9], [13.9, 7.15], [15.0, 7.45], [16.1, 7.95]]
const FEATURE: Table = [[3.4, 2.0], [4.6, 2.2], [5.7, 2.4], [6.5, 2.6], [10.6, 1.7], [11.0, 1.75], [11.65, 1.2], [12.6, 0.95], [13.9, 0.75], [15.0, 0.9], [16.1, 1.6]]
const WIDEST: Table = [[-4.6, 0.5], [3.0, 0.5], [6.0, 0.42], [12, 0.42], [16, 0.45], [23, 0.45]]
const JAW_BORDER: Table = [[-3, 8.5], [-1.6, 8.0], [-0.6, 6.4], [1.2, 4.6], [3.5, 3.6], [5.3, 3.0], [7.3, 3.3], [8.6, 4.4]]
const RAMUS_BACK: Table = [[6.0, -0.6], [7.4, -0.8], [9.6, -1.9], [10.6, -2.5], [12, -2.6]]
const BRAIN_WIDTH: Table = [[12.3, 4.0], [13.0, 5.6], [14.5, 6.4], [16.5, 6.9], [18.5, 6.6], [20.0, 5.4], [21.0, 3.6], [21.45, 0.5]]
const TONGUE_W: Table = [[0, 1.5], [0.15, 1.9], [0.35, 2.35], [0.6, 2.45], [0.8, 2.2], [0.92, 1.5], [1, 0.55]]
const TONGUE_H: Table = [[0, 1.3], [0.35, 1.1], [0.7, 0.9], [0.9, 0.55], [1, 0.25]]
const UPPER_TEETH = [0.85, 0.68, 0.78, 0.7, 0.68, 1.0, 0.92]
const PB = 2.2
const CONDYLE: Pt = [-2.5, 10.5]

function interp(tab: Table, x: number): number {
  const first = tab[0]!, lastRow = tab[tab.length - 1]!
  if (x <= first[0]) return first[1]
  for (let i = 1; i < tab.length; i++) {
    const [x1, y1] = tab[i]!
    if (x <= x1) {
      const [x0, y0] = tab[i - 1]!
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return lastRow[1]
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const bump = (u: number) => (Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0)

function catmullRom(p: Pt[], per: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[Math.min(p.length - 1, i + 2)]!
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(p[p.length - 1]!)
  return out
}

// ------------------------------------------------------------------ the rest pose (jaw closed)

const neckFront = catmullRom([[2.3, -4.6], [2.38, -1.5], [2.52, 0.4], [3.0, 1.7], [5.3, 3.0], [7.25, 3.35], [7.95, 4.6], [7.55, 5.7]], 4)
const llOut: Pt[] = [[7.55, 8.95], [8.0, 8.7], [8.05, 8.2], [7.6, 7.6], [7.05, 7.0], [7.2, 6.4]]
const ulOut: Pt[] = [[7.55, 9.05], [8.05, 9.3], [8.2, 9.75], [7.95, 10.2], [7.4, 10.5]]
const face = catmullRom([[7.4, 10.5], [7.05, 10.6], [7.75, 10.78], [8.75, 11.05], [9.25, 11.65], [8.95, 12.6], [8.35, 13.9], [7.7, 15.0], [7.95, 16.1], [7.9, 18.1], [6.9, 20.5]], 4)
const cranium = catmullRom([[6.9, 20.5], [3.0, 22.9], [-2.2, 22.7], [-6.9, 19.6], [-8.7, 15.4], [-8.3, 11.9], [-7.4, 8.9], [-6.8, 4.8], [-6.6, 0], [-6.6, -4.6]], 4)
const SKIN: Pt[] = [...neckFront, ...llOut.slice().reverse(), ...ulOut, ...face.slice(1), ...cranium.slice(1)]
const BRAIN = catmullRom([[6.55, 16.3], [6.75, 18.4], [5.5, 20.1], [2.8, 21.4], [-1.9, 21.3], [-5.8, 18.8], [-7.1, 15.4], [-6.7, 13.1], [-4.4, 12.8], [-2.1, 13.9], [1.0, 14.3], [4.0, 14.7], [5.9, 15.4], [6.55, 16.3]], 3)

function crossings(poly: Pt[], y: number): [number, number] | null {
  let F = -Infinity, Bk = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!
    if (a[1] > y === b[1] > y) continue
    const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1])
    F = Math.max(F, x)
    Bk = Math.min(Bk, x)
  }
  return F > Bk ? [F, Bk] : null
}

type Section = { F: number; Bk: number; Fs: number; W: number; xw: number; E: number; wf: number; pf: number }
function section(y: number): Section | null {
  const c = crossings(SKIN, y)
  if (!c) return null
  const [F, Bk] = c
  const plane = y >= 3.4 && y <= 16.1 ? interp(PLANE, y) : Infinity
  const Fs = Math.min(F, plane)
  const pf = 2.2 + 0.4 * smooth(2.5, 3.5, y) * (1 - smooth(17, 18.5, y))
  return { F, Bk, Fs, W: interp(WIDTH, y), xw: Bk + (Fs - Bk) * interp(WIDEST, y), E: F - Fs, wf: interp(FEATURE, y), pf }
}

/** a point of the head's surface at height y, angle th (0 the face's midline, pi the back) */
function surface(s: Section, y: number, th: number): P3 {
  const c = Math.cos(th), sn = Math.sin(th)
  const p = c >= 0 ? s.pf : PB
  const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), sz = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p)
  const z = s.W * sz
  const x = c >= 0 ? s.xw + (s.Fs - s.xw) * sx + s.E * bump(z / s.wf) : s.xw + (s.xw - s.Bk) * sx
  return [x, y, z]
}

/** how much of the jaw's turn a point of the skin follows (CHIMERA's skinning weights) */
function jawWeight(x: number, y: number): number {
  const wv = 1 - smooth(7.6, 9.1, y)
  const yb = interp(JAW_BORDER, x)
  const wl = smooth(yb - 1.5, yb + 0.15, y)
  const xr = interp(RAMUS_BACK, y)
  const wb = smooth(xr - 0.7, xr + 0.9, x)
  return wv * wl * wb
}
const inMouth = (p: P3) => p[1] > 8.05 && p[1] < 10.05 && p[0] > 6.4 && Math.abs(p[2]) < 2.55

type Skinned = { pts: P3[]; w: number[] }
type Geometry = { still: P3[][]; moving: Skinned[]; brain: P3[][]; eyes: { c: P3; side: number }[]; ears: P3[][]; airway: P3[]; neck: P3[][] }

let geometry: Geometry | undefined
function build(): Geometry {
  if (geometry) return geometry
  const still: P3[][] = [], moving: Skinned[] = []
  const add = (line: P3[]) => {
    // split into runs outside the mouth's hole, then into still and jaw-carried parts
    let run: P3[] = []
    const runs: P3[][] = []
    for (const p of line) {
      if (inMouth(p)) {
        if (run.length > 1) runs.push(run)
        run = []
      } else run.push(p)
    }
    if (run.length > 1) runs.push(run)
    for (const r of runs) {
      const w = r.map(p => jawWeight(p[0], p[1]))
      let i = 0
      while (i < r.length) {
        const m = w[i]! > 0.003
        let j = i
        while (j < r.length && w[j]! > 0.003 === m) j++
        const a = Math.max(0, i - 1), b = Math.min(r.length, j + 1)
        const part = r.slice(a, b)
        if (part.length > 1) (m ? moving.push({ pts: part, w: w.slice(a, b) }) : still.push(part))
        i = j
      }
    }
  }
  // more points toward the face, where the nose and lips are
  const warp = (th: number) => th - 0.6 * Math.sin(th)
  const N = 44
  for (let y = -4.2; y <= 22.7; y += 0.95) {
    const s = section(y)
    if (!s) continue
    const ring: P3[] = []
    for (let i = 0; i <= N; i++) ring.push(surface(s, y, warp((i / N) * Math.PI * 2)))
    add(ring)
  }
  for (let k = 0; k < 14; k++) {
    const th = warp((k / 14) * Math.PI * 2 + 0.11)
    const line: P3[] = []
    for (let y = -4.4; y <= 22.9; y += 0.45) {
      const s = section(y)
      if (s) line.push(surface(s, y, th))
    }
    add(line)
  }
  const brain: P3[][] = []
  for (let y = 13.0; y <= 21.2; y += 1.15) {
    const c = crossings(BRAIN, y)
    if (!c) continue
    const [F, Bk] = c, W = interp(BRAIN_WIDTH, y), cx = (F + Bk) / 2, a = (F - Bk) / 2
    const ring: P3[] = []
    for (let i = 0; i <= 28; i++) {
      const th = (i / 28) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th)
      ring.push([cx + a * Math.sign(cs) * Math.abs(cs) ** (2 / 2.2), y, W * Math.sign(sn) * Math.abs(sn) ** (2 / 2.2)])
    }
    brain.push(ring)
  }
  const ears: P3[][] = []
  for (const side of [1, -1]) {
    const z = side * (interp(WIDTH, 12.6) + 0.15)
    for (const [rx, ry] of [[1.25, 2.9], [0.75, 2.0]] as const) {
      const e: P3[] = []
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 2
        e.push([-1.7 + rx * Math.cos(a), 12.7 + ry * Math.sin(a), z])
      }
      ears.push(e)
    }
  }
  const neck: P3[][] = []
  for (let y = -4.0; y <= 1.6; y += 0.8) {
    const r: P3[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2
      r.push([1.0 + 0.85 * Math.cos(a), y, 0.95 * Math.sin(a)])
    }
    neck.push(r)
  }
  const airway: P3[] = catmullRom([[0.6, 1.6], [-0.5, 3.0], [-1.0, 5.0], [-1.05, 7.5], [-0.7, 9.3], [0.6, 9.0], [2.5, 9.3], [4.5, 9.45], [6.3, 9.2], [7.4, 9.0], [8.4, 9.0]], 3).map(([x, y]) => [x, y, 0])
  geometry = { still, moving, brain, eyes: [{ c: [6.15, 15.4, 3.25], side: 1 }, { c: [6.15, 15.4, -3.25], side: -1 }], ears, airway, neck }
  return geometry
}

// ------------------------------------------------------------------ poses of the mouth

type Pose = { jaw: number; round: number; closed: boolean; front: number; high: number; tip: number }
export const POSES: Pose[] = [
  { jaw: 0.12, round: 0.15, closed: true, front: 0.5, high: 0.4, tip: 0 }, // 0 m b p, rest
  { jaw: 0.55, round: 0, closed: false, front: 0.95, high: 0.95, tip: 0.6 }, // 1 ee, t d n s l
  { jaw: 1.05, round: 0.05, closed: false, front: 0.7, high: 0.45, tip: 0 }, // 2 eh uh er
  { jaw: 1.7, round: 0.1, closed: false, front: 0.25, high: 0.05, tip: 0 }, // 3 ah
  { jaw: 0.95, round: 0.75, closed: false, front: 0.1, high: 0.45, tip: 0 }, // 4 oh
  { jaw: 0.5, round: 1, closed: false, front: 0.05, high: 0.9, tip: 0 }, // 5 oo w
]
const PHONE_POSE: Record<string, number | [number, number]> = {
  IY: 1, IH: 1, EY: [1, 1], Y: 1, EH: 2, AE: 2, AH: 2, ER: 2, AA: 3, AO: 4, AY: [3, 1], AW: [3, 5], OY: [4, 1],
  OW: [4, 5], UH: 4, UW: 5, W: 5, R: 4, M: 0, B: 0, P: 0, F: 1, V: 1, K: 2, G: 2, NG: 2, HH: 2, E: 2, O: 4,
}
const poseOf = (ph: string): [number, number] => {
  const p = PHONE_POSE[ph] ?? 1
  return typeof p === 'number' ? [p, p] : p
}

const rot = (p: P3, ang: number): P3 => {
  const c = Math.cos(ang), s = Math.sin(ang), dx = p[0] - CONDYLE[0], dy = p[1] - CONDYLE[1]
  return [CONDYLE[0] + dx * c - dy * s, CONDYLE[1] + dx * s + dy * c, p[2]]
}
// a little more than life: it's a toy, and the mouth should read from across the room
const jawAngle = (jaw: number) => (-jaw * 1.6) / 9.84

type Parts = { shell: P3[][]; lips: P3[][]; teeth: P3[][]; tongue: P3[][]; mandible: P3[][] }

function posed(pose: Pose): Parts {
  const g = build()
  const phi = jawAngle(pose.jaw)
  const shell = g.moving.map(m => m.pts.map((p, i) => rot(p, phi * (m.w[i] ?? 0))))
  // lips: an inner edge and an outer border each, top and bottom
  const w = 2.45 - 1.15 * pose.round, pr = 0.45 * pose.round
  const lipX = (z: number, base: number) => base + pr - 1.15 * (z / 2.4) ** 2
  const round = pose.closed ? 0 : 0.28 * pose.round
  const curve = (f: (z: number, u: number) => P3) => Array.from({ length: 11 }, (_, i) => {
    const z = -w + (2 * w * i) / 10
    return f(z, Math.abs(z) / w)
  })
  const upIn = curve((z, u) => [lipX(z, 7.75), 9.02 + 0.1 * u * u + round * (1 - u * u) + (pose.closed ? 0 : 0.06), z])
  const upOut = curve((z, u) => [lipX(z, 8.12), 9.62 - 0.55 * u * u, z])
  const lowRest = curve((z, u) => [lipX(z, 7.7), 8.98 - 0.08 * u * u - round * (1 - u * u), z])
  const lowOutRest = curve((z, u) => [lipX(z, 8.02), 8.38 + 0.55 * u * u, z])
  const lw = (z: number) => 1 - 0.6 * (z / w) ** 2
  const low = lowRest.map(p => rot(p, phi * lw(p[2])))
  const lowOut = lowOutRest.map(p => rot(p, phi * lw(p[2])))
  const lips = [[...upIn, ...upOut.slice().reverse(), upIn[0]!], [...low, ...lowOut.slice().reverse(), low[0]!]]
  // teeth: upper still, lower carried by the jaw
  const arch = (xi: number, y0: number, y1: number, ang: number): P3[][] => {
    const zs = Array.from({ length: 15 }, (_, i) => -2.3 + (4.6 * i) / 14)
    const at = (z: number, y: number): P3 => rot([xi - 0.62 * z * z, y + 0.12 * Math.abs(z), z], ang)
    const lines: P3[][] = [zs.map(z => at(z, y0)), zs.map(z => at(z, y1))]
    let s = 0
    for (const tw of UPPER_TEETH) {
      s += tw * 0.62
      for (const side of [1, -1]) {
        const z = side * Math.min(2.3, s)
        lines.push([at(z, y0), at(z, y1)])
      }
    }
    lines.push([at(0, y0), at(0, y1)])
    return lines
  }
  const teeth = [...arch(7.3, 8.95, 9.75, 0), ...arch(7.02, 9.12, 8.25, phi)]
  // tongue: ribs across a midline that humps toward the palate
  const tphi = phi * 0.6
  const ribs: P3[][] = []
  const mid: P3[] = [], edgeL: P3[] = [], edgeR: P3[] = []
  for (let k = 0; k <= 9; k++) {
    const u = k / 9
    const x = 1.0 + 5.7 * Math.pow(u, 0.9) - 0.35 * (1 - pose.front) * (1 - u)
    const floor = 6.3 + 1.9 * u
    const hump = (1.25 + 1.0 * pose.high) * Math.exp(-(((u - (0.3 + 0.38 * pose.front)) / 0.3) ** 2))
    const top = Math.min(9.05, floor + hump + pose.tip * 0.8 * smooth(0.75, 1, u))
    const wdt = interp(TONGUE_W, u) * 0.95, drop = interp(TONGUE_H, u)
    const rib: P3[] = []
    for (let j = 0; j <= 8; j++) {
      const z = -wdt + (2 * wdt * j) / 8
      rib.push(rot([x, top - drop * (z / wdt) ** 2, z], tphi))
    }
    ribs.push(rib)
    mid.push(rot([x, top, 0], tphi))
    edgeL.push(rib[0]!)
    edgeR.push(rib[8]!)
  }
  const tongue = [...ribs, mid, edgeL, edgeR]
  // mandible: the lower border, the ramus up to the condyle, the alveolar ridge
  const mandible: P3[][] = []
  for (const side of [1, -1]) {
    const border: P3[] = []
    for (let i = 0; i <= 10; i++) {
      const x = 7.4 - (8.0 * i) / 10
      border.push(rot([x, interp(JAW_BORDER, x) + 0.3, side * 4.6 * Math.sqrt(Math.max(0, (7.6 - x) / 8.2))], phi))
    }
    border.push(rot([-1.7, 8.4, side * 4.75], phi), rot([-2.5, 10.4, side * 4.9], phi))
    mandible.push(border)
    mandible.push([rot([0.5, 7.0, side * 4.3], phi), rot([0.3, 9.9, side * 4.5], phi)])
    const ridge: P3[] = []
    for (let i = 0; i <= 8; i++) {
      const z = (side * 2.4 * i) / 8
      ridge.push(rot([7.0 - 0.62 * z * z, 7.55 + 0.1 * Math.abs(z), z], phi))
    }
    mandible.push(ridge)
  }
  mandible.push([rot([7.4, 4.75, -0.6], phi), rot([7.55, 4.7, 0], phi), rot([7.4, 4.75, 0.6], phi)])
  return { shell, lips, teeth, tongue, mandible }
}

// ------------------------------------------------------------------ the camera

const HW = 600, HH = 780, S = 25

type Cam = { yaw: number; pitch: number }
function project(p: P3, cam: Cam): [number, number, number] {
  const q: P3 = [p[0] - 0.4, p[1] - 9.4, p[2]]
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch)
  const x1 = q[0] * cy - q[2] * sy, z1 = q[0] * sy + q[2] * cy
  const y2 = q[1] * cp - z1 * sp, z2 = q[1] * sp + z1 * cp
  const k = 70 / (70 - z2)
  return [HW / 2 + S * x1 * k, HH / 2 - S * y2 * k + 10, z2]
}

/** does a point of the shell face the camera (its outward normal toward the viewer)? */
function facing(p: P3, cam: Cam): boolean {
  const s = section(p[1])
  const cx = s ? (s.F + s.Bk) / 2 : 0.5
  const nx = p[0] - cx, nz = p[2]
  return nx * Math.sin(cam.yaw) + nz * Math.cos(cam.yaw) > 0
}

const num = (v: number) => String(Math.round(v))
function d(lines: P3[][], cam: Cam): string {
  return lines
    .map(l => 'M' + l.map(p => { const [x, y] = project(p, cam); return `${num(x)} ${num(y)}` }).join(' '))
    .join('')
}
/** shell lines split into the half facing us and the half behind */
function shellD(lines: P3[][], cam: Cam): [string, string] {
  const front: P3[][] = [], back: P3[][] = []
  for (const l of lines) {
    let run: P3[] = [], f = facing(l[0]!, cam)
    for (const p of l) {
      const pf = facing(p, cam)
      if (pf !== f) {
        run.push(p)
        if (run.length > 1) (f ? front : back).push(run)
        run = [p]
        f = pf
      } else run.push(p)
    }
    if (run.length > 1) (f ? front : back).push(run)
  }
  return [d(front, cam), d(back, cam)]
}

// ------------------------------------------------------------------ what the pane shows


/** The visual score of a phrase: when each word lights up and how the mouth moves. */
export function score(id: number, phrase: Phrase, segs: Seg[], caption: string, yaw: number): Show {
  const keys: [number, number][] = [[0, 0]]
  for (const s of segs) {
    const d = s.t1 - s.t0
    const [a, b] = poseOf(s.ph)
    if (s.vowel) {
      keys.push([s.t0 + Math.min(0.07, d * 0.3), a])
      if (a !== b) keys.push([s.t0 + d * 0.55, a], [s.t0 + d * 0.9, b])
      else keys.push([s.t1 - Math.min(0.03, d * 0.2), a])
    } else keys.push([s.t0 + d * 0.5, a])
  }
  keys.push([phrase.dur + 0.12, 0])
  const wordAt = phrase.words.map((_, i) => phrase.notes.find(n => n.syl.word === i)?.start ?? 0)
  const onsets = segs.filter(s => s.vowel).map(s => s.t0)
  return { id, mode: 'sing', kind: phrase.kind, caption, words: phrase.words, wordAt, keys, onsets, dur: phrase.dur + 0.2, beat: phrase.beat, yaw }
}

export const idleShow = (id: number, caption: string): Show => ({ id, mode: 'idle', kind: 'idle', caption, words: [], wordAt: [], keys: [], onsets: [], dur: 0, beat: 0.5, yaw: 0.62 })

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString()
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const KIND_LABEL: Record<Show['kind'], string> = { say: 'CLAUDE SAYS', prompt: 'YOU ASKED', tool: 'NOW WORKING', question: 'A QUESTION FOR YOU', answer: 'THE ANSWER', song: 'A SONG WHILE YOU WAIT', hello: 'HELLO', joke: 'DAD JOKE', rant: 'THE HEAD SPEAKS', laugh: 'MWAHAHA', reply: 'THE HEAD REPLIES', idle: 'RESTING' }

type Move = 'bounce' | 'sway' | 'headbang' | 'tilt' | 'spin' | 'groove' | 'shake' | 'flip' | 'upside' | 'cartwheel'

/** Which move a phrase gets: songs groove, answers spin, questions tilt, the rest take turns. */
function moveFor(show: Show): Move {
  if (show.kind === 'song') return 'groove'
  if (show.kind === 'answer') return 'spin'
  if (show.kind === 'question') return 'tilt'
  if (show.kind === 'laugh') return show.id % 3 === 0 ? 'cartwheel' : 'shake'
  if (show.kind === 'joke') return /\?\s*$/.test(show.caption) ? 'tilt' : 'spin'
  if (show.kind === 'rant') return (['shake', 'upside', 'headbang', 'flip', 'sway', 'tilt', 'cartwheel'] as const)[show.id % 7] ?? 'shake'
  if (show.kind === 'reply') return (['bounce', 'flip', 'sway', 'headbang', 'upside'] as const)[show.id % 5] ?? 'bounce'
  return (['bounce', 'sway', 'headbang', 'bounce', 'sway', 'flip'] as const)[show.id % 6] ?? 'bounce'
}

/**
 * Wraps the head in groups that dance to the beat: a translate and a rotation about the neck,
 * and a scale about the neck's base (a squash, or a flip that reads as a spin).
 */
function dance(show: Show, px: number, py: number, cx: number, T: number): [string, string] {
  const P = `${num(px)} ${num(py)}`
  // the middle of the head, for turning it upside down
  const C = `${num(cx)} ${num(HH / 2 - 20)}`
  if (show.mode !== 'sing') {
    const doze = `<animateTransform attributeName="transform" type="rotate" values="0 ${P};2.5 ${P};0 ${P}" dur="6s" repeatCount="indefinite"/>`
    return [`<g>${doze}`, '</g>']
  }
  const beat = Math.max(0.2, show.beat)
  const reps = (dur: number) => Math.max(1, Math.ceil(T / dur))
  const splines = (n: number) => Array.from({ length: n }, () => '.45 0 .3 1').join(';')
  const anim = (type: 'translate' | 'rotate' | 'scale', values: string[], dur: number, opts: { once?: boolean; sum?: boolean; keyTimes?: string } = {}) =>
    `<animateTransform attributeName="transform" type="${type}" values="${values.join(';')}" dur="${f3(dur)}s" repeatCount="${opts.once ? 1 : reps(dur)}" calcMode="spline" keySplines="${splines(values.length - 1)}"${opts.keyTimes ? ` keyTimes="${opts.keyTimes}"` : ''}${opts.sum ? ' additive="sum"' : ''}/>`
  const rot = (deg: number[]) => deg.map(d => `${d} ${P}`)
  const turn = (deg: number[]) => deg.map(d => `${d} ${C}`)
  let move = '', scale = ''
  switch (moveFor(show)) {
    case 'bounce':
      move = anim('translate', ['0 0', '0 -26', '0 0'], beat)
      scale = anim('scale', ['1 1', '0.97 1.03', '1.03 0.96', '1 1'], beat)
      break
    case 'sway':
      move = anim('translate', ['0 0', '-22 -6', '0 0', '22 -6', '0 0'], beat * 2) + anim('rotate', rot([0, -6, 0, 6, 0]), beat * 2, { sum: true })
      break
    case 'headbang':
      move = anim('rotate', rot([0, 11, 0]), beat) + anim('translate', ['0 0', '6 12', '0 0'], beat, { sum: true })
      break
    case 'tilt':
      // a quizzical tilt, held, with a little bob on the beat
      move = anim('rotate', rot([0, -12, -12, -8, -12, 0]), T, { once: true, keyTimes: '0;.12;.45;.6;.85;1' }) + anim('translate', ['0 0', '0 -8', '0 0'], beat, { sum: true })
      break
    case 'spin':
      move = anim('translate', ['0 0', '0 -20', '0 0'], beat)
      scale = anim('scale', ['1 1', '-1 1', '1 1'], Math.min(T, beat * 4), { once: true })
      break
    case 'shake':
      // the twitch of a head that has seen too many stack traces
      move = anim('translate', ['0 0', '-9 4', '8 -5', '-6 -3', '7 5', '0 0'], 0.42) + anim('rotate', rot([0, -4, 5, -3, 4, 0]), 0.42, { sum: true })
      break
    case 'flip':
      // over the top and back on its feet
      move = anim('rotate', turn([0, 180, 180, 360]), Math.min(T, Math.max(2.4, beat * 6)), { once: true, keyTimes: '0;.25;.7;1' })
      break
    case 'upside':
      // upside down for most of the line, wobbling, then back
      move = anim('rotate', turn([0, 180, 168, 192, 175, 180, 0]), T, { once: true, keyTimes: '0;.1;.3;.5;.7;.88;1' })
      break
    case 'cartwheel':
      move = anim('rotate', turn([0, 120, 240, 360]), beat * 4) + anim('translate', ['0 0', '0 -18', '0 0'], beat, { sum: true })
      break
    case 'groove':
      move = anim('translate', ['0 0', '-18 -22', '0 0', '18 -22', '0 0'], beat * 2) + anim('rotate', rot([0, -5, 0, 5, 0]), beat * 2, { sum: true })
      scale = anim('scale', ['1 1', '1 1', '-1 1', '1 1'], beat * 8, { keyTimes: '0;.7;.85;1' })
      break
  }
  return [
    `<g>${move}<g transform="translate(${num(cx)} ${num(py)})"><g>${scale}<g transform="translate(${num(-cx)} ${num(-py)})">`,
    '</g></g></g></g>',
  ]
}

/** The whole drawing: one head (or two, facing each other, for a duet) and the lyrics. */
export function headSvg(show: Show, duet: boolean): string {
  const cam: Cam = { yaw: show.yaw, pitch: -0.12 }
  const g = build()
  const sing = show.mode === 'sing'
  const T = Math.max(0.1, show.dur)
  const [still, behind] = shellD(g.still, cam)
  const anim = (values: string, keyTimes: string) => `<animate attributeName="opacity" dur="${f3(T)}s" values="${values}" keyTimes="${keyTimes}" fill="freeze"/>`
  // keyframes, made strictly increasing
  const keys: [number, number][] = []
  for (const [t, p] of show.keys) {
    const u = Math.min(1, Math.max(0, t / T))
    const prev = keys[keys.length - 1]
    keys.push([prev && u <= prev[0] ? Math.min(1, prev[0] + 0.0005) : u, p])
  }
  if (keys.length > 0) {
    keys[0]![0] = 0
    if (keys[keys.length - 1]![0] < 1) keys.push([1, 0])
  }
  const keyTimes = keys.map(k => f3(k[0])).join(';')
  const poses = POSES.map((pose, i) => {
    const parts = posed(pose)
    const [front, back] = shellD(parts.shell, cam)
    const a = sing && keys.length > 1 ? anim(keys.map(k => (k[1] === i ? 1 : 0)).join(';'), keyTimes) : ''
    return `<g opacity="${i === 0 ? 1 : 0}">${a}` +
      `<path d="${back}" stroke="${V.blueDim}" stroke-width="1" opacity=".55"/>` +
      `<path d="${front}" stroke="${V.blue}" stroke-width="1.4"/>` +
      `<path d="${d(parts.mandible, cam)}" stroke="${V.red}" stroke-width="1.6"/>` +
      `<path d="${d(parts.tongue, cam)}" stroke="${V.green}" stroke-width="1.3"/>` +
      `<path d="${d(parts.teeth.slice(parts.teeth.length / 2), cam)}" stroke="${V.white}" stroke-width="1.2"/>` +
      `<path d="${d(parts.lips, cam)}" stroke="${V.pink}" stroke-width="1.9"/></g>`
  }).join('')
  const upperTeeth = posed(POSES[0]!).teeth
  const eyes = g.eyes.map(({ c, side }) => {
    const iris: P3[] = [], pupil: P3[] = [], lid: P3[] = []
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2
      iris.push([c[0] + 1.0, c[1] + 0.72 * Math.sin(a), c[2] + 0.72 * Math.cos(a) + side * 0.15])
      pupil.push([c[0] + 1.05, c[1] + 0.28 * Math.sin(a), c[2] + 0.28 * Math.cos(a) + side * 0.15])
      if (i <= 9) lid.push([c[0] + 1.05, c[1] + 0.1 - 0.12 * Math.sin((i / 9) * Math.PI), c[2] + 0.75 * Math.cos((i / 9) * Math.PI) + side * 0.15])
    }
    const open = `<g opacity="${sing ? 1 : 0}">${sing ? '<animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.93;.96;1" dur="3.7s" repeatCount="indefinite"/>' : ''}<path d="${d([iris], cam)}" stroke="${V.white}" stroke-width="1.3"/><path d="${d([pupil], cam)}" stroke="${V.white}" stroke-width="2.4"/></g>`
    const shut = `<path d="${d([lid], cam)}" stroke="${V.white}" stroke-width="1.6" opacity="${sing ? 0 : 1}">${sing ? '<animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.93;.96;1" dur="3.7s" repeatCount="indefinite"/>' : ''}</path>`
    return open + shut
  }).join('')
  const [mx, my] = project([8.6, 8.9, 0], cam)
  const neckPivot = project([0.5, 0, 0], cam)
  const [danceOpen, danceClose] = dance(show, neckPivot[0], neckPivot[1], HW / 2, T)
  const rings = sing
    ? show.onsets.slice(0, 16).map(t => `<circle cx="${num(mx)}" cy="${num(my)}" r="4" stroke="${V.amber}" stroke-width="1.6" opacity="0"><animate attributeName="r" from="6" to="70" begin="${f3(t)}s" dur=".9s"/><animate attributeName="opacity" values=".9;0" begin="${f3(t)}s" dur=".9s"/></circle>`).join('')
    : ''
  const notes = sing
    ? show.onsets.filter((_, i) => i % 2 === 0).slice(0, 10).map((t, i) => {
        const col = [V.green, V.pink, V.white, V.amber][i % 4]
        return `<text x="${num(mx + 10)}" y="${num(my)}" font-size="30" fill="${col}" opacity="0">${i % 3 === 1 ? '&#9835;' : '&#9834;'}<animate attributeName="opacity" values="0;1;0" begin="${f3(t)}s" dur="1.6s"/><animateTransform attributeName="transform" type="translate" from="0 0" to="${40 + (i % 3) * 25} ${-110 - (i % 2) * 40}" begin="${f3(t)}s" dur="1.6s"/></text>`
      }).join('')
    : ''
  const zs = sing
    ? ''
    : [0, 1, 2].map(i => `<text x="${num(mx + 30)}" y="${num(my - 230)}" font-size="${26 + i * 8}" fill="${V.blueMid}" opacity="0">Z<animate attributeName="opacity" values="0;.9;0" begin="${i * 1.3}s" dur="3.9s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" from="0 0" to="${30 + i * 10} -90" begin="${i * 1.3}s" dur="3.9s" repeatCount="indefinite"/></text>`).join('')
  const airway = `<path d="${d([g.airway], cam)}" stroke="${V.amber}" stroke-width="2.2" stroke-dasharray="7 9" opacity="${sing ? 0.85 : 0.25}">${sing ? `<animate attributeName="stroke-dashoffset" from="0" to="-64" dur=".7s" repeatCount="${Math.max(1, Math.round(T / 0.7))}"/>` : ''}</path>`
  const head =
    `<g id="h" fill="none" stroke-linecap="round" stroke-linejoin="round">${danceOpen}` +
    `<g filter="url(#glow)">` +
    `<path d="${behind}" stroke="${V.blueDim}" stroke-width="1" opacity=".5"/>` +
    `<path d="${d(g.brain, cam)}" stroke="${V.blueDim}" stroke-width="1" opacity=".75"/>` +
    `<path d="${d(g.neck, cam)}" stroke="${V.blueDim}" stroke-width="1" opacity=".8"/>` +
    `<path d="${d(g.ears, cam)}" stroke="${V.blueMid}" stroke-width="1.2"/>` +
    `<path d="${still}" stroke="${V.blue}" stroke-width="1.4"/>` +
    airway +
    `<path d="${d(upperTeeth.slice(0, upperTeeth.length / 2), cam)}" stroke="${V.white}" stroke-width="1.2"/>` +
    poses + eyes + `</g>${rings}${notes}${zs}${danceClose}</g>`
  // a portrait frame that fills a side pane: the head large, the lyrics over its neck
  const W = duet ? 1100 : 640
  const H = 880
  const perLine = Math.floor((W - 40) / 24)
  const lines: { w: string; at: number }[][] = [[]]
  let len = 0
  show.words.forEach((w, i) => {
    if (len + w.length + 1 > perLine && len > 0) {
      lines.push([])
      len = 0
    }
    lines[lines.length - 1]!.push({ w: w.toUpperCase(), at: show.wordAt[i] ?? 0 })
    len += w.length + 1
  })
  const shown = lines.slice(-3)
  const top = 700 - (shown.length - 1) * 24
  const lyric = shown.map((ln, li) => `<text x="${W / 2}" y="${top + li * 50}" text-anchor="middle" font-size="36" letter-spacing="2" fill="${V.blueMid}">${ln.map(({ w, at }) => `<tspan>${esc(w)} <set attributeName="fill" to="${show.kind === 'prompt' ? V.green : V.amber}" begin="${f3(at)}s"/></tspan>`).join('')}</text>`).join('')
  const capY = show.words.length ? top + shown.length * 50 + 6 : 720
  // the caption says what the lyrics left out (a file name, the full question), never the same twice
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  const fits = Math.floor((W - 48) / 13.4)
  const same = norm(show.caption) === norm(show.words.join(' ')) || norm(show.caption).startsWith(norm(show.words.join(' '))) && show.caption.length <= fits
  const capText = show.caption.length > fits ? show.caption.slice(0, fits - 1) + '…' : show.caption
  const caption = show.caption && !same ? `<text x="${W / 2}" y="${Math.min(H - 24, capY)}" text-anchor="middle" font-size="22" fill="${V.blue}" opacity=".7">${esc(capText)}</text>` : ''
  const label = `<text x="24" y="44" font-size="22" letter-spacing="6" fill="${V.blue}">CHIMERA</text><text x="${W - 24}" y="44" text-anchor="end" font-size="18" letter-spacing="3" fill="${sing ? V.amber : V.blueDim}">${KIND_LABEL[show.kind]}</text>`
  const first = `<g transform="translate(${duet ? 0 : 20} 0)">${head}</g>`
  const second = duet ? `<use href="#h" transform="translate(${W} 0) scale(-1 1)"/>` : ''
  const fade = `<rect y="560" width="${W}" height="${H - 560}" fill="url(#fade)"/>`
  // drawn wider than any pane, so the surface scales it to the pane's full width
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 3}" height="${H * 3}" font-family="Menlo, Consolas, monospace">` +
    `<defs><filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".4" stop-color="#000" stop-opacity=".88"/><stop offset="1" stop-color="#000" stop-opacity=".95"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="#000"/>` +
    first + second + fade + label + lyric + caption + `</svg>`
}
