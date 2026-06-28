import { NextResponse } from 'next/server'
import { fetchUserAIContext } from '@/lib/supabase/data'
import { getWhatShouldIDoNow } from '@/lib/ai/gemini'

export async function POST() {
  try {
    const context = await fetchUserAIContext()
    const actions = await getWhatShouldIDoNow(context)
    return NextResponse.json(actions)
  } catch (error: any) {
    console.error('What Now API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
