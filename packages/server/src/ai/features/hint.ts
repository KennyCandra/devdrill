import { HINT_SCHEMA, HINT_SYSTEM } from '../prompts/hint.js';
import type { AiFeature } from '../service.js';

const MAX_HINT = 600;

export interface HintInput {
  /** The task (the challenge README). */
  task: string;
  /** The player's files as they are now. Never the reference solution: that's the answer. */
  files: { path: string; content: string }[];
  /** The written hints they've already seen, so the AI doesn't repeat them. */
  shownHints: string[];
}

/** One nudge for a stuck player, without the answer. */
export function hint(input: HintInput): AiFeature<{ hint: string }> {
  return {
    system: HINT_SYSTEM,
    prompt: [
      '# The task',
      input.task.trim(),
      '# Their code right now',
      ...input.files.map((f) => `## ${f.path}\n${f.content}`),
      '# Hints they already have',
      input.shownHints.length > 0 ? input.shownHints.map((h) => `- ${h}`).join('\n') : '(none)',
    ].join('\n\n'),
    schema: HINT_SCHEMA,
    parse: (value) => {
      const text = (value as { hint?: unknown } | null)?.hint;
      if (typeof text !== 'string' || !text.trim()) throw new Error('no hint');
      return { hint: text.trim().slice(0, MAX_HINT) };
    },
  };
}
