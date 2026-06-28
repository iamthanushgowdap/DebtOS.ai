import { NextResponse } from 'next/server'
import { fetchUserAIContext } from '@/lib/supabase/data'
import { getEmergencyAnalysis } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  try {
    const { walletBalance } = await request.json()
    if (walletBalance === undefined || isNaN(Number(walletBalance))) {
      return NextResponse.json({ error: 'Invalid or missing wallet balance' }, { status: 400 })
    }
    const context = await fetchUserAIContext()
    const analysis = await getEmergencyAnalysis(context, Number(walletBalance))
    return NextResponse.json(analysis)
  } catch (error: any) {
    console.error('Emergency API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
