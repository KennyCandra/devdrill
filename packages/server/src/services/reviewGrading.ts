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
 * - Each issue can be found by one comment and each comment finds one issue; `must`
 *   issues get first pick, so a comment that fits two issues counts for the serious one.
 * - A comment that matches no issue at all is a false alarm. One that matches an issue
 *   another comment already found is a repeat: not wrong, so not a false alarm.
 * - Solved: every `must` found, the right verdict, and at most MAX_FALSE_ALARMS false alarms.
 */
export function gradeReview(
  issues: ReviewIssue[],
  comments: ReviewComment[],
  verdict: ReviewVerdict,
  issueTypes: IssueType[],
): Omit<ReviewResult, 'progress'> {
  const matches = (c: ReviewComment, i: ReviewIssue) =>
    c.file === i.file &&
    c.lines[0] <= i.lines[1] &&
    i.lines[0] <= c.lines[1] &&
    (c.type === i.type || (i.alsoAccept ?? []).includes(c.type));

  // Maximum matching (Kuhn's algorithm), adding issues most serious first: an issue that
  // has been matched stays matched, so later issues can't take a comment from a `must`.
  const commentOf = new Map<ReviewIssue, ReviewComment>();
  const issueOf = new Map<ReviewComment, ReviewIssue>();
  const tryMatch = (issue: ReviewIssue, seen: Set<ReviewComment>): boolean => {
    for (const comment of comments) {
      if (seen.has(comment) || !matches(comment, issue)) continue;
      seen.add(comment);
      const holder = issueOf.get(comment);
      if (!holder || tryMatch(holder, seen)) {
        commentOf.set(issue, comment);
        issueOf.set(comment, issue);
        return true;
      }
    }
    return false;
  };
  const bySeverity = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  for (const issue of bySeverity) tryMatch(issue, new Set());

  const falseAlarms = comments.filter((c) => !issues.some((i) => matches(c, i))).map((c) => c.id);
  const expected: ReviewVerdict = issues.some((i) => i.severity === 'must')
    ? 'request_changes'
    : 'approve';
  const solved =
    issues.every((i) => i.severity !== 'must' || commentOf.has(i)) &&
    verdict === expected &&
    falseAlarms.length <= MAX_FALSE_ALARMS;

  const categoryOf = (type: string) => issueTypes.find((t) => t.id === type)?.category ?? 'bug';
  const outcomes = issues.map((issue): IssueOutcome => {
    const comment = commentOf.get(issue);
    const { id, severity, ...details } = issue;
    return {
      id,
      severity,
      category: categoryOf(issue.type),
      found: comment !== undefined,
      ...(comment ? { commentId: comment.id } : {}),
      // A missed issue only says how serious and what kind until the review is solved;
      // where and what would be the answer.
      ...(comment || solved ? { details } : {}),
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
