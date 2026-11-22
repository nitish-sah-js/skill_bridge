import "server-only";
import { GroqProvider } from "./groq";
import type { ChatProvider } from "./types";

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/** The configured chat provider, or null when no API key is set. */
export function getChatProvider(): ChatProvider | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new GroqProvider(apiKey, process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL);
}

export function isMentorConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
