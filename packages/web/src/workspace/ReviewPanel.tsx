import { Check, MessageSquarePlus, Pencil, SquareFunction, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import type {
  IssueType,
  LineRange,
  ReviewCategory,
  ReviewComment,
  ReviewVerdict,
} from '@devdrill/shared';
import {
  CATEGORY_LABELS,
  MAX_COMMENT_CHARS,
  MAX_COMMENT_LINES,
  MAX_REVIEW_COMMENTS,
  REVIEW_CATEGORIES,
} from '@devdrill/shared/review';
import { Button, modKey } from '../components/ui';
import { lineLabel } from './DiffView';

/** A comment being written: a new one on some lines, or an existing one being changed. */
export interface CommentEdit {
  file: string;
  lines: LineRange;
  /** Set when changing an existing comment. */
  id?: string;
  type: string;
  why: string;
}

/**
 * The right-hand column: start a comment from the selected lines, write it, see every
 * comment, and pick the verdict.
 */
export function ReviewPanel({
  activePath,
  selection,
  comments,
  issueTypes,
  verdict,
  editing,
  focusedId,
  disabled,
  onStartComment,
  onWholeFunction,
  onEditChange,
  onSaveComment,
  onCancelEdit,
  onEditComment,
  onDeleteComment,
  onFocusComment,
  onVerdict,
}: {
  activePath: string;
  selection: LineRange | null;
  comments: ReviewComment[];
  issueTypes: IssueType[];
  verdict: ReviewVerdict | null;
  editing: CommentEdit | null;
  focusedId: string | null;
  disabled: boolean;
  onStartComment: () => void;
  onWholeFunction: () => Promise<string | null>;
  onEditChange: (edit: CommentEdit) => void;
  onSaveComment: () => void;
  onCancelEdit: () => void;
  onEditComment: (comment: ReviewComment) => void;
  onDeleteComment: (id: string) => void;
  onFocusComment: (comment: ReviewComment) => void;
  onVerdict: (verdict: ReviewVerdict) => void;
}) {
  const full = comments.length >= MAX_REVIEW_COMMENTS;
  const typeLabel = (id: string) => issueTypes.find((t) => t.id === id);

  return (
    <aside className="flex h-full flex-col bg-side" aria-label="Your review">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex items-center px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          <span className="mr-auto">Your review</span>
          <span>
            {comments.length}/{MAX_REVIEW_COMMENTS}
            <span className="sr-only"> comments used</span>
          </span>
        </div>

        <div className="px-3 pb-3">
          {editing ? (
            <CommentForm
              key={editing.id ?? 'new'}
              edit={editing}
              issueTypes={issueTypes}
              disabled={disabled}
              onChange={onEditChange}
              onSave={onSaveComment}
              onCancel={onCancelEdit}
              onWholeFunction={onWholeFunction}
            />
          ) : selection ? (
            <div className="flex flex-col gap-2 rounded border border-line p-2">
              <span className="text-muted">
                {activePath} · {lineLabel(selection)}
              </span>
              {full ? (
                <p className="text-warning">
                  You've used all {MAX_REVIEW_COMMENTS} comments. Remove one to add another.
                </p>
              ) : selection[1] - selection[0] + 1 > MAX_COMMENT_LINES ? (
                <p className="text-warning">
                  A comment covers at most {MAX_COMMENT_LINES} lines. Select fewer.
                </p>
              ) : (
                <Button
                  variant="primary"
                  className="self-start"
                  onClick={onStartComment}
                  disabled={disabled}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                >
                  <MessageSquarePlus size={14} aria-hidden="true" /> Comment on{' '}
                  {lineLabel(selection)}
                </Button>
              )}
            </div>
          ) : (
            <p className="leading-relaxed text-muted">
              Select lines in the new code to comment on them: click a line number, shift-click
              another to select more (or Shift + arrow keys in the editor, then {modKey} Enter). Up
              to {MAX_REVIEW_COMMENTS} comments, whatever the pull request. A good pull request
              deserves an approval and no comments.
            </p>
          )}
        </div>

        {comments.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-line p-2" aria-label="Comments">
            {comments.map((c) => {
              const type = typeLabel(c.type);
              return (
                <li
                  key={c.id}
                  className={`group rounded border p-2 ${
                    c.id === focusedId ? 'border-accent bg-hover' : 'border-transparent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onFocusComment(c)}
                    className="flex w-full flex-col items-start gap-0.5 text-left focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span className="text-[12px] font-semibold">
                      {type ? `${CATEGORY_LABELS[type.category]} · ${type.label}` : c.type}
                    </span>
                    <span className="text-[12px] text-muted">
                      {c.file} · {lineLabel(c.lines)}
                    </span>
                    <span className="line-clamp-2">{c.why}</span>
                  </button>
                  <div className="mt-1 flex gap-1">
                    <Button
                      variant="ghost"
                      className="h-6 px-1.5"
                      disabled={disabled}
                      onClick={() => onEditComment(c)}
                      aria-label="Edit comment"
                    >
                      <Pencil size={12} aria-hidden="true" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-6 px-1.5"
                      disabled={disabled}
                      onClick={() => onDeleteComment(c.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 size={12} aria-hidden="true" /> Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <fieldset className="shrink-0 border-t border-line p-3" disabled={disabled}>
        <legend className="sr-only">Verdict</legend>
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          Verdict
        </div>
        <div className="flex flex-wrap gap-2">
          <VerdictButton
            selected={verdict === 'approve'}
            onClick={() => onVerdict('approve')}
            icon={<Check size={14} aria-hidden="true" />}
          >
            Approve
          </VerdictButton>
          <VerdictButton
            selected={verdict === 'request_changes'}
            onClick={() => onVerdict('request_changes')}
            icon={<X size={14} aria-hidden="true" />}
          >
            Request changes
          </VerdictButton>
        </div>
      </fieldset>
    </aside>
  );
}

function VerdictButton({
  selected,
  onClick,
  icon,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded border px-3 text-[13px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${
        selected
          ? 'border-accent bg-accent-bg text-on-accent'
          : 'border-line-strong bg-hover hover:bg-active'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function CommentForm({
  edit,
  issueTypes,
  disabled,
  onChange,
  onSave,
  onCancel,
  onWholeFunction,
}: {
  edit: CommentEdit;
  issueTypes: IssueType[];
  disabled: boolean;
  onChange: (edit: CommentEdit) => void;
  onSave: () => void;
  onCancel: () => void;
  onWholeFunction: () => Promise<string | null>;
}) {
  const typeId = useId();
  const whyId = useId();
  const [snapError, setSnapError] = useState<string | null>(null);
  const [snapping, setSnapping] = useState(false);
  const chosen = issueTypes.find((t) => t.id === edit.type);
  const byCategory = new Map<ReviewCategory, IssueType[]>(
    REVIEW_CATEGORIES.map((c) => [c, issueTypes.filter((t) => t.category === c)]),
  );
  const ready = edit.type !== '' && edit.why.trim() !== '' && !disabled;

  const wholeFunction = async () => {
    setSnapping(true);
    setSnapError(await onWholeFunction());
    setSnapping(false);
  };

  return (
    <form
      className="animate-fade-in flex flex-col gap-2 rounded border border-accent p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSave();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-muted">
          {edit.file} · {lineLabel(edit.lines)}
        </span>
        <Button
          variant="ghost"
          className="h-6 px-1.5"
          onClick={() => void wholeFunction()}
          disabled={snapping}
          title="Comment on the whole function around these lines"
        >
          <SquareFunction size={13} aria-hidden="true" /> Whole function
        </Button>
      </div>
      {snapError && <p className="text-[12px] text-warning">{snapError}</p>}

      <label htmlFor={typeId} className="text-[12px] text-muted">
        What's wrong?
      </label>
      <select
        id={typeId}
        // The form opens because the user asked to comment: start where they type.
        autoFocus
        value={edit.type}
        onChange={(e) => onChange({ ...edit, type: e.target.value })}
        className="h-7 rounded border border-line-strong bg-bg px-1.5 focus-visible:outline-2 focus-visible:outline-accent"
        required
      >
        <option value="" disabled>
          Pick an issue type…
        </option>
        {[...byCategory].map(([category, types]) =>
          types.length > 0 ? (
            <optgroup key={category} label={CATEGORY_LABELS[category]}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
      {chosen && <p className="text-[12px] leading-relaxed text-muted">{chosen.description}</p>}

      <label htmlFor={whyId} className="text-[12px] text-muted">
        Why? Say what goes wrong, and when.
      </label>
      <textarea
        id={whyId}
        value={edit.why}
        onChange={(e) => onChange({ ...edit, why: e.target.value })}
        maxLength={MAX_COMMENT_CHARS}
        rows={4}
        required
        className="resize-y rounded border border-line-strong bg-bg p-1.5 leading-relaxed focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="flex items-center gap-2">
        <span className="mr-auto text-[11px] text-muted">
          {edit.why.length}/{MAX_COMMENT_CHARS}
        </span>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!ready}>
          {edit.id ? 'Save comment' : 'Add comment'}
        </Button>
      </div>
    </form>
  );
}
