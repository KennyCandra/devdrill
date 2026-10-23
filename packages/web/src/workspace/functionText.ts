export /**
 * True when what's assigned is itself a function: `total = (a) => …`, `load: async () => …`,
 * `x = function …`; not `xs = items.map((x) => …)`.
 */
function holdsFunction(declaration: string): boolean {
  const value = declaration.replace(/^[^=:]*[=:]/, '');
  return /^\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[\w$]+\s*=>)/.test(value);
}
