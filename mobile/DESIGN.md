# Trips Loom mobile design system (Loom)

The app is React Native on Expo SDK 57 with Expo Router. The design source is the Design canvas artifact (https://claude.ai/artifact/ScEx3wGEgyAs8nVqWseRRN); `src/loom/` is its code twin. The previous Outfit/Coast UI lives in `legacy/` for reference only and is excluded from the typecheck.

## Where things live

| Path | What |
| --- | --- |
| `src/loom/tokens.ts` | Colours, chip tints, radii, shadows, fonts (Figtree), the ember gradient. |
| `src/loom/graphics.tsx` | `Icon`, `Illustration`, `EmberBackdrop`, `Ring`. |
| `src/loom/ui.tsx` | Every component screens use: `Screen`, `Header`, `Section`, `Hero`, `Card`, `Group` + `Row`, `MediaRow`, `PhotoCard`, `Button`, `Pill`, `Chips`, `Field`, `Segmented`, `Toggle`, `CheckToggle`, `Radio`, `DayChips`, `Bars`, `Sheet`… |
| `src/loom/TabBar.tsx` | The custom white tab bar and the three tab sets (app, trip, adventure). |
| `src/loom/illustrations.ts` | Generated. Do not edit; run `python3 scripts/illustrations/export.py` after changing `scripts/illustrations/ill.py`. |
| `src/screens/*.tsx` | Screens grouped by area: entry, home, trip, create, adventure. |
| `app/` | Expo Router routes, one line each, re-exporting a screen. |

## Rules

- **Shape:** hero 20, cards and rows 16, tiles 12, buttons 12, icon tiles 10, checkboxes 7, label chips 6. Only avatars, radios, toggles, rings and progress bars are round. Never a pill button.
- **One hero per screen.** The ember gradient carries the screen's headline number or trip. Its content sits straight on the gradient, split by `HeroRule` hairlines; never put a white card inside it.
- **Cards float, they don't stack.** A card sits on the `#EEEDEB` canvas with the rest shadow. Lists are one `Group` card with hairline-separated `Row`s, not a card per row.
- **Dark means go.** The ink (`#2A2A2A`) button is the primary action and the selected state. Ember is for small live signals: progress, a step, today's marker.
- **Illustrations, not photos.** Flat, smooth-edged scenes in the chip tints with one ember accent. One scene per place, reused at every size. Use `align="top"` when a wide crop would lose the top of a scene.
- **Type:** Figtree only, through `T` variants (`hero`, `display`, `title`, `section`, `row`, `body`, `small`, `meta`, `label`, `eyebrow`). Don't set `fontWeight`; use the font family.
- **Spacing:** 16 gutter, 16 between cards, 22 between sections on Home, 14 inside a row.

## Checking a screen quickly

In development, set `DEV_START_ROUTE` in `src/devStart.ts` (for example `'/trip/packing'`) and reload; the app opens there instead of Welcome. Leave it empty before committing.

## Not wired yet

Screens render sample data. The data layer from the previous app (`src/data/`: Supabase auth, SQLite cache, sync) is kept and still typechecks, but no screen reads from it yet.
