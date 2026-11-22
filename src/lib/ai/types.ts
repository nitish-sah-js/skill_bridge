export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  signal?: AbortSignal;
  maxOutputTokens?: number;
  temperature?: number;
};

/** Minimal streaming chat interface so another LLM provider can be swapped in. */
export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  streamChat(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "rate_limited" | "auth" | "unavailable" | "bad_response",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
