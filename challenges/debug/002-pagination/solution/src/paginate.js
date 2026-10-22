// Splits a list into pages. Pages are numbered from 1, like the page links users click.
export function paginate(items, page, pageSize = 10) {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('page must be a whole number, starting at 1');
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    page,
    pageSize,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}
