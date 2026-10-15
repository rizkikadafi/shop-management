/**
 * Helpers for keeping authentication responsive when the network is slow or
 * absent.
 *
 * `navigator.onLine` is only a hint — it can be `true` while there is no usable
 * route (e.g. Wi-Fi connected to a dead AP). So offline handling pairs a hard
 * fast-path (skip the network entirely when we are certain we are offline) with
 * a bounded timeout around every auth network call, so an unreachable server
 * cannot block the first render for the full browser/OS timeout.
 */

/** How long an auth network call may run before we fall back to the cache. */
export const NETWORK_TIMEOUT_MS = 5000;

export class TimeoutError extends Error {
  constructor(message = "Network request timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

/** True only when the browser is certain there is no connectivity. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Resolve `task`, but reject with a {@link TimeoutError} if it takes longer than
 * `ms`. The underlying request is not cancelled; callers treat a timeout the
 * same as a network failure and use cached data instead.
 */
export function withTimeout<T>(
  task: PromiseLike<T>,
  ms: number = NETWORK_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    Promise.resolve(task).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
