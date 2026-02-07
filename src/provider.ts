/**
 * BYOK (Bring Your Own Key) LLM provider -- raw fetch(), zero SDK dependencies.
 *
 * Tries providers in order: Gemini -> OpenAI -> Anthropic.
 * Only describe and auto commands need an API key.
 */

export type ProviderName = "gemini" | "openai" | "anthropic";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmProvider {
  name: ProviderName;
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
  multiTurn(systemPrompt: string, messages: ChatMessage[]): Promise<string>;
}
// --- Gemini (Google) ---

async function callGemini(apiKey: string, systemPrompt: string, userText: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt + "\n\n" + userText }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

async function callGeminiMultiTurn(apiKey: string, systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  contents.push({ role: "user", parts: [{ text: systemPrompt }] });
  contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });

  for (const msg of messages) {
    if (msg.role === "system") continue;
    const geminiRole = msg.role === "assistant" ? "model" : "user";
    contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}
// --- OpenAI ---

async function callOpenAI(apiKey: string, systemPrompt: string, userText: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return content;
}

async function callOpenAIMultiTurn(apiKey: string, systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const apiMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.role === "system") continue;
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: apiMessages,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return content;
}
// --- Anthropic ---

async function callAnthropic(apiKey: string, systemPrompt: string, userText: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const block = data?.content?.[0];
  if (block?.type === "text" && block.text) return block.text;
  throw new Error("Empty response from Anthropic");
}

async function callAnthropicMultiTurn(apiKey: string, systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const apiMessages: Array<{ role: string; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  if (apiMessages.length === 0 || apiMessages[0].role !== "user") {
    apiMessages.unshift({ role: "user", content: "Begin." });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      system: systemPrompt,
      messages: apiMessages,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const block = data?.content?.[0];
  if (block?.type === "text" && block.text) return block.text;
  throw new Error("Empty response from Anthropic");
}
// --- Provider Detection & Factory ---

export function detectProvider(): ProviderName | null {
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function getProvider(): LlmProvider | null {
  const detected = detectProvider();
  if (!detected) return null;

  switch (detected) {
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
      return {
        name: "gemini",
        generate: (sys, user) => callGemini(apiKey, sys, user),
        multiTurn: (sys, msgs) => callGeminiMultiTurn(apiKey, sys, msgs),
      };
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY || "";
      return {
        name: "openai",
        generate: (sys, user) => callOpenAI(apiKey, sys, user),
        multiTurn: (sys, msgs) => callOpenAIMultiTurn(apiKey, sys, msgs),
      };
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY || "";
      return {
        name: "anthropic",
        generate: (sys, user) => callAnthropic(apiKey, sys, user),
        multiTurn: (sys, msgs) => callAnthropicMultiTurn(apiKey, sys, msgs),
      };
    }
    default:
      return null;
  }
}

export async function callLlm(systemPrompt: string, userText: string): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No LLM provider configured.\n" +
        "Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY"
    );
  }
  return provider.generate(systemPrompt, userText);
}

/**
 * Multi-turn conversation with message history.
 * Used by the ReAct agent loop for iterative tool use.
 */
export async function callLlmMultiTurn(
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No LLM provider configured.\n" +
        "Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY"
    );
  }
  return provider.multiTurn(systemPrompt, messages);
}
