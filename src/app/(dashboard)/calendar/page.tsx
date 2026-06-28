import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch loans, payments, cards, and card payments to cross-reference dues
  const [
    { data: loans },
    { data: payments },
    { data: cards },
    { data: ccPayments }
  ] = await Promise.all([
    supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('loan_payments')
      .select('*')
      .eq('user_id', user.id),
    supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id),
    supabase
      .from('credit_card_payments')
      .select('*')
      .eq('user_id', user.id)
  ])

  return (
    <CalendarClient 
      userId={user.id}
      loans={loans || []}
      initialPayments={payments || []}
      cards={cards || []}
      initialCcPayments={ccPayments || []}
    />
  )
}
