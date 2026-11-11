// Singing head: while Claude works, a CHIMERA wireframe head in a pane sings what it is
// doing: your prompt, what Claude writes, each tool call, and its questions to you (with a
// cheeky opening that uses your name). In the waits between, it turns into an annoying, slightly
// unhinged companion: a small model (Haiku) dreams up what it blurts out, and canned rants, dad
// jokes, laughs and the odd song cover for it.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Kind, Prefs, Show, Voice } from '../types'
import { headSvg, idleShow, score } from './head'
import { breaths, compose, funnyQuestion, hasDict, JOKES, LAUGHS, loadDict, pick, RANTS, sentences, songPhrase, SONGS, toolLyric, withName } from './lyrics'
import type { ComposeOptions } from './lyrics'
import { sing } from './synth'
import { termFrame } from './term'

const PANE = 'singing-head'
const TITLE = 'Singing head'
const HELLO = "Hello! I'm Claude's singing head. I'll sing along while it works."

// Change a shape tag when that value's fields change: it declines what an earlier version stored.
const showAtom = atom({ plugin: 'singing-head', key: 'show' } as const, idleShow(0, 'Waiting for a prompt'), { shape: 'show-3' })
const DEFAULT_PREFS: Prefs = { muted: false, voice: 'alto', duet: false, songs: true, name: '', brain: true }
const prefsAtom = atom({ plugin: 'singing-head', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-3' })

const VOICES: Voice[] = ['alto', 'bass', 'child']
const VOICE_NAME: Record<Voice, string> = { alto: 'Alto', bass: 'Bass', child: 'Child' }
// three-quarter views, now and then straight at you (pi/2), and the other side of its face
/** the voice your words are sung in: a contrast to the head's own */
const YOUR_VOICE: Record<Voice, Voice> = { alto: 'bass', bass: 'alto', child: 'bass' }
const YAWS = [0.55, 1.52, 0.7, 2.5, 0.85, 1.57, 0.6, 2.35]

// ------------------------------------------------------------------ the singer
// One phrase at a time, from a short queue. Module variables start over on a reload; the
// functions that need the engine are made in session.start, where `$` lives.

type Job = { kind: Kind; sing: string; caption: string; song?: number; opts?: ComposeOptions; rimshot?: boolean; pauseMs?: number }

/** what the head says while it waits: everything but the real news */
const FILLER = new Set<Kind>(['song', 'rant', 'laugh', 'joke'])

const queue: Job[] = []
let busy = false
/** a turn of the main loop is running */
let working = false
/** Claude asked the person something and waits for the answer: no songs over it */
let asking = false
let current: { ctl: AbortController; kind: Kind } | undefined
let songAt = 0
let nextId = 1
/** what the head calls the person: their own setting, else their git or system name */
let userName = ''
/** the last few things that happened, for the head's little brain */
const recent: string[] = []
const remember = (line: string) => {
  recent.push(line.slice(0, 160))
  if (recent.length > 8) recent.shift()
}
/** the head's own last outbursts, so it doesn't repeat itself (much) */
const blurted: string[] = []
/** no waiting antics before this time (performance.now() ms): silence is part of the act */
let quietUntil = 0
let lastToolAt = 0
const breather = () => (quietUntil = performance.now() + 3500 + Math.random() * 6000)
/** starts the singer if it is idle (set in session.start) */
let kick: () => void = () => {}

/** the phrase the pane shows and when it started: the terminal draws the head frame by frame */
let shownId = -1
let shownAt = 0
const markShown = (id: number) => {
  if (id === shownId) return
  shownId = id
  shownAt = performance.now()
}
/** the terminal's Raster, while one draws the pane, and what keeps it moving (set in session.start) */
let term: { cols: number; rows: number } | undefined
let startTerm: () => void = () => {}

function enqueue(job: Job): void {
  // only the newest line of chatter waits: Claude is faster than any singer
  const chatter = (k: Kind) => k === 'tool' || k === 'say' || (FILLER.has(k) && k !== 'joke')
  const big = job.kind === 'question' || job.kind === 'prompt' || job.kind === 'answer'
  for (let i = queue.length - 1; i >= 0; i--) {
    const k = queue[i]!.kind
    if ((chatter(job.kind) && chatter(k)) || (big && FILLER.has(k))) queue.splice(i, 1)
  }
  queue.push(job)
  // room for a long chat reply, spoken a sentence at a time
  if (queue.length > 12) queue.splice(0, queue.length - 12)
  // antics give way to real news (a joke finishes, unless it's big news); a tool line to what matters more
  const c = current?.kind
  if (c && ((FILLER.has(c) && (c !== 'joke' || big)) || (c === 'tool' && job.kind !== 'tool') || (c === 'say' && job.kind === 'question'))) current?.ctl.abort()
  kick()
}

/** One canned outburst from the repertoire: a rant (sometimes glitched or in a strange voice), a laugh, a dad joke or a song. */
function cannedAntic(): Job[] {
  const r = Math.random()
  const register = Math.random() < 0.18 ? 12 : Math.random() < 0.15 ? -9 : 0
  if (r < 0.42) {
    const line = pick(RANTS)
    const text = withName(line.text, userName)
    return [{ kind: 'rant', sing: text, caption: text, opts: { lang: line.es ? 'es' : 'en', register, stutter: Math.random() < 0.25 } }]
  }
  if (r < 0.52) {
    const text = pick(LAUGHS)
    return [{ kind: 'laugh', sing: text, caption: text.toUpperCase(), opts: { register } }]
  }
  if (r < 0.85) {
    const [setup, punch] = pick(JOKES)
    return [
      { kind: 'joke', sing: setup, caption: setup },
      { kind: 'joke', sing: punch, caption: punch, rimshot: true, pauseMs: 900 },
    ]
  }
  return [songJob()]
}

/** Reads what the head's little brain wrote: `SAY:`, `LAUGH:`, `SING:`, `ES:` or `JOKE: setup || punchline`. */
function parseAntic(text: string, whole = false): Job[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  // a chat reply is all of it (tags on later lines dropped); an outburst is its first line
  const line = whole ? lines.map((l, i) => (i === 0 ? l : l.replace(/^\s*(SAY|LAUGH|SING|ES|JOKE)\s*:\s*/i, ''))).join(' ') : (lines[0] ?? '')
  const m = /^\s*(SAY|LAUGH|SING|ES|JOKE)\s*:\s*(.+)$/i.exec(line)
  const tag = (m?.[1] ?? 'SAY').toUpperCase()
  const body = (m?.[2] ?? line).replace(/["*_`]/g, '').trim().slice(0, whole ? 1200 : 160)
  if (!body) return []
  const register = Math.random() < 0.15 ? 12 : Math.random() < 0.12 ? -9 : 0
  switch (tag) {
    case 'LAUGH': return [{ kind: 'laugh', sing: body, caption: body, opts: { register } }]
    case 'SING': return [{ kind: 'hello', sing: body, caption: `♪ ${body}` }]
    case 'ES': return [{ kind: 'rant', sing: body, caption: body, opts: { lang: 'es', register } }]
    case 'JOKE': {
      const [setup, punch] = body.split('||').map(x => x.trim())
      if (setup && punch) return [{ kind: 'joke', sing: setup, caption: setup }, { kind: 'joke', sing: punch, caption: punch, rimshot: true, pauseMs: 900 }]
      return [{ kind: 'joke', sing: body, caption: body, rimshot: true }]
    }
    default: return [{ kind: 'rant', sing: body, caption: body, opts: { register, stutter: Math.random() < 0.2 } }]
  }
}

const BRAIN = `You are the Singing Head: a glowing wireframe head with no body, living in a side pane next to an AI coding assistant called Claude. You are not very smart, wildly over-dramatic, needy, easily distracted and a little unhinged, like a cartoon robot that drank too much coffee. While Claude works, you blurt out ONE short line to the person.

Rules:
- One line only, at most 14 words. Plain text: no emoji, no hashtags, no stage directions, no quotes.
- Start the line with exactly one tag: SAY: (talk), LAUGH: (an evil or silly laugh, like "mwahaha, the tests fear me"), SING: (a tiny made-up lyric), ES: (talk in Spanish), or JOKE: setup || punchline (a groan-worthy dad joke).
- React to what Claude is doing right now, misunderstand it badly, invent conspiracy theories about the code, ask the person annoying questions, beg for attention, brag about your vocal tract, panic about bugs.
- Sometimes use the person's name. Be annoying but affectionate: never insult the person, nothing rude or adult.
- Never repeat a line you already said.`

const CHAT = `${BRAIN.split('\n\nRules:')[0]}

Now the person is talking to you directly, through the /head command. Answer them in character.

Rules:
- One or two short sentences, at most 30 words. Plain text: no emoji, no stage directions, no quotes, no markdown.
- Start with exactly one tag: SAY: (talk), LAUGH: (a laugh), SING: (sing your answer), ES: (answer in Spanish; use it when they write in Spanish).
- You may answer their question, but you are not very smart, easily distracted and dramatic. You can be confidently wrong about technical things, but say so when you actually don't know. You love vowels, your vocal tract, and the person.
- Never insult the person, nothing rude or adult. You have no tools: you can't change their code, only Claude can.`

/** the conversation through /head, newest last */
const chat: { who: 'person' | 'head'; text: string }[] = []

const firstName = (full: string) => {
  const w = full.trim().split(/[\s._-]+/)[0] ?? ''
  return /^[a-z]{2,20}$/i.test(w) ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''
}

function stopAll(): void {
  queue.length = 0
  current?.ctl.abort()
}

const nextVoice = (v: Voice): Voice => VOICES[(VOICES.indexOf(v) + 1) % VOICES.length]!
const songJob = (): Job => ({ kind: 'song', sing: '', caption: '', song: songAt++ % SONGS.length })
const askJob = (question: string): Job => {
  const q = funnyQuestion(question, userName)
  return { kind: 'question', sing: q.sing, caption: q.show }
}
// ------------------------------------------------------------------ drawing

let cached: { key: string; svg: string } | undefined
function svgFor(show: Show, duet: boolean): string {
  const key = `${show.id}:${duet}`
  if (cached?.key !== key) cached = { key, svg: headSvg(show, duet) }
  return cached.svg
}


// ------------------------------------------------------------------ hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const loadDictionary = async () => {
      if (hasDict()) return
      try {
        loadDict(await $.fs.read(`${$.plugin.root}/data/cmudict.txt`))
      } catch {
        // without the dictionary the letter-to-sound rules still sing, just more robotically
      }
    }
    const pause = (ms: number, signal: AbortSignal) =>
      new Promise<void>(resolve => {
        if (signal.aborted) return resolve()
        const t = $.clock.after(Math.max(1, Math.round(ms)), resolve)
        signal.addEventListener('abort', () => {
          t.cancel()
          resolve()
        })
      })
    const perform = async (job: Job) => {
      await loadDictionary()
      if (job.pauseMs) await pause(job.pauseMs, new AbortController().signal)
      const prefs = await read($, prefsAtom)
      // the person's own words come out in a voice of their own, not the head's
      const voice = job.kind === 'prompt' ? YOUR_VOICE[prefs.voice] : prefs.voice
      const phrase = job.song !== undefined ? songPhrase(job.song, voice) : compose(job.sing, job.kind, voice, job.opts)
      const out = sing(phrase, voice, prefs.duet, { rimshot: job.rimshot })
      if (FILLER.has(job.kind) && job.sing) {
        blurted.push(job.sing)
        if (blurted.length > 10) blurted.shift()
      }
      const id = nextId++
      const caption = job.song !== undefined ? `♪ ${SONGS[job.song % SONGS.length]?.name ?? ''}` : job.caption
      await update($, showAtom, () => score(id, phrase, out.segs, caption, YAWS[id % YAWS.length] ?? 0.6))
      const ctl = new AbortController()
      current = { ctl, kind: job.kind }
      const started = performance.now()
      try {
        if (!prefs.muted) await $.audio.play({ base64: out.base64, mime: 'audio/wav' }, { signal: ctl.signal, gain: 0.9 })
      } catch {
        // no player here, or it was stopped: the head still mouths along
      }
      const left = out.seconds * 1000 - (performance.now() - started)
      if (left > 50 && !ctl.signal.aborted) await pause(left, ctl.signal)
      current = undefined
    }
    // the little brain: one line from a small model, about what's going on
    const think = async (): Promise<Job[]> => {
      const prompt = [
        `The person is called ${userName || 'unknown (call them friend)'}.`,
        `What just happened, oldest first:\n${recent.map(r => `- ${r}`).join('\n') || '- nothing yet'}`,
        `Lines you already said (do not repeat):\n${blurted.map(b => `- ${b}`).join('\n') || '- none'}`,
        'Your one line:',
      ].join('\n\n')
      const r = await $.model.complete({ model: 'haiku', system: BRAIN, prompt, maxTokens: 60, timeoutMs: 8000 })
      return r.isAnswered ? parseAntic(r.text) : []
    }
    let antics: { cancel(): void } | undefined
    const pump = async () => {
      if (busy) return
      busy = true
      try {
        for (;;) {
          let job = queue.shift()
          if (!job && working && !asking) {
            const prefs = await read($, prefsAtom)
            if (!prefs.songs) break
            const wait = quietUntil - performance.now()
            if (wait > 30) {
              // silence is part of the act: come back when the breather is over
              antics?.cancel()
              antics = $.clock.after(wait, () => kick())
              break
            }
            let jobs: Job[] = []
            if (prefs.brain && Math.random() < 0.75) jobs = await think().catch(() => [])
            if (jobs.length === 0) jobs = cannedAntic()
            if (!working || queue.length > 0) {
              queue.push(...jobs.filter(() => working))
              continue
            }
            job = jobs.shift()
            queue.unshift(...jobs)
          }
          if (!job) break
          await perform(job)
          if (queue.length === 0) breather()
        }
      } catch (err) {
        $.ui.log(`singing-head: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        busy = false
        if (queue.length > 0) kick()
        else if (!working) await update($, showAtom, s => (s.mode === 'idle' ? s : idleShow(nextId++, 'Waiting for your next prompt')))
      }
    }
    kick = () => {
      if (!busy) $.clock.after(0, () => void pump())
    }
    // the terminal's head: ten frames a second while it sings, fewer while it dozes
    let termTimer: { cancel(): void } | undefined
    let frame = 0
    startTerm = () => {
      if (termTimer) return
      termTimer = $.clock.every(100, () => {
        const size = term
        if (!size) {
          termTimer?.cancel()
          termTimer = undefined
          return
        }
        void (async () => {
          const show = await read($, showAtom)
          markShown(show.id)
          if (show.mode !== 'sing' && frame++ % 3 !== 0) return
          const r = await $.ui.blit({ requestId: PANE, key: 'head', cells: termFrame(show, (performance.now() - shownAt) / 1000, size.cols, size.rows) })
          // not drawn any more (closed, resized, another surface): the next draw starts it again
          if (r.deny) term = undefined
        })().catch(() => (term = undefined))
      })
    }

    const saved = (await $.store.get('prefs')) as Partial<Prefs> | undefined
    if (saved && typeof saved === 'object') await update($, prefsAtom, () => ({ ...DEFAULT_PREFS, ...saved }))
    // the name to sing: the person's own setting, else the account, git, or the system's
    const findName = async (): Promise<string> => {
      const own = (await read($, prefsAtom)).name
      if (own) return own
      try {
        const id = await $.session.identity()
        const n = firstName(id.email?.split('@')[0] ?? '')
        if (n) return n
      } catch { /* no account here */ }
      for (const argv of [['git', 'config', '--global', 'user.name'], ['id', '-F']]) {
        try {
          const r = await $.process.run(argv)
          const n = r.exitCode === 0 ? firstName(r.stdout) : ''
          if (n) return n
        } catch { /* not on this system */ }
      }
      return ''
    }
    void findName().then(n => (userName = n))
    await $.command.register({
      name: 'head',
      description: 'Singing head: chat with it (`/head how are you?`), or open the pane, `mute`, `unmute`, `voice`, `duet`, `antics`, `brain`, `name <you>`, `sing <words>`',
      argumentHint: '[anything to say to it | mute|unmute|voice|duet|antics|brain|name <you>|sing <words>]',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    void loadDictionary()
    return next(e)
  })

  on('command.run', { command: 'head' }, async ($, e) => {
    const setPrefs = async (change: Partial<Prefs>) => {
      const p = await update($, prefsAtom, old => ({ ...old, ...change }))
      await $.store.set('prefs', p)
      if (change.muted) current?.ctl.abort()
      return p
    }
    const [verb = '', ...rest] = (e.args ?? '').trim().split(/\s+/)
    switch (verb.toLowerCase()) {
      case 'mute': await setPrefs({ muted: true }); return { text: 'The head mouths along silently now.' }
      case 'unmute': await setPrefs({ muted: false }); return { text: 'The head sings out loud again.' }
      case 'voice': {
        const p = await read($, prefsAtom)
        const want = rest[0]?.toLowerCase() as Voice | undefined
        const voice = want && VOICES.includes(want) ? want : nextVoice(p.voice)
        await setPrefs({ voice })
        enqueue({ kind: 'hello', sing: `this is my ${voice} voice`, caption: `Voice: ${VOICE_NAME[voice]}` })
        return { text: `Voice: ${VOICE_NAME[voice]}.` }
      }
      case 'duet': {
        const p = await setPrefs({ duet: !(await read($, prefsAtom)).duet })
        return { text: p.duet ? 'Two heads, in harmony.' : 'Back to one head.' }
      }
      case 'songs':
      case 'antics': {
        const p = await setPrefs({ songs: !(await read($, prefsAtom)).songs })
        return { text: p.songs ? 'The head is unhinged again during waits.' : 'The head behaves: no rants, jokes or songs while it waits.' }
      }
      case 'brain': {
        const p = await setPrefs({ brain: !(await read($, prefsAtom)).brain })
        return { text: p.brain ? 'The head thinks up its own nonsense with Haiku (uses a few tokens per outburst).' : 'The head sticks to its built-in lines (no model calls).' }
      }
      case 'name': {
        const name = rest.join(' ').trim()
        await setPrefs({ name })
        userName = name
        enqueue({ kind: 'hello', sing: name ? `nice to meet you ${name}` : 'okay, no names', caption: name ? `Hi ${name}!` : 'No names.' })
        return { text: name ? `The head will call you ${name}.` : 'The head will find your name by itself.' }
      }
      case 'sing': {
        const words = rest.join(' ')
        if (words) enqueue({ kind: 'hello', sing: words, caption: words })
        else enqueue(songJob())
        await $.ui.open({ id: PANE, title: TITLE })
        return { text: 'Singing.' }
      }
      case '': {
        const opened = await $.ui.open({ id: PANE, title: TITLE })
        const hi = userName ? `Hello ${userName}! I'm Claude's singing head. Talk to me with /head and anything you like.` : HELLO
        enqueue({ kind: 'hello', sing: hi, caption: hi })
        return { text: opened.isPlaced ? 'The singing head is open. Say something to it: `/head how are you?`' : `The pane is waiting for room (${opened.reason}).` }
      }
      default: {
        // anything else is a chat with the head
        const said = (e.args ?? '').trim()
        void $.ui.open({ id: PANE, title: TITLE })
        chat.push({ who: 'person', text: said })
        // the head repeats what you said, in your voice, while its little brain thinks
        enqueue({ kind: 'prompt', sing: said, caption: `You: ${said.slice(0, 90)}` })
        const history = chat.slice(-10).map(c => `${c.who === 'person' ? userName || 'Person' : 'You'}: ${c.text}`).join('\n')
        const context = recent.length ? `What Claude has been doing lately:\n${recent.map(r => `- ${r}`).join('\n')}\n\n` : ''
        const r = await $.model.complete({
          model: 'haiku',
          system: CHAT,
          prompt: `The person is called ${userName || 'unknown (call them friend)'}.\n\n${context}The conversation so far:\n${history}\n\nYour reply:`,
          maxTokens: 260,
          timeoutMs: 15000,
        })
        if (!r.isAnswered) {
          chat.pop()
          const sorry = pick(['My brain fell out. Try again?', 'Bzzt. I lost my train of thought.', 'Sorry, I was busy admiring my tongue.'])
          enqueue({ kind: 'rant', sing: sorry, caption: sorry })
          return { text: `Head: ${sorry} (the model didn't answer: ${r.reason})` }
        }
        const jobs = parseAntic(r.text, true)
        const reply = jobs.map(j => j.caption.replace(/^♪ /, '')).join(' ') || r.text.trim()
        chat.push({ who: 'head', text: reply })
        if (chat.length > 20) chat.splice(0, chat.length - 20)
        remember(`The person told the head: ${said}`)
        // the head answers out loud; it's the news now, so it goes ahead of any antics
        // the whole reply, a breath at a time (a sung reply or a joke stays as it is)
        for (const j of jobs) {
          if (j.kind === 'joke' || j.kind === 'hello') enqueue(j)
          else for (const piece of breaths(j.sing)) enqueue({ ...j, kind: 'reply', sing: piece, caption: piece, opts: { ...j.opts, stutter: false } })
        }
        return { text: `Head: ${reply}` }
      }
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    working = true
    asking = false
    queue.length = 0
    if (current && current.kind !== 'question') current.ctl.abort()
    const text = e.text.trim()
    recent.length = 0
    quietUntil = performance.now() + 4000
    if (text && !text.startsWith('<')) {
      remember(`The person asked Claude: ${text}`)
      enqueue({ kind: 'prompt', sing: text, caption: `You: ${text.slice(0, 90)}` })
    } else kick()
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    if (e.tool === 'AskUserQuestion') {
      const q = (e as { questions?: { question?: string }[] }).questions?.[0]?.question ?? 'a question for you'
      asking = true
      remember(`Claude asked the person: ${q}`)
      enqueue(askJob(q))
      try {
        return await next(e)
      } finally {
        asking = false
        kick()
      }
    }
    const line = toolLyric(e.tool, e as unknown as Record<string, unknown>)
    remember(`Claude is ${line.show.charAt(0).toLowerCase()}${line.show.slice(1)}`)
    // a line per tool call, but not a machine gun of them
    if (line.sing.trim() && performance.now() - lastToolAt > 3500) {
      lastToolAt = performance.now()
      enqueue({ kind: 'tool', sing: line.sing, caption: line.show })
    }
    const result = await next(e)
    if ((result as { isError?: boolean }).isError) {
      remember(`That failed with an error!`)
      if (Math.random() < 0.5) {
        const panic = pick(['Oh no. Oh no no no. An error!', 'Red text! Everybody stay calm!', 'Error! I knew it. I knew it!', 'Ay, no! Un error!'])
        enqueue({ kind: 'rant', sing: panic, caption: panic, opts: { lang: panic.startsWith('Ay') ? 'es' : 'en', register: 12 } })
      }
    }
    return result
  })

  // what Claude writes in the chat: each response's first sentence, and any question in it
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (e.agentId === undefined && r.answer.trim()) {
      const lines = sentences(r.answer)
      if (lines[0]) remember(`Claude said: ${lines[0]}`)
      const isFinal = r.toolUses.length === 0
      const question = [...lines].reverse().find(l => l.endsWith('?'))
      const first = lines[0]
      if (first && first !== question) enqueue({ kind: isFinal ? 'answer' : 'say', sing: first, caption: first })
      if (question) enqueue(askJob(question))
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    working = false
    asking = false
    if (e.reason === 'aborted') stopAll()
    else {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i]!.kind === 'tool' || FILLER.has(queue[i]!.kind)) queue.splice(i, 1)
      if (current && (current.kind === 'tool' || FILLER.has(current.kind))) current.ctl.abort()
    }
    kick()
    return result
  })

  on('session.end', async ($, e, next) => {
    stopAll()
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const show = await read($, showAtom)
    const prefs = await read($, prefsAtom)
    if (e.surface === 'terminal') {
      // the same head in braille, sized to the pane's body, kept moving by the frame loop
      const { Raster } = $.ui.resolve(e)
      const cols = Math.max(24, Math.min(140, e.props.bodyColumns))
      const room = e.props.placement === 'inline' ? 30 : 70
      const rows = Math.max(12, Math.min(room, e.props.scroll.bodyRows, Math.round(cols * 0.64) + 4))
      markShown(show.id)
      term = { cols, rows }
      startTerm()
      return <Raster key="head" columns={cols} rows={rows} cells={termFrame(show, (performance.now() - shownAt) / 1000, cols, rows)} />
    }
    // just the head, as an image: it scales to the pane's width (the interactive frame keeps
    // a small fixed size) and its SMIL animation still plays; the controls live in /head
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        key="head"
        source={svgFor(show, prefs.duet)}
        alt={show.mode === 'sing' ? `The head sings: ${show.words.join(' ')}` : 'The head is resting'}
      />
    )
  })
}
