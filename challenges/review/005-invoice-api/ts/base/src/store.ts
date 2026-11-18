export interface User {
  id: number;
  token: string;
}
//T
export interface Invoice {
  id: number;
  customerId: number;
  number: string;
}
//T
export interface InvoiceLine {
  invoiceId: number;
  amountCents: number;
}
//T
export type Store = ReturnType<typeof createStore>;
//T
export function createStore() {
  const users: User[] = [
    { id: 1, token: 'ana-token' },
    { id: 2, token: 'ben-token' },
  ];
  const invoices: Invoice[] = [
    { id: 10, customerId: 1, number: 'A-10' },
    { id: 11, customerId: 1, number: 'A-11' },
    { id: 20, customerId: 2, number: 'B-20' },
  ];
  const lines: InvoiceLine[] = [
    { invoiceId: 10, amountCents: 1500 },
    { invoiceId: 10, amountCents: 250 },
    { invoiceId: 11, amountCents: 900 },
    { invoiceId: 20, amountCents: 4000 },
  ];

  return {
    findUserByToken: async (token: string) => users.find((u) => u.token === token),
    invoicesOf: async (customerId: number) =>
      invoices.filter((i) => i.customerId === customerId),
    findInvoice: async (id: number) => invoices.find((i) => i.id === id),
    linesOf: async (invoiceId: number) => lines.filter((l) => l.invoiceId === invoiceId),
  };
}
