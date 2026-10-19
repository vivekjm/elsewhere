/**
 * The shared "card grows into its page" transition (a container transform).
 *
 * A card calls `open(ref, href, options)`. A copy of the card is drawn over everything at the card's exact position;
 * the page behind it fades to the page colour while the copy grows into the place the card takes on the new page
 * (an `ExpandTarget` there reports where that is), its contents cross-fading into that page's own card. A picture on the
 * card (the trip's cover thumbnail) is the shared element: it grows into the page's cover, so the eye follows one thing
 * from the card into the page. Once it has landed the
 * route is pushed underneath without an animation of its own, and the copy fades away over a page that already looks
 * the same. Going back is the normal slide.
 *
 * Built in-app rather than with the iOS zoom transition, which faded the new page in over a black container that
 * flashed on most taps.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, interpolateColor, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import { colors, radii } from '../loom/tokens';
import { setOpeningByCard } from '../loom/motion';

type Nav = { getState(): { type?: string } | undefined; getParent(): Nav | undefined; setOptions(o: object): void };
type Rect = { x: number; y: number; width: number; height: number };

/** Where the card lands on the new page. */
export type Landing = {
  /** The `ExpandTarget` id on the new page. */
  target: string;
  /** Colour and corner radius of the card on the new page. */
  colour: string;
  radius?: number;
  /** Height used until the target has been measured once (the first open). */
  height: number;
  /** The card as the new page draws it, faded in as the copy grows, so it lands complete (text and all). */
  page?: React.ReactNode;
  /** The rest of the page's first view: its header row, and its tab bar if it has one. Faded in with the backdrop. */
  header?: React.ReactNode;
  bar?: React.ReactNode;
  /** Height of the cover at the top of the landed card, where the card's picture grows to. */
  coverHeight?: number;
};
/** A picture inside the tapped card that becomes the page's cover. */
type Picture = {
  ref: React.RefObject<View | null>; node: React.ReactNode; radius: number;
  /** What the page lays over its cover (its bottom fade), shown as the picture becomes the cover. */
  overlay?: React.ReactNode;
};
type Options = { colour: string; radius: number; content: React.ReactNode; to: Landing; picture?: Picture };
type Open = (from: React.RefObject<View | null>, href: string, options: Options) => void;
type Ctx = { open: Open; report: (id: string, rect: Rect, restore: () => void) => void };

const ExpandContext = createContext<Ctx | null>(null);
/** True inside the transition's copy of a card, so the copy never takes over refs that belong to the real card. */
const CopyContext = createContext(false);
export const useIsExpandCopy = () => useContext(CopyContext);

const GROW_MS = 480;
const REVEAL_MS = 160;
/** When the backdrop has fully covered the old page (it is opaque from 60% of the eased grow, ~190 ms in). */
const PUSH_AFTER_MS = 200;
/** The standard ease-in-out: a gentle start, an even middle and a short settle, so the picture's travel reads naturally. */
const grow = { duration: GROW_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) };

/** Space above a page's first card: the safe area, the screen's top padding, the 48pt header and the 16pt gap. */
const ABOVE_FIRST_CARD = 10 + 48 + 16;

