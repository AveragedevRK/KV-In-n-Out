
export interface CardPayment {
  id: string;
  last4: string;
  amount: number;
}

export interface ShippingBreakdown {
  cards: CardPayment[];
  balance: number;
}

export interface PayoutAccount {
  id: string;
  name: string;
  amount: number;
}

export interface PayoutBreakdown {
  accounts: PayoutAccount[];
  total: number;
}

export interface FinancialData {
  date: string; // YYYY-MM-DD
  sales: number;
  sellingFee: number;
  cogs: number;
  shipping: number;
  dailyInvestment: number;
  expectedDailyEarning: number;
  expectedWeeklyPayout: number;
  payoutBreakdown?: PayoutBreakdown; // Optional for backward compatibility
  previousWeeksPayout: number;
  shippingBreakdown: ShippingBreakdown;
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY';
