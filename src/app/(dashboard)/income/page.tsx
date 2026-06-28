import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import IncomeClient from './IncomeClient'

export default async function IncomePage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch income entries
  const { data: incomeEntries } = await supabase
    .from('income_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })

  return (
    <IncomeClient 
      userId={user.id}
      initialEntries={incomeEntries || []}
    />
  )
}
