/** Which voice the head sings with: CHIMERA's male, female and child bodies. */
export type Voice = 'bass' | 'alto' | 'child'

/** What a phrase is about: it picks the tune's mood and the label over the head. */
export type Kind = 'prompt' | 'say' | 'tool' | 'question' | 'answer' | 'song' | 'hello' | 'joke' | 'rant' | 'laugh' | 'reply'

/** What the pane draws: one sung phrase (its words, timing and mouth shapes), or the head at rest. */
export type Show = {
  id: number
  mode: 'idle' | 'sing'
  kind: Kind | 'idle'
  caption: string
  words: string[]
  /** when each word starts, in seconds */
  wordAt: number[]
  /** [time, pose] keyframes of the mouth */
  keys: [number, number][]
  /** vowel onsets: the sound rings and floating notes */
  onsets: number[]
  dur: number
  beat: number
  yaw: number
}

/** The person's settings, kept across sessions. */
export type Prefs = {
  muted: boolean
  voice: Voice
  duet: boolean
  /** fill long waits with rants, dad jokes, laughs and the odd song */
  songs: boolean
  /** what the head calls you; empty: found from your git or system name */
  name: string
  /** let a small model (Haiku) think up what the head blurts out while it waits */
  brain: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'singing-head': {
      show: Shaped<Show>
      prefs: Shaped<Prefs>
    }
  }
}