export function ExpandProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const [shot, setShot] = useState<(Options & { from: Rect; at: Rect; pic?: Rect }) | null>(null);
  const targets = useRef(new Map<string, Rect>());
  const restore = useRef<(() => void) | null>(null);
  const busy = useRef(false);
  const t = useSharedValue(0);
  const reveal = useSharedValue(0);
  // The landing height: the page's measured card, or until then the copy's own drawing of it.
  const landH = useSharedValue(0);
  const measured = useRef(false);

  const report = useCallback((id: string, rect: Rect) => { targets.current.set(id, rect); }, []);

  const finish = useCallback(() => {
    setShot(null);
    busy.current = false;
    setOpeningByCard(false);
    // Hand the page its normal slide for going back.
    restore.current?.();
    restore.current = null;
  }, []);

  // The page is pushed as soon as the backdrop hides the old one, so it renders while the card is still growing.
  // It is revealed once both have happened: the card has landed and the page has laid out its target.
  const pending = useRef({ landed: false, drawn: false });
  const revealIfReady = useCallback(() => {
    const p = pending.current;
    if (!p.landed || !p.drawn) return;
    p.landed = false; p.drawn = false;
    // Two frames, so the fade starts after the page's native views are in place rather than during their mount.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      reveal.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.quad) }, (ok) => { if (ok) runOnJS(finish)(); });
    }));
  }, [reveal, finish]);
  const landed = useCallback(() => { pending.current.landed = true; revealIfReady(); }, [revealIfReady]);
  const drawn = useCallback(() => { if (!busy.current) return; pending.current.drawn = true; revealIfReady(); }, [revealIfReady]);
  const push = useCallback((href: string) => {
    router.push({ pathname: href, params: { via: 'expand' } } as never);
    // A page without a target (or one that fails to report) still opens.
    setTimeout(drawn, 600);
  }, [router, drawn]);

  const open = useCallback<Open>((ref, href, options) => {
    if (busy.current) return;
    if (reduce || !ref.current) { router.push(href as never); return; }
    busy.current = true;
    // The page this opens shows at rest: the card brings it in, so its content doesn't also rise in.
    setOpeningByCard(true);
    const card = ref.current;
    // The picture's place inside the card, if the card has one that lands as the page's cover.
    const measurePicture = (done: (pic?: Rect) => void) => {
      const node = options.picture?.ref.current;
      if (!node || !options.to.coverHeight) { done(); return; }
      node.measureInWindow((x, y, w, h) => done(w && h ? { x, y, width: w, height: h } : undefined));
    };
    measurePicture((pic) => card.measureInWindow((x, y, w, h) => {
      if (!w || !h) { busy.current = false; setOpeningByCard(false); router.push(href as never); return; }
      const top = insets.top + ABOVE_FIRST_CARD;
      const to = targets.current.get(options.to.target)
        ?? { x: 16, y: top, width: width - 32, height: Math.min(options.to.height, screenHeight - top) };
      t.value = 0;
      reveal.value = 0;
      measured.current = targets.current.has(options.to.target);
      landH.value = to.height;
      setShot({ ...options, from: { x, y, width: w, height: h }, at: to, pic: pic && { x: pic.x - x, y: pic.y - y, width: pic.width, height: pic.height } });
      pending.current = { landed: false, drawn: false };
      next.current = href;
    }));
  }, [reduce, router, insets.top, width, screenHeight, t, reveal]);

  // The grow starts once the copy is on screen, so its first frames are never lost to the render that mounts it.
  const next = useRef<string | null>(null);
  const begin = useCallback(() => {
    const href = next.current;
    if (!href) return;
    next.current = null;
    // Two frames after layout, so the copy (pictures and all) has been drawn before its clock starts; starting at
    // layout lost the first half of the grow to the frames spent mounting it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      t.value = withTiming(1, grow);
      setTimeout(() => push(href), PUSH_AFTER_MS);
      // The last stretch of the eased grow moves only a few points, so the page can start showing through then.
      setTimeout(landed, GROW_MS - 90);
    }));
  }, [t, landed, push]);

  const ctx = React.useMemo<Ctx>(() => ({ open, report: (id, rect, back) => { report(id, rect); if (busy.current) restore.current = back; drawn(); } }), [open, report, drawn]);

  const from = shot?.from;
  const to = shot?.at;
  const fromColour = shot?.colour ?? colors.card;
  const toColour = shot?.to.colour ?? colors.card;
  const fromRadius = shot?.radius ?? 0;
  const toRadius = shot?.to.radius ?? radii.hero;
  const pic = shot?.pic;
  const picRadius = shot?.picture?.radius ?? 0;
  const coverH = shot?.to.coverHeight ?? 0;
  const hasPicture = !!pic && coverH > 0;

  const layer = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 0.6], [0, 1], 'clamp') }));
  const chrome = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0.2, 0.6], [0, 1], 'clamp') }));
  const card = useAnimatedStyle(() => {
    if (!from || !to) return {};
    const g = t.value;
    return {
      left: interpolate(g, [0, 1], [from.x, to.x]),
      top: interpolate(g, [0, 1], [from.y, to.y]),
      width: interpolate(g, [0, 1], [from.width, to.width]),
      height: interpolate(g, [0, 1], [from.height, landH.value]),
      borderRadius: interpolate(g, [0, 1], [fromRadius, toRadius]),
      // With a shared picture leading the eye, a coloured card turns to the page's colour early instead of melting late.
      backgroundColor: hasPicture
        ? interpolateColor(g, [0, 0.1, 0.45], [fromColour, fromColour, toColour])
        : interpolateColor(g, [0, 0.3, 0.8], [fromColour, fromColour, toColour]),
    };
  });
  // The tapped card's contents fade out quickly while the page's card fades in, laid out at its final size.
  const content = useAnimatedStyle(() => ({ opacity: interpolate(t.value, hasPicture ? [0, 0.18] : [0, 0.25], [1, 0], 'clamp') }));
  const page = useAnimatedStyle(() => ({ opacity: interpolate(t.value, hasPicture ? [0.25, 0.6] : [0.15, 0.55], [0, 1], 'clamp') }));
  const pictureOverlay = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0.4, 1], [0, 1], 'clamp') }));
  // The picture travels from its spot on the card to the cover's: the card's full width at the top.
  const picture = useAnimatedStyle(() => {
    if (!pic || !to) return {};
    const g = t.value;
    return {
      left: interpolate(g, [0, 1], [pic.x, 0]),
      top: interpolate(g, [0, 1], [pic.y, 0]),
      width: interpolate(g, [0, 1], [pic.width, to.width]),
      height: interpolate(g, [0, 1], [pic.height, coverH]),
      borderRadius: interpolate(g, [0, 1], [picRadius, 0]),
    };
  });

  return <ExpandContext.Provider value={ctx}>
    {children}
    {shot && from ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, layer]} onLayout={begin}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, opacity: 0 }, backdrop]} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0 }, chrome]}>
        {/* Placed exactly as the page's Screen places its first row. */}
        {shot.to.header ? <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 10 }}>{shot.to.header}</View> : null}
        {shot.to.bar}
      </Animated.View>
      <Animated.View style={[{
        position: 'absolute', overflow: 'hidden', borderCurve: 'continuous',
        // Its starting place, for the frame before the animated style applies.
        left: from.x, top: from.y, width: from.width, height: from.height, borderRadius: shot.radius, backgroundColor: shot.colour,
      }, card]}>
        {/* With a travelling picture, the page's card shows from below its cover down: the cover is the picture. */}
        {shot.to.page && to ? <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: hasPicture ? coverH : 0, bottom: 0, overflow: 'hidden', opacity: 0 }, page]}>
          <View style={{ width: to.width, marginTop: hasPicture ? -coverH : 0 }}
            onLayout={(e) => { if (!measured.current) landH.value = Math.min(e.nativeEvent.layout.height, screenHeight - to.y); }}>{shot.to.page}</View>
        </Animated.View> : null}
        <Animated.View style={[{ width: from.width, height: from.height }, content]}><CopyContext.Provider value>{shot.content}</CopyContext.Provider></Animated.View>
        {hasPicture && pic ? <Animated.View style={[{
          position: 'absolute', overflow: 'hidden', borderCurve: 'continuous',
          left: pic.x, top: pic.y, width: pic.width, height: pic.height, borderRadius: picRadius,
        }, picture]}>
          {shot.picture?.node}
          {shot.picture?.overlay ? <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0 }, pictureOverlay]}>{shot.picture.overlay}</Animated.View> : null}
        </Animated.View> : null}
      </Animated.View>
    </Animated.View> : null}
  </ExpandContext.Provider>;
}

