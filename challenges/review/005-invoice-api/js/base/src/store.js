//T
//T
//T
//T
export function createStore() {
  const users = [
    { id: 1, token: 'ana-token' },
    { id: 2, token: 'ben-token' },
  ];
  const invoices = [
    { id: 10, customerId: 1, number: 'A-10' },
    { id: 11, customerId: 1, number: 'A-11' },
    { id: 20, customerId: 2, number: 'B-20' },
  ];
  const lines = [
    { invoiceId: 10, amountCents: 1500 },
    { invoiceId: 10, amountCents: 250 },
    { invoiceId: 11, amountCents: 900 },
    { invoiceId: 20, amountCents: 4000 },
  ];

  return {
    findUserByToken: async (token) => users.find((u) => u.token === token),
    invoicesOf: async (customerId) =>
      invoices.filter((i) => i.customerId === customerId),
    findInvoice: async (id) => invoices.find((i) => i.id === id),
    linesOf: async (invoiceId) => lines.filter((l) => l.invoiceId === invoiceId),
  };
}
