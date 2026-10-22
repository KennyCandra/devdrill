import { X } from 'lucide-react';

/** Open files, like VS Code's editor tabs. Plain buttons: there is no tab panel to control. */
export function EditorTabs({
  tabs,
  active,
  unsaved,
  onSelect,
  onClose,
}: {
  tabs: string[];
  active: string | null;
  unsaved: Set<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <nav aria-label="Open files" className="flex h-8 shrink-0 overflow-x-auto bg-bar">
      {tabs.map((path) => {
        const selected = path === active;
        const isUnsaved = unsaved.has(path);
        const name = path.split('/').pop();
        return (
          <div
            key={path}
            className={`group flex items-center gap-1 border-r border-line pr-1 pl-3 font-mono text-[12px] ${
              selected ? 'bg-bg text-fg' : 'text-muted hover:bg-hover'
            }`}
          >
            <button
              type="button"
              aria-current={selected ? 'page' : undefined}
              title={path}
              onClick={() => onSelect(path)}
              className="rounded focus-visible:outline-2 focus-visible:outline-accent"
            >
              {name}
              {isUnsaved && <span className="sr-only"> (unsaved)</span>}
            </button>
            <button
              type="button"
              onClick={() => onClose(path)}
              aria-label={`Close ${name}`}
              className="flex size-5 items-center justify-center rounded hover:bg-active focus-visible:outline-2 focus-visible:outline-accent"
            >
              {isUnsaved && (
                <span aria-hidden="true" className="size-2 rounded-full bg-fg group-hover:hidden" />
              )}
              <X
                size={12}
                aria-hidden="true"
                className={isUnsaved ? 'hidden group-hover:block' : ''}
              />
            </button>
          </div>
        );
      })}
    </nav>
  );
}
