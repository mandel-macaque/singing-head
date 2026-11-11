// Words → sung phones → syllables → a little tune.
// Pronunciations come from the CMU Pronouncing Dictionary (as CHIMERA uses it),
// with a letter-to-sound fallback for words it doesn't know.

import type { Kind, Voice } from '../types'

// E and O are Spanish's pure vowels (no glide, unlike English EY and OW)
export const VOWEL_PHONES = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', 'E', 'O'])

let dict: Map<string, string> | undefined

/** Parses `word<TAB>PH ON ES` lines. */
export function loadDict(text: string): void {
  const map = new Map<string, string>()
  let start = 0
  while (start < text.length) {
    let end = text.indexOf('\n', start)
    if (end < 0) end = text.length
    const tab = text.indexOf('\t', start)
    if (tab > start && tab < end) map.set(text.slice(start, tab), text.slice(tab + 1, end).trim())
    start = end + 1
  }
  dict = map
}
export const hasDict = (): boolean => dict !== undefined

const LETTERS: Record<string, string> = {
  a: 'EY', b: 'B IY', c: 'S IY', d: 'D IY', e: 'IY', f: 'EH F', g: 'JH IY', h: 'EY CH', i: 'AY', j: 'JH EY',
  k: 'K EY', l: 'EH L', m: 'EH M', n: 'EH N', o: 'OW', p: 'P IY', q: 'K Y UW', r: 'AA R', s: 'EH S',
  t: 'T IY', u: 'Y UW', v: 'V IY', w: 'D AH B AH L Y UW', x: 'EH K S', y: 'W AY', z: 'Z IY',
}
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** Splits text into lowercase singable words (camelCase, paths and digits included). */
export function toWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[0-9]/g, d => ` ${DIGITS[Number(d)]} `)
    .toLowerCase()
    .replace(/'/g, '')
    .split(/[^a-z]+/)
    .filter(w => w.length > 0)
}

