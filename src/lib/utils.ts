import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num)
}

export function calculateDaysRemaining(dueDateDay: number) {
  const today = new Date()
  const currentDay = today.getDate()
  if (currentDay <= dueDateDay) {
    return dueDateDay - currentDay
  } else {
    // next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dueDateDay)
    const diffTime = Math.abs(nextMonth.getTime() - today.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }
}

/**
 * Calculates the implied monthly interest rate using the Bisection Method.
 * Principal = Sum_{t=1}^n [EMI_t / (1 + r)^t]
 */
export function calculateImpliedMonthlyRate(principal: number, payments: number[]): number {
  if (principal <= 0 || payments.length === 0) return 0;
  
  // Total payments must be greater than principal to have positive interest rate
  const totalPaid = payments.reduce((sum, p) => sum + p, 0);
  if (totalPaid <= principal) {
    // If total payments is less than principal, it's 0% (or negative, which we treat as 0% for user-friendly UI)
    return 0;
  }

  let low = 0; // 0%
  let high = 5.0; // 500% monthly interest rate upper limit
  
  const evaluate = (r: number) => {
    let sum = 0;
    for (let t = 0; t < payments.length; t++) {
      sum += payments[t] / Math.pow(1 + r, t + 1);
    }
    return principal - sum;
  };
  
  // Ensure the upper bound is high enough to capture extreme rates
  while (evaluate(high) > 0 && high < 100) {
    high *= 2;
  }
  
  for (let iter = 0; iter < 100; iter++) {
    const mid = (low + high) / 2;
    const fMid = evaluate(mid);
    if (Math.abs(fMid) < 1e-6) {
      return mid;
    }
    if (fMid > 0) {
      // principal is larger than discounted payments, which means interest rate needs to be lower
      high = mid;
    } else {
      low = mid;
    }
  }
  return (low + high) / 2;
}

export interface AmortizationRow {
  month: number;
  startingBalance: number;
  emi: number;
  interestPaid: number;
  principalPaid: number;
  endingBalance: number;
}

/**
 * Generates a full month-by-month amortization schedule
 */
export function getAmortizationSchedule(principal: number, payments: number[], monthlyRate: number): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  let balance = principal;
  
  for (let t = 0; t < payments.length; t++) {
    const emi = payments[t];
    const interestPaid = balance * monthlyRate;
    const principalPaid = emi - interestPaid;
    const endingBalance = Math.max(0, balance - principalPaid);
    
    schedule.push({
      month: t + 1,
      startingBalance: balance,
      emi,
      interestPaid,
      principalPaid,
      endingBalance
    });
    
    balance = endingBalance;
  }
  
  return schedule;
}

export function getRelativeDayOfMonth(year: number, month: number, week: string, dayOfWeek: string): string {
  const daysMap: Record<string, number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  const targetDayOfWeek = daysMap[dayOfWeek] ?? 3; // default to Wednesday
  
  if (week === 'last') {
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = lastDay.getDate();
    const current = new Date(year, month, lastDate);
    while (current.getDay() !== targetDayOfWeek) {
      current.setDate(current.getDate() - 1);
    }
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } else {
    const weekIndex = week === '1st' ? 1 : week === '2nd' ? 2 : week === '3rd' ? 3 : 4;
    let count = 0;
    const current = new Date(year, month, 1);
    while (current.getMonth() === month) {
      if (current.getDay() === targetDayOfWeek) {
        count++;
        if (count === weekIndex) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      }
      current.setDate(current.getDate() + 1);
    }
    // Fallback to 1st of month
    const y = year;
    const m = String(month + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }
}

export function resolveScheduleDueDate(
  startDateStr: string,
  monthIndex: number,
  entry: {
    dueDateType?: 'date' | 'relative';
    dateVal?: string;
    relativeWeek?: string;
    relativeDay?: string;
    dueDay?: number;
  }
): string {
  // Parse startDate. If invalid, use current date
  let startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    startDate = new Date();
  }
  
  const t = monthIndex + 1; // 1-based payment month offset
  const targetYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + t) / 12);
  const targetMonth = (startDate.getMonth() + t) % 12; // 0-11
  
  if (entry.dueDateType === 'relative') {
    const week = entry.relativeWeek || '2nd';
    const day = entry.relativeDay || 'Wednesday';
    return getRelativeDayOfMonth(targetYear, targetMonth, week, day);
  }
  
  // Specific date
  if (entry.dateVal) {
    return entry.dateVal;
  }
  
  // Fallback to dueDay or start date's day of the month
  const dueDay = entry.dueDay || startDate.getDate() || 5;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(dueDay, lastDayOfTargetMonth);
  const targetDate = new Date(targetYear, targetMonth, safeDay);
  
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ScheduleEntry {
  amount: number;
  dueDateType: 'date' | 'relative';
  dateVal: string;
  relativeWeek: '1st' | '2nd' | '3rd' | '4th' | 'last';
  relativeDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  resolvedDate?: string;
}

export interface DetailedAmortizationRow extends AmortizationRow {
  resolvedDate: string;
  dueDateType: 'date' | 'relative';
  dateVal: string;
  relativeWeek: '1st' | '2nd' | '3rd' | '4th' | 'last';
  relativeDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
}