/** Opens a route by growing a card into its place on the new page. Falls back to a plain push outside the provider. */
export function useExpand(): Open {
  const ctx = useContext(ExpandContext);
  const router = useRouter();
  return ctx?.open ?? ((_, href) => router.push(href as never));
}

/** Marks where an expanding card lands on a page, so later opens grow to the exact spot. */
export function ExpandTarget({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = useContext(ExpandContext);
  const navigation = useNavigation();
  const view = useRef<View>(null);
  const { height } = useWindowDimensions();
  // The page opened without its own animation; give its screen in the root stack (above any tabs inside the page)
  // the normal slide back.
  const restore = () => {
    let nav: Nav | undefined = navigation as unknown as Nav;
    while (nav && nav.getState()?.type !== 'stack') nav = nav.getParent();
    nav?.setOptions({ animation: 'default' });
  };
  const measure = () => view.current?.measureInWindow((x, y, w, h) => {
    // Only a resting page counts (not one mid-slide or scrolled), and only the part that fits on screen.
    if (w && h && x >= 0 && x < 40 && y > 0 && y < 200) ctx?.report(id, { x, y, width: w, height: Math.min(h, height - y) }, restore);
  });
  // Measured on layout (the card transition waits for that), and again once a slide-in or the page's own rise
  // has settled, so the spot remembered for next time is where the card rests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(measure, 900); return () => clearTimeout(t); }, []);
  return <View ref={view} collapsable={false} onLayout={measure}>{children}</View>;
}
