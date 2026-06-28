'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Wallet,
  Sparkles,
  Info
} from 'lucide-react'
import { formatCurrency, parseLoanSchedule, getLocalTodayStr, formatDateToLocalYYYYMMDD, isCardPaidForCycle } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

interface Loan {
  id: string
  name: string
  lender: string
  principal: number
  current_balance: number
  interest_rate: number
  emi: number
  due_day: number
  status: string
  start_date?: string
  end_date?: string
  notes?: string
}

interface Payment {
  id: string
  loan_id: string
  amount: number
  payment_date: string
  status: string
}

interface CreditCard {
  id: string
  card_name: string
  bank: string
  credit_limit: number
  current_utilization: number
  minimum_due: number
  statement_date: number
  due_date: number
  annual_fee: number
  status: string
}

interface CCPayment {
  id: string
  credit_card_id: string
  amount: number
  payment_date: string
}

interface CalendarClientProps {
  userId: string
  loans: Loan[]
  initialPayments: Payment[]
  cards: CreditCard[]
  initialCcPayments: CCPayment[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function CalendarClient({
  userId,
  loans,
  initialPayments,
  cards,
  initialCcPayments
}: CalendarClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [ccPayments, setCcPayments] = useState<CCPayment[]>(initialCcPayments)

  // Current calendar viewport date
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-11
  const [viewYear, setViewYear] = useState(today.getFullYear())

  // Dialog State
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([])
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(prev => prev - 1)
    } else {
      setViewMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(prev => prev + 1)
    } else {
      setViewMonth(prev => prev + 1)
    }
  }

  // Cross reference loans, credit cards, and payments for a specific day
  const getEventsForDay = (day: number) => {
    const dayEvents: any[] = []
    const targetDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    // 1. Process Loans
    loans.forEach(loan => {
      let isScheduledForDay = false;
      let emiAmount = loan.emi;
      let isPaid = false;
      
      const loanPaymentsList = payments.filter(p => p.loan_id === loan.id && p.status === 'paid');
      const paymentsCount = loanPaymentsList.length;
      
      if (loan.start_date && loan.end_date) {
        const start = new Date(loan.start_date)
        const end = new Date(loan.end_date)
        const duration = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
        const actualDuration = duration > 0 ? duration : 12
        
        const { schedule } = parseLoanSchedule(
          loan.notes || '',
          loan.emi,
          loan.principal,
          actualDuration,
          loan.start_date,
          loan.due_day
        );
        
        const scheduleIndex = schedule.findIndex(s => s.resolvedDate === targetDateStr);
        if (scheduleIndex !== -1) {
          isScheduledForDay = true;
          emiAmount = schedule[scheduleIndex].amount;
          isPaid = scheduleIndex < paymentsCount;
        }
      } else {
        // Fallback for legacy loans
        if (loan.due_day === day) {
          isScheduledForDay = true;
          isPaid = payments.some(p => {
            const pDate = new Date(p.payment_date)
            return p.loan_id === loan.id && 
                   pDate.getMonth() === viewMonth && 
                   pDate.getFullYear() === viewYear
          });
        }
      }
      
      if (isScheduledForDay) {
        let status: 'paid' | 'upcoming' | 'overdue' = 'upcoming'
        if (isPaid) {
          status = 'paid'
        } else {
          const todayStr = getLocalTodayStr()
          if (targetDateStr < todayStr) {
            status = 'overdue'
          }
        }
        
        dayEvents.push({
          id: loan.id,
          name: loan.name,
          lender: loan.lender,
          emi: emiAmount,
          current_balance: loan.current_balance,
          status,
          type: 'loan',
          due_date_formatted: `${day} ${MONTHS[viewMonth].substring(0, 3)} ${viewYear}`,
          raw: loan
        })
      }
    })

    // 2. Process Credit Cards
    cards.forEach(card => {
      if (card.due_date === day && card.minimum_due > 0 && card.status === 'active') {
        const isPaid = isCardPaidForCycle(card, ccPayments, viewYear, viewMonth)
        
        let status: 'paid' | 'upcoming' | 'overdue' = 'upcoming'
        if (isPaid) {
          status = 'paid'
        } else {
          const todayStr = getLocalTodayStr()
          if (targetDateStr < todayStr) {
            status = 'overdue'
          }
        }

        dayEvents.push({
          id: card.id,
          name: card.card_name,
          lender: card.bank,
          emi: card.minimum_due,
          current_balance: card.current_utilization,
          status,
          type: 'card',
          due_date_formatted: `${day} ${MONTHS[viewMonth].substring(0, 3)} ${viewYear}`,
          raw: card
        })
      }
    })

    return dayEvents
  }

