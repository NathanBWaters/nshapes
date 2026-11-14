/**
 * Slow motion for the effects. Dev tools only (/dev/fx, and
 * `__nshapesFx.slow = 8` in a dev build's console): every delay and duration
 * of the stage is multiplied by `slow`, so an effect can be watched frame by
 * frame. The fight itself is not slowed.
 */
export const fxClock = { slow: 1 };

export const fxMs = (ms: number): number => ms * fxClock.slow;
