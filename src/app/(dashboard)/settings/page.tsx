import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  // Get logged in user session
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch current user profiles details
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const userMpin = user.user_metadata?.mpin || ''

  return (
    <SettingsClient 
      userId={user.id}
      userEmail={user.email || ''}
      profileName={profile?.name || ''}
      initialMpin={userMpin}
    />
  )
}