  const handleDayClick = (day: number, events: any[]) => {
    if (events.length === 0) return
    setSelectedDayNumber(day)
    setSelectedDayEvents(events)
    setIsModalOpen(true)
  }

  // Mark EMI as paid from calendar
  const handleMarkPaidFromCalendar = async (loan: Loan) => {
    let paymentAmount = loan.emi
    let updatedBalance = Math.max(0, Number(loan.current_balance) - paymentAmount)

    const loanPaymentsList = payments.filter(p => p.loan_id === loan.id && p.status === 'paid')
    const paymentsCount = loanPaymentsList.length

    if (loan.start_date && loan.end_date) {
      const start = new Date(loan.start_date)
      const end = new Date(loan.end_date)
      const duration = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      const actualDuration = duration > 0 ? duration : 12

      const { schedule, scheduleRows } = parseLoanSchedule(
        loan.notes || '',
        loan.emi,
        loan.principal,
        actualDuration,
        loan.start_date,
        loan.due_day
      )

      if (paymentsCount < schedule.length) {
        paymentAmount = schedule[paymentsCount].amount
        updatedBalance = scheduleRows[paymentsCount] ? scheduleRows[paymentsCount].endingBalance : 0
      }
    }

    const payDate = formatDateToLocalYYYYMMDD(new Date(viewYear, viewMonth, selectedDayNumber || today.getDate()))

    // 1. Log Payment
    const { data: newPayment, error: payError } = await supabase
      .from('loan_payments')
      .insert({
        loan_id: loan.id,
        user_id: userId,
        amount: paymentAmount,
        payment_date: payDate,
        status: 'paid'
      })
      .select()

    if (payError) {
      alert('Failed to log payment: ' + payError.message)
      return
    }

    // 2. Deduct Loan Balance
    const { error: loanError } = await supabase
      .from('loans')
      .update({ current_balance: updatedBalance, status: updatedBalance === 0 ? 'closed' : 'active' })
      .eq('id', loan.id)

    if (loanError) {
      alert('Payment registered but balance update failed: ' + loanError.message)
      return
    }

    // 3. Update local state
    if (newPayment) {
      setPayments(prev => [...prev, newPayment[0] as Payment])
    }

    // Update modal state in-place
    setSelectedDayEvents(prev => prev.map(e => e.id === loan.id ? { ...e, status: 'paid', current_balance: updatedBalance } : e))
    
    // Confetti
    confetti({ particleCount: 100, spread: 60 })
    router.refresh()
  }

