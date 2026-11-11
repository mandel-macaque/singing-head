# Singing head

A wireframe head in a pane beside Claude that **sings what Claude is doing** while you wait.

- It sings your prompt when a turn starts.
- It sings what Claude writes in the chat (the first sentence of each message) and a line for each tool call ("reading app", "running git status", "searching the web for…").
- When Claude asks you something, the head sings the question with a cheeky opening that uses your name ("Calling Sam, come in Sam!"). It finds your name from your account, `git config user.name` or your system name, or you can set it with `/head name`.
- In the waits between, it turns into an annoying, slightly unhinged companion. A small model (Haiku) watches what Claude is doing and dreams up what the head blurts out: conspiracy theories about your code, needy questions, puns, Spanish outbursts, evil laughs and dad jokes (with a ba-dum-tss). Built-in lines cover for it when the model isn't there, sometimes glitched, squeaky or in a demon voice. There's silence in between, and only now and then a song.
- When a tool fails, it panics.
- It dances: songs groove (with the odd spin), answers spin, questions tilt, rants headbang, flip over, cartwheel or stay upside down, and laughs twitch. Each line it turns a different way: three-quarter, straight at you, or showing the other side of its face.
- When Claude is done, it dozes off (zZz).

Songs: "La cucaracha", "Martinillo" (Frère Jacques in Spanish), "Cumbia del código" (this mod's own), "Made of air" (CHIMERA's own tune), "Daisy Bell", "Row, row, row your boat" and "Twinkle, twinkle".

The head is drawn the way [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) draws its 3D head: glowing blue wireframe, red jaw, green tongue, white teeth, pink lips. The jaw, lips and tongue move with every syllable, and the lyrics light up karaoke-style.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install singing-head --marketplace mandel-macaque/singing-head
```

Answer `y` to add the marketplace, then pick a scope (Enter takes the user scope, so the head joins every session).

From a shell:

```
claude plugin install singing-head --marketplace mandel-macaque/singing-head
```

In the Claude desktop app, where `/plugin` doesn't run: click + next to the prompt box, then Plugins, Add marketplace with `mandel-macaque/singing-head`, then Add plugin.

Then type `/head` to open the pane.

### From a clone of the repository

```
git clone https://github.com/mandel-macaque/singing-head ~/singing-head
```

Then either install it from that folder, at a Claude Code prompt:

```
/plugin install singing-head --marketplace ~/singing-head
```

or run it for one session only, without installing:

```
claude --plugin-dir ~/singing-head
```

A `git pull` in that folder brings in later versions.

## Where it draws

- **Claude desktop app:** the animated SVG head fills the side pane.
- **Terminal:** the same 3D head is drawn in color with braille characters (each character is a 2×4 grid of dots), redrawn ten times a second, with the lyrics underneath. It works in any terminal with a font that has braille; the pane docks beside the transcript in fullscreen mode from 110 columns, and sits above the prompt otherwise.

Sound plays through `afplay` on macOS; elsewhere the head mouths along silently.

## Chat

Talk to it: `/head how are you?`, `/head ¿qué opinas de mi código?`. The head answers in character, out loud and in the chat, and remembers the last few exchanges. It knows what Claude has been doing, but it can't touch your code.

## Controls

The pane shows only the head. Everything else is a command:

```
/head              open the pane and say hello
/head <anything>   chat with the head: it answers out loud (Haiku), and in the chat
/head mute         mouth along silently
/head unmute
/head voice [alto|bass|child]
/head duet         toggle a second head singing harmony
/head name <you>   what the head calls you (empty: find it)
/head antics       toggle the waiting antics (rants, jokes, laughs, songs)
/head brain        toggle the Haiku brain (each outburst costs a few tokens)
/head sing <words> sing anything
```

Settings are remembered across sessions.

## How it sings

The mod's sandbox has no WebAssembly, so it can't run CHIMERA's Rust engine. Instead it has a small source-filter singer in TypeScript: a Rosenberg glottal pulse with vibrato through five formant resonators. It uses CHIMERA's vowel formant tables (Hillenbrand et al. 1995) for male, female and child voices, and the CMU Pronouncing Dictionary that CHIMERA ships for pronunciation. Consonants are short gestures between the vowels, as in CHIMERA. Each line gets its own pentatonic tune, seeded from its words, and questions end on a rising note.

It sounds robotic, and that's the point.


## Credits

- Head proportions, palette and the "Made of air" melody: [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) by Jameson Hodge (MIT).
- Pronunciations: the CMU Pronouncing Dictionary (see `data/CMUDICT-LICENSE.txt`).
- "Daisy Bell" (Harry Dacre, 1892), "Twinkle, twinkle", "Row, row, row your boat", "La cucaracha" and "Martinillo" are traditional or in the public domain; their melodies were written down from memory.
- Spanish is sung with a small set of Spanish spelling rules, not the English dictionary.
