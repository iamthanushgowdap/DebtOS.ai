import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdvisorClient from './AdvisorClient'

export default async function AdvisorPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch past advisor logs to display history
  const { data: logs } = await supabase
    .from('advisor_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const hasApiKey = !!process.env.GEMINI_API_KEY

  return (
    <AdvisorClient 
      userId={user.id}
      initialLogs={logs || []}
      hasApiKey={hasApiKey}
    />
  )
}
