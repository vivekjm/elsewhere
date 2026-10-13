# Trips Loom mobile design system

Open `index.html` in a browser, or run `python3 -m http.server 4174 --directory mobile/design-system` from the repository root and visit `http://127.0.0.1:4174`.

This is the visual and interaction reference for the Expo app. The Sikkim trip and sample activities are **preview content only**. They are not seeded into the app or database. The reference image from the user informed the photo-first trip cards, compact type, and floating navigation. Trips Loom does not show accommodation prices or ratings because those are outside its planning model.

## Themes

The gallery includes Coast, Olive, Terracotta, and Lavender palettes, each in light and dark mode. The palette and mode switch every example together and persist in this browser's local storage. CSS roles are `--bg`, `--surface`, `--surface-alt`, `--field`, `--text`, `--muted`, `--border`, `--primary`, `--on-primary`, `--accent`, `--soft`, `--sage`, `--success`, `--warning`, and `--scrim`. These map to the semantic colors in `../src/design/tokens.ts`.

## Components

- App shell: wordmark, settings action, floating five-destination tab bar, phone status and safe-space framing.
- Journey surfaces: full-bleed trip cover, new-trip tile, scenic planner hero, day rail, empty day, and quick actions.
- Actions: primary, outlined, tonal, quiet, icon, and over-image controls.
- Selection: segmented choice, category chips, selected day, and packing checklist.
- Content: activity, packing, progress, wardrobe, and essentials rows.
- Forms: text, number, date, email, password, notes, editor, and dialog.
- Feedback: saved, offline, loading skeleton, and toast.
- Foundations: color roles, editorial heading, body, and eyebrow type.

## Native Liquid Glass

The HTML's blur and translucency **approximate** Liquid Glass; a web page cannot render Apple's native material. The native Expo app uses [`expo-glass-effect`](https://docs.expo.dev/versions/latest/sdk/glass-effect/) for iOS 26+ where available, with solid themed fallbacks elsewhere. Glass is reserved for floating navigation and controls over imagery. Cards, fields, and reading surfaces stay opaque, following [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials). Reduced-transparency preferences disable the HTML blur, and the native API is expected to honor iOS accessibility settings.

Buttons and controls have explicit selected, pressed, focus, and disabled states. The HTML gallery demonstrates interaction only; its forms do not write trip data. The native app handles persistence and authentication.
