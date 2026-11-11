// The head in a terminal: the same projected wireframe the desktop draws as SVG, plotted
// into braille characters (each cell a 2x4 grid of dots) and colored cell by cell. It's
// drawn as a Raster and repainted about ten times a second with $.ui.blit.
import type { Show } from '../types'
import { danceAt, HH, HW, LABEL, poseAt, scene, V } from './head'
import type { Stroke } from './head'

const DEFAULT = 0x01000000
const BLACK = 0x000000
const hex = (c: string) => parseInt(c.slice(1), 16)
/** the braille dot bit for a dot's row (0-3) and column (0-1) within its cell */
const BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
]
const printable = (s: string) => s.replace(/[^\x20-\x7e -ɏ]/g, '?')

/** One frame of the head at time t (seconds into the phrase), as a Raster's `cells`. */
export function termFrame(show: Show, t: number, cols: number, rows: number): string {
  const sing = show.mode === 'sing'
  const top = 1
  const bottom = rows >= 18 ? 3 : 2
  const artRows = Math.max(4, rows - top - bottom)
  const W = cols * 2, H = artRows * 4
  const bits = new Uint8Array(cols * artRows)
  const fg = new Uint32Array(cols * artRows)
  // the drawing's 640x800 frame, fitted in the dots (a braille dot is about square)
  const s = Math.min(W / 640, H / 820)
  const ox = (W - HW * s) / 2, oy = (H - HH * s) / 2 + 10 * s
  const move = danceAt(show, t)
  const plot = (x: number, y: number, c: number) => {
    const xi = Math.round(x), yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return
    const cell = (yi >> 2) * cols + (xi >> 1)
    bits[cell]! |= BITS[yi & 3]![xi & 1]!
    fg[cell] = c
  }
  const line = (x0: number, y0: number, x1: number, y1: number, c: number) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let i = 0; i <= n; i++) plot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c)
  }
  const at = (x: number, y: number): [number, number] => {
    const [mx, my] = move(x, y)
    return [ox + mx * s, oy + my * s]
  }
  const draw = (st: Stroke) => {
    // braille has few dots: the dim lines behind the head would only blur it
    if (st.color === V.blueDim) return
    const c = hex(st.color)
    let prev: [number, number] | undefined
    for (const p of st.pts) {
      const q = at(p[0], p[1])
      if (prev) line(prev[0], prev[1], q[0], q[1], c)
      prev = q
    }
  }
  const sc = scene(show.yaw)
  sc.still.forEach(draw)
  sc.poses[poseAt(show, t)]?.forEach(draw)
  const blinking = sing && (t % 3.7) / 3.7 > 0.93 && (t % 3.7) / 3.7 < 0.96
  ;(sing && !blinking ? sc.eyesOpen : sc.eyesShut).forEach(draw)
  // sound rings from the mouth on each vowel
  if (sing) {
    const [mx, my] = at(sc.mouth[0], sc.mouth[1])
    for (const on of show.onsets) {
      const age = t - on
      if (age < 0 || age > 0.9) continue
      const r = (6 + 64 * (age / 0.9)) * s
      let prev: [number, number] | undefined
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2
        const q: [number, number] = [mx + r * Math.cos(a), my + r * Math.sin(a)]
        if (prev) line(prev[0], prev[1], q[0], q[1], hex(V.amber))
        prev = q
      }
    }
  }
  // the cells: a header, the head, the lyrics
  const out = new Uint32Array(cols * rows * 3)
  const put = (row: number, col: number, ch: number, color: number, bg = BLACK) => {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return
    const i = (row * cols + col) * 3
    out[i] = ch
    out[i + 1] = color
    out[i + 2] = bg
  }
  const text = (row: number, col: number, str: string, color: number) => [...printable(str)].forEach((ch, i) => put(row, col + i, ch.codePointAt(0) ?? 32, color))
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) put(r, c, 32, DEFAULT)
  text(0, 1, 'CHIMERA', hex(V.blue))
  const label = LABEL(show)
  if (cols > label.length + 10) text(0, cols - label.length - 1, label, hex(sing ? V.amber : V.blueDim))
  for (let r = 0; r < artRows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = bits[r * cols + c]!
      if (b) put(top + r, c, 0x2800 | b, fg[r * cols + c]!)
    }
  }
  // a dozing head: z's drifting up from its face
  if (!sing) {
    const [fx, fy] = at(sc.mouth[0] + 30, sc.mouth[1] - 230)
    for (let i = 0; i < 3; i++) {
      const u = ((t / 3.9 + i / 3) % 1)
      const col = Math.round((fx + 20 * u * (1 + i)) / 2), row = top + Math.round((fy - 90 * u * s * 4) / 4)
      if (row > top && row < top + artRows) put(row, col, i === 2 ? 90 : 122, hex(V.blueMid))
    }
  }
  // the lyrics, lit word by word: your words in green, the head's in amber
  const lit = hex(show.kind === 'prompt' ? V.green : V.amber)
  const width = cols - 2
  const lines: { w: string; at: number }[][] = [[]]
  let len = 0
  show.words.forEach((w, i) => {
    if (len + w.length + 1 > width && len > 0) {
      lines.push([])
      len = 0
    }
    lines[lines.length - 1]!.push({ w: w.toUpperCase(), at: show.wordAt[i] ?? 0 })
    len += w.length + 1
  })
  // keep the line being sung in view
  let current = 0
  lines.forEach((ln, i) => ln.some(x => x.at <= t) && (current = i))
  const lyricRows = bottom - 1
  const first = Math.max(0, Math.min(current, lines.length - lyricRows))
  for (let i = 0; i < lyricRows; i++) {
    const ln = lines[first + i]
    if (!ln) continue
    const total = ln.reduce((n, x) => n + x.w.length + 1, -1)
    let col = Math.max(1, Math.floor((cols - total) / 2))
    for (const { w, at: when } of ln) {
      text(top + artRows + i, col, w, sing && when <= t ? lit : hex(V.blueMid))
      col += w.length + 1
    }
  }
  const cap = show.caption.length > width ? show.caption.slice(0, width - 1) + '~' : show.caption
  if (cap && !show.words.length) text(top + artRows, Math.max(1, Math.floor((cols - cap.length) / 2)), cap, hex(V.blueDim))
  else if (cap && bottom >= 3 && cap.toLowerCase() !== show.words.join(' ')) text(rows - 1, Math.max(1, Math.floor((cols - cap.length) / 2)), cap, hex(V.blueDim))
  const bytes = new Uint8Array(out.buffer)
  const native = (bytes as unknown as { toBase64?: () => string }).toBase64
  if (typeof native === 'function') return native.call(bytes)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
