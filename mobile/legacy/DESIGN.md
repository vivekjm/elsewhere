# Trips Loom mobile design system

Trips Loom is a calm, editorial travel planner. Its mobile interface should feel like the existing web app: clear ink, generous paper surfaces, fine borders, quiet color, and a serif headline paired with a readable system sans. The supplied planner screenshot uses **Coast**, so Coast is the mobile starting palette. The web app's original Olive palette and its Terracotta and Lavender alternatives remain available in Settings.

The source of truth in code is [`src/design/tokens.ts`](src/design/tokens.ts). Screens consume semantic roles from `useTheme()` instead of copying hex values. `ThemeProvider` resolves the system appearance by default, supports explicit light and dark choices, and exposes `setPalette` and `setMode`. The app shell can hydrate saved preferences through the provider's `palette` and `mode` props and persist changes with `onPreferencesChange`.

## Visual rules

The full system (tokens, component guidelines, live previews) is the **Trips Loom** design system artifact: https://claude.ai/artifact/Cy8kxub66qcb8w3L7MNcE7. `src/design/tokens.ts` mirrors it.

| Element | Rule |
| --- | --- |
| Color | Warm Sand canvas (`background`) in light, Night in dark, with a `canvasGlow` bloom at the top. Opaque `surface` cards for reading. The palette chosen in Settings changes only `primary`, `accent` and `accentSoft`; Coast is the default. Photo cards use a `moods.*` scrim chosen from the trip's landscape. |
| Type | Outfit (400/500/600/700, loaded in `App.tsx`) for all UI. Italic Georgia is used only by `Wordmark`. Use the `typography` variants and never set `fontWeight` alone, because custom fonts need the weight's family name (`fonts.semibold`). |
| Spacing | Use the 4/8-point rhythm: 4, 8, 12, 16, 24, 32, 40, 48. The phone gutter is 16. The trip grid is two even columns with an 8-point gap. |
| Shape | Buttons, chips and icon buttons are pills. Photo cards use 32-point corners (`radii.xxl`), sheets and cards 24, fields 16. Shadows are `shadows.card`, `shadows.float` and `shadows.photo`. |
| Glass | `GlassSurface` is for floating chrome (back button, weather or trip chip, tab bar) and for facts on photos. It uses native Liquid Glass on iOS 26+, blur on older iOS, translucent colour on Android, and solid surface under Reduce Transparency. |
| Icons | Use the Trips Loom outline set (`Icon`, shared with the web app's `components/travel/icons.tsx`) at 18, 22 or 28. Never use emoji or text glyphs such as › as icons. |
| Cards | `TripCard`, measured from the reference: 26pt corners, 12pt inner padding, and cards about 1.18× taller than wide in a two-column grid with 8pt gaps and 14pt page margins. The image fills the top 84%, then frosts and melts into the mood colour. The top row has a 36pt grey glass pill (days) and a 36pt glass icon button. At the bottom: an 18/22 semibold title, a 13pt meta line with a 13pt icon, and 30pt light frosted chips (white 16%). |
| Motion | Nothing snaps. Pressables use `PressableScale` (spring down on touch, slight overshoot on release); selection pills in `TabBar` and `SegmentedControl` spring between options; tabs cross-fade with `FadeSwap`. Native Liquid Glass uses `isInteractive` so the system's own touch response plays. Every animation is skipped under Reduce Motion. |

## Component hierarchy

Use `Screen` for the route background, `ScreenHeader`/`SectionHeader` for titles, `TripCard` for trips, `Card` for grouped information, `AppText` for all app copy, `TextField` for labeled input, `Chip`/`SegmentedControl` for choices, and `AppButton` for actions. Each screen should present one dominant primary action. Strong secondary actions use `tonal`, neutral alternatives use `secondary` (outline), and low-priority actions use `ghost`. `IconButton` requires a descriptive `label`. `EmptyState` pairs a clear explanation with a next step where one exists.

Native controls should handle native tasks: `Switch` for binary settings, `TextInput` for entry, platform date/time pickers for dates when available, and the operating system share sheet for sharing. Avoid reimplementing a control solely to mimic desktop hover behavior. Buttons and fields use at least a 48-point touch area, which covers the 44-point iOS and 48-dp Android targets.

## Interaction and accessibility

- Keep status bars, notches, home indicators, and tab bars clear using the app shell's safe-area insets. Add scroll bottom padding when a fixed CTA or tab bar is present.
- All actionable elements need pressed feedback, disabled semantics, and a screen-reader label. Keep reading order in the same order as the visible layout. Never make color the sole indicator of status.
- Show a spinner and disable a submitting button while saving. Show errors next to the field or action with an explicit recovery path. Keep a visible label even when an input has placeholder text.
- Keep destructive actions separate from the primary action and confirm irreversible deletion. Keep standard platform back gestures and provide an obvious close/back control for sheets.
- Use 150–300 ms for brief transitions, usually opacity or transform. Respect reduced-motion settings; continuous animation is reserved for loading.
- Verify at a 375-point phone width, a large phone, tablet portrait/landscape, enlarged system text, VoiceOver/TalkBack, and both light and dark appearances.

The defined primary, muted text, accent button, and danger button color pairs each meet at least 4.5:1 contrast against their intended surfaces in all four light and dark palettes (checked from token values). Recheck any new foreground/background combination before release.

## Screen pattern

Keep screens quiet: one large left-aligned `ScreenTitle` (a short noun: Trips, Wardrobe, Essentials, Packing), one round `+` action, and at most one line of detail under it. No eyebrows, marketing subtitles or helper sentences on list screens. Empty states get a short title and one short sentence.

- **Navigation is native (Expo Router):** `app/(tabs)/_layout.tsx` uses `NativeTabs`, the system tab bar with SF Symbols and Liquid Glass, which minimises as you scroll on iOS 26. Each tab is a native stack with a large title that collapses on scroll (`useStackOptions`). Bar buttons are native `UIBarButtonItem`s set by `useNativeHeader`: the prominent `+` and the Profile button, which shows a badge when sync needs attention. Calendar adds a native trip-switcher menu on the left once there's more than one trip.
- **Headers:** a centred compact title (19pt semibold) with one muted 13pt line, as in the reference's "Paris, France / 46 results". Set it with `ScreenTitle title detail` or `useNativeHeader({ title, subtitle })`. A route's scroll view must be the first view in the screen, so don't wrap tab routes in extra views.
- **Section headers:** `GroupLabel`: a 20pt semibold title, a 14pt muted subtitle, and an optional round white icon action, as in the reference's "Near Paris".
- **Native controls:** segmented controls are SwiftUI pickers (`@expo/ui`), dates are native compact date pickers, and trip cards open a native action sheet on long-press. Haptics fire on `+`, checks and segment changes.
- **Profile:** a native page sheet (`app/profile.tsx`) opened from the Profile bar button, closed with Done or a swipe down. It holds your name, sync status only when there's a problem, Appearance, and Account rows.
- **Lists:** rows go inside one `Group` card per section, separated by hairlines, under a quiet `GroupLabel`. Don't put each row on its own card. Suggestions are `+` chips.
- **Calendar:** a trip photo hero, a swipeable day strip, the day title, then the Plans, Outfit and Details groups.
- **Spacing:** 20pt gutters, 28pt between sections, 20pt card padding. When unsure, add space rather than text.

```tsx
import { AppButton, AppText, Card, Screen, useTheme } from './src/design';

function DaySummary() {
  const { spacing } = useTheme();
  return (
    <Screen>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="eyebrow" tone="muted">YOUR TRIP CALENDAR</AppText>
        <AppText variant="title">Thursday 1 October</AppText>
        <AppText tone="muted">A day with room to wander</AppText>
        <AppButton label="Choose outfit" onPress={() => {}} />
      </Card>
    </Screen>
  );
}
```

`Screen` sets the page surface and horizontal phone gutter; the navigation shell owns safe-area handling. The `colors` token is available for any custom view that needs a semantic color.
