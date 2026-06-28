import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchUserAIContext } from '@/lib/supabase/data'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get logged in user
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch base data
  let context
  try {
    context = await fetchUserAIContext()
  } catch (err) {
    console.error('Error fetching dashboard context:', err)
    // Fallback to empty context
    context = {
      cashBalance: 0,
      income: [],
      expenses: [],
      loans: [],
      cards: [],
      goals: []
    }
  }

  // Fetch payments for additional metrics
  const [{ data: loanPayments }, { data: ccPayments }] = await Promise.all([
    supabase.from('loan_payments').select('*').eq('user_id', user.id).order('payment_date', { ascending: false }),
    supabase.from('credit_card_payments').select('*').eq('user_id', user.id).order('payment_date', { ascending: false })
  ])

  // Get total principal and total paid
  const totalPrincipal = context.loans.reduce((sum, l) => sum + l.principal, 0)
  const totalBalanceRemaining = context.loans.reduce((sum, l) => sum + l.current_balance, 0)
  const totalCCUtilization = context.cards.reduce((sum, c) => sum + c.current_utilization, 0)
  
  const totalDebtRemaining = totalBalanceRemaining + totalCCUtilization
  
  // Calculate Debt Paid: principal - balance + payments
  // E.g., principal reduced: principal - balance
  const principalPaid = Math.max(0, totalPrincipal - totalBalanceRemaining)
  const totalEMI = context.loans.reduce((sum, l) => sum + l.emi, 0) + context.cards.reduce((sum, c) => sum + c.minimum_due, 0)

  // Current month income & expenses
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Get logs to display latest advice
  const { data: latestAdvisorLogs } = await supabase
    .from('advisor_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestAIRecommendation = latestAdvisorLogs && latestAdvisorLogs.length > 0 
    ? latestAdvisorLogs[0].response 
    : "Review your active debts. Click 'WHAT SHOULD I DO NOW?' to generate a customized strategy."

  return (
    <DashboardClient 
      context={context}
      totalDebtRemaining={totalDebtRemaining}
      principalPaid={principalPaid}
      monthlyEMI={totalEMI}
      latestAIRecommendation={latestAIRecommendation}
      loanPayments={loanPayments || []}
      ccPayments={ccPayments || []}
    />
  )
}
