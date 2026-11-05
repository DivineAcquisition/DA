'use client';

import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia(REDUCED);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** True when the visitor asked for less motion. Server render assumes motion is fine. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/** Becomes true the first time the element is on screen, and stays true. */
export function useInViewOnce(ref: RefObject<Element | null>, threshold = 0.3) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, seen, threshold]);
  return seen;
}

/**
 * Counts from 0 up to `total`, one step per `interval`, once `active` is true.
 * Reduced motion jumps straight to `total`.
 */
export function useSequence(active: boolean, total: number, interval = 650) {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current + 1 >= total) window.clearInterval(timer);
        return Math.min(current + 1, total);
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [active, interval, reduced, total]);
  return reduced ? total : count;
}

/**
 * Steps through 0..length-1 on a timer while `active`. Reduced motion holds
 * `still` (the last frame by default), so nothing moves.
 */
export function useCycle(length: number, interval = 2400, active = true, still = length - 1) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % length), interval);
    return () => window.clearInterval(timer);
  }, [active, interval, length, reduced]);
  return reduced ? still : index;
}
