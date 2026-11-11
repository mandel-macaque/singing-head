// A small singing synthesizer in plain TypeScript (the mod's sandbox has no WebAssembly).
// CHIMERA itself simulates the airway as acoustic tubes; this is the classic shortcut:
// a glottal pulse train through a cascade of formant resonators, with CHIMERA's vowel
// formant tables (Hillenbrand et al. 1995, men / women / children) and its idea that
// consonants are gestures sliding in and out of the vowels.
import type { Voice } from '../types'
import type { Phrase } from './lyrics'

export const SR = 22050

// [male, female, child] F1-F3 per ARPAbet vowel, from CHIMERA's vowel_data.rs
const VOWEL_F: Record<string, [number, number, number][]> = {
  IY: [[342, 2322, 3000], [437, 2761, 3372], [452, 3081, 3702]],
  IH: [[427, 2034, 2684], [483, 2365, 3053], [511, 2552, 3403]],
  EY: [[476, 2089, 2691], [536, 2530, 3047], [564, 2656, 3323]],
  EH: [[580, 1799, 2605], [731, 2058, 2979], [749, 2267, 3310]],
  AE: [[640, 1760, 2500], [669, 2349, 2972], [717, 2501, 3289]],
  AA: [[768, 1333, 2522], [936, 1551, 2815], [1002, 1688, 2950]],
  AO: [[652, 997, 2538], [781, 1136, 2824], [803, 1210, 2982]],
  OW: [[497, 910, 2459], [555, 1035, 2828], [597, 1137, 2987]],
  UH: [[469, 1122, 2434], [519, 1225, 2827], [568, 1490, 3072]],
  UW: [[378, 997, 2343], [459, 1105, 2735], [494, 1345, 2988]],
  AH: [[623, 1200, 2550], [753, 1426, 2933], [749, 1546, 3145]],
  ER: [[474, 1379, 1710], [523, 1588, 1929], [586, 1719, 2143]],
  A: [[780, 1450, 2550], [913, 1740, 2933], [1014, 1929, 3162]],
  // Spanish's pure e and o: CHIMERA's e and o without the English glide
  E: [[476, 2089, 2691], [536, 2530, 3047], [564, 2656, 3323]],
  O: [[497, 910, 2459], [555, 1035, 2828], [597, 1137, 2987]],
}
/** diphthongs: from → to */
const GLIDE: Record<string, [string, string]> = { AY: ['A', 'IH'], AW: ['A', 'UH'], OY: ['AO', 'IH'], EY: ['EY', 'IH'], OW: ['OW', 'UH'] }
const VI: Record<Voice, number> = { bass: 0, alto: 1, child: 2 }
const HIGH: Record<Voice, [number, number]> = { bass: [3400, 4300], alto: [4000, 4800], child: [4400, 5200] }

