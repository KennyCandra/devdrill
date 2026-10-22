import type { FileBuffer } from './fileStore';

/** "All changes saved" / "Saving…" / errors, in the top bar. */
export function SaveIndicator({ buffers }: { buffers: Record<string, FileBuffer> }) {
  const all = Object.values(buffers);
  const failed = all.find((b) => b.state === 'error');

  let label = 'All changes saved';
  let tone = 'text-muted';
  if (all.some((b) => b.state === 'conflict')) {
    label = 'File changed elsewhere';
    tone = 'text-danger';
  } else if (failed) {
    label = failed.error ?? "Couldn't save";
    tone = 'text-danger';
  } else if (all.some((b) => b.state === 'saving')) {
    label = 'Saving…';
  } else if (all.some((b) => b.state === 'dirty')) {
    label = 'Edited';
  }

  return (
    <span role="status" className={`min-w-0 truncate text-[12px] whitespace-nowrap ${tone}`}>
      {label}
    </span>
  );
}
