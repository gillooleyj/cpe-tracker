import { useCallback, useEffect, useRef, useState } from "react";

// Events that count as user activity.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

interface Options {
  /** Total inactivity time before logout (ms). */
  timeoutMs: number;
  /** How long before logout the warning is shown (ms). */
  warningMs: number;
  /** Called exactly once when the timeout fires. */
  onTimeout: () => void;
  /** Pass false to disable the timer (e.g. when no user is logged in). */
  enabled: boolean;
}

interface Result {
  /** Whether the warning modal should be visible. */
  showWarning: boolean;
  /** Seconds remaining when the warning is active. */
  secondsLeft: number;
  /** Call this when the user clicks "Stay Logged In". Resets the timer. */
  keepAlive: () => void;
}

/**
 * Tracks user inactivity and fires `onTimeout` after `timeoutMs` ms of no
 * activity.  Shows a warning `warningMs` ms before the timeout fires.
 *
 * Uses a 1-second polling interval rather than two nested timeouts so that
 * the remaining-time display stays accurate and background-tab timer
 * throttling doesn't cause stale countdowns.
 */
export function useInactivityTimeout({
  timeoutMs,
  warningMs,
  onTimeout,
  enabled,
}: Options): Result {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Track the wall-clock time of the last activity.
  const lastActivityRef = useRef(Date.now());

  // Keep the callback in a ref so the interval closure never goes stale.
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  // Stamp "now" as activity — used both by event listeners and keepAlive.
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const keepAlive = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    // Treat the moment the timer starts as activity so the full window is given.
    lastActivityRef.current = Date.now();

    // Guard against the interval firing multiple times after the timeout.
    let timedOut = false;

    const tick = () => {
      const inactive = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - inactive;

      if (remaining <= 0 && !timedOut) {
        timedOut = true;
        setShowWarning(false);
        onTimeoutRef.current();
        return;
      }

      if (remaining > 0 && remaining <= warningMs) {
        setShowWarning(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (remaining > warningMs) {
        setShowWarning(false);
      }
    };

    const interval = setInterval(tick, 1_000);

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetActivity, { passive: true })
    );

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetActivity)
      );
      setShowWarning(false);
    };
  }, [enabled, timeoutMs, warningMs, resetActivity]);

  return { showWarning, secondsLeft, keepAlive };
}
