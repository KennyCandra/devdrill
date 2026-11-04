export interface Article {
  slug: string;
  title: string;
  author: string;
}
//T
export interface Comment {
  slug: string;
  text: string;
}
//T
export type Store = ReturnType<typeof createStore>;
//T
export function createStore() {
  let articles: Article[] = [
    { slug: 'hello-world', title: 'Hello, world', author: 'ana' },
    { slug: 'second-post', title: 'A second post', author: 'ben' },
  ];
  let comments: Comment[] = [
    { slug: 'hello-world', text: 'First!' },
    { slug: 'hello-world', text: 'Nice post.' },
    { slug: 'second-post', text: 'Thanks for this.' },
  ];
  // Kept apart from the articles, so responses never show how deleting works.
  const deleted = new Set<string>();

  const visible = () => articles.filter((a) => !deleted.has(a.slug));
  const find = (slug: string) => visible().find((a) => a.slug === slug);

  return {
    list: visible,
    byAuthor: (author: string) => visible().filter((a) => a.author === author),
    find,
    isDeleted: (slug: string) => deleted.has(slug),
    /** True for every article ever made, deleted or not. */
    slugIsTaken: (slug: string) => articles.some((a) => a.slug === slug),
    add(article: Article) {
      articles.push(article);
      return article;
    },
    rename(slug: string, title: string) {
      articles = articles.map((a) => (a.slug === slug ? { ...a, title } : a));
      return find(slug);
    },
    remove(slug: string) {
      deleted.add(slug);
    },
    restore(slug: string) {
      deleted.delete(slug);
      return find(slug);
    },
    commentsOn: (slug: string) => comments.filter((c) => c.slug === slug),
    addComment(slug: string, text: string) {
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
