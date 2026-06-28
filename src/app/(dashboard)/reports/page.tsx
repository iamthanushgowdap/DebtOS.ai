import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch all tables to compile comprehensive reports
  const [
    { data: loans },
    { data: cards },
    { data: income },
    { data: expenses },
    { data: loanPayments },
    { data: cardPayments }
  ] = await Promise.all([
    supabase.from('loans').select('*').eq('user_id', user.id),
    supabase.from('credit_cards').select('*').eq('user_id', user.id),
    supabase.from('income_entries').select('*').eq('user_id', user.id),
    supabase.from('expense_entries').select('*').eq('user_id', user.id),
    supabase.from('loan_payments').select('*, loans(name)').eq('user_id', user.id),
    supabase.from('credit_card_payments').select('*, credit_cards(card_name)').eq('user_id', user.id)
  ])

  return (
    <ReportsClient 
      loans={loans || []}
      cards={cards || []}
      income={income || []}
      expenses={expenses || []}
      loanPayments={loanPayments || []}
      cardPayments={cardPayments || []}
    />
  )
}
