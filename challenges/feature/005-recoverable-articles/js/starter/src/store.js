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

  const find = (slug) => articles.find((a) => a.slug === slug);

  return {
    list: () => articles,
    byAuthor: (author) => articles.filter((a) => a.author === author),
    find,
    add(article) {
      articles.push(article);
      return article;
    },
    rename(slug, title) {
      articles = articles.map((a) => (a.slug === slug ? { ...a, title } : a));
      return find(slug);
    },
    remove(slug) {
      articles = articles.filter((a) => a.slug !== slug);
      comments = comments.filter((c) => c.slug !== slug);
    },
    commentsOn: (slug) => comments.filter((c) => c.slug === slug),
    addComment(slug, text) {
      const comment = { slug, text };
      comments.push(comment);
      return comment;
    },
    stats: () => ({ articles: articles.length, comments: comments.length }),
  };
}
