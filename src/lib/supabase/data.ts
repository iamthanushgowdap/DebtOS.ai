import { createClient } from './server'
import { AIContext } from '../ai/gemini'

export async function fetchUserAIContext(): Promise<AIContext> {
  const supabase = await createClient()

  // Get current user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized or not logged in')
  }

  // Fetch profiles, loans, credit cards, income, expenses, and goals
  const [
    { data: profile },
    { data: loans },
    { data: cards },
    { data: income },
    { data: expenses },
    { data: goals }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('loans').select('*').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('credit_cards').select('*').eq('user_id', user.id),
    supabase.from('income_entries').select('*').eq('user_id', user.id),
    supabase.from('expense_entries').select('*').eq('user_id', user.id),
    supabase.from('goals').select('*').eq('user_id', user.id)
  ])

  // Calculate Cash Balance: Received Income - Expenses - Paid EMIs - Credit Card Payments
  // (Or fallback to a standard default value or a profile-level cash setting if defined)
  const totalReceivedIncome = (income || []).reduce(
    (sum, inc) => sum + (inc.status === 'received' ? Number(inc.received_amount) : 0),
    0
  )
  const totalExpenses = (expenses || []).reduce(
    (sum, exp) => sum + (exp.credit_card_id ? 0 : Number(exp.amount)),
    0
  )

  // Fetch payments to subtract
  const [{ data: loanPayments }, { data: ccPayments }] = await Promise.all([
    supabase.from('loan_payments').select('amount').eq('user_id', user.id),
    supabase.from('credit_card_payments').select('amount').eq('user_id', user.id)
  ])

  const totalLoanPayments = (loanPayments || []).reduce((sum, pay) => sum + Number(pay.amount), 0)
  const totalCCPayments = (ccPayments || []).reduce((sum, pay) => sum + Number(pay.amount), 0)

  // Let's compute calculated cash: starting from a default base of 0 or a reasonable minimum
  // In a real app we can let them log cash, or calculate it. We'll set a base cash of ₹50,000 if ledger is empty,
  // or calculate: totalReceivedIncome - totalExpenses - totalLoanPayments - totalCCPayments
  const calculatedCash = Math.max(0, totalReceivedIncome - totalExpenses - totalLoanPayments - totalCCPayments)

  return {
    cashBalance: calculatedCash, // default to 0 if ledger is empty
    income: (income || []).map((inc) => ({
      source: inc.source,
      expected: Number(inc.expected_amount),
      received: Number(inc.received_amount),
      status: inc.status
    })),
    expenses: (expenses || []).map((exp) => ({
      category: exp.category,
      amount: Number(exp.amount),
      description: exp.description || '',
      credit_card_id: exp.credit_card_id || null
    })),
    loans: (loans || []).map((l) => ({
      id: l.id,
      name: l.name,
      lender: l.lender,
      loan_type: l.loan_type,
      principal: Number(l.principal),
      current_balance: Number(l.current_balance),
      interest_rate: Number(l.interest_rate),
      emi: Number(l.emi),
      due_day: Number(l.due_day),
      priority: l.priority,
      start_date: l.start_date,
      end_date: l.end_date,
      notes: l.notes
    })),
    cards: (cards || []).map((c) => ({
      id: c.id,
      card_name: c.card_name,
      bank: c.bank,
      credit_limit: Number(c.credit_limit),
      current_utilization: Number(c.current_utilization),
      minimum_due: Number(c.minimum_due),
      statement_date: Number(c.statement_date),
      due_date: Number(c.due_date),
      status: c.status
    })),
    goals: (goals || []).map((g) => ({
      name: g.name,
      target_amount: Number(g.target_amount),
      current_amount: Number(g.current_amount),
      target_date: g.target_date,
      required_monthly_reduction: Number(g.required_monthly_reduction)
    }))
  }
}
