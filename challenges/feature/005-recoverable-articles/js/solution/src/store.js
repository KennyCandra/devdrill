//T
//T
//T
export function createStore() {
  let articles = [
    { slug: 'hello-world', title: 'Hello, world', author: 'ana' },
    { slug: 'second-post', title: 'A second post', author: 'ben' },
  ];
  let comments = [
    { slug: 'hello-world', text: 'First!' },
    { slug: 'hello-world', text: 'Nice post.' },
    { slug: 'second-post', text: 'Thanks for this.' },
  ];
  // Kept apart from the articles, so responses never show how deleting works.
  const deleted = new Set();

  const visible = () => articles.filter((a) => !deleted.has(a.slug));
  const find = (slug) => visible().find((a) => a.slug === slug);

  return {
    list: visible,
    byAuthor: (author) => visible().filter((a) => a.author === author),
    find,
    isDeleted: (slug) => deleted.has(slug),
    /** True for every article ever made, deleted or not. */
    slugIsTaken: (slug) => articles.some((a) => a.slug === slug),
    add(article) {
      articles.push(article);
      return article;
    },
    rename(slug, title) {
      articles = articles.map((a) => (a.slug === slug ? { ...a, title } : a));
      return find(slug);
    },
    remove(slug) {
      deleted.add(slug);
    },
    restore(slug) {
      deleted.delete(slug);
      return find(slug);
    },
    commentsOn: (slug) => comments.filter((c) => c.slug === slug),
    addComment(slug, text) {
      const comment = { slug, text };
      comments.push(comment);
      return comment;
    },
    stats: () => ({
      articles: visible().length,
      comments: comments.filter((c) => !deleted.has(c.slug)).length,
    }),
  };
}