type Cons = {
  kind: 'stop' | 'fric' | 'nasal' | 'approx' | 'asp' | 'affric'
  voiced?: boolean
  f?: [number, number, number]
  ff?: number
  fbw?: number
  af?: number
  dur: number
}
const C: Record<string, Cons> = {
  B: { kind: 'stop', voiced: true, ff: 900, dur: 0.07 }, D: { kind: 'stop', voiced: true, ff: 3600, dur: 0.065 },
  G: { kind: 'stop', voiced: true, ff: 2200, dur: 0.07 }, P: { kind: 'stop', ff: 900, dur: 0.085 },
  T: { kind: 'stop', ff: 4200, dur: 0.08 }, K: { kind: 'stop', ff: 2400, dur: 0.085 },
  F: { kind: 'fric', ff: 6500, fbw: 6000, af: 0.11, dur: 0.09 }, V: { kind: 'fric', voiced: true, ff: 6500, fbw: 6000, af: 0.07, dur: 0.07 },
  TH: { kind: 'fric', ff: 6000, fbw: 6000, af: 0.09, dur: 0.08 }, DH: { kind: 'fric', voiced: true, ff: 6000, fbw: 6000, af: 0.05, dur: 0.05 },
  S: { kind: 'fric', ff: 6300, fbw: 2200, af: 0.32, dur: 0.1 }, Z: { kind: 'fric', voiced: true, ff: 6300, fbw: 2200, af: 0.2, dur: 0.08 },
  SH: { kind: 'fric', ff: 3000, fbw: 1600, af: 0.32, dur: 0.1 }, ZH: { kind: 'fric', voiced: true, ff: 3000, fbw: 1600, af: 0.2, dur: 0.08 },
  CH: { kind: 'affric', ff: 3000, fbw: 1600, af: 0.32, dur: 0.11 }, JH: { kind: 'affric', voiced: true, ff: 3000, fbw: 1600, af: 0.22, dur: 0.09 },
  HH: { kind: 'asp', af: 0.3, dur: 0.06 },
  M: { kind: 'nasal', voiced: true, f: [280, 1000, 2300], dur: 0.075 }, N: { kind: 'nasal', voiced: true, f: [280, 1600, 2500], dur: 0.07 },
  NG: { kind: 'nasal', voiced: true, f: [280, 2000, 2650], dur: 0.07 },
  L: { kind: 'approx', voiced: true, f: [380, 1100, 2700], dur: 0.065 }, R: { kind: 'approx', voiced: true, f: [420, 1250, 1650], dur: 0.065 },
  W: { kind: 'approx', voiced: true, f: [320, 750, 2300], dur: 0.06 }, Y: { kind: 'approx', voiced: true, f: [290, 2150, 2900], dur: 0.055 },
}

/** One timed phone of the phrase: what the sound and the face follow. */
export type Seg = { t0: number; t1: number; ph: string; note: number; midi: number; harm: number; vowel: boolean }

/** Lays each note's syllable out in time: onset consonants, the vowel holding the note, coda. */
export function timeline(phrase: Phrase): Seg[] {
  const segs: Seg[] = []
  phrase.notes.forEach((n, i) => {
    const on = n.syl.onset.map(p => C[p]?.dur ?? 0.06)
    const off = n.syl.coda.map(p => C[p]?.dur ?? 0.06)
    const cons = on.reduce((a, b) => a + b, 0) + off.reduce((a, b) => a + b, 0)
    const k = cons > n.dur * 0.45 ? (n.dur * 0.45) / cons : 1
    let t = n.start
    const push = (ph: string, d: number, vowel: boolean) => {
      segs.push({ t0: t, t1: t + d, ph, note: i, midi: n.midi, harm: n.harm, vowel })
      t += d
    }
    n.syl.onset.forEach((p, j) => push(p, (on[j] ?? 0.06) * k, false))
    const vd = n.dur - cons * k
    push(n.syl.v, vd, true)
    n.syl.coda.forEach((p, j) => push(p, (off[j] ?? 0.06) * k, false))
  })
  return segs
}

const FR = 200 // parameter frames per second

type Tracks = { f1: Float32Array; f2: Float32Array; f3: Float32Array; av: Float32Array; asp: Float32Array; af: Float32Array; ff: Float32Array; fbw: Float32Array; nas: Float32Array; f0: Float32Array; age: Float32Array }

function vowelF(ph: string, v: Voice, fscale: number): [number, number, number] {
  const tab = VOWEL_F[ph] ?? VOWEL_F.AH!
  const f = tab[VI[v]] ?? tab[0]!
  return [f[0] * fscale, f[1] * fscale, f[2] * fscale]
}

