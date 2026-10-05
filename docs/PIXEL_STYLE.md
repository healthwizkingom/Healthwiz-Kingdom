# HealthWiz pixel-art standard

The visual direction for every screen from now on, and the shared code behind it (`js/v6-pixel.js`, `HWPixel`).
Introduced in the visual-foundation session (`docs/ARCHITECTURE_AUDIT.md` §30). Later sessions redesign screens with
these pieces instead of inventing new ones.

## Direction

**A modern pixel-art RPG.** Think of a polished indie RPG: a steady pixel grid, crisp edges, hard shadows, a warm
parchment world by day and deep night-blue HUDs, and the existing HealthWiz cast (the knight, Medius, the orc).

Not wanted: old Mario-style or crude 8-bit graphics, sprites that just slide around, smooth Apple/Android emoji, or a
generic dashboard look (rounded cards, soft drop shadows, gradients, thin system icons).

## Rules

1. **The grid.** One grid unit is `--px-unit` (4 px; plain `--px` is taken by the title screen's parallax). Panel borders, shadows, gaps and paddings are multiples of it
   (controls use 3 px, the original button size). No `border-radius` on UI: corners are square, or stepped (`.pxn`).
2. **Hard shadows only.** Offset, no blur: `--px-sh` for panels, `--px-sh-c` for controls, plus the inner bevel
   (`--px-bevel`, `--px-bevel-c`). A glow is allowed for magic (Medius, rewards), never as a panel shadow.
3. **Colours come from tokens.** The original theme tokens (`--bg --pn --p2 --ink --mut --ln --gold --red --blue
   --grn --vio`) switch with light/dark and the saved THEME choice. New UI uses them, or `.pxdk` for a dark HUD, so it
   follows the theme for free. Icons use the one icon palette (`HWPixel.PAL`).
4. **Type.** Headings, buttons, tags and HUD numbers use the pixel font `var(--fh)` (Press Start 2P). It is drawn on
   an 8 px grid, so new pixel text uses `--px-f1` 8 px, `--px-f2` 16 px or `--px-f3` 24 px. Running text and long
   numbers stay in `var(--fb)` for legibility. Never set pixel-font text in italics.
5. **Pixel art scales by whole numbers.** Grid art (icons, `spr()` sprites) is drawn at 1×, 2×, 3×… with
   `image-rendering: pixelated` (or `shape-rendering: crispEdges` for SVG). **High-resolution character art is
   different:** the knight, avatars, Medius and the orc (`assets/img/*.webp`, 180–292 px wide, already detailed) are
   *down*-scaled, so they keep smooth scaling (`.av { image-rendering: auto }` in the original is correct). Showing
   them with `pixelated` at a fraction of their size makes them shimmer. For new art at small sizes, draw a small
   sprite and scale it up instead.
6. **Motion is stepped.** Use `steps()` timing for UI movement (the original `pgin .3s steps(4)`), honour reduced motion
   (`HWUI.reduced()`, `html.hw-rm`) and the performance modes (`js/v6-motion.js`).
7. **Icons are pixel icons.** Every emoji the app shows is drawn as pixel art by `js/v6-emoji.js` (below). New UI may
   still write emoji in its strings, or use `HWPixel.icon()` for a hand-drawn icon.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--px-unit` | 4px | grid unit |
| `--px-bw` / `--px-bw-c` / `--px-bw-s` | 4 / 3 / 2 px | border: panels / controls / tags |
| `--px-sh` / `--px-sh-c` | `4px 4px 0 var(--ln)` / `3px 3px 0 …` | hard drop shadow |
| `--px-bevel` / `--px-bevel-c` | `inset -4px -4px 0 rgba(0,0,0,.18)` / `inset -3px -3px 0 rgba(0,0,0,.25)` | inner shade |
| `--px-pad` / `--px-gap` | 12px | panel padding / grid gap |
| `--px-f1` / `--px-f2` / `--px-f3` | 8 / 16 / 24 px | pixel-font sizes that stay crisp |
| `--px-hud`, `--px-hud2`, `--px-hud-ink`, `--px-hud-mut`, `--px-hud-ln` | night blue, ink | dark HUD colours |

These equal the original card and button values, so new panels match the existing screens.

## Components

All opt-in by class; nothing existing is restyled by them. Existing pieces stay the standard where they exist: `.card`
(panel), `button` / `button.g` / `button.chip`, `.t` (stat tile), `bar(pct, colour)` (segmented meter), `.grid`.

| Class | What |
|---|---|
| `.pxp` | Panel. The same frame as `.card` (4 px ink border, bevel, hard shadow). |
| `.pxp.pxn` | Stepped corners: one grid pixel cut from each corner, with a stepped shadow. For HUD and dialog frames. |
| `.pxdk` | Dark HUD colours. Re-points the theme tokens inside it, so `.pxp`, buttons, `bar()` and muted text all follow. |
| `.pxh` | Panel heading: icon + 8 px pixel-font label. |
| `.pxhud` + `.pxst` | HUD strip of stats (icon, big number, unit), e.g. over a game scene. |
| `.pxtag` | Small label (EST, NEW, LV 3…). |
| `.pxi` | A pixel icon (set by `HWPixel.icon`). |

```js
'<div class="pxp pxn pxdk"><h3 class="pxh">'+HWPixel.icon('monster')+'Dream Battle</h3>'+bar(60,'var(--gold)')+'</div>'
'<div class="pxhud"><span class="pxst">'+HWPixel.icon('heart')+'<b>72</b>BPM</span></div>'
```

## Icons

`HWPixel.icon(name, s | {s, label, cls})` returns inline SVG: 16×16 grid, `shape-rendering="crispEdges"`, one `<path>`
per colour. `s` is a whole-number scale (1 = 16 px, 2 = 32 px); fractions are rounded so the grid holds. Without
`label` the icon is hidden from screen readers (the text next to it says it); with `label` it is `role="img"`.

| Required set | Also drawn (page banners, headings) |
|---|---|
| heart, water, food, sleep, stairs, running, stress, energy, achievement, warning, success, wizard, monster | balance, chart, scroll, gear, quest, map, bell; final polish: workout, pulse (heart rate), badge, home, flame, star, mind, game; wake-up alarm: alarm, snooze |

* `HWPixel.names`: every icon. `HWPixel.grid(name)`: its 16 rows with the outline added, which the original sprite
  helper can draw on a canvas: `spr(HWPixel.grid('heart'), HWPixel.PAL, 3)`.
* `HWPixel.forEmoji('💧')` → `'water'`: the emoji used today, mapped to icons. Only unambiguous ones are mapped: 🔥 means
  streak, vigorous pace *and* the Energy Forge, and 📊 both the Health Hall and Statistics, so pick those by meaning.
* `HWPixel.glyph(emojiOrName, s)`: the pixel icon when there is one, otherwise the emoji unchanged; a list draws each in
  turn. Use it to move a screen over without breaking the places that have no icon yet.
* `HWPixel.region(view)`: the icon (or list of icons) for a page's banner. `ban()` draws it at 2× (since session 1); the
  Nutrition & Hydration page shows both of its systems, `['food', 'water']`.
* Card headings with an icon: `'<h3>'+HWPixel.icon('water')+' ADD WATER</h3>'`, laid out as a row by the page's CSS
  (first used on Nutrition & Hydration, `js/v6-provisions.js`).

### Adding an icon

1. Add a 16×16 grid to `ICONS` in `js/v6-pixel.js`. Use palette letters; `.` is empty. Draw the fill only: the builder
   adds the 1-pixel outline (`k`) around the art, so leave an empty pixel at every edge.
2. Light from the top left: a highlight (`w`, `l`, `c`, `p`, `h`, `m`) on the upper-left, a shade (`R`, `B`, `Y`, `G`,
   `V`, `N`, `S`) on the lower-right. Two or three tones per material, no dithering, no anti-aliasing.
3. Check it at 1×, 2× and 4× on light and dark backgrounds, then map its emoji in `EMOJI` if the meaning is unambiguous.
4. `tests/28-foundation.test.mjs` checks every icon: 16×16, palette colours only, a free edge for the outline, crisp SVG.

### Palette

`k` outline `#1b1626` · `w` `#fffbea` · red `r R p` · blue `b B c` · gold `y Y l` · green `g G h` · violet `v V m` ·
brown `n N t` · steel `s S e` · orange `o O` · skin `q`. Gold, red, blue, green and violet are the theme accents.

## Emoji become pixel art everywhere (`js/v6-emoji.js`)

The app's ~750 emoji (200+ different) are all drawn as 16×16 pixel pictures, with no change to the strings that hold
them. `HWEmoji` watches the page (every render, toast, dialog, Medius line and mini-game) and swaps each emoji for:
* the **hand-drawn icon** when it shows the same object (`SAME` in `js/v6-emoji.js`: 💧 ❤️ 🍗 🌙 🏃 🌩 ⚡ 🏆 ⚠️ ✅ 🧙 ⚖️
  📊 📜 ⚙️ ⚔️ 🗺️ 🔔, and since the final polish 🏋️ 💪 💓 🫀 🏅 🎖️ 🏠 🔥 ⭐ 🌟 ✨ 🧠 🎮 🧗 🪜 🥤 😴 🛏️ 🍽️), or
* the **emoji itself, pixelated** once on a canvas: sampled to a 14×14 grid, snapped to the icon palette (plus pink,
  magenta and teal), with the same ink outline.

The emoji character stays in the page, invisible inside the picture: screen readers, `textContent`, the tutorial's text
search and the add-ons' anchors see exactly what they did before. Pictures are sized from the surrounding text in 8 px
steps (at least 16 px). Left as they are: form fields and `<option>` text (cannot hold pictures), SVG, and typographic
symbols drawn as text (✓ ✕ ▶ ◀ ★ ✿). `HWEmoji.src(emoji)` returns a picture as a data: URL. To give an emoji a
better picture, draw an icon (below) and add it to `SAME`.

The pixelated pictures follow the device's emoji font (Apple, Google or Microsoft), so they differ a little between
devices; hand-drawn icons are identical everywhere. The emoji audit (`docs/ARCHITECTURE_AUDIT.md` §30) lists which
emoji are used most, so the next hand-drawn icons can go where they are seen most.

**Careful:** some add-ons find their place in a page by searching for a heading that contains an emoji:
`'<h2>💡 HEALTHWIZ GUIDE</h2>'` (`v6-insights`), `'<h2>⚙️ SETTINGS</h2>'` (`v6-medius`, `v6-motion`) and
`'<h3>🔥 STREAK</h3>'` (`v6-streaks`). Change one of those headings and the add-on's card quietly moves to the top or
bottom of the page (each falls back to that). Change the search string in the same commit.
