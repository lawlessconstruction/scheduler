// Current cheap, fast Claude model. Checked against Anthropic's model
// docs: Claude Haiku 5.5 (claude-haiku-5-5), released October 2026.
// Haiku 4.5 is the previous generation and costs about ten times as much.
// ANTHROPIC_MODEL can override this. Unknown models skip the Haiku 5.5
// thinking switch, which older models reject.

export const DEFAULT_ASK_MODEL = "claude-haiku-5-5"

export function resolveAskModel(envValue: string | undefined): string {
  const trimmed = envValue?.trim()
  return trimmed || DEFAULT_ASK_MODEL
}

export function modelExtras(model: string): Record<string, unknown> {
  if (model === DEFAULT_ASK_MODEL) {
    return {
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
    }
  }
  return {}
}
