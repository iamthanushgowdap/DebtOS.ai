import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExpenseClient from './ExpenseClient'

export default async function ExpensePage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch expense entries and active credit cards
  const [
    { data: expenseEntries },
    { data: cards }
  ] = await Promise.all([
    supabase
      .from('expense_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false }),
    supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
  ])

  return (
    <ExpenseClient 
      userId={user.id}
      initialEntries={expenseEntries || []}
      cards={cards || []}
    />
  )
}
