import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CardsClient from './CardsClient'

export default async function CardsPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch credit cards and card payments history
  const [
    { data: cards },
    { data: payments }
  ] = await Promise.all([
    supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('current_utilization', { ascending: false }), // highest debt first
    supabase
      .from('credit_card_payments')
      .select('*, credit_cards(card_name)')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })
  ])

  return (
    <CardsClient 
      userId={user.id}
      initialCards={cards || []}
      initialPayments={payments || []}
    />
  )
}