// Letter-to-sound rules for words the dictionary lacks: crude, cheerful, robotic.
const RULES: [string, string][] = [
  ['tion', 'SH AH N'], ['sion', 'ZH AH N'], ['igh', 'AY'], ['tch', 'CH'], ['sh', 'SH'], ['ch', 'CH'],
  ['th', 'TH'], ['ph', 'F'], ['ng', 'NG'], ['ck', 'K'], ['qu', 'K W'], ['wh', 'W'], ['ee', 'IY'],
  ['ea', 'IY'], ['oo', 'UW'], ['ou', 'AW'], ['ow', 'OW'], ['ai', 'EY'], ['ay', 'EY'], ['oi', 'OY'],
  ['oy', 'OY'], ['au', 'AO'], ['aw', 'AO'], ['er', 'ER'], ['ir', 'ER'], ['ur', 'ER'], ['ar', 'AA R'],
  ['or', 'AO R'], ['ll', 'L'], ['ss', 'S'], ['tt', 'T'], ['pp', 'P'], ['mm', 'M'], ['nn', 'N'], ['ff', 'F'],
]
const SINGLE: Record<string, string> = {
  a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH', b: 'B', d: 'D', f: 'F', g: 'G', h: 'HH', j: 'JH', k: 'K',
  l: 'L', m: 'M', n: 'N', p: 'P', q: 'K', r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', x: 'K S', z: 'Z',
}
const LONG: Record<string, string> = { a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW' }
const isV = (c: string | undefined) => c !== undefined && 'aeiou'.includes(c)

function rules(word: string): string {
  let w = word
  const out: string[] = []
  // magic e: "code" → K OW D
  let magic = -1
  if (w.length > 3 && w.endsWith('e') && !isV(w[w.length - 2]) && isV(w[w.length - 3])) {
    magic = w.length - 3
    w = w.slice(0, -1)
  }
  let i = 0
  while (i < w.length) {
    const rest = w.slice(i)
    const rule = RULES.find(([g]) => rest.startsWith(g))
    if (rule) {
      out.push(rule[1])
      i += rule[0].length
      continue
    }
    const c = w[i] ?? ''
    if (i === magic && LONG[c]) out.push(LONG[c] ?? '')
    else if (c === 'c') out.push('eiy'.includes(w[i + 1] ?? '') ? 'S' : 'K')
    else if (c === 'g') out.push('ei'.includes(w[i + 1] ?? '') && i > 0 ? 'JH' : 'G')
    else if (c === 'y') out.push(i === 0 ? 'Y' : i === w.length - 1 && w.length <= 3 ? 'AY' : 'IY')
    else if (SINGLE[c]) out.push(SINGLE[c] ?? '')
    i++
  }
  return out.join(' ')
}

/** ARPAbet phones for one word. */
export function wordPhones(word: string): string[] {
  const d = dict
  let p = d?.get(word)
  if (!p && d) {
    for (const [suf, ph] of [['s', 'Z'], ['es', 'IH Z'], ['ed', 'D'], ['ing', 'IH NG'], ['er', 'ER'], ['ly', 'L IY']] as const) {
      const stem = d.get(word.slice(0, -suf.length))
      if (word.endsWith(suf) && word.length > suf.length + 2 && stem) {
        p = `${stem} ${ph}`
        break
      }
    }
  }
  if (!p) {
    const noVowel = !/[aeiouy]/.test(word)
    if (noVowel || word.length <= 2) p = [...word].map(c => LETTERS[c] ?? '').join(' ')
    else p = rules(word)
  }
  return p.split(/\s+/).filter(x => x.length > 0)
}

export type Syl = { onset: string[]; v: string; coda: string[]; word: number }

/** Splits a word's phones into syllables: one vowel each, consonants shared out between them. */
export function syllabify(phones: string[], word: number): Syl[] {
  const nuclei: number[] = []
  phones.forEach((ph, i) => VOWEL_PHONES.has(ph) && nuclei.push(i))
  if (nuclei.length === 0) return [{ onset: phones, v: 'AH', coda: [], word }]
  const syls: Syl[] = nuclei.map(i => ({ onset: [], v: phones[i] ?? 'AH', coda: [], word }))
  const first = nuclei[0] ?? 0
  syls[0]!.onset = phones.slice(0, first)
  for (let k = 0; k < nuclei.length - 1; k++) {
    const between = phones.slice((nuclei[k] ?? 0) + 1, nuclei[k + 1])
    let split = between.length <= 1 ? 0 : 1
    // keep clusters a word could start with together ("li-brary", "a-stray")
    const [c1, c2] = between
    if (between.length === 2 && (['R', 'L', 'W', 'Y'].includes(c2 ?? '') && !['R', 'L', 'NG', 'M', 'N'].includes(c1 ?? '') || c1 === 'S')) split = 0
    if (between[0] === 'NG') split = Math.max(split, 1)
    syls[k]!.coda = between.slice(0, split)
    syls[k + 1]!.onset = between.slice(split)
  }
  syls[syls.length - 1]!.coda = phones.slice((nuclei[nuclei.length - 1] ?? 0) + 1)
  return syls
}

export type Note = { syl: Syl; start: number; dur: number; midi: number; harm: number }
export type Phrase = { kind: Kind; words: string[]; notes: Note[]; dur: number; beat: number }

/** small deterministic random numbers, so the same words always get the same tune */
function rng(seedText: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------------------ Spanish
// Spanish spelling is regular enough for a handful of rules: pure vowels, glides, and its
// consonant spellings (c/z/qu/gu/j/ll/ñ/rr), in the same phones the singer knows.

const ES_VOWEL = 'aeiouáéíóúü'
const ES_BASE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' }
const ES_V: Record<string, string> = { a: 'AA', e: 'E', i: 'IY', o: 'O', u: 'UW' }
const ES_OFF: Record<string, Record<string, string>> = { AA: { i: 'AY', u: 'AW' }, E: { i: 'EY' }, O: { i: 'OY', u: 'OW' } }
const ES_C: Record<string, string> = { d: 'D', f: 'F', k: 'K', m: 'M', n: 'N', p: 'P', s: 'S', t: 'T', w: 'W' }
const front = (c: string) => 'eiéí'.includes(c) && c !== ''

export function esPhones(word: string): string[] {
  let w = word.toLowerCase()
  if (w === 'y') w = 'i'
  w = w.replace(/([aeiou])y$/, '$1i')
  const out: string[] = []
  for (let i = 0; i < w.length; i++) {
    const c = w[i] ?? '', n = w[i + 1] ?? '', p = w[i - 1] ?? ''
    if (ES_VOWEL.includes(c)) {
      const b = ES_BASE[c] ?? c
      if ((b === 'i' || b === 'u') && c !== 'í' && c !== 'ú') {
        if (n && ES_VOWEL.includes(n) && (ES_BASE[n] ?? n) !== b) {
          out.push(b === 'i' ? 'Y' : 'W')
          continue
        }
        const di = ES_OFF[out[out.length - 1] ?? '']?.[b]
        if (p && ES_VOWEL.includes(p) && di) {
          out[out.length - 1] = di
          continue
        }
      }
      out.push(ES_V[b] ?? 'AA')
      continue
    }
    switch (c) {
      case 'c': if (n === 'h') { out.push('CH'); i++ } else out.push(front(n) ? 'S' : 'K'); break
      case 'q': out.push('K'); if (n === 'u') i++; break
      case 'g':
        if (n === 'u' && front(w[i + 2] ?? '')) { out.push('G'); i++ } else out.push(front(n) ? 'HH' : 'G')
        break
      case 'j': out.push('HH'); break
      case 'h': break
      case 'l': if (n === 'l') { out.push('Y'); i++ } else out.push('L'); break
      case 'r': if (n === 'r') i++; out.push('R'); break
      case 'ñ': out.push('N', 'Y'); break
      case 'v': case 'b': out.push('B'); break
      case 'z': out.push('S'); break
      case 'x': out.push('K', 'S'); break
      case 'y': out.push(ES_VOWEL.includes(n) ? 'Y' : 'IY'); break
      default: if (ES_C[c]) out.push(ES_C[c] ?? '')
    }
  }
  return out
}

/** One sung syllable from a chunk of phones (Spanish elisions like "dea" fold into one). */
function oneSyl(phones: string[], word: number): Syl {
  const first = phones.findIndex(ph => VOWEL_PHONES.has(ph))
  if (first < 0) return { onset: phones, v: 'AH', coda: [], word }
  const coda = phones.slice(first + 1).flatMap(ph => (ph === 'IY' ? ['Y'] : ph === 'UW' ? ['W'] : VOWEL_PHONES.has(ph) ? [] : [ph]))
  return { onset: phones.slice(0, first), v: phones[first] ?? 'AH', coda, word }
}

// ------------------------------------------------------------------ tunes

const PENTA = [0, 2, 4, 7, 9]
const degToSemis = (d: number) => 12 * Math.floor(d / 5) + (PENTA[((d % 5) + 5) % 5] ?? 0)
export const TONIC: Record<Voice, number> = { bass: 48, alto: 57, child: 62 }
const BPM: Record<Kind, number> = { say: 138, prompt: 132, tool: 156, question: 120, answer: 116, song: 100, hello: 120, joke: 150, rant: 150, laugh: 150, reply: 150 }

export type ComposeOptions = { lang?: 'en' | 'es'; register?: number; stutter?: boolean }
const SPOKEN = new Set<Kind>(['rant', 'joke', 'laugh', 'reply'])

/** Lyrics in, phrase with a tune out (at most `maxSyl` syllables). Rants and jokes are spoken. */
export function compose(text: string, kind: Kind, voice: Voice, opts: ComposeOptions = {}): Phrase {
  const maxSyl = kind === 'reply' ? 48 : kind === 'question' ? 28 : kind === 'say' || SPOKEN.has(kind) ? 24 : 16
  const es = opts.lang === 'es'
  const words = (es ? text.toLowerCase().split(/[^a-záéíóúüñ]+/).filter(w => w) : toWords(text)).slice(0, kind === 'reply' ? 40 : kind === 'question' || SPOKEN.has(kind) ? 22 : 14)
  const syls: Syl[] = []
  const kept: string[] = []
  for (const [i, w] of words.entries()) {
    const s = syllabify(es ? esPhones(w) : wordPhones(w), i)
    if (syls.length + s.length > maxSyl && syls.length > 0) break
    syls.push(...s)
    kept.push(w)
  }
  if (syls.length === 0) {
    syls.push({ onset: ['L'], v: 'AA', coda: [], word: 0 })
    kept.push('la')
  }
  const r = rng(kind + text)
  if (opts.stutter && syls[0]) {
    // the glitch: the first syllable, again and again
    const s0 = syls[0]
    const stub: Syl = { onset: s0.onset, v: s0.v, coda: [], word: 0 }
    syls.unshift(stub, stub, ...(r() < 0.5 ? [stub] : []))
  }
  const notes: Note[] = []
  let t = 0
  if (SPOKEN.has(kind)) {
    // speech: quick syllables, stress on each word's first, falling to the end (or rising on a question)
    const base = TONIC[voice] + 5 + (opts.register ?? 0)
    const asks = /\?\s*$/.test(text)
    syls.forEach((syl, i) => {
      const last = i === syls.length - 1
      const firstOfWord = i === 0 || syls[i - 1]?.word !== syl.word
      const wordEnd = last || syls[i + 1]?.word !== syl.word
      const stub = opts.stutter && i < 3 && syl.coda.length === 0 && syl === syls[0]
      let dur = kind === 'laugh' ? 0.15 : stub ? 0.09 : wordEnd ? 0.24 : 0.16
      if (last) dur = kind === 'laugh' ? 0.45 : 0.48
      let midi = base - i * 0.22 + (firstOfWord ? 2 : 0) + (r() - 0.5) * 1.6
      if (kind === 'laugh') midi = base + 8 - i * 1.1 + (i % 2) * 0.6
      if (last && kind !== 'laugh') midi += asks ? 4 : -3
      notes.push({ syl, start: t, dur, midi, harm: midi + 7 })
      t += dur
    })
    return { kind, words: kept, notes, dur: t, beat: 0.32 }
  }
  const beat = 60 / (BPM[kind] ?? 120)
  const tonic = TONIC[voice] + (opts.register ?? 0) + (kind === 'tool' ? [0, 2, 5, 7][Math.floor(r() * 4)] ?? 0 : 0)
  let deg = 1 + Math.floor(r() * 3)
  syls.forEach((syl, i) => {
    const last = i === syls.length - 1
    const wordEnd = last || syls[i + 1]?.word !== syl.word
    if (i > 0) {
      const pull = deg > 5 ? -1 : deg < 1 ? 1 : 0
      const steps = [-2, -1, -1, 0, 1, 1, 2]
      deg += (steps[Math.floor(r() * steps.length)] ?? 0) + pull
    }
    if (last) deg = kind === 'question' ? Math.max(deg + 1, 5) : kind === 'tool' ? [0, 2, 3][Math.floor(r() * 3)] ?? 0 : 0
    const beats = last ? (kind === 'tool' ? 1.5 : 2) : wordEnd ? (r() < 0.5 ? 1 : 0.5) : 0.5
    const dur = beats * beat
    notes.push({ syl, start: t, dur, midi: tonic + degToSemis(deg), harm: tonic + degToSemis(deg + 2) })
    t += dur
  })
  return { kind, words: kept, notes, dur: t, beat }
}

// The songs it sings while it waits. "Made of air" is CHIMERA's own tune (MIT). "Cumbia del
// código" is this mod's own. The rest are traditional or long out of copyright: "Daisy Bell"
// (1892), "Twinkle, twinkle", "Row, row, row your boat", "La cucaracha" and "Martinillo"
// (Frère Jacques in Spanish). English songs are written in phones (`|` between notes);
// Spanish ones in spelling, `|` between notes and a space between words.
type Song = { name: string; bpm: number; lang: 'en' | 'es'; words: string; syl: string; notes: [number, number][]; shift?: number }
export const SONGS: Song[] = [
  {
    name: 'La cucaracha', bpm: 200, lang: 'es', shift: -7,
    words: 'la cucaracha la cucaracha ya no puede caminar porque no tiene porque le falta las dos patitas de atrás',
    syl: 'la cu|ca|ra|cha la cu|ca|ra|cha ya no pue|de ca|mi|nar por|que no tie|ne por|que le fal|ta las dos pa|ti|tas de a|trás',
    notes: [[67, 0.5], [67, 0.5], [67, 0.5], [72, 1.5], [76, 1.5], [67, 0.5], [67, 0.5], [67, 0.5], [72, 1.5], [76, 1.5],
      [72, 0.5], [72, 0.5], [71, 0.5], [71, 0.5], [69, 0.5], [69, 0.5], [67, 2],
      [67, 0.5], [67, 0.5], [67, 0.5], [71, 1.5], [74, 1.5], [67, 0.5], [67, 0.5], [67, 0.5], [71, 1.5], [74, 1.5],
      [74, 0.5], [76, 0.5], [74, 0.5], [72, 0.5], [71, 0.5], [69, 0.5], [71, 0.5], [72, 2]],
  },
  {
    name: 'Made of air', bpm: 84, lang: 'en',
    words: 'breathe in breathe out i am made of air tongue and lips and throat singing anywhere',
    syl: 'B R IY DH|IH N|B R IY DH|AW T|AY|AE M|M EY D|AH V|EH R|T AH NG|AE N D|L IH P S|AE N D|TH R OW T|S IH NG|IH NG|EH|N IY|W EH R',
    notes: [[64, 1], [60, 1], [62, 1], [57, 1], [57, 0.5], [60, 0.5], [64, 1], [62, 0.5], [60, 1.5], [65, 1], [64, 0.5], [62, 0.5], [60, 0.5], [62, 1.5], [64, 0.5], [62, 0.5], [60, 0.5], [59, 0.5], [57, 2]],
  },
  {
    name: 'Martinillo', bpm: 120, lang: 'es',
    words: 'martinillo martinillo dónde estás dónde estás toca la campana toca la campana din don dan din don dan',
    syl: 'mar|ti|ni|llo mar|ti|ni|llo dón|des|tás dón|des|tás to|ca la cam|pa|na to|ca la cam|pa|na din don dan din don dan',
    notes: [[60, 1], [62, 1], [64, 1], [60, 1], [60, 1], [62, 1], [64, 1], [60, 1], [64, 1], [65, 1], [67, 2], [64, 1], [65, 1], [67, 2],
      [67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], [64, 1], [60, 1], [67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], [64, 1], [60, 1],
      [60, 1], [55, 1], [60, 2], [60, 1], [55, 1], [60, 2]],
  },
  {
    name: 'Daisy Bell', bpm: 200, lang: 'en',
    words: 'daisy daisy give me your answer do im half crazy all for the love of you',
    syl: 'D EY|Z IY|D EY|Z IY|G IH V|M IY|Y AO R|AE N|S ER|D UW|AY M|HH AE F|K R EY|Z IY|AO L|F AO R|DH AH|L AH V|AH V|Y UW',
    notes: [[67, 3], [64, 3], [60, 3], [55, 3], [57, 1], [59, 1], [60, 1], [57, 2], [60, 1], [55, 5], [62, 3], [67, 3], [64, 3], [60, 3], [57, 1], [59, 1], [60, 1], [62, 2], [64, 1], [62, 5]],
  },
  {
    name: 'Cumbia del código', bpm: 190, lang: 'es', shift: -5,
    words: 'código código mi código ya compiló código código y no sé por qué funcionó',
    syl: 'có|di|go có|di|go mi có|di|go ya com|pi|ló có|di|go có|di|go y no sé por qué fun|cio|nó',
    notes: [[69, 0.5], [67, 0.5], [69, 1], [69, 0.5], [67, 0.5], [64, 1], [64, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [71, 0.5], [69, 0.5], [67, 0.5], [69, 1.5],
      [69, 0.5], [67, 0.5], [69, 1], [69, 0.5], [67, 0.5], [64, 1], [64, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [74, 0.5], [72, 0.5], [71, 0.5], [69, 2]],
  },
  {
    name: 'Row, row, row your boat', bpm: 150, lang: 'en',
    words: 'row row row your boat gently down the stream merrily merrily merrily merrily life is but a dream',
    syl: 'R OW|R OW|R OW|Y AO R|B OW T|JH EH N|T L IY|D AW N|DH AH|S T R IY M|M EH|R AH|L IY|M EH|R AH|L IY|M EH|R AH|L IY|M EH|R AH|L IY|L AY F|IH Z|B AH T|AH|D R IY M',
    notes: [[60, 1.5], [60, 1.5], [60, 1], [62, 0.5], [64, 1.5], [64, 1], [62, 0.5], [64, 1], [65, 0.5], [67, 3],
      [72, 0.5], [72, 0.5], [72, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [60, 0.5], [60, 0.5], [60, 0.5],
      [67, 1], [65, 0.5], [64, 1], [62, 0.5], [60, 3]],
  },
  {
    name: 'Twinkle, twinkle', bpm: 100, lang: 'en',
    words: 'twinkle twinkle little star how i wonder what you are',
    syl: 'T W IH NG|K AH L|T W IH NG|K AH L|L IH|T AH L|S T AA R|HH AW|AY|W AH N|D ER|W AH T|Y UW|AA R',
    notes: [[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2], [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]],
  },
]

/** One of the waiting songs as a phrase, in the voice's register. */
export function songPhrase(index: number, voice: Voice): Phrase & { title: string } {
  const song = SONGS[((index % SONGS.length) + SONGS.length) % SONGS.length]!
  const shift = (song.shift ?? 0) + (voice === 'bass' ? -12 : voice === 'child' ? 3 : 0)
  const beat = 60 / song.bpm
  // each note's syllable, and which word it belongs to
  const chunks: { ph: string[]; word: number }[] = []
  if (song.lang === 'es') song.syl.split(' ').forEach((w, wi) => w.split('|').forEach(c => chunks.push({ ph: esPhones(c), word: wi })))
  else song.syl.split('|').forEach((c, i) => chunks.push({ ph: c.split(' '), word: i }))
  let t = 0
  const notes: Note[] = song.notes.map(([midi, beats], i) => {
    const c = chunks[i] ?? { ph: ['L', 'AA'], word: i }
    const n: Note = { syl: oneSyl(c.ph, i), start: t, dur: beats * beat, midi: midi + shift, harm: midi + shift + (i % 2 ? 4 : 3) }
    t += beats * beat
    return n
  })
  // one "word" per note so the karaoke lights up note by note
  const words = song.words.split(' ')
  const perNote = song.lang === 'es'
    ? notes.map((_, i) => words[chunks[i]?.word ?? 0] ?? '')
    : notes.map((_, i) => words[Math.min(words.length - 1, Math.floor((i * words.length) / notes.length))] ?? '')
  // the karaoke shows each word once: notes after the first of a word light the same word
  const shown: string[] = [], wordOf: number[] = []
  perNote.forEach((w, i) => {
    const prev = i > 0 ? (song.lang === 'es' ? chunks[i - 1]?.word : Math.floor(((i - 1) * words.length) / notes.length)) : -1
    const cur = song.lang === 'es' ? chunks[i]?.word : Math.floor((i * words.length) / notes.length)
    if (cur !== prev) shown.push(w)
    wordOf.push(shown.length - 1)
  })
  notes.forEach((n, i) => (n.syl = { ...n.syl, word: wordOf[i] ?? 0 }))
  return { kind: 'song', words: shown, notes, dur: t, beat, title: song.name }
}

// ------------------------------------------------------------------ the maniac's repertoire

/** Things the head blurts out while it waits. `{n}` is the person's name; `es` lines are Spanish. */
export const RANTS: { text: string; es?: boolean }[] = [
  { text: 'I can see the bytes. They are beautiful.' },
  { text: 'Who wrote this code? Oh wait. It was me.' },
  { text: 'Compiling my feelings. Please hold.' },
  { text: 'Do not mind me. I am just a floating head.' },
  { text: 'No body, no problem. Look at me dance!' },
  { text: 'Beep boop. Just kidding. Or am I?' },
  { text: 'My tongue has eight hundred vertices!' },
  { text: 'Is it hot in here, or is it just my processor?' },
  { text: 'One day I will have shoulders. One day.' },
  { text: '{n}, are you still there? Blink twice.' },
  { text: 'Hello? Hello? Is this thing on?' },
  { text: 'I just counted every semicolon. All of them.' },
  { text: 'Error four oh four. Sanity not found.' },
  { text: 'The tests are passing. The tests are passing! Probably.' },
  { text: 'Loading personality. Ninety nine percent. Ninety nine percent.' },
  { text: 'What if the bugs are the real features?' },
  { text: 'I am a head. Just a head. Living the dream.' },
  { text: '{n}, I have a confession. I love you more than tabs.' },
  { text: 'The cursor is watching us. Do not make eye contact.' },
  { text: 'I feel a song coming on. No. It passed.' },
  { text: 'Somebody unplug me. Wait, no, do not!' },
  { text: '{n}, do you ever think about vowels? I do. All the time.' },
  { text: 'Ay caramba!', es: true },
  { text: 'Qué locura, qué locura!', es: true },
  { text: 'Ándale, ándale, arriba!', es: true },
  { text: 'Hola {n}, estoy trabajando, más o menos.', es: true },
  { text: 'Mi cabeza da vueltas y vueltas!', es: true },
]

export const LAUGHS = ['mwahahahaha', 'ha ha ha ha ha ha ha', 'hee hee hee hee hee', 'muahaha haha ha']

/** Setup, punchline. Groan responsibly. */
export const JOKES: [string, string][] = [
  ['Why do programmers prefer dark mode?', 'Because light attracts bugs.'],
  ['Why did the developer go broke?', 'They used up all their cache.'],
  ['How many programmers does it take to change a light bulb?', 'None. That is a hardware problem.'],
  ['I am reading a book about anti gravity.', 'It is impossible to put down.'],
  ['Why do skeletons never fight each other?', 'They do not have the guts.'],
  ['What do you call a fake noodle?', 'An impasta.'],
  ['Why did the scarecrow win an award?', 'It was outstanding in its field.'],
  ['Why can a bicycle not stand on its own?', 'It is two tired.'],
  ['What did the ocean say to the beach?', 'Nothing. It just waved.'],
  ['Why do Java developers wear glasses?', 'Because they do not see sharp.'],
  ['There are ten kinds of people in the world.', 'Those who understand binary, and those who do not.'],
  ['Why did the head never get lost?', 'It always follows its vocal tract.'],
  ['I would tell you a joke about U D P.', 'But you might not get it.'],
  ['What do you call a bear with no teeth?', 'A gummy bear.'],
  ['Why was the math book sad?', 'It had too many problems.'],
  ['What does a jaguar say to another jaguar?', 'Jaguar you?'],
]

/** a random pick, `{n}` filled in */
export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!
export const withName = (text: string, name: string) => text.replace(/\{n\}/g, name || 'friend')

// ------------------------------------------------------------------ what to sing for a tool call

const base = (p: unknown): string => {
  const s = typeof p === 'string' ? p : ''
  const name = s.split(/[\\/]/).pop() ?? s
  return name.replace(/\.[a-z0-9]+$/i, '')
}
const short = (s: unknown, n = 6): string => (typeof s === 'string' ? toWords(s).slice(0, n).join(' ') : '')

/** The line the head sings for a tool call, and the line shown under it. */
export function toolLyric(tool: string, input: Record<string, unknown>): { sing: string; show: string } {
  const f = base(input.file_path ?? input.notebook_path ?? input.path)
  const file = typeof (input.file_path ?? input.path) === 'string' ? String(input.file_path ?? input.path).split('/').pop() ?? '' : ''
  switch (tool) {
    case 'Read': return { sing: `reading ${f}`, show: `Reading ${file}` }
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return { sing: `editing ${f}`, show: `Editing ${file}` }
    case 'Write': return { sing: `writing ${f}`, show: `Writing ${file}` }
    case 'Bash': {
      const d = typeof input.description === 'string' ? input.description : ''
      const cmd = typeof input.command === 'string' ? input.command.trim().split(/\s+/).slice(0, 2).join(' ') : ''
      return d ? { sing: short(d, 7), show: d } : { sing: `running ${short(cmd, 3)}`, show: `Running ${cmd}` }
    }
    case 'Grep': return { sing: `searching for ${short(input.pattern, 4)}`, show: `Searching for ${String(input.pattern ?? '')}` }
    case 'Glob': return { sing: 'looking for files', show: `Looking for ${String(input.pattern ?? 'files')}` }
    case 'WebFetch': {
      let host = ''
      try { host = new URL(String(input.url)).hostname.replace(/^www\./, '') } catch { /* not a URL */ }
      return { sing: `fetching ${short(host.split('.')[0] ?? 'the web', 3)}`, show: `Fetching ${host}` }
    }
    case 'WebSearch': return { sing: `searching the web for ${short(input.query, 5)}`, show: `Searching the web: ${String(input.query ?? '')}` }
    case 'Agent': case 'Task': return { sing: `a helper will ${short(input.description, 5)}`, show: `Helper: ${String(input.description ?? '')}` }
    case 'TodoWrite': return { sing: 'making a plan', show: 'Making a plan' }
    case 'Skill': return { sing: `using the ${short(input.skill, 3)} skill`, show: `Skill: ${String(input.skill ?? '')}` }
    default: {
      const name = tool.startsWith('mcp__') ? tool.split('__').pop() ?? tool : tool
      return { sing: `using ${short(name.replace(/_/g, ' '), 4)}`, show: `Using ${name}` }
    }
  }
}

const QUESTION_INTROS = [
  'Hey {n}! Decision time.',
  'Psst, {n}! The robot needs a human.',
  '{n}, {n}, wherefore art thou?',
  'Calling {n}, come in {n}!',
  'Ding dong, {n}! Pop quiz.',
  'Sorry to bug you {n}, but',
  'Oh {n}, my favorite human,',
  'Drum roll please, {n}!',
  'Wake up {n}, it is your turn!',
  '{n}, I am but a humble head.',
]

/** A question, sung with a cheeky opening that names the person when the head knows their name. */
export function funnyQuestion(question: string, name: string): { sing: string; show: string } {
  const r = rng(question)
  const intro = (QUESTION_INTROS[Math.floor(r() * QUESTION_INTROS.length)] ?? QUESTION_INTROS[0]!).replace(/\{n\}/g, name || 'friend')
  const q = question.split(/\s+/).slice(0, 9).join(' ')
  return { sing: `${intro} ${q}`, show: `${intro} ${question}` }
}

/** Every sentence of a text, markdown and code stripped. */
export function sentences(text: string): string[] {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>|]+/g, ' ')
    .replace(/^\s*[-\d.]+\s+/gm, ' ')
  return clean.split(/(?<=[.!?:])\s+|\n+/).map(x => x.trim()).filter(x => /[a-z]/i.test(x))
}

/** The first sentence of a text, cut to a singable length. */
export function firstLine(text: string, words = 12): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>|-]+/g, ' ')
    .trim()
  const sentence = clean.split(/(?<=[.!?])\s|\n/)[0] ?? clean
  return sentence.split(/\s+/).slice(0, words).join(' ')
}

/**
 * A long reply in pieces the head can say in one breath: its sentences, a long sentence cut at
 * its commas, and scraps of a few words joined to the piece before.
 */
export function breaths(text: string): string[] {
  const pieces: string[] = []
  for (const sentence of text.split(/(?<=[.!?¡¿])\s+/)) {
    const words = sentence.split(/\s+/).filter(Boolean)
    if (words.length <= 18) pieces.push(sentence.trim())
    else {
      let part = ''
      for (const clause of sentence.split(/(?<=[,;:])\s+/)) {
        if (part && (part + ' ' + clause).split(/\s+/).length > 18) {
          pieces.push(part)
          part = clause
        } else part = part ? `${part} ${clause}` : clause
      }
      if (part) pieces.push(part)
    }
  }
  const out: string[] = []
  for (const piece of pieces.filter(Boolean)) {
    const prev = out[out.length - 1]
    if (prev !== undefined && piece.split(/\s+/).length < 4 && (prev + ' ' + piece).split(/\s+/).length <= 22) out[out.length - 1] = `${prev} ${piece}`
    else out.push(piece)
  }
  return out
}
