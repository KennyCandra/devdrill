import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson,
  FileText,
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

export function FileTree({
  files,
  activePath,
  dirtyPaths,
  onOpen,
}: {
  files: string[];
  activePath: string | null;
  dirtyPaths: Set<string>;
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

  const render = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const indent = { paddingLeft: 8 + depth * 12 };
      if (node.children) {
        const open = !collapsed.has(node.path);
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => toggle(node.path)}
              aria-expanded={open}
              style={indent}
              className="flex w-full items-center gap-1 py-0.5 pr-2 text-left hover:bg-hover"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {node.name}
            </button>
            {open && <ul>{render(node.children, depth + 1)}</ul>}
          </li>
        );
      }
      const active = node.path === activePath;
      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => onOpen(node.path)}
            aria-current={active ? 'true' : undefined}
            style={{ paddingLeft: indent.paddingLeft + 14 }}
            className={`flex w-full items-center gap-1.5 py-0.5 pr-2 text-left ${
              active ? 'bg-active text-fg' : 'hover:bg-hover'
            }`}
          >
            <FileIcon name={node.name} />
            <span className="truncate">{node.name}</span>
            {dirtyPaths.has(node.path) && (
              <span className="ml-auto size-1.5 rounded-full bg-fg" aria-label="Unsaved" />
            )}
          </button>
        </li>
      );
    });

  return (
    <nav aria-label="Files" className="h-full overflow-auto bg-side py-1 font-mono text-[12px]">
      <div className="px-3 pt-1 pb-2 font-sans text-[11px] font-semibold tracking-wide text-muted uppercase">
        Files
      </div>
      <ul>{render(tree, 0)}</ul>
    </nav>
  );
}

function FileIcon({ name }: { name: string }) {
  const props = { size: 14, className: 'shrink-0 text-muted', 'aria-hidden': true } as const;
  if (/\.(test|spec)\.[cm]?js$/.test(name)) return <FlaskConical {...props} />;
  if (name.endsWith('.json')) return <FileJson {...props} />;
  if (/\.[cm]?js$/.test(name)) return <FileCode2 {...props} className="shrink-0 text-warning" />;
  return <FileText {...props} />;
}
