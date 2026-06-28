import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoansClient from './LoansClient'

export default async function LoansPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch loans & historical payments
  const [
    { data: loans },
    { data: payments }
  ] = await Promise.all([
    supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false }), // sort high to low
    supabase
      .from('loan_payments')
      .select('*, loans(name)')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })
  ])

  return (
    <LoansClient 
      userId={user.id}
      initialLoans={loans || []}
      initialPayments={payments || []}
    />
  )
}
