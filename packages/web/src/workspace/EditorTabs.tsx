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
    <nav aria-label="Open files" className="flex h-9 shrink-0 overflow-x-auto bg-bar">
      {tabs.map((path) => {
        const selected = path === active;
        const isUnsaved = unsaved.has(path);
        const name = path.split('/').pop();
        return (
          <div key={path} className={`ftab group ${selected ? 'on' : ''}`}>
            <button
              type="button"
              aria-current={selected ? 'page' : undefined}
              title={path}
              onClick={() => onSelect(path)}
              className="rounded font-mono focus-visible:outline-2 focus-visible:outline-accent"
            >
              {name}
              {isUnsaved && <span className="sr-only"> (unsaved)</span>}
            </button>
            <button
              type="button"
              onClick={() => onClose(path)}
              aria-label={`Close ${name}`}
              className="x hover:bg-active focus-visible:outline-2 focus-visible:outline-accent"
            >
              {isUnsaved && <span aria-hidden="true" className="dot group-hover:hidden" />}
              <X
                size={14}
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
