import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GoalsClient from './GoalsClient'

export default async function GoalsPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch goals
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch income/expenses/loans to calculate monthly surplus
  const [
    { data: income },
    { data: expenses },
    { data: loans },
    { data: cards }
  ] = await Promise.all([
    supabase.from('income_entries').select('*').eq('user_id', user.id).eq('status', 'received'),
    supabase.from('expense_entries').select('*').eq('user_id', user.id),
    supabase.from('loans').select('*').eq('user_id', user.id).eq('status', 'active'),
    supabase.from('credit_cards').select('*').eq('user_id', user.id)
  ])

  const totalMonthlyIncome = (income || []).reduce((sum, i) => sum + Number(i.received_amount), 0)
  const totalMonthlyExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0)
  const totalEMIs = ((loans || []).reduce((sum, l) => sum + Number(l.emi), 0) + 
                    (cards || []).reduce((sum, c) => sum + Number(c.minimum_due), 0))

  const monthlySurplus = Math.max(0, totalMonthlyIncome - totalMonthlyExpenses - totalEMIs)

  return (
    <GoalsClient 
      userId={user.id}
      initialGoals={goals || []}
      monthlySurplus={monthlySurplus}
    />
  )
}
