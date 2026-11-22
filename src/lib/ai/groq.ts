import "server-only";
import { ProviderError, type ChatMessage, type ChatOptions, type ChatProvider } from "./types";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/** Groq's OpenAI-compatible chat completions API with server-sent-event streaming. */
export class GroqProvider implements ChatProvider {
  readonly name = "groq";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async *streamChat(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.4,
          max_completion_tokens: options.maxOutputTokens ?? 1024,
        }),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw new ProviderError("The AI provider timed out.", "timeout");
      throw new ProviderError(`Could not reach the AI provider: ${(error as Error).message}`, "unavailable");
    }

    if (!response.ok || !response.body) {
      const kind = response.status === 429 ? "rate_limited" : response.status === 401 || response.status === 403 ? "auth" : "unavailable";
      throw new ProviderError(`AI provider returned HTTP ${response.status}`, kind, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          const text = parseDelta(payload);
          if (text) yield text;
        }
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (options.signal?.aborted) throw new ProviderError("The AI provider timed out.", "timeout");
      throw new ProviderError("The AI response stream was interrupted.", "unavailable");
    } finally {
      reader.releaseLock();
    }
  }
}

export function parseDelta(payload: string): string {
  try {
    const json = JSON.parse(payload) as { choices?: { delta?: { content?: unknown } }[]; error?: { message?: string } };
    if (json.error) throw new ProviderError(json.error.message ?? "AI provider error", "bad_response");
    const content = json.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : "";
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    return "";
  }
}
