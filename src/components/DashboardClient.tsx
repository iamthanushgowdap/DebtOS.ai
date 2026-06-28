'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  TrendingUp, 
  Wallet, 
  CreditCard, 
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Activity,
  ChevronRight,
  TrendingDown,
  Target
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { formatCurrency, calculateDaysRemaining, parseLoanSchedule, calculateDaysUntilDate, isCardPaidThisStatement } from '@/lib/utils'
import { AIContext } from '@/lib/ai/gemini'

interface DashboardClientProps {
  context: AIContext
  totalDebtRemaining: number
  principalPaid: number
  monthlyEMI: number
  latestAIRecommendation: string
  loanPayments: any[]
  ccPayments: any[]
}

export default function DashboardClient({
  context,
  totalDebtRemaining,
  principalPaid,
  monthlyEMI,
  latestAIRecommendation,
  loanPayments,
  ccPayments
}: DashboardClientProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { cashBalance, loans, cards, goals, expenses, income } = context

  // 1. Calculate Monthly Income & Expenses from current logs
  const totalIncome = income.reduce((sum, i) => sum + i.received, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // 2. Financial Status Determination
  let status: 'Excellent' | 'Stable' | 'Tight' | 'Critical' = 'Stable'
  let statusColor = 'text-blue-400 bg-blue-950/20 border-blue-900/40'
  let statusIcon = ShieldCheck
  let statusDescription = 'Your cash flow is stable enough to cover current obligations.'

  const maxUtilization = cards.length > 0 ? Math.max(...cards.map(c => (c.current_utilization / c.credit_limit) * 100)) : 0

  if (cashBalance >= monthlyEMI * 3 && maxUtilization < 30) {
    status = 'Excellent'
    statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
    statusIcon = ShieldCheck
    statusDescription = 'Excellent liquid reserves and optimal utilization. Keep accelerating repayments!'
  } else if (cashBalance >= monthlyEMI * 1.5 && maxUtilization < 60) {
    status = 'Stable'
    statusColor = 'text-blue-700 bg-blue-50 border-blue-200/80'
    statusIcon = ShieldCheck
    statusDescription = 'Solid standing. Your cash reserves comfortably cover immediate EMIs.'
  } else if (cashBalance >= monthlyEMI && maxUtilization < 80) {
    status = 'Tight'
    statusColor = 'text-amber-700 bg-amber-50 border-amber-200/80'
    statusIcon = AlertCircle
    statusDescription = 'Liquidity is tight. Try to reduce discretionary spending to build a cash buffer.'
  } else {
    status = 'Critical'
    statusColor = 'text-rose-700 bg-rose-50 border-rose-200/80'
    statusIcon = ShieldAlert
    statusDescription = 'Emergency Alert. Total EMIs exceed cash reserves, or card utilization is critical (>75%).'
  }

  // 3. Goal Progress %
  const activeGoal = goals.length > 0 ? goals[0] : null
  const goalProgressPercent = activeGoal 
    ? Math.round(Math.min(100, (activeGoal.current_amount / activeGoal.target_amount) * 100))
    : 0

  // 4. Upcoming EMI Countdowns
  const upcomingEMIs = loans
    .map(l => {
      const paymentsCount = loanPayments.filter(p => p.loan_id === l.id && p.status === 'paid').length
      let emi = l.emi
      let daysLeft = calculateDaysRemaining(l.due_day)
      let resolvedDateStr = ''
      
      if (l.start_date && l.end_date) {
        const start = new Date(l.start_date)
        const end = new Date(l.end_date)
        const duration = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
        const actualDuration = duration > 0 ? duration : 12
        
        const parsed = parseLoanSchedule(
          l.notes || '',
          l.emi,
          l.principal,
          actualDuration,
          l.start_date,
          l.due_day
        )
        
        if (paymentsCount < parsed.schedule.length) {
          const nextEntry = parsed.schedule[paymentsCount]
          emi = nextEntry.amount
          resolvedDateStr = nextEntry.resolvedDate || ''
          daysLeft = calculateDaysUntilDate(resolvedDateStr)
        }
      }
      
      return {
        name: l.name,
        lender: l.lender,
        emi,
        dueDay: l.due_day,
        daysLeft,
        resolvedDateStr,
        type: 'loan'
      }
    })
    .concat(
      cards
        .filter(c => !isCardPaidThisStatement(c, ccPayments))
        .map(c => ({
          name: c.card_name,
          lender: c.bank,
          emi: c.minimum_due,
          dueDay: c.due_date,
          daysLeft: calculateDaysRemaining(c.due_date),
          resolvedDateStr: '',
          type: 'card'
        }))
    )
    .filter(item => item.emi > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3)

  // 5. Generate simulated Debt Reduction Forecast (12 months)
  const generateForecastData = () => {
    const data = []
    let simulatedBalance = totalDebtRemaining
    const monthlyNetSavings = Math.max(2000, totalIncome - totalExpenses - monthlyEMI)
    
    // Simulate over 6 months
    for (let i = 0; i <= 6; i++) {
      const monthName = new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000).toLocaleString('default', { month: 'short' })
      data.push({
        month: monthName,
        Balance: Math.max(0, Math.round(simulatedBalance)),
        Savings: Math.round(cashBalance + (monthlyNetSavings * i))
      })
      // Every month balance reduces by EMI principal pay down plus 30% of extra savings
      simulatedBalance -= (monthlyEMI * 0.4) + (monthlyNetSavings * 0.5)
    }
    return data
  }

  const forecastData = generateForecastData()

  return (
    <div className="space-y-6">
      {/* Top Welcome Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Command Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time ledger, debt reduction ratios, and AI risk status.</p>
        </div>
        
        {/* Connection status Badge */}
        <div className="flex items-center gap-2 self-start lg:self-center">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-semibold text-emerald-700 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full">
            Active Connection: Secured
          </span>
        </div>
      </div>

      {/* Metrics Row Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        
        {/* Metric Card 1: Remaining Debt */}
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Remaining Debt</span>
            <span className="text-lg lg:text-xl font-extrabold text-foreground mt-1.5 block">
              {formatCurrency(totalDebtRemaining)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>Principal Paid: {formatCurrency(principalPaid)}</span>
            <Wallet className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>

        {/* Metric Card 2: Ledger Cash */}
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Available Cash</span>
            <span className="text-lg lg:text-xl font-extrabold text-emerald-400 mt-1.5 block">
              {formatCurrency(cashBalance)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>Ledger liquidity</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Metric Card 3: Monthly EMIs */}
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Monthly EMI</span>
            <span className="text-lg lg:text-xl font-extrabold text-foreground mt-1.5 block">
              {formatCurrency(monthlyEMI)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>Next bills sum</span>
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
          </div>
        </div>

        {/* Metric Card 4: Financial Status */}
        <div className={`border p-4 rounded-xl flex flex-col justify-between h-28 relative overflow-hidden ${statusColor}`}>
          <div>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Health Status</span>
            <span className="text-lg lg:text-xl font-extrabold mt-1.5 block uppercase tracking-wide">
              {status}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <Activity className="h-3.5 w-3.5" />
            <span className="truncate">Ratios: Optimal</span>
          </div>
        </div>

      </div>

      {/* EMI RUNWAY & DAILY TARGET PLANNER */}
      {(() => {
        const targetEMIsToCover = upcomingEMIs.reduce((sum, item) => sum + item.emi, 0) || monthlyEMI;
        const shortfall = Math.max(0, targetEMIsToCover - cashBalance);
        
        // Find closest due date
        const positiveDaysLeft = upcomingEMIs.map(item => item.daysLeft).filter(d => d >= 0);
        const daysToClosest = positiveDaysLeft.length > 0 ? Math.min(...positiveDaysLeft) : 30;
        
        const divisor = daysToClosest > 0 ? daysToClosest : 1;
        const dailySavingsTarget = shortfall / divisor;
        
        const coveragePercent = Math.min(100, Math.round((cashBalance / Math.max(1, targetEMIsToCover)) * 100));
        
        return (
          <div className="bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/50 pb-3">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Target className="h-4.5 w-4.5 text-primary" />
                  Ramp-up Repayment & Daily Savings Planner
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Calculates your required daily velocity to cover upcoming EMIs and statement dues.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                  CLOSEST DUE DATE
                </span>
                <span className="text-xs font-semibold text-foreground mt-0.5 block">
                  {positiveDaysLeft.length > 0 ? `In ${daysToClosest} days` : 'No immediate dues'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-secondary/10 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Upcoming Target</span>
                <span className="text-sm font-extrabold text-foreground mt-1 block">
                  {formatCurrency(targetEMIsToCover)}
                </span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">Due in 30 days</span>
              </div>

              <div className="bg-secondary/10 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Available Cash</span>
                <span className="text-sm font-extrabold text-emerald-600 mt-1 block">
                  {formatCurrency(cashBalance)}
                </span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">Liquid reserves</span>
              </div>

              <div className="bg-secondary/10 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Runway Deficit</span>
                <span className={`text-sm font-extrabold mt-1 block ${shortfall > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {shortfall > 0 ? formatCurrency(shortfall) : '₹0 (Fully Covered)'}
                </span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">Funding gap</span>
              </div>

              <div className="bg-secondary/10 p-3 rounded-xl border border-border/50">
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Coverage</span>
                <span className="text-sm font-extrabold text-primary mt-1 block">
                  {coveragePercent}%
                </span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">Debt-to-cash ratio</span>
              </div>

              <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 col-span-2 md:col-span-1">
                <span className="text-[10px] text-primary font-bold block uppercase">Daily Target</span>
                <span className="text-base font-black text-foreground mt-1 block">
                  {formatCurrency(Math.ceil(dailySavingsTarget))}
                </span>
                <span className="text-[9px] text-muted-foreground block mt-0.5">To pay off on time</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-muted-foreground">Cash Funding Runway</span>
                <span className={shortfall > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                  {shortfall > 0 ? `${coveragePercent}% Funded` : 'Fully Funded 🎉'}
                </span>
              </div>
              <div className="w-full bg-secondary h-3 rounded-full overflow-hidden border border-border/50">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    coveragePercent >= 100 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                      : coveragePercent >= 50 
                        ? 'bg-gradient-to-r from-amber-500 to-emerald-500' 
                        : 'bg-gradient-to-r from-rose-500 to-amber-500'
                  }`} 
                  style={{ width: `${coveragePercent}%` }} 
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                {shortfall > 0 
                  ? `💡 You are short by ${formatCurrency(shortfall)} to cover all upcoming dues. Try to accumulate ${formatCurrency(Math.ceil(dailySavingsTarget))} daily over the next ${daysToClosest} days to secure your runway.`
                  : '💡 Excellent! Your current available cash is sufficient to cover all upcoming obligations. Continue keeping discretionary expenses low to build savings.'}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Main Grid: Forecast Chart & Goal Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Repayment Forecast Chart (2/3 width) */}
        <div className="bg-card border border-border p-5 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Repayment & Cash Forecast</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">6-Month projection based on current EMI rates and surplus allocations.</p>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>

          <div className="h-60 w-full text-xs">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#09090b' }}
                    labelClassName="text-slate-500 font-semibold"
                  />
                  <Area type="monotone" dataKey="Balance" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" name="Simulated Debt" />
                  <Area type="monotone" dataKey="Savings" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSavings)" name="Projected Cash" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-secondary/20 animate-pulse rounded-lg flex items-center justify-center">
                Loading visual matrix...
              </div>
            )}
          </div>
        </div>

        {/* Goals / Progress checklist (1/3 width) */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground">Debt Reduction Goal</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tracking current acceleration targets.</p>
          </div>

          {activeGoal ? (
            <div className="space-y-4 my-2">
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">TARGET REDUCTION</span>
                <span className="text-xl font-black text-primary mt-1 block">
                  {formatCurrency(activeGoal.target_amount)}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/20 px-2 py-0.5 rounded-full inline-block mt-2">
                  Progress: {goalProgressPercent}%
                </span>
              </div>

              {/* Progress Slider Bar */}
              <div className="space-y-1">
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-500" 
                    style={{ width: `${goalProgressPercent}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                  <span>Paid: {formatCurrency(activeGoal.current_amount)}</span>
                  <span>Remaining: {formatCurrency(Math.max(0, activeGoal.target_amount - activeGoal.current_amount))}</span>
                </div>
              </div>

              <div className="bg-secondary/40 border border-border/60 p-2.5 rounded-xl text-[10px] text-muted-foreground text-center">
                Required Monthly Savings: <strong className="text-foreground">{formatCurrency(activeGoal.required_monthly_reduction)}</strong>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-6 gap-2">
              <Target className="h-8 w-8 text-muted-foreground opacity-50" />
              <span className="text-xs text-muted-foreground">No active goals configured.</span>
              <Link href="/goals" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                Establish Goal <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          <div className="border-t border-border/50 pt-3 flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Status Rating</span>
            <span className={`px-2 py-0.5 rounded text-[10px] border ${statusColor}`}>
              {status}
            </span>
          </div>
        </div>

      </div>

      {/* Grid: Upcoming EMIs & AI recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upcoming EMI Countdowns */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Upcoming EMI Countdown</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Critical due dates in the next 30 days.</p>
            </div>
            <Calendar className="h-4 w-4 text-blue-400" />
          </div>

          <div className="flex flex-col gap-2">
            {upcomingEMIs.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8 bg-secondary/10 rounded-xl">
                All EMIs are clear or paid for the upcoming 30 days!
              </div>
            ) : (
              upcomingEMIs.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 bg-secondary/20 hover:bg-secondary/40 border border-border/50 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.type === 'card' ? 'bg-amber-950/20 text-amber-400' : 'bg-blue-950/20 text-blue-400'}`}>
                      {item.type === 'card' ? <CreditCard className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {item.lender} &bull; {item.resolvedDateStr ? `Due: ${item.resolvedDateStr}` : `Due Day ${item.dueDay}`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-foreground block">{formatCurrency(item.emi)}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1 ${
                      item.daysLeft <= 3 
                        ? 'bg-rose-950/30 text-rose-400 border border-rose-900/30' 
                        : item.daysLeft <= 7 
                          ? 'bg-amber-950/30 text-amber-400 border border-amber-900/30' 
                          : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                    }`}>
                      {item.daysLeft === 0 
                        ? 'Due Today' 
                        : item.daysLeft < 0 
                          ? `Overdue by ${Math.abs(item.daysLeft)} days` 
                          : `${item.daysLeft} days remaining`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Recommendation Card */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-bold text-sm text-foreground">AI Command Center Recommendation</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">Derived from your current balances, cash levels, and goals.</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex-1 flex items-start gap-3 my-2 max-h-[160px] overflow-y-auto">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
              {latestAIRecommendation}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-[10px] text-muted-foreground">Ask AI Advisor for custom plans</span>
            <Link href="/advisor" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
              Consult Advisor <ChevronRight className="h-4.5 w-4.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
