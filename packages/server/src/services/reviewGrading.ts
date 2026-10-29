import type {
  IssueOutcome,
  IssueType,
  ReviewComment,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
  ReviewVerdict,
} from '@devdrill/shared';
import { MAX_FALSE_ALARMS } from '@devdrill/shared/review';

const SEVERITY_ORDER: ReviewSeverity[] = ['must', 'should', 'nit'];

/**
 * Grades a review against the answer key, without AI (docs/V1_1_PLAN.md, section 6).
 *
 * - A comment matches an issue when it's on the same file, its lines overlap the issue's,
 *   and it names the issue's type (or one of its `alsoAccept` types).
 * - Each issue can be found by one comment and each comment finds one issue. Comments go
 *   to the issue they name exactly before any `alsoAccept` one, then `must` issues get
 *   first pick, then the narrower issue: a comment about a leaked password on line 47
 *   finds the leak on line 47, not a missing check on lines 43-48 that also accepts it.
 * - A comment that matches no issue at all is a false alarm. One that matches an issue
 *   another comment already found is a repeat: not wrong, so not a false alarm.
 * - Solved: every `must` found, the right verdict, and at most MAX_FALSE_ALARMS false alarms.
 */
export function gradeReview(
  issues: ReviewIssue[],
  comments: ReviewComment[],
  verdict: ReviewVerdict,
  issueTypes: IssueType[],
  /** Show every issue even if this review isn't solved (solved before: nothing to hide). */
  revealAll = false,
): Omit<ReviewResult, 'progress'> {
  const overlaps = (c: ReviewComment, i: ReviewIssue) =>
    c.file === i.file && c.lines[0] <= i.lines[1] && i.lines[0] <= c.lines[1];
  const exact = (c: ReviewComment, i: ReviewIssue) => overlaps(c, i) && c.type === i.type;
  const matches = (c: ReviewComment, i: ReviewIssue) =>
    overlaps(c, i) && (c.type === i.type || (i.alsoAccept ?? []).includes(c.type));

  // Maximum matching (Kuhn's algorithm), adding issues most serious first: an issue that
  // has been matched stays matched, so later issues can't take a comment from a `must`.
  const commentOf = new Map<ReviewIssue, ReviewComment>();
  const issueOf = new Map<ReviewComment, ReviewIssue>();
  const tryMatch = (
    issue: ReviewIssue,
    fits: (c: ReviewComment, i: ReviewIssue) => boolean,
    free: (c: ReviewComment) => boolean,
    seen: Set<ReviewComment>,
  ): boolean => {
    for (const comment of comments) {
      if (seen.has(comment) || !free(comment) || !fits(comment, issue)) continue;
      seen.add(comment);
      const holder = issueOf.get(comment);
      if (!holder || tryMatch(holder, fits, free, seen)) {
        commentOf.set(issue, comment);
        issueOf.set(comment, issue);
        return true;
      }
    }
    return false;
  };
  const span = (i: ReviewIssue) => i.lines[1] - i.lines[0];
  const bySeverity = [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || span(a) - span(b),
  );
  // First the exact type, then the extra labels, with only the comments still unused.
  for (const issue of bySeverity) tryMatch(issue, exact, () => true, new Set());
  const usedExactly = new Set(issueOf.keys());
  for (const issue of bySeverity) {
    if (!commentOf.has(issue)) tryMatch(issue, matches, (c) => !usedExactly.has(c), new Set());
  }

  const falseAlarms = comments.filter((c) => !issues.some((i) => matches(c, i))).map((c) => c.id);
  const expected: ReviewVerdict = issues.some((i) => i.severity === 'must')
    ? 'request_changes'
    : 'approve';
  const solved =
    issues.every((i) => i.severity !== 'must' || commentOf.has(i)) &&
    verdict === expected &&
    falseAlarms.length <= MAX_FALSE_ALARMS;

  const categoryOf = (type: string) => {
    const found = issueTypes.find((t) => t.id === type);
    if (!found) throw new Error(`Unknown issue type "${type}" in the answer key.`);
    return found.category;
  };
  // A missed issue only says how serious and what kind until the review is solved: its id,
  // where and what would be the answer, and so would its place in the answer key.
  let missed = 0;
  const outcomes = bySeverity.map((issue): IssueOutcome => {
    const comment = commentOf.get(issue);
    const { id, severity, ...details } = issue;
    const reveal = comment !== undefined || solved || revealAll;
    return {
      id: reveal ? id : `missed-${++missed}`,
      severity,
      category: categoryOf(issue.type),
      found: comment !== undefined,
      ...(comment ? { commentId: comment.id } : {}),
      ...(reveal ? { details } : {}),
    };
  });

  return {
    solved,
    verdict: { given: verdict, correct: verdict === expected },
    issues: outcomes,
    falseAlarms,
    comments,
  };
}
