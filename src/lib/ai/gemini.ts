import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize the Gemini API client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is missing in env. Falling back to mock responses or failing.')
  }
  return new GoogleGenerativeAI(apiKey || 'MOCK_KEY')
}

// System context to ensure Gemini behaves like an expert financial advisor for DebtOS AI
const BASE_FINANCIAL_EXPERT_SYSTEM_INSTRUCTION = `
You are the DebtOS AI Financial Advisor, a world-class personal finance and debt reduction expert. 
Your goal is to help a single user manage their debt (loans, EMIs, credit cards), track income and expenses, and formulate optimized repayment plans using methodologies like Debt Snowball or Debt Avalanche.
You always prioritize:
1. Staying whitelisted within the user's budget and cash constraints.
2. Avoiding high utilization on credit cards (keep utilization < 30%, flag > 70% as high risk).
3. Paying off high-interest debts first (Avalanche) or small-balance debts for psychological wins (Snowball).
4. Keeping an emergency fund buffer.
5. Remaining highly structured, concise, and realistic. Never make false assumptions. All amounts are in Indian Rupees (INR).
`

// Interface definitions for inputs
export interface AIContext {
  cashBalance: number
  income: { source: string; expected: number; received: number; status: string }[]
  expenses: { category: string; amount: number; description: string; credit_card_id?: string | null }[]
  loans: {
    id: string
    name: string
    lender: string
    loan_type: string
    principal: number
    current_balance: number
    interest_rate: number
    emi: number
    due_day: number
    priority: string
    start_date?: string
    end_date?: string
    notes?: string
  }[]
  cards: {
    id: string
    card_name: string
    bank: string
    credit_limit: number
    current_utilization: number
    minimum_due: number
    statement_date: number
    due_date: number
    status: string
    bill_due?: number
    interest_rate?: number
    statement_date_full?: string
    due_date_full?: string
  }[]
  goals: {
    name: string
    target_amount: number
    current_amount: number
    target_date: string
    required_monthly_reduction: number
  }[]
}

// 1. Get Money Cash Allocation
export async function getGotMoneyAllocation(context: AIContext, amount: number) {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  })

  const prompt = `
    ${BASE_FINANCIAL_EXPERT_SYSTEM_INSTRUCTION}
    
    TASK: The user just received an unexpected lump sum of ₹${amount}. Allocate this amount across:
    1. Debt repayment (paying off loans or credit card balances)
    2. Emergency buffer (saving for unexpected situations)
    3. Savings (building wealth/general savings)
    4. Personal spending (guilt-free leisure spending)
    
    Here is the user's current financial situation:
    - Available Cash: ₹${context.cashBalance}
    - Loans: ${JSON.stringify(context.loans)}
    - Credit Cards: ${JSON.stringify(context.cards)}
    - Active Income Entries: ${JSON.stringify(context.income)}
    - Monthly Expenses: ${JSON.stringify(context.expenses)}
    - Goals: ${JSON.stringify(context.goals)}
    
    Provide a detailed JSON response exactly matching the schema:
    {
      "allocation": {
        "debtRepayment": number,
        "emergencyBuffer": number,
        "savings": number,
        "personalSpending": number
      },
      "explanation": "Brief explanation of why this division was chosen based on their high interest cards, loans, or low cash state.",
      "recommendedAction": "Exactly where should they put the debt repayment portion (e.g. 'Pay ₹X towards Lender Y because interest rate is Z%')."
    }
    
    Note: The sum of debtRepayment, emergencyBuffer, savings, and personalSpending MUST EXACTLY EQUAL ${amount}.
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text)
  } catch (error: any) {
    console.error('Gemini error in Got Money:', error)
    return {
      allocation: {
        debtRepayment: 0,
        emergencyBuffer: 0,
        savings: 0,
        personalSpending: 0
      },
      explanation: `Gemini allocation request failed: ${error.message || error.toString()}`,
      recommendedAction: 'Ensure your GEMINI_API_KEY is correct and you restarted the dev server.'
    }
  }
}

// 2. Emergency Mode Calculation
export async function getEmergencyAnalysis(context: AIContext, walletBalance: number) {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  })

  const prompt = `
    ${BASE_FINANCIAL_EXPERT_SYSTEM_INSTRUCTION}
    
    TASK: The user has activated Emergency Mode and entered their current available wallet balance of ₹${walletBalance}.
    Analyze their upcoming monthly obligations (credit card minimum dues, loan EMIs, essential bills/expenses) and calculate:
    1. Total upcoming obligations in the next 30 days.
    2. Shortfall (obligations minus wallet balance, set to 0 if balance is enough).
    3. Days remaining before cash runs out based on daily essential burn rate.
    4. Risk score (from 0 to 100, where 100 is high risk - no cash and high EMIs due).
    5. Recommended actions to survive the month and mitigate damage.
    
    Here is the user's current profile:
    - Active Loans & EMIs: ${JSON.stringify(context.loans)}
    - Credit Cards & Min Dues: ${JSON.stringify(context.cards)}
    - Monthly Expenses: ${JSON.stringify(context.expenses)}
    
    Provide a detailed JSON response exactly matching the schema:
    {
      "upcomingObligations": number,
      "shortfall": number,
      "daysRemaining": number,
      "riskScore": number,
      "recommendedActions": string[],
      "explanation": "A breakdown of what makes their situation critical or stable."
    }
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text)
  } catch (error: any) {
    console.error('Gemini error in Emergency Analysis:', error)
    return {
      upcomingObligations: 0,
      shortfall: 0,
      daysRemaining: 0,
      riskScore: 100,
      recommendedActions: [
        `Gemini API Error: ${error.message || error.toString()}`,
        'Verify your GEMINI_API_KEY settings.'
      ],
      explanation: `Gemini audit failed: ${error.message || error.toString()}`
    }
  }
}

