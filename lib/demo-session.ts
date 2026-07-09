export const DEMO_SESSION_COOKIE = "demo_session_id";
export const DEMO_TTL_SECONDS = 60 * 60; // 1 hour

export function generateDemoSessionId(): string {
  return crypto.randomUUID();
}
