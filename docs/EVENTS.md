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

Every event is `{ type, at, ...payload }`, where `at` is an ISO timestamp.

* **Timing:** listeners run synchronously, right after the action that caused the event.
* **Errors:** a listener that throws is logged with `console.error` and never breaks the app or other listeners.
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
| `quest:completed` | `date, index, name, xp` | the original awards a daily quest (`st.qx`) |
| `quests:all-completed` | `date` | all daily quests done (`st.claimed[date]`) |
| `badge:unlocked` | `name, icon, date` | the original awards a badge (`st.b`) |
| `energy:rated` | `value, first, date` | daily energy check-in (`first` = first rating today) |
| `data:imported` | `mode: merge\|replace, added, total` | a backup is merged or restored |
| `data:reset` | — | all data erased (second tap) |
| `insights:updated` | `ids` (top 3) | insights recomputed after a data change (`js/v6-insights.js`) |
| `insight:new` | `insight` | an insight newly reaches the top 3 after a log, edit or delete (never at boot) |

Import, reset and the initial load update the award baselines **silently**, so badges and
quests that already existed are never announced as new.

## Adding an event

Wrap the original global function or `acts.*` handler in `js/v6-events.js` (see the existing
wrappers), emit through `HWEvents.cause(...)` so ordering holds, add a row here and a test in
`tests/03-events.test.mjs`.
