import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A select that matches the app instead of the operating system's menu.
 * Keyboard: Enter/Space/↓ opens; ↑/↓/Home/End move; Enter picks; Escape or Tab closes.
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  defaultValue,
}: {
  /** Accessible name, e.g. "Difficulty". */
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** The "no filter" value; anything else gets the active style. */
  defaultValue?: T;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const active = defaultValue !== undefined && value !== defaultValue;

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const openList = () => {
    setHighlighted(selectedIndex);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close(true);
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(highlighted + 1, last),
      ArrowUp: Math.max(highlighted - 1, 0),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setHighlighted(moves[e.key]!);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(highlighted);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${options[selectedIndex]?.label ?? ''}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onButtonKey}
        className={`flex h-7 items-center gap-1.5 rounded border px-2 transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-accent ${
          active
            ? 'border-accent bg-active text-fg'
            : 'border-line text-fg hover:border-line-strong hover:bg-hover'
        }`}
      >
        {options[selectedIndex]?.label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${listId}-${highlighted}`}
          tabIndex={-1}
          onKeyDown={onListKey}
          className="animate-fade-in absolute top-full left-0 z-20 mt-1 min-w-full overflow-hidden rounded-md border border-line-strong bg-side py-1 shadow-lg shadow-black/30 outline-none"
        >
          {options.map((option, i) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setHighlighted(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-2 px-2 py-1 whitespace-nowrap ${
                  i === highlighted ? 'bg-accent-bg text-on-accent' : 'text-fg'
                }`}
              >
                <Check
                  size={13}
                  aria-hidden="true"
                  className={selected ? 'opacity-100' : 'opacity-0'}
                />
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
