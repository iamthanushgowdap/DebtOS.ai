import { NextResponse } from 'next/server'
import { fetchUserAIContext } from '@/lib/supabase/data'
import { askAdvisor } from '@/lib/ai/gemini'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    if (!query) {
      return NextResponse.json({ error: 'Query is missing' }, { status: 400 })
    }
    
    const context = await fetchUserAIContext()
    const response = await askAdvisor(context, query)

    // Log the transaction to advisor_logs in database
    try {
      const supabase = await createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('advisor_logs').insert({
          user_id: user.id,
          query,
          response: response.answer || JSON.stringify(response),
          type: 'general'
        })
      }
    } catch (logErr) {
      console.error('Failed to log advisor interaction:', logErr)
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Advisor API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