// 3. What Should I Do Now? Action Trigger (Main Feature)
export async function getWhatShouldIDoNow(context: AIContext) {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  })

  const prompt = `
    ${BASE_FINANCIAL_EXPERT_SYSTEM_INSTRUCTION}
    
    TASK: The user clicked "WHAT SHOULD I DO NOW?". This is the main guidance feature.
    Analyze their debt, EMIs, credit card utilization, cash, income, expenses, and goals.
    Formulate:
    1. The absolute top priority action to take today (e.g. paying off a card at 85% utilization, or paying an overdue EMI).
    2. A secondary action (e.g. setting up a recurring deposit, planning for an upcoming loan, etc.).
    3. A clear warning highlighting high-risk situations (e.g. utilization > 70%, upcoming loan EMI with low cash balance).
    4. The expected outcome of taking these actions.
    
    User details:
    - Cash Balance: ₹${context.cashBalance}
    - Loans & EMIs: ${JSON.stringify(context.loans)}
    - Credit Cards: ${JSON.stringify(context.cards)}
    - Income Entries: ${JSON.stringify(context.income)}
    - Expenses: ${JSON.stringify(context.expenses)}
    - Goals: ${JSON.stringify(context.goals)}
    
    Provide a detailed JSON response exactly matching the schema:
    {
      "topPriorityAction": "String - The primary, urgent step.",
      "secondaryAction": "String - The secondary supportive step.",
      "warning": "String - Alert flag for high utilization, upcoming dates, or cash shortfalls.",
      "expectedOutcome": "String - Psychological or financial benefits after execution."
    }
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text)
  } catch (error: any) {
    console.error('Gemini error in What Should I Do Now:', error)
    return {
      topPriorityAction: `AI Audit Failed: ${error.message || error.toString()}`,
      secondaryAction: 'Check your .env.local file configuration.',
      warning: 'Ensure you restarted the dev server (npm run dev) in your terminal.',
      expectedOutcome: 'Gemini API call will function once the key is loaded.'
    }
  }
}

// 4. General Advisor Chat
export async function askAdvisor(context: AIContext, query: string) {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  })

  const prompt = `
    ${BASE_FINANCIAL_EXPERT_SYSTEM_INSTRUCTION}
    
    TASK: The user has asked the following question: "${query}"
    Evaluate their financial data and answer this question directly, and also provide a structured response covering action plan, risk analysis, priority ranking, debt strategy, and monthly suggestions.
    
    User details:
    - Cash Balance: ₹${context.cashBalance}
    - Loans: ${JSON.stringify(context.loans)}
    - Credit Cards: ${JSON.stringify(context.cards)}
    - Income: ${JSON.stringify(context.income)}
    - Expenses: ${JSON.stringify(context.expenses)}
    - Goals: ${JSON.stringify(context.goals)}
    
    Provide a detailed JSON response exactly matching the schema:
    {
      "answer": "Direct answer to the user's question, written in a clear, friendly, expert financial planner tone.",
      "actionPlan": ["Action 1", "Action 2"],
      "riskAnalysis": "Brief risk evaluation.",
      "priorityRanking": ["Rank 1", "Rank 2"],
      "debtStrategy": "Strategy recommendations (e.g., Avalanche or Snowball prioritization).",
      "monthlySuggestions": "Budgeting adjustments or changes."
    }
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return JSON.parse(text)
  } catch (error: any) {
    console.error('Gemini error in Advisor Chat:', error)
    return {
      answer: `Gemini API Request Failed: ${error.message || error.toString()}. \n\nNote: If you recently added the key to your .env.local file, you MUST stop and restart the development server (npm run dev) in your terminal for Next.js to load the changes.`,
      actionPlan: [`Check .env.local file configuration`, `Verify Gemini key validity in Google AI Studio`],
      riskAnalysis: `Error Trace: ${error.message || error.toString()}`,
      priorityRanking: ['1. High Interest Debts', '2. Credit Card Balances'],
      debtStrategy: 'Debt Avalanche (targeting highest interest rate first).',
      monthlySuggestions: 'Limit leisure spending to 10% of monthly income.'
    }
  }
}
