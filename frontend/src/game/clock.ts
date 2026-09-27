/**
 * Clock: one frame loop for the whole room.
 *
 * Every walker needs to know how much time has passed, and a phone has better
 * things to do than run one animation frame loop per resident. This module owns
 * a single loop, starts it when the first walker asks, and stops it when the
 * last one leaves, so a still room costs nothing at all.
 *
 * The loop subdivides into roughly thirty updates per second, which is enough
 * for a walk and leaves the drawing budget to the figures themselves.
 */

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let frame: number | null = null;
let lastCall = 0;

/** A monotonic enough clock for animation, in seconds. */
export function nowSeconds(): number {
  return Date.now() / 1000;
}

function tick(): void {
  const now = nowSeconds();
  // Thirty updates a second: a walk reads as a walk, and two walkers do not
  // repaint the room sixty times a second for nothing.
  if (now - lastCall >= 1 / 30) {
    lastCall = now;
    for (const listener of [...listeners]) {
      // One walker failing to compute a step must not take the whole room's
      // clock down with it: the others keep walking, and that one is simply
      // left standing this frame.
      try {
        listener(now);
      } catch {
        // Forgotten on purpose: a bad frame is not worth a broken room.
      }
    }
  }
  frame = listeners.size > 0 ? requestAnimationFrame(tick) : null;
}

/** Ask to be called on every frame while at least one walker is moving. */
export function onFrame(listener: Listener): () => void {
  listeners.add(listener);
  if (frame === null) {
    lastCall = 0;
    frame = requestAnimationFrame(tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}