export function parseLoanSchedule(
  notes: string,
  emiFallback: number,
  principal: number,
  duration: number,
  startDateStr: string,
  dueDayFallback: number
) {
  let schedule: ScheduleEntry[] = [];
  let textNotes = notes || '';
  
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.schedule)) {
        schedule = parsed.schedule.map((entry: any) => {
          if (typeof entry === 'number') {
            return {
              amount: entry,
              dueDateType: 'date',
              dateVal: '',
              relativeWeek: '2nd',
              relativeDay: 'Wednesday'
            };
          }
          return {
            amount: Number(entry.amount) || 0,
            dueDateType: entry.dueDateType || 'date',
            dateVal: entry.dateVal || '',
            relativeWeek: entry.relativeWeek || '2nd',
            relativeDay: entry.relativeDay || 'Wednesday'
          };
        });
      }
      textNotes = parsed.text || '';
    }
  } catch {
    // Legacy flat schedule parsing or raw text notes
  }
  
  if (schedule.length === 0) {
    schedule = Array.from({ length: duration }).map(() => ({
      amount: emiFallback,
      dueDateType: 'date',
      dateVal: '',
      relativeWeek: '2nd',
      relativeDay: 'Wednesday'
    }));
  }
  
  // Resolve due dates for all entries in the schedule
  const resolvedSchedule = schedule.map((entry, index) => {
    const resolvedDate = resolveScheduleDueDate(startDateStr, index, {
      dueDateType: entry.dueDateType,
      dateVal: entry.dateVal,
      relativeWeek: entry.relativeWeek,
      relativeDay: entry.relativeDay,
      dueDay: dueDayFallback
    });
    return {
      ...entry,
      resolvedDate
    };
  });
  
  const payments = resolvedSchedule.map(s => s.amount);
  const monthlyRate = calculateImpliedMonthlyRate(principal, payments);
  const impliedAPR = monthlyRate * 12 * 100;
  const scheduleRows = getAmortizationSchedule(principal, payments, monthlyRate);
  
  const detailedRows: DetailedAmortizationRow[] = scheduleRows.map((row, index) => ({
    ...row,
    resolvedDate: resolvedSchedule[index].resolvedDate || '',
    dueDateType: resolvedSchedule[index].dueDateType,
    dateVal: resolvedSchedule[index].dateVal,
    relativeWeek: resolvedSchedule[index].relativeWeek,
    relativeDay: resolvedSchedule[index].relativeDay
  }));
  
  return {
    schedule: resolvedSchedule,
    textNotes,
    impliedAPR,
    scheduleRows: detailedRows
  };
}

export function calculateDaysUntilDate(targetDateStr: string): number {
  if (!targetDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  
  if (isNaN(target.getTime())) return 0;
  
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isCardPaidThisStatement(card: any, payments: any[]): boolean {
  if (Number(card.current_utilization) === 0) return true;
  
  const today = new Date();
  const currentDay = today.getDate();
  
  // Find the next due date's month and year
  let nextDueDateMonth = today.getMonth();
  let nextDueDateYear = today.getFullYear();
  if (currentDay > card.due_date) {
    nextDueDateMonth += 1;
    if (nextDueDateMonth > 11) {
      nextDueDateMonth = 0;
      nextDueDateYear += 1;
    }
  }
  
  // Find the statement date corresponding to this upcoming due date
  let statementDate: Date;
  if (card.statement_date < card.due_date) {
    statementDate = new Date(nextDueDateYear, nextDueDateMonth, card.statement_date);
  } else {
    // Statement was generated in the previous month
    let stmtMonth = nextDueDateMonth - 1;
    let stmtYear = nextDueDateYear;
    if (stmtMonth < 0) {
      stmtMonth = 11;
      stmtYear -= 1;
    }
    statementDate = new Date(stmtYear, stmtMonth, card.statement_date);
  }
  
  // Format statementDate to YYYY-MM-DD for string comparison
  const year = statementDate.getFullYear();
  const month = String(statementDate.getMonth() + 1).padStart(2, '0');
  const day = String(statementDate.getDate()).padStart(2, '0');
  const statementDateStr = `${year}-${month}-${day}`;
  
  // Sum payments made on or after the statement date
  const cardPayments = payments.filter(
    (p: any) => p.credit_card_id === card.id && p.payment_date >= statementDateStr
  );
  
  const totalPaid = cardPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  
  // If minimum_due is 0, we consider it paid if there's any payment, or if utilization is 0 (which was checked above).
  // Otherwise, compare totalPaid against minimum_due.
  const requiredAmount = card.minimum_due > 0 ? card.minimum_due : 1;
  return totalPaid >= requiredAmount;
}

export function getLocalTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateToLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isCardPaidForCycle(card: any, payments: any[], Y: number, M: number): boolean {
  if (Number(card.current_utilization) === 0) return true;

  let statementStartDate: Date;
  if (card.statement_date < card.due_date) {
    statementStartDate = new Date(Y, M, card.statement_date);
  } else {
    // Statement was in the previous month
    let stmtMonth = M - 1;
    let stmtYear = Y;
    if (stmtMonth < 0) {
      stmtMonth = 11;
      stmtYear -= 1;
    }
    statementStartDate = new Date(stmtYear, stmtMonth, card.statement_date);
  }

  let statementEndDate: Date;
  if (card.statement_date < card.due_date) {
    statementEndDate = new Date(Y, M + 1, card.statement_date);
  } else {
    statementEndDate = new Date(Y, M, card.statement_date);
  }

  const startStr = formatDateToLocalYYYYMMDD(statementStartDate);
  const endStr = formatDateToLocalYYYYMMDD(statementEndDate);

  const cyclePayments = payments.filter(
    (p: any) => p.credit_card_id === card.id && p.payment_date >= startStr && p.payment_date < endStr
  );

  const totalPaid = cyclePayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const requiredAmount = card.minimum_due > 0 ? card.minimum_due : 1;
  return totalPaid >= requiredAmount;
}


