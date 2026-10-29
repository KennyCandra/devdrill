import type { FeedbackKind, SolutionFeedback, SolutionFile } from '@devdrill/shared';
import { SOLUTION_FEEDBACK_SCHEMA, SOLUTION_FEEDBACK_SYSTEM } from '../prompts/solutionFeedback.js';
import type { AiFeature } from '../service.js';

const KINDS: readonly FeedbackKind[] = ['good', 'risk', 'readability', 'simpler'];
const MAX_POINTS = 6;
const MAX_TEXT = 800;
/** Enough for any challenge; keeps a pasted log or huge file from blowing up the request. */
const MAX_PROMPT_CHARS = 120_000;

export interface SolutionFeedbackInput {
  /** The task (the challenge README). */
  task: string;
  /** What the player changed: their files next to the starter versions. */
  changes: SolutionFile[];
  /** The reference solution, for comparison. */
  reference: SolutionFile[];
}

/** Asks the AI how a passing solution could be better. */
export function solutionFeedback(input: SolutionFeedbackInput): AiFeature<SolutionFeedback> {
  const changed = input.changes.map((c) =>
    c.starter === null
      ? `## ${c.path} (new file)\n${numbered(c.solution)}`
      : `## ${c.path}\n### Before\n${c.starter}\n### After (line numbers are what feedback refers to)\n${numbered(c.solution)}`,
  );
  const reference = input.reference.map((r) => `## ${r.path}\n${r.solution}`);
  const prompt = [
    '# The task',
    input.task.trim(),
    "# The candidate's changes",
    changed.length > 0 ? changed.join('\n\n') : '(no files changed)',
    '# A reference solution (for comparison only)',
    reference.join('\n\n'),
  ]
    .join('\n\n')
    .slice(0, MAX_PROMPT_CHARS);

  return {
    system: SOLUTION_FEEDBACK_SYSTEM,
    prompt,
    schema: SOLUTION_FEEDBACK_SCHEMA,
    parse: (value) => {
      const v = value as { summary?: unknown; points?: unknown } | null;
      if (typeof v?.summary !== 'string' || !Array.isArray(v.points)) throw new Error('bad shape');
      const files = new Set(input.changes.map((c) => c.path));
      const points = (v.points as Record<string, unknown>[])
        .filter(
          (p) =>
            KINDS.includes(p?.kind as FeedbackKind) && typeof p.text === 'string' && p.text.trim(),
        )
        .slice(0, MAX_POINTS)
        .map((p) => ({
          kind: p.kind as FeedbackKind,
          // Only point at files the player actually changed, and at real line numbers.
          file: typeof p.file === 'string' && files.has(p.file) ? p.file : null,
          line:
            typeof p.file === 'string' &&
            files.has(p.file) &&
            Number.isInteger(p.line) &&
            (p.line as number) > 0
              ? (p.line as number)
              : null,
          text: (p.text as string).trim().slice(0, MAX_TEXT),
        }));
      return { summary: v.summary.trim().slice(0, MAX_TEXT), points };
    },
  };
}

function numbered(code: string): string {
  const lines = code.replace(/\n$/, '').split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)} | ${line}`).join('\n');
}