function tracks(segs: Seg[], total: number, voice: Voice, harmony: boolean, fscale: number): Tracks {
  const n = Math.ceil(total * FR) + 2
  const mk = () => new Float32Array(n)
  const T: Tracks = { f1: mk(), f2: mk(), f3: mk(), av: mk(), asp: mk(), af: mk(), ff: mk(), fbw: mk(), nas: mk(), f0: mk(), age: mk() }
  const vowelAt = (i: number, dir: 1 | -1): string => {
    for (let j = i; j >= 0 && j < segs.length; j += dir) if (segs[j]!.vowel) return GLIDE[segs[j]!.ph]?.[dir === 1 ? 0 : 1] ?? segs[j]!.ph
    return 'AH'
  }
  const noteStart = new Map<number, number>()
  for (const s of segs) if (!noteStart.has(s.note)) noteStart.set(s.note, s.t0)
  segs.forEach((s, i) => {
    const a = Math.floor(s.t0 * FR), b = Math.max(a + 1, Math.floor(s.t1 * FR))
    const midi = harmony ? s.harm : s.midi
    const hz = 440 * Math.pow(2, (midi - 69) / 12)
    for (let f = a; f < b && f < n; f++) {
      const u = (f - a) / Math.max(1, b - a)
      T.f0[f] = hz
      T.age[f] = f / FR - (noteStart.get(s.note) ?? s.t0)
      T.ff[f] = 3000
      T.fbw[f] = 3000
      if (s.vowel) {
        const g = GLIDE[s.ph]
        let F = vowelF(g ? g[0] : s.ph, voice, fscale)
        if (g && u > 0.55) {
          const G = vowelF(g[1], voice, fscale), w = Math.min(1, (u - 0.55) / 0.35)
          F = [F[0] + (G[0] - F[0]) * w, F[1] + (G[1] - F[1]) * w, F[2] + (G[2] - F[2]) * w]
        }
        ;[T.f1[f], T.f2[f], T.f3[f]] = F
        T.av[f] = 1
        T.asp[f] = 0.025
        continue
      }
      const c = C[s.ph] ?? C.L!
      const onset = segs.slice(i + 1).some(x => x.note === s.note && x.vowel)
      const near = vowelF(onset ? vowelAt(i, 1) : vowelAt(i, -1), voice, fscale)
      const F = c.f ? ([c.f[0] * fscale, c.f[1] * fscale, c.f[2] * fscale] as [number, number, number]) : ([Math.min(near[0], 300), near[1], near[2]] as [number, number, number])
      ;[T.f1[f], T.f2[f], T.f3[f]] = F
      T.ff[f] = c.ff ?? 3000
      T.fbw[f] = c.fbw ?? 3000
      switch (c.kind) {
        case 'nasal': T.av[f] = 0.42; T.nas[f] = 1; break
        case 'approx': T.av[f] = 0.62; break
        case 'asp': T.asp[f] = 0.32; T.av[f] = 0; ;[T.f1[f], T.f2[f], T.f3[f]] = near; break
        case 'fric': T.af[f] = c.af ?? 0.1; T.av[f] = c.voiced ? 0.3 : 0; break
        case 'stop': case 'affric': {
          const closure = c.kind === 'stop' ? 0.62 : 0.4
          if (u < closure) T.av[f] = c.voiced ? 0.1 : 0
          else if (c.kind === 'affric') { T.af[f] = c.af ?? 0.3; T.av[f] = c.voiced ? 0.25 : 0 }
          else if (u < closure + 0.14) { T.af[f] = 0.55; T.ff[f] = c.ff ?? 3000; T.fbw[f] = 2500 }
          else { T.asp[f] = c.voiced ? 0.05 : 0.28; T.av[f] = c.voiced ? 0.6 : 0; ;[T.f1[f], T.f2[f], T.f3[f]] = near }
          break
        }
      }
    }
  })
  // a quick breath between words, a slower one at the end
  const smooth = (x: Float32Array, frames: number) => {
    const k = 1 / frames
    for (let i = 1; i < x.length; i++) x[i] = x[i - 1]! + (x[i]! - x[i - 1]!) * k
    for (let i = x.length - 2; i >= 0; i--) x[i] = x[i + 1]! + (x[i]! - x[i + 1]!) * k
  }
  // hold edges: formants that are 0 (silence) take their neighbour's
  for (const tr of [T.f1, T.f2, T.f3, T.f0]) {
    let last = tr.find(v => v > 0) ?? 500
    for (let i = 0; i < n; i++) tr[i]! > 0 ? (last = tr[i]!) : (tr[i] = last)
  }
  for (const tr of [T.f1, T.f2, T.f3]) smooth(tr, 4)
  for (const tr of [T.av, T.asp, T.af, T.nas]) smooth(tr, 1.6)
  return T
}

