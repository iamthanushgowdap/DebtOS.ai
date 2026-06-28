import { NextResponse } from 'next/server'
import { fetchUserAIContext } from '@/lib/supabase/data'
import { getGotMoneyAllocation } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  try {
    const { amount } = await request.json()
    if (amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Invalid or missing amount' }, { status: 400 })
    }
    const context = await fetchUserAIContext()
    const allocation = await getGotMoneyAllocation(context, Number(amount))
    return NextResponse.json(allocation)
  } catch (error: any) {
    console.error('Got Money API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
