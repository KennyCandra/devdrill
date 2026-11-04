//T
//T
export function createStore(texts = ['Hello', 'Anyone here?', 'Yes!']) {
  let messages = texts.map((text, i) => ({ id: i + 1, text }));
  let nextId = texts.length + 1;

  return {
    list: () => messages,
    add(text) {
      const message = { id: nextId++, text };
      messages.push(message);
      return message;
    },
    remove(id) {
      const before = messages.length;
      messages = messages.filter((m) => m.id !== id);
      return messages.length < before;
    },
  };
}
