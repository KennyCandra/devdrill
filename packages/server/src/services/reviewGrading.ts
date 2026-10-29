import type {
  IssueOutcome,
  ReviewComment,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
  ReviewVerdict,
} from '@devdrill/shared';
import { SEVERITY_WEIGHTS } from '@devdrill/shared/review';

const SEVERITY_ORDER: ReviewSeverity[] = ['must', 'should', 'nit'];

/** A review result before it's tied to progress: what gets saved in the workspace. */
export type SavedReview = Omit<ReviewResult, 'progress'>;

/**
 * Lays a submitted review next to the answer key (docs/V1_1_PLAN.md, section 11).
 *
 * Without AI there's no telling whether a comment is right, so nothing here judges one:
 * - The verdict is the only check: Request changes when the PR has a `must` issue,
 *   Approve when it doesn't. The right verdict passes.
 * - Each issue lists the comments on its lines ("nearby"), so the player can compare;
 *   comments near no issue are listed apart. The player then ticks what they caught.
 */
export function compareReview(
  issues: ReviewIssue[],
  comments: ReviewComment[],
  verdict: ReviewVerdict,
  submittedAt: string,
): SavedReview {
  const near = (c: ReviewComment, i: ReviewIssue) =>
    c.file === i.file && c.lines[0] <= i.lines[1] && i.lines[0] <= c.lines[1];
  const expected: ReviewVerdict = issues.some((i) => i.severity === 'must')
    ? 'request_changes'
    : 'approve';
  const total = issues.reduce((sum, i) => sum + SEVERITY_WEIGHTS[i.severity], 0);
  const ordered = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const outcomes = ordered.map((issue): IssueOutcome => ({
    issue,
    weight: (SEVERITY_WEIGHTS[issue.severity] / total) * 100,
    nearby: comments.filter((c) => near(c, issue)).map((c) => c.id),
    caught: false,
  }));
  const passed = verdict === expected;
  return {
    passed,
    verdict: { given: verdict, expected },
    issues: outcomes,
    others: comments.filter((c) => !issues.some((i) => near(c, i))).map((c) => c.id),
    comments,
    score: score(outcomes, passed),
    submittedAt,
  };
}

/** Applies the player's ticks: only issues of this review count, unknown ids are ignored. */
export function withCaught(review: SavedReview, caught: readonly string[]): SavedReview {
  const ticked = new Set(caught);
  const issues = review.issues.map((o) => ({ ...o, caught: ticked.has(o.issue.id) }));
  return { ...review, issues, score: score(issues, review.passed) };
}

/** 0–100: the weight of the issues ticked. With no issues, a pass is a perfect review. */
function score(outcomes: IssueOutcome[], passed: boolean): number {
  if (outcomes.length === 0) return passed ? 100 : 0;
  return Math.round(outcomes.reduce((sum, o) => sum + (o.caught ? o.weight : 0), 0));
}
