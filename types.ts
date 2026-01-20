
export interface BoletoData {
  supplier: string;
  payer: string;
  originalValue: number;
  dueDate: string;
  paymentDate: string;
  finePercent: number;
}

export interface CalculationResult {
  daysLate: number;
  interestValue: number;
  fineValue: number;
  updatedTotal: number;
  isLate: boolean;
}
