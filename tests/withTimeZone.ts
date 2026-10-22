/**
 * Runs `fn` with the process time zone set to `tz` (an IANA name), then restores the previous
 * value, also when `fn` throws or returns a rejected promise. Setting `process.env.TZ` at
 * runtime takes effect immediately in Node (the shell prefix `TZ=... node` does not work under
 * Git Bash on Windows, so tests use this instead).
 */
export function withTimeZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  const restore = () => {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  };
  process.env.TZ = tz;
  let result: T;
  try {
    result = fn();
  } catch (error) {
    restore();
    throw error;
  }
  if (result instanceof Promise) {
    return result.finally(restore) as T;
  }
  restore();
  return result;
}