function render(segs: Seg[], total: number, voice: Voice, harmony: boolean, fscale: number, seed: number): Float32Array {
  const T = tracks(segs, total, voice, harmony, fscale)
  const len = Math.ceil((total + 0.05) * SR)
  const out = new Float32Array(len)
  const [F4, F5] = HIGH[voice]
  const res = Array.from({ length: 5 }, () => ({ a: 0, b: 0, c: 0, y1: 0, y2: 0 }))
  const fr = { a: 0, b: 0, c: 0, y1: 0, y2: 0 }
  const set = (r: { a: number; b: number; c: number }, F: number, B: number) => {
    const q = Math.exp((-Math.PI * B) / SR)
    r.c = -q * q
    r.b = 2 * q * Math.cos((2 * Math.PI * Math.min(F, SR * 0.45)) / SR)
    r.a = 1 - r.b - r.c
  }
  let s = seed >>> 0 || 1
  const noise = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) / 4294967296) * 2 - 1
  }
  let phase = 0, lf0 = Math.log(T.f0[0] || 220), prevFlow = 0, jit = 1
  const vibRate = 5.2 + (seed % 7) * 0.08
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const fi = Math.min(T.f0.length - 1, t * FR)
    const f = Math.floor(fi), w = fi - f, g = Math.min(T.f0.length - 1, f + 1)
    const L = (x: Float32Array) => x[f]! + (x[g]! - x[f]!) * w
    if ((i & 15) === 0) {
      const nas = L(T.nas)
      set(res[0]!, L(T.f1), 70 + 60 * nas)
      set(res[1]!, L(T.f2), 90 + 140 * nas)
      set(res[2]!, L(T.f3), 130 + 160 * nas)
      set(res[3]!, F4, 220)
      set(res[4]!, F5, 300)
      set(fr, L(T.ff), L(T.fbw))
    }
    // pitch: glide into each note, vibrato blooming on long ones
    const age = L(T.age)
    const vib = 0.42 * Math.min(1, Math.max(0, (age - 0.22) / 0.35)) * Math.sin(2 * Math.PI * vibRate * t)
    lf0 += (Math.log(L(T.f0)) + (vib * Math.LN2) / 12 - lf0) * 0.006
    const f0 = Math.exp(lf0) * jit
    phase += f0 / SR
    if (phase >= 1) {
      phase -= 1
      jit = 1 + noise() * 0.004
    }
    // Rosenberg glottal pulse, differentiated (the lips radiate the flow's derivative)
    const Tp = 0.42, Tn = 0.16
    const flow = phase < Tp ? 0.5 * (1 - Math.cos((Math.PI * phase) / Tp)) : phase < Tp + Tn ? Math.cos((Math.PI * (phase - Tp)) / (2 * Tn)) : 0
    const src = (flow - prevFlow) * (SR / f0) * 0.12
    prevFlow = flow
    const av = L(T.av), asp = L(T.asp)
    let x = av * src + noise() * (asp + 0.03 * av * flow)
    for (const r of res) {
      const y = r.a * x + r.b * r.y1 + r.c * r.y2
      r.y2 = r.y1
      r.y1 = y
      x = y
    }
    const fy = fr.a * noise() + fr.b * fr.y1 + fr.c * fr.y2
    fr.y2 = fr.y1
    fr.y1 = fy
    out[i] = x * (1 - 0.45 * L(T.nas)) + fy * L(T.af) * 2.2
  }
  return out
}

/** a small room, so the head doesn't sing in a vacuum */
function room(x: Float32Array, mix = 0.16): Float32Array {
  const tail = Math.floor(0.45 * SR)
  const y = new Float32Array(x.length + tail)
  const combs = [1557, 1617, 1491, 1422].map(d => ({ d: Math.floor((d * SR) / 44100) * 2, buf: new Float32Array(Math.floor((d * SR) / 44100) * 2), i: 0 }))
  const aps = [225, 556].map(d => ({ buf: new Float32Array(Math.floor((d * SR) / 44100)), i: 0 }))
  for (let n = 0; n < y.length; n++) {
    const inp = x[n] ?? 0
    let wet = 0
    for (const c of combs) {
      const o = c.buf[c.i]!
      c.buf[c.i] = inp + o * 0.74
      c.i = (c.i + 1) % c.buf.length
      wet += o
    }
    wet *= 0.25
    for (const a of aps) {
      const o = a.buf[a.i]!
      const v = wet + o * 0.5
      a.buf[a.i] = v
      a.i = (a.i + 1) % a.buf.length
      wet = o - v * 0.5
    }
    y[n] = inp + wet * mix
  }
  return y
}

