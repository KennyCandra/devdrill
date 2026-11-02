import { Check, TriangleAlert } from 'lucide-react';
import { Spinner } from '../components/ui';
import type { FileBuffer } from './fileStore';

/** "All changes saved" / "Saving…" / errors, in the top bar. Each state has an icon and a word. */
export function SaveIndicator({ buffers }: { buffers: Record<string, FileBuffer> }) {
  const all = Object.values(buffers);
  const failed = all.find((b) => b.state === 'error');

  let label = 'All changes saved';
  let tone = 'muted';
  let icon = <Check className="i i-sm" aria-hidden="true" />;
  if (all.some((b) => b.state === 'conflict')) {
    label = 'File changed elsewhere';
    tone = 'text-danger';
    icon = <TriangleAlert className="i i-sm" aria-hidden="true" />;
  } else if (failed) {
    label = failed.error ?? "Couldn't save";
    tone = 'text-danger';
    icon = <TriangleAlert className="i i-sm" aria-hidden="true" />;
  } else if (all.some((b) => b.state === 'saving')) {
    label = 'Saving…';
    icon = <Spinner />;
  } else if (all.some((b) => b.state === 'dirty')) {
    label = 'Edited';
    icon = <span aria-hidden="true" className="dot" />;
  }

  return (
    <span
      role="status"
      className={`flex min-w-0 items-center gap-1.5 text-[12px] whitespace-nowrap ${tone}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}
