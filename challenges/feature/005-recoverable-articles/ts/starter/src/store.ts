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

  const find = (slug: string) => articles.find((a) => a.slug === slug);

  return {
    list: () => articles,
    byAuthor: (author: string) => articles.filter((a) => a.author === author),
    find,
    add(article: Article) {
      articles.push(article);
      return article;
    },
    rename(slug: string, title: string) {
      articles = articles.map((a) => (a.slug === slug ? { ...a, title } : a));
      return find(slug);
    },
    remove(slug: string) {
      articles = articles.filter((a) => a.slug !== slug);
      comments = comments.filter((c) => c.slug !== slug);
    },
    commentsOn: (slug: string) => comments.filter((c) => c.slug === slug),
    addComment(slug: string, text: string) {
      const comment = { slug, text };
      comments.push(comment);
      return comment;
    },
    stats: () => ({ articles: articles.length, comments: comments.length }),
  };
}
