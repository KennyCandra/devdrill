import { MessageSquarePlus, Pencil, SquareFunction, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { LineRange, ReviewComment } from '@devdrill/shared';
import { MAX_COMMENT_CHARS, MAX_COMMENT_LINES, MAX_REVIEW_COMMENTS } from '@devdrill/shared/review';
import { Button, Kbd, modKey } from '../components/ui';
import { lineLabel } from './DiffView';

/** A comment being written: a new one on some lines, or an existing one being changed. */
export interface CommentEdit {
  file: string;
  lines: LineRange;
  /** Set when changing an existing comment. */
  id?: string;
  why: string;
}

/**
 * The right-hand column: start a comment from the selected lines, write it, and see every
 * comment. The verdict is in the bottom bar, beside Submit.
 */
export function ReviewPanel({
  activePath,
  selection,
  comments,
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
}: {
  activePath: string;
  selection: LineRange | null;
  comments: ReviewComment[];
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
}) {
  const full = comments.length >= MAX_REVIEW_COMMENTS;

  return (
    <aside className="panel flex h-full flex-col" aria-label="Your review">
      <div className="panel-header shrink-0">
        <span className="panel-title">Your review</span>
        <span className="mono subtle text-[12px]">
          {comments.length} / {MAX_REVIEW_COMMENTS} comments
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-line p-3.5">
          {editing ? (
            <CommentForm
              key={editing.id ?? 'new'}
              edit={editing}
              disabled={disabled}
              onChange={onEditChange}
              onSave={onSaveComment}
              onCancel={onCancelEdit}
              onWholeFunction={onWholeFunction}
            />
          ) : selection ? (
            <div className="flex flex-col gap-2.5">
              <span className="mono text-[12.5px]">
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
                  <MessageSquarePlus className="i i-sm" aria-hidden="true" />
                  Comment on {lineLabel(selection)}
                </Button>
              )}
            </div>
          ) : (
            <div className="muted flex flex-col gap-2.5 rounded-lg border border-dashed border-line-strong p-3 leading-relaxed">
              <p className="flex items-center gap-2 font-semibold text-fg">
                <MessageSquarePlus className="i i-sm text-accent" aria-hidden="true" />
                Comment on the code
              </p>
              <p>
                Hover a line in the new code and click{' '}
                <span className="rounded bg-accent-bg px-1 font-semibold text-on-accent">+</span>.
                To cover several lines, select them first (drag, or shift-click line numbers), then
                click + or press {modKey} Enter.
              </p>
              <p>
                Say what's wrong and why. Up to {MAX_REVIEW_COMMENTS} comments; a good pull request
                needs none, just an approval.
              </p>
            </div>
          )}
        </div>

        {comments.length > 0 && (
          <ul aria-label="Comments" className="flex flex-col gap-1 p-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className={`rounded-lg px-3 py-2.5 ${c.id === focusedId ? 'bg-active' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onFocusComment(c)}
                  className="flex w-full flex-col items-start gap-1 text-left focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="mono muted text-[12px]">
                    {c.file} · {lineLabel(c.lines)}
                  </span>
                  <span className="text-[14px] leading-[21px] break-words whitespace-pre-wrap">
                    {c.why}
                  </span>
                </button>
                <div className="-ml-2 mt-1 flex flex-wrap items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onEditComment(c)}
                    aria-label="Edit comment"
                  >
                    <Pencil className="i i-sm" aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onDeleteComment(c.id)}
                    aria-label="Delete comment"
                  >
                    <Trash2 className="i i-sm" aria-hidden="true" /> Delete
                  </Button>
                  {editing?.id === c.id && (
                    <span className="subtle ml-2 text-[12px]">Editing above</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function CommentForm({
  edit,
  disabled,
  onChange,
  onSave,
  onCancel,
  onWholeFunction,
}: {
  edit: CommentEdit;
  disabled: boolean;
  onChange: (edit: CommentEdit) => void;
  onSave: () => void;
  onCancel: () => void;
  onWholeFunction: () => Promise<string | null>;
}) {
  const whyId = useId();
  const [snapError, setSnapError] = useState<string | null>(null);
  const [snapping, setSnapping] = useState(false);
  const ready = edit.why.trim() !== '' && !disabled;

  const wholeFunction = async () => {
    setSnapping(true);
    setSnapError(await onWholeFunction());
    setSnapping(false);
  };

  return (
    <form
      className="animate-fade-in flex flex-col gap-2.5 rounded-lg border border-accent p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSave();
      }}
    >
      {/* The button drops under a long location instead of squeezing it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="mono min-w-0 break-words text-[12.5px]">
          {edit.file} · {lineLabel(edit.lines)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => void wholeFunction()}
          disabled={snapping}
          title="Widen the comment to the whole function around these lines"
        >
          <SquareFunction className="i i-sm" aria-hidden="true" /> Whole function
        </Button>
      </div>
      {snapError && <p className="text-[12px] text-warning">{snapError}</p>}

      <label htmlFor={whyId} className="muted text-[13px]">
        What's wrong here, and why does it matter?
      </label>
      <textarea
        id={whyId}
        // The form opens because the user asked to comment: start where they type.
        autoFocus
        value={edit.why}
        onChange={(e) => onChange({ ...edit, why: e.target.value })}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter adds the comment, like in a code review tool.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && ready) {
            e.preventDefault();
            onSave();
          }
        }}
        maxLength={MAX_COMMENT_CHARS}
        rows={4}
        required
        className="textarea leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <span className="mono subtle mr-auto text-[12px] whitespace-nowrap">
          {edit.why.length} / {MAX_COMMENT_CHARS}
        </span>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={!ready}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          {edit.id ? 'Save comment' : 'Add comment'}
          <Kbd>{modKey} ↵</Kbd>
        </Button>
      </div>
    </form>
  );
}
