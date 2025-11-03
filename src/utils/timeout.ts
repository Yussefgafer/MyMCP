/**
 * Timeout utility for operations
 * Provides timeout functionality with AbortController
 */

export interface TimeoutOptions {
  timeout?: number; // timeout in milliseconds
  signal?: AbortSignal;
}

/**
 * Wraps a promise with timeout functionality
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Custom timeout message
 * @returns Promise that rejects with timeout error if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = `Operation timed out after ${timeoutMs}ms`
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Creates an AbortController with timeout
 * @param timeoutMs Timeout in milliseconds
 * @returns AbortController that will abort after timeout
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Clear timeout if operation completes
  const originalSignal = controller.signal;
  const cleanup = () => clearTimeout(timeoutId);

  originalSignal.addEventListener('abort', cleanup);

  return controller;
}

/**
 * Validates and normalizes timeout value
 * @param timeout Timeout value from parameters
 * @param defaultTimeout Default timeout in seconds
 * @param maxTimeout Maximum allowed timeout in seconds
 * @returns Timeout in milliseconds
 */
export function normalizeTimeout(
  timeout?: number,
  defaultTimeout: number = 120,
  maxTimeout: number = 600
): number {
  const timeoutSeconds = timeout ?? defaultTimeout;
  const clampedTimeout = Math.min(Math.max(timeoutSeconds, 1), maxTimeout);
  return clampedTimeout * 1000; // Convert to milliseconds
}
