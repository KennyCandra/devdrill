import type {
  AiIssueVerdict,
  AiReviewJudgement,
  ReviewComment,
  ReviewFile,
  ReviewIssue,
  ReviewVerdict,
} from '@devdrill/shared';
import { JUDGE_REVIEW_SCHEMA, JUDGE_REVIEW_SYSTEM } from '../prompts/judgeReview.js';
import type { AiFeature } from '../service.js';

const VERDICTS: readonly AiIssueVerdict[] = ['caught', 'partly', 'missed'];
const MAX_REASON = 600;

export interface JudgeReviewInput {
  /** The PR description (the challenge README). */
  description: string;
  files: ReviewFile[];
  issues: ReviewIssue[];
  comments: ReviewComment[];
  verdict: ReviewVerdict;
}

/** Asks the AI, issue by issue, whether the player's comments found it. */
export function judgeReview(
  input: JudgeReviewInput,
): AiFeature<Omit<AiReviewJudgement, 'judgedAt'>> {
  return {
    system: JUDGE_REVIEW_SYSTEM,
    prompt: [
      '# Pull request description',
      input.description.trim(),
      '# The new code (line numbers are what comments refer to)',
      ...input.files.map(
        (f) => `## ${f.path}${f.base === null ? ' (new file)' : ''}\n${numbered(f.head)}`,
      ),
      '# Answer key',
      ...input.issues.map(
        (i) =>
          `- id: ${i.id}\n  severity: ${i.severity}\n  where: ${i.file} lines ${i.lines[0]}-${i.lines[1]}\n  problem: ${i.title}\n  why: ${i.explanation}`,
      ),
      "# The candidate's comments",
      input.comments.length === 0
        ? '(none)'
        : input.comments
            .map(
              (c) =>
                `- ${c.file} lines ${c.lines[0]}-${c.lines[1]}:\n  """${c.why.replace(/"""/g, '"')}"""`,
            )
            .join('\n'),
      `# The candidate's verdict: ${input.verdict === 'approve' ? 'Approve' : 'Request changes'}`,
    ].join('\n\n'),
    schema: JUDGE_REVIEW_SCHEMA,
    parse: (value) => {
      const items = (value as { issues?: unknown } | null)?.issues;
      if (!Array.isArray(items)) throw new Error('no issues');
      const byId = new Map<string, { verdict: AiIssueVerdict; reason: string }>();
      for (const item of items as Record<string, unknown>[]) {
        if (
          typeof item?.id === 'string' &&
          VERDICTS.includes(item.verdict as AiIssueVerdict) &&
          typeof item.reason === 'string'
        ) {
          byId.set(item.id, {
            verdict: item.verdict as AiIssueVerdict,
            reason: item.reason.trim().slice(0, MAX_REASON),
          });
        }
      }
      // Every issue of the key must be judged; an answer that skips one is retried.
      const issues = input.issues.map((issue) => {
        const judged = byId.get(issue.id);
        if (!judged) throw new Error(`no verdict for ${issue.id}`);
        return { issueId: issue.id, ...judged };
      });
      return { issues };
    },
  };
}

/** Code with line numbers, the way the review screen shows it. */
function numbered(code: string): string {
  const lines = code.replace(/\n$/, '').split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)} | ${line}`).join('\n');
}
