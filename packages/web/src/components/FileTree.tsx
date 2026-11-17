import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FlaskConical,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[] | null; // null for files
}

/** Turns ['src/a.js', 'tests/b.test.js'] into a folder tree, folders first. */
export function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const file of files) {
    let node = root;
    const parts = file.split('/');
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');
      let child = node.children!.find((c) => c.name === part && (c.children === null) === isFile);
      if (!child) {
        child = { name: part, path, children: isFile ? null : [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) =>
        (a.children === null) === (b.children === null)
          ? a.name.localeCompare(b.name)
          : a.children === null
            ? 1
            : -1,
      )
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

/**
 * `virtualFiles` are listed first, above the folders, for files the page shows that are not
 * on disk (the README). They open like any file but have no unsaved state.
 */
export function FileTree({
  files,
  virtualFiles = [],
  activePath,
  unsaved,
  onOpen,
}: {
  files: string[];
  virtualFiles?: string[];
  activePath: string | null;
  unsaved: Set<string>;
  onOpen: (path: string) => void;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const fileItem = (path: string, name: string, depth: number) => {
    const active = path === activePath;
    const indent = 10 + depth * 14;
    return (
      <li key={path}>
        <button
          type="button"
          onClick={() => onOpen(path)}
          aria-current={active ? 'true' : undefined}
          style={{ paddingLeft: indent + 14 }}
          className={`tree-item w-[calc(100%-12px)] text-left ${active ? 'on' : ''}`}
        >
          <FileIcon name={name} />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {unsaved.has(path) && (
            <>
              <span aria-hidden="true" className="dot" />
              <span className="sr-only"> (unsaved)</span>
            </>
          )}
        </button>
      </li>
    );
  };

  const render = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indent = 10 + depth * 14;
      if (node.children) {
        const open = !collapsed.has(node.path);
        const Chevron = open ? ChevronDown : ChevronRight;
        const FolderIcon = open ? FolderOpen : Folder;
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => toggle(node.path)}
              aria-expanded={open}
              style={{ paddingLeft: indent }}
              className="tree-item w-[calc(100%-12px)] text-left"
            >
              <Chevron className="i i-sm subtle" aria-hidden="true" />
              <FolderIcon className="i i-sm subtle" aria-hidden="true" />
              <span className="truncate">{node.name}</span>
            </button>
            {open && <ul>{render(node.children, depth + 1)}</ul>}
          </li>
        );
      }
      return fileItem(node.path, node.name, depth);
    });

  return (
    <nav aria-label="Files" className="panel flex h-full flex-col">
      <div className="panel-header">
        <span className="panel-title">Files</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto py-2">
        {virtualFiles.map((path) => fileItem(path, path, 0))}
        {render(tree, 0)}
      </ul>
    </nav>
  );
}

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** A test file gets a flask; source files get a small JS or TS badge; anything else a page. */
function FileIcon({ name }: { name: string }) {
  if (TEST_FILE.test(name)) {
    return <FlaskConical className="i i-sm shrink-0 text-mode-feature" aria-hidden="true" />;
  }
  if (/\.[cm]?jsx?$/.test(name)) {
    return (
      <span
        aria-hidden="true"
        className="mono w-3.5 shrink-0 text-center text-[9.5px] font-semibold text-mode-debug"
      >
        JS
      </span>
    );
  }
  if (/\.[cm]?tsx?$/.test(name)) {
    return (
      <span
        aria-hidden="true"
        className="mono w-3.5 shrink-0 text-center text-[9.5px] font-semibold text-info"
      >
        TS
      </span>
    );
  }
  return <FileText className="i i-sm subtle shrink-0" aria-hidden="true" />;
}
