/**
 * BYOK (Bring Your Own Key) LLM provider — raw fetch(), zero SDK dependencies.
 *
 * Tries providers in order: Gemini -> OpenAI -> Anthropic.
 * Only `describe` and `auto` commands need an API key.
 */

export type ProviderName = "gemini" | "openai" | "anthropic";

export interface LlmProvider {
  name: ProviderName;
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

// ─── Gemini (Google) ───────────────────────────────────────────────────────

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

// ─── OpenAI ────────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, systemPrompt: string, userText: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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

// ─── Anthropic ─────────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, systemPrompt: string, userText: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
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

// ─── Provider Detection & Factory ──────────────────────────────────────────

/**
 * Detect which LLM provider is available based on environment variables.
 * Priority: Gemini -> OpenAI -> Anthropic. Returns null if none configured.
 */
export function detectProvider(): ProviderName | null {
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/**
 * Get an LLM provider instance using raw fetch(). No SDK dependencies.
 * Returns null if no API key is configured.
 */
export function getProvider(): LlmProvider | null {
  const detected = detectProvider();
  if (!detected) return null;

  switch (detected) {
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
      return {
        name: "gemini",
        generate: (sys, user) => callGemini(apiKey, sys, user),
      };
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY || "";
      return {
        name: "openai",
        generate: (sys, user) => callOpenAI(apiKey, sys, user),
      };
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY || "";
      return {
        name: "anthropic",
        generate: (sys, user) => callAnthropic(apiKey, sys, user),
      };
    }
    default:
      return null;
  }
}

/**
 * Convenience: call the first available LLM provider.
 * Throws if no provider is configured.
 */
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
