export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a retryable error (429 or 5xx)
      const statusCode = error.statusCode || error.status;
      if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(
          `Retry ${i + 1}/${maxRetries} after ${delay}ms for status ${statusCode}`
        );
        await sleep(delay);
        continue;
      }

      // Non-retryable error, throw immediately
      throw error;
    }
  }

  throw lastError;
}
