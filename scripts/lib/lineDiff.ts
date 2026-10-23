import ts from 'typescript';
import type { LineRange } from '@devdrill/shared';

/**
 * The 1-based line numbers in `head` that a pull request added or changed, from a
 * longest-common-subsequence line diff against `base` (null: the file is new).
 * Challenge files are small, so the O(n·m) table is fine.
 */
export function changedLines(base: string | null, head: string): Set<number> {
  const a = base === null ? [] : base.split('\n');
  const b = head.split('\n');
  const n = a.length;
  const m = b.length;
  // lcs[i][j]: length of the common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  const at = (i: number, j: number) => lcs[i]?.[j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const changed = new Set<number>();
  let i = 0;
  let j = 0;
  while (j < m) {
    if (i < n && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < n && at(i + 1, j) >= at(i, j + 1)) {
      i++; // a line only base has (removed)
    } else {
      changed.add(j + 1); // a line only head has (added or changed)
      j++;
    }
  }
  return changed;
}

/**
 * Where each named function in a file starts and ends (1-based lines): function
 * declarations, methods, and functions assigned to a variable or property.
 * A name can appear more than once (e.g. methods of two classes).
 */
export function functionSpans(fileName: string, source: string): Map<string, LineRange[]> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const spans = new Map<string, LineRange[]>();
  const lineOf = (pos: number) => file.getLineAndCharacterOfPosition(pos).line + 1;
  const add = (name: string, node: ts.Node) => {
    const range: LineRange = [lineOf(node.getStart(file)), lineOf(node.getEnd())];
    spans.set(name, [...(spans.get(name) ?? []), range]);
  };
  const isFunction = (node: ts.Node | undefined) =>
    node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
      add(node.name.getText(file), node);
    } else if (ts.isVariableStatement(node)) {
      // `export const total = (...) => {...}`: the whole statement is the function.
      const [only, ...rest] = node.declarationList.declarations;
      if (only && rest.length === 0 && isFunction(only.initializer)) {
        add(only.name.getText(file), node);
      }
    } else if (ts.isPropertyAssignment(node) && isFunction(node.initializer)) {
      add(node.name.getText(file), node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return spans;
}
