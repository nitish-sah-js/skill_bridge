/** Client helpers for the separate proctored test window. */

export const TEST_WINDOW_NAME = "skillbridge-test";
export const TEST_FINISHED_MESSAGE = "skillbridge:assessment-finished";

export type TestFinishedMessage = { type: typeof TEST_FINISHED_MESSAGE; attemptId: string };

export function testWindowUrl(attemptId: string) {
  return `/assessment/${attemptId}/take`;
}

/**
 * Open (or focus) the test window. Call synchronously inside a click handler, before any
 * await, so the browser treats it as user-initiated; pass no URL to open a blank window
 * that is pointed at the test once the attempt id is known. Returns null when blocked.
 */
export function openTestWindow(url = "about:blank"): Window | null {
  const width = window.screen.availWidth;
  const height = window.screen.availHeight;
  const win = window.open(url, TEST_WINDOW_NAME, `popup,width=${width},height=${height},left=0,top=0`);
  win?.focus();
  return win;
}

export function isTestFinishedMessage(data: unknown, attemptId?: string): data is TestFinishedMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Partial<TestFinishedMessage>;
  return message.type === TEST_FINISHED_MESSAGE && (attemptId === undefined || message.attemptId === attemptId);
}