  // Mark Credit Card statement as paid from calendar
  const handlePayCardFromCalendar = async (card: CreditCard) => {
    const paymentAmount = Number(card.minimum_due)
    const updatedUtilization = Math.max(0, Number(card.current_utilization) - paymentAmount)
    const payDate = formatDateToLocalYYYYMMDD(new Date(viewYear, viewMonth, selectedDayNumber || today.getDate()))

    // 1. Log Payment
    const { data: newPayment, error: payError } = await supabase
      .from('credit_card_payments')
      .insert({
        credit_card_id: card.id,
        user_id: userId,
        amount: paymentAmount,
        payment_date: payDate
      })
      .select('*, credit_cards(card_name)')

    if (payError) {
      alert('Failed to log card payment: ' + payError.message)
      return
    }

    // 2. Update Card Utilization
    const { error: cardError } = await supabase
      .from('credit_cards')
      .update({ current_utilization: updatedUtilization })
      .eq('id', card.id)

    if (cardError) {
      alert('Payment registered but utilization update failed: ' + cardError.message)
      return
    }

    // 3. Log Audit
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'pay_credit_card',
      details: { card_name: card.card_name, amount: paymentAmount, utilization_remaining: updatedUtilization }
    })

    // 4. Update local state
    if (newPayment) {
      setCcPayments(prev => [newPayment[0] as unknown as CCPayment, ...prev])
    }

    // Update modal state in-place
    setSelectedDayEvents(prev => prev.map(e => e.id === card.id ? { ...e, status: 'paid', current_balance: updatedUtilization } : e))
    
    // Confetti
    confetti({ particleCount: 100, spread: 60 })
    router.refresh()
  }

  // Generate grid calendar cells
  const calendarCells = []
  
  // Padding cells
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(<div key={`pad-${i}`} className="bg-secondary/40 border border-border/20 min-h-16 lg:min-h-24 opacity-30" />)
  }

  // Month days
  for (let day = 1; day <= daysInMonth; day++) {
    const events = getEventsForDay(day)
    const isCurrentDay = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear

    calendarCells.push(
      <div 
        key={`day-${day}`}
        onClick={() => handleDayClick(day, events)}
        className={`bg-card border border-border min-h-16 lg:min-h-24 p-1.5 flex flex-col justify-between hover:bg-secondary/20 transition-all ${events.length > 0 ? 'cursor-pointer' : ''} ${isCurrentDay ? 'border-primary shadow-sm shadow-primary/20' : ''}`}
      >
        {/* Day Number */}
        <div className="flex justify-between items-center">
          <span className={`text-[10px] lg:text-xs font-semibold ${isCurrentDay ? 'bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center font-black' : 'text-muted-foreground'}`}>
            {day}
          </span>
          {events.length > 0 && (
            <span className="text-[8px] bg-secondary px-1 py-0.5 rounded text-foreground font-bold lg:hidden">
              {events.length}
            </span>
          )}
        </div>

        {/* Desktop Event list */}
        <div className="hidden lg:flex flex-col gap-1 mt-1 overflow-hidden">
          {events.map((e, idx) => (
            <div 
              key={idx}
              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold truncate border ${
                e.status === 'paid' 
                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' 
                  : e.status === 'overdue' 
                    ? 'bg-rose-950/20 text-rose-400 border-rose-900/30 font-bold animate-pulse'
                    : 'bg-amber-950/20 text-amber-400 border-amber-900/30'
              }`}
            >
              {e.name}: {formatCurrency(e.emi)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Calendar Header Control */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">EMI Calendar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Visually track upcoming payments and payment logs by day.</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3 bg-card border border-border px-3 py-1.5 rounded-xl shadow-sm">
          <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-foreground min-w-[100px] text-center uppercase tracking-wider">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={handleNextMonth} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend guide */}
      <div className="flex gap-4 bg-card border border-border p-3.5 rounded-2xl text-[10px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Paid (Clear)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>Upcoming (Dues Pending)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span>Overdue (Past Date)</span>
        </span>
      </div>

      {/* Main Grid Calendar */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/20">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2.5 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {/* Days slots grid */}
        <div className="grid grid-cols-7">
          {calendarCells}
        </div>
      </div>

      {/* ========================================================
          MODAL: EMI DETAILS FOR SELECTED DAY
         ======================================================== */}
      {isModalOpen && selectedDayNumber && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-sm text-foreground">EMIs Due: {selectedDayNumber} {MONTHS[viewMonth]} {viewYear}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayEvents.map((event) => (
                <div 
                  key={event.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                    event.status === 'paid' 
                      ? 'bg-emerald-950/10 border-emerald-900/30' 
                      : event.status === 'overdue' 
                        ? 'bg-rose-950/10 border-rose-900/30'
                        : 'bg-amber-950/10 border-amber-900/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{event.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{event.lender}</p>
                    </div>
                    <span className="text-sm font-black text-foreground">{formatCurrency(event.emi)}</span>
                  </div>

                   <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                    <span>{event.type === 'card' ? 'Current Utilization' : 'Remaining Balance'}: {formatCurrency(event.current_balance)}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase border ${
                      event.status === 'paid' 
                        ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' 
                        : event.status === 'overdue' 
                          ? 'bg-rose-950/20 text-rose-400 border-rose-900/30 animate-pulse'
                          : 'bg-amber-950/20 text-amber-400 border-amber-900/30'
                    }`}>
                      {event.status}
                    </span>
                  </div>

                  {event.status !== 'paid' && (
                    <button
                      onClick={() => event.type === 'card' ? handlePayCardFromCalendar(event.raw) : handleMarkPaidFromCalendar(event.raw)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Confirm {event.type === 'card' ? 'Card' : 'EMI'} Payment</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