function wav(chans: Float32Array[]): Uint8Array {
  const n = Math.max(...chans.map(c => c.length))
  const ch = chans.length
  const bytes = new Uint8Array(44 + n * ch * 2)
  const v = new DataView(bytes.buffer)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, SR, true)
  v.setUint32(28, SR * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true)
  let peak = 1e-6
  for (const c of chans) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]!))
  const g = 0.86 / peak
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < ch; k++) {
      // fade the first and last few ms so playback never clicks
      const fade = Math.min(1, i / 80, (n - i) / 400)
      const smp = Math.max(-1, Math.min(1, (chans[k]![i] ?? 0) * g * fade))
      v.setInt16(44 + (i * ch + k) * 2, Math.round(smp * 32767), true)
    }
  }
  return bytes
}

export function toBase64(bytes: Uint8Array): string {
  const native = (bytes as unknown as { toBase64?: () => string }).toBase64
  if (typeof native === 'function') return native.call(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** ba-dum-tss: two toms and a cymbal, for after a punchline */
function rimshot(seed: number): Float32Array {
  const y = new Float32Array(Math.floor(1.2 * SR))
  const tom = (at: number, f0: number) => {
    let ph = 0
    const start = Math.floor(at * SR)
    for (let i = 0; i < 0.25 * SR && start + i < y.length; i++) {
      const t = i / SR
      ph += (2 * Math.PI * f0 * (1 + 1.4 * Math.exp(-t * 28))) / SR
      y[start + i]! += Math.sin(ph) * Math.exp(-t * 13) * 0.9
    }
  }
  tom(0, 170)
  tom(0.17, 125)
  let s = seed >>> 0 || 7, prev = 0
  const start = Math.floor(0.36 * SR)
  for (let i = 0; start + i < y.length; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    const n = ((s >>> 0) / 4294967296) * 2 - 1
    y[start + i]! += (n - prev) * Math.exp(-(i / SR) * 4.5) * 0.45
    prev = n
  }
  return y
}

const join = (a: Float32Array, gap: number, b: Float32Array) => {
  const out = new Float32Array(a.length + Math.floor(gap * SR) + b.length)
  out.set(a)
  out.set(b, a.length + Math.floor(gap * SR))
  return out
}

const PARTNER: Record<Voice, Voice> = { bass: 'alto', alto: 'alto', child: 'child' }

/** Renders a phrase: a mono WAV, or a stereo duet with a harmony line. */
export function sing(phrase: Phrase, voice: Voice, duet: boolean, opts: { rimshot?: boolean } = {}): { base64: string; segs: Seg[]; seconds: number } {
  const segs = timeline(phrase)
  const seed = [...phrase.words.join(' ')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const voiced = render(segs, phrase.dur, voice, false, 1, seed)
  const lead = room(opts.rimshot ? join(voiced, 0.15, rimshot(seed)) : voiced)
  if (!duet) return { base64: toBase64(wav([lead])), segs, seconds: lead.length / SR }
  const partner = PARTNER[voice]
  // a bass's partner sings the harmony an octave up; the others a little brighter, beside them
  const pSegs = voice === 'bass' ? segs.map(s => ({ ...s, harm: s.harm + 12 })) : segs
  const harm = room(render(pSegs, phrase.dur, partner, true, voice === 'bass' ? 1 : 1.06, seed ^ 0x9e3779b9))
  const L = new Float32Array(lead.length), R = new Float32Array(lead.length)
  for (let i = 0; i < lead.length; i++) {
    L[i] = lead[i]! * 0.85 + (harm[i] ?? 0) * 0.4
    R[i] = lead[i]! * 0.4 + (harm[i] ?? 0) * 0.85
  }
  return { base64: toBase64(wav([L, R])), segs, seconds: lead.length / SR }
}
