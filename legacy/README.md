# Legacy fragments (read-only reference)

These files are byte-for-byte copies of what was in the repository before the
v6 repair. Do not edit them; they exist so nothing from the original app is lost.

| File | Source commit | What it is |
|------|---------------|------------|
| `index.head-fragment.html` | `bd53041` ("Update index.html") | First ~100 KB of the original single-file app: all CSS, MENU data, core helpers, welcome / food / water / sleep pages. Cut off mid-line inside `pages.sleep`; no closing `</script>`. The MENU JSON has newlines injected every 3800 characters. |
| `index.tail-fragment.js` | `4316ee3` ("Create index.html") | Last ~8.6 KB of the original app: energy check-in, 7-day trends, health connections, JSON backup/restore, extra badges, `render();` and closing tags. |

The middle of the original file (router, nav, home, pulse, stairs, stress,
BMI, calculator, stats, guide, settings, onboarding, Wizard's Counsel, the
knight sprite image) was never committed. See `docs/ARCHITECTURE_AUDIT.md`.
