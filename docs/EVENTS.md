# HealthWiz events (`js/v6-events.js`)

A small in-browser event bus. It **observes** the original app and changes none of its behaviour.
Later systems (insight engine, Medius reactions, adaptive quests, kingdom changes) subscribe to it
instead of being wired into the original code.

```js
const stop = HWEvents.on('entry:added', e => { /* e.entry */ });
HWEvents.on('*', e => console.log(e.type, e));   // every event
HWEvents.once('level:up', e => …);
stop();                                           // unsubscribe
HWEvents.recent('xp:gained', 10);                 // last 10 (in-memory log, max 200)
```

Every event is `{ type, at, ...payload }`, where `at` is an ISO timestamp. `type` and `at` always
take precedence over payload fields with the same name.

* **Timing:** listeners run synchronously, right after the action that caused the event.
* **Errors:** a listener that throws is logged with `console.error` and never breaks the app or other listeners.
* **Loops:** a listener that keeps re-emitting is cut off after 5000 deliveries in one flush (logged with `console.error`).
* **Order:** delivery is breadth-first, cause → effect. Logging water gives `entry:added` → `xp:gained`,
  then reactions to those (`insights:updated`, …), then `quest:completed` / `badge:unlocked` after the next render.

## Catalog

| Event | Payload | Emitted when |
|---|---|---|
| `app:ready` | `view, entries, xp, schema` | once, after the first render |
| `data:migrated` | `from, to` | saved data was upgraded on load (before `app:ready`) |
| `page:viewed` | `view, from, requested` | `go()` navigation. `view` is where the user ended up (e.g. onboarding), `requested` is what was asked for |
| `entry:added` | `entry` (copy) | any log: water, food, sleep, pulse, stairs, stress, BMI |
| `entry:edited` | `entry, before` | an entry is saved from the edit dialog with a real change |
| `entry:deleted` | `entry` | an entry is deleted |
| `entry:restored` | `entry` | UNDO after a delete |
| `xp:gained` | `amount, reason, total` | every XP award (logging, quests, badges, games…) |
| `level:up` | `level, name, total` | an XP award crosses a level threshold |
| `quest:completed` | `kind, name, xp, date` + `index` (daily) or `id` (focus/weekly) | `kind:'daily'`: the original awards one of the 5 daily quests (`st.qx`). `kind:'focus'`/`'weekly'`: an adaptive quest is completed (`js/v6-quests.js`) |
| `quests:all-completed` | `date` | all daily quests done (`st.claimed[date]`) |
| `badge:unlocked` | `name, icon, date` | the original awards a badge (`st.b`) |
| `energy:rated` | `value, first, date` | daily energy check-in (`first` = first rating today) |
| `data:imported` | `mode: merge\|replace, added, total` | a backup is merged or restored |
| `data:reset` | — | all data erased (second tap) |
| `kingdom:state` | `key, name, from, to, up` | a log, edit or delete changes a region's state (`js/v6-kingdom.js`) |
| `medius:said` | `kind, text` | Medius shows a speech bubble (`js/v6-medius.js`) |
| `insights:updated` | `ids` (top 3) | insights recomputed after a data change (`js/v6-insights.js`) |
| `title:interact` | `k` (castle, tower, village, falls) | a scene object on the title screen is tapped (`js/v6-title.js`) |
| `insight:new` | `insight` | an insight newly reaches the top 3 after a log, edit or delete (never at boot) |
| `motion:changed` | `level, reduced, enabled, choice` | the effective animation level changes: a settings choice, the device's reduced-motion setting, or Auto downgrading after its frame probe (`js/v6-motion.js`) |

Import, reset and the initial load update the award baselines **silently**, so badges and
quests that already existed are never announced as new.

## Adding an event

Wrap the original global function or `acts.*` handler in `js/v6-events.js` (see the existing
wrappers), emit through `HWEvents.cause(...)` so ordering holds, add a row here and a test in
`tests/03-events.test.mjs`.
