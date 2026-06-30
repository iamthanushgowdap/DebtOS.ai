'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  History, 
  Wallet,
  Sparkles,
  Info,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  List,
  Flame,
  FileText,
  Undo
} from 'lucide-react'
import { 
  formatCurrency, 
  calculateDaysRemaining,
  calculateImpliedMonthlyRate,
  getAmortizationSchedule,
  parseLoanSchedule,
  calculateDaysUntilDate,
  resolveScheduleDueDate,
  getLocalTodayStr,
  formatDateToLocalYYYYMMDD
} from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

interface Loan {
  id: string
  name: string
  lender: string
  loan_type: string
  principal: number
  current_balance: number
  interest_rate: number
  emi: number
  start_date: string
  end_date: string
  due_day: number
  status: string
  priority: string
  notes: string
}

interface Payment {
  id: string
  loan_id: string
  amount: number
  payment_date: string
  status: string
  loans?: {
    name: string
  }
}

interface LoansClientProps {
  userId: string
  initialLoans: Loan[]
  initialPayments: any[]
}

export default function LoansClient({
  userId,
  initialLoans,
  initialPayments
}: LoansClientProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')

  // Expandable schedule drawers per loan
  const [expandedSchedules, setExpandedSchedules] = useState<Record<string, boolean>>({})

  // Modals Toggle
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)

  // Confirmation Modals State
  const [logConfirmOpen, setLogConfirmOpen] = useState(false)
  const [selectedLoanForLog, setSelectedLoanForLog] = useState<Loan | null>(null)
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false)
  const [selectedLoanForUndo, setSelectedLoanForUndo] = useState<Loan | null>(null)

  // Form Fields
  const [formFields, setFormFields] = useState({
    name: '',
    lender: '',
    loan_type: 'Personal',
    principal: '',
    durationMonths: '12',
    due_day: '5',
    priority: 'medium',
    notes: '',
    start_date: getLocalTodayStr()
  })
  
  interface CustomScheduleField {
    amount: string;
    dueDateType: 'date' | 'relative';
    dateVal: string;
    relativeWeek: '1st' | '2nd' | '3rd' | '4th' | 'last';
    relativeDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  }

  // Custom schedule array for dynamic scheduling
  const [customSchedule, setCustomSchedule] = useState<CustomScheduleField[]>(
    Array(12).fill(null).map(() => ({
      amount: '',
      dueDateType: 'date',
      dateVal: '',
      relativeWeek: '2nd',
      relativeDay: 'Wednesday'
    }))
  )

  // Helper: get months between dates
  const getMonthsDifference = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 12
    const start = new Date(startStr)
    const end = new Date(endStr)
    const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    return diff > 0 ? diff : 12
  }

  // Calculations
  const totalRemaining = loans.reduce((sum, l) => sum + Number(l.current_balance), 0)
  const totalEMI = loans.reduce((sum, l) => {
    if (l.status !== 'active') return sum;
    const duration = getMonthsDifference(l.start_date, l.end_date)
    const { schedule } = parseLoanSchedule(l.notes || '', l.emi, l.principal, duration, l.start_date, l.due_day)
    const paymentsCount = payments.filter(p => p.loan_id === l.id && p.status === 'paid').length
    const currentEMI = schedule[paymentsCount] !== undefined ? schedule[paymentsCount].amount : l.emi
    return sum + currentEMI
  }, 0)
  
  const averageInterest = loans.length > 0 
    ? (loans.reduce((sum, l) => sum + Number(l.interest_rate), 0) / loans.length).toFixed(2) 
    : '0.00'

  // Dynamic preview calculations for modal input
  const getModalPreviewStats = () => {
    const principalNum = Number(formFields.principal) || 0
    const duration = Number(formFields.durationMonths) || 12
    const emiNums = customSchedule.slice(0, duration).map(s => Number(s.amount) || 0)
    
    const monthlyRate = calculateImpliedMonthlyRate(principalNum, emiNums)
    const apr = monthlyRate * 12 * 100
    const totalRepayment = emiNums.reduce((a, b) => a + b, 0)
    const totalInterest = Math.max(0, totalRepayment - principalNum)
    
    // Risk score: base 10 + (interest/principal ratios) + rate modifiers
    let riskScore = 15
    if (apr > 24) riskScore += 45
    else if (apr > 14) riskScore += 25
    if (principalNum > 500000) riskScore += 20
    if (totalRepayment > principalNum * 1.5) riskScore += 15
    riskScore = Math.min(100, riskScore)
    
    let riskLevel = 'Low Risk'
    let riskColor = 'text-emerald-600 bg-emerald-50 border-emerald-200'
    if (riskScore > 65) {
      riskLevel = 'High Risk'
      riskColor = 'text-rose-600 bg-rose-50 border-rose-200'
    } else if (riskScore > 35) {
      riskLevel = 'Medium Risk'
      riskColor = 'text-amber-600 bg-amber-50 border-amber-200'
    }

    return {
      apr,
      totalRepayment,
      totalInterest,
      riskScore,
      riskLevel,
      riskColor
    }
  }

  const previewStats = getModalPreviewStats()

  const handleDurationChange = (months: number) => {
    setFormFields(prev => ({ ...prev, durationMonths: String(months) }))
    setCustomSchedule(prev => {
      const next = [...prev]
      if (next.length < months) {
        const diff = months - next.length;
        const newEntries = Array(diff).fill(null).map(() => ({
          amount: '',
          dueDateType: 'date' as const,
          dateVal: '',
          relativeWeek: '2nd' as const,
          relativeDay: 'Wednesday' as const
        }));
        return next.concat(newEntries);
      }
      return next.slice(0, months)
    })
  }

  const handleApplySameEMI = () => {
    const first = customSchedule[0];
    if (!first) return;
    const confirmCopy = confirm("Copy Month 1's EMI amount and Due Date rule to all months?");
    if (!confirmCopy) return;

    const duration = Number(formFields.durationMonths) || 12
    setCustomSchedule(Array(duration).fill(null).map((_, index) => {
      let dateVal = first.dateVal
      if (first.dueDateType === 'date' && first.dateVal) {
        const d = new Date(first.dateVal)
        if (!isNaN(d.getTime())) {
          // Safe month incrementer clamping to the last day of target month if necessary
          const targetMonth = d.getMonth() + index
          const tempDate = new Date(d.getFullYear(), targetMonth, 1)
          const lastDayOfTargetMonth = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate()
          const targetDay = Math.min(d.getDate(), lastDayOfTargetMonth)
          const newDate = new Date(tempDate.getFullYear(), tempDate.getMonth(), targetDay)
          
          const y = newDate.getFullYear()
          const m = String(newDate.getMonth() + 1).padStart(2, '0')
          const day = String(newDate.getDate()).padStart(2, '0')
          dateVal = `${y}-${m}-${day}`
        }
      }
      
      return {
        amount: first.amount,
        dueDateType: first.dueDateType,
        dateVal,
        relativeWeek: first.relativeWeek,
        relativeDay: first.relativeDay
      }
    }))
  }

  const openAddModal = () => {
    setFormFields({
      name: '',
      lender: '',
      loan_type: 'Personal',
      principal: '',
      durationMonths: '12',
      due_day: '5',
      priority: 'medium',
      notes: '',
      start_date: getLocalTodayStr()
    })
    setCustomSchedule(Array(12).fill(null).map(() => ({
      amount: '',
      dueDateType: 'date',
      dateVal: '',
      relativeWeek: '2nd',
      relativeDay: 'Wednesday'
    })))
    setIsAddOpen(true)
  }

  const openEditModal = (loan: Loan) => {
    setSelectedLoan(loan)
    const duration = getMonthsDifference(loan.start_date, loan.end_date)
    const parsed = parseLoanSchedule(
      loan.notes || '',
      loan.emi,
      loan.principal,
      duration,
      loan.start_date,
      loan.due_day
    )
    
    setFormFields({
      name: loan.name,
      lender: loan.lender,
      loan_type: loan.loan_type,
      principal: String(loan.principal),
      durationMonths: String(duration),
      due_day: String(loan.due_day),
      priority: loan.priority,
      notes: parsed.textNotes,
      start_date: loan.start_date
    })
    setCustomSchedule(parsed.schedule.map(s => ({
      amount: String(s.amount || ''),
      dueDateType: s.dueDateType || 'date',
      dateVal: s.dateVal || '',
      relativeWeek: s.relativeWeek || '2nd',
      relativeDay: s.relativeDay || 'Wednesday'
    })))
    setIsEditOpen(true)
  }

  const toggleScheduleDrawer = (loanId: string) => {
    setExpandedSchedules(prev => ({
      ...prev,
      [loanId]: !prev[loanId]
    }))
  }

  // API Methods
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    const principalNum = Number(formFields.principal)
    const duration = Number(formFields.durationMonths)
    
    const emiSchedule = customSchedule.slice(0, duration).map(s => ({
      amount: Number(s.amount) || 0,
      dueDateType: s.dueDateType,
      dateVal: s.dateVal,
      relativeWeek: s.relativeWeek,
      relativeDay: s.relativeDay
    }))
    
    const emiNums = emiSchedule.map(s => s.amount)
    
    // Mathematical rate calculations
    const monthlyRate = calculateImpliedMonthlyRate(principalNum, emiNums)
    const solvedAPR = monthlyRate * 12 * 100
    
    // Average EMI to keep DB aggregations operational
    const avgEMI = emiNums.reduce((a, b) => a + b, 0) / duration

    // Start/End date bounds
    const startDate = formFields.start_date || getLocalTodayStr()
    const endDateObj = new Date(startDate)
    endDateObj.setMonth(endDateObj.getMonth() + duration)
    const endDate = formatDateToLocalYYYYMMDD(endDateObj)

    // Serialize schedule and raw note text into notes column
    const serializedNotes = JSON.stringify({
      schedule: emiSchedule,
      text: formFields.notes
    })

    const { data, error } = await supabase
      .from('loans')
      .insert({
        user_id: userId,
        name: formFields.name,
        lender: formFields.lender,
        loan_type: formFields.loan_type,
        principal: principalNum,
        current_balance: principalNum, // initially balance is equal to principal
        interest_rate: Number(solvedAPR.toFixed(2)),
        emi: Number(avgEMI.toFixed(2)),
        start_date: startDate,
        end_date: endDate,
        due_day: Number(formFields.due_day),
        priority: formFields.priority,
        notes: serializedNotes
      })
      .select()

    if (error) {
      alert('Error creating loan: ' + error.message)
    } else if (data) {
      setLoans(prev => [...prev, data[0] as Loan])
      setIsAddOpen(false)
      confetti({ particleCount: 80, spread: 60 })
      router.refresh()
    }
  }

  const handleEditLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoan) return

    const principalNum = Number(formFields.principal)
    const duration = Number(formFields.durationMonths)
    
    const emiSchedule = customSchedule.slice(0, duration).map(s => ({
      amount: Number(s.amount) || 0,
      dueDateType: s.dueDateType,
      dateVal: s.dateVal,
      relativeWeek: s.relativeWeek,
      relativeDay: s.relativeDay
    }))
    
    const emiNums = emiSchedule.map(s => s.amount)
    
    const monthlyRate = calculateImpliedMonthlyRate(principalNum, emiNums)
    const solvedAPR = monthlyRate * 12 * 100
    const avgEMI = emiNums.reduce((a, b) => a + b, 0) / duration

    const startDate = formFields.start_date || selectedLoan.start_date
    const endDateObj = new Date(startDate)
    endDateObj.setMonth(endDateObj.getMonth() + duration)
    const endDate = formatDateToLocalYYYYMMDD(endDateObj)

    const serializedNotes = JSON.stringify({
      schedule: emiSchedule,
      text: formFields.notes
    })

    // Calculate updated balance: based on payment count
    const paymentsCount = payments.filter(p => p.loan_id === selectedLoan.id && p.status === 'paid').length
    const scheduleRows = getAmortizationSchedule(principalNum, emiNums, monthlyRate)
    const updatedBalance = scheduleRows[paymentsCount - 1] ? scheduleRows[paymentsCount - 1].endingBalance : principalNum

    const { data, error } = await supabase
      .from('loans')
      .update({
        name: formFields.name,
        lender: formFields.lender,
        loan_type: formFields.loan_type,
        principal: principalNum,
        current_balance: updatedBalance,
        interest_rate: Number(solvedAPR.toFixed(2)),
        emi: Number(avgEMI.toFixed(2)),
        start_date: startDate,
        end_date: endDate,
        due_day: Number(formFields.due_day),
        priority: formFields.priority,
        notes: serializedNotes,
        status: updatedBalance === 0 ? 'closed' : 'active'
      })
      .eq('id', selectedLoan.id)
      .select()

    if (error) {
      alert('Error updating loan: ' + error.message)
    } else if (data) {
      setLoans(prev => prev.map(l => l.id === selectedLoan.id ? (data[0] as Loan) : l))
      setIsEditOpen(false)
      router.refresh()
    }
  }

  const handleDeleteLoan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loan? All records will be removed.')) return

    const { error } = await supabase.from('loans').delete().eq('id', id)
    if (error) {
      alert('Error deleting loan: ' + error.message)
    } else {
      setLoans(prev => prev.filter(l => l.id !== id))
      router.refresh()
    }
  }

  const handleMarkPaid = (loan: Loan) => {
    setSelectedLoanForLog(loan)
    setLogConfirmOpen(true)
  }

  const executeMarkPaid = async () => {
    if (!selectedLoanForLog) return
    const loan = selectedLoanForLog

    const duration = getMonthsDifference(loan.start_date, loan.end_date)
    const { schedule, scheduleRows } = parseLoanSchedule(
      loan.notes || '',
      loan.emi,
      loan.principal,
      duration,
      loan.start_date,
      loan.due_day
    )
    
    // Payments logged so far
    const paymentsCount = payments.filter(p => p.loan_id === loan.id && p.status === 'paid').length
    
    if (paymentsCount >= schedule.length) {
      alert('All scheduled EMIs for this loan are already logged as paid.')
      setLogConfirmOpen(false)
      return
    }

    const amountPaid = schedule[paymentsCount].amount
    const updatedBalance = scheduleRows[paymentsCount] ? scheduleRows[paymentsCount].endingBalance : 0

    // 1. Log Payment
    const { data: newPayment, error: payError } = await supabase
      .from('loan_payments')
      .insert({
        loan_id: loan.id,
        user_id: userId,
        amount: amountPaid,
        payment_date: getLocalTodayStr(),
        status: 'paid'
      })
      .select('*, loans(name)')

    if (payError) {
      alert('Failed to log payment: ' + payError.message)
      setLogConfirmOpen(false)
      return
    }

    // 2. Update Loan Balance
    const { error: loanError } = await supabase
      .from('loans')
      .update({ 
        current_balance: updatedBalance, 
        status: updatedBalance === 0 ? 'closed' : 'active' 
      })
      .eq('id', loan.id)

    if (loanError) {
      alert('Payment registered but balance update failed: ' + loanError.message)
      setLogConfirmOpen(false)
      return
    }

    // 3. Log to audit_logs
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'pay_emi',
      details: { loan_name: loan.name, emi_index: paymentsCount + 1, emi: amountPaid, balance_remaining: updatedBalance }
    })

    // 4. Update Client State
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, current_balance: updatedBalance, status: updatedBalance === 0 ? 'closed' : 'active' } : l))
    if (newPayment) {
      setPayments(prev => [newPayment[0] as unknown as Payment, ...prev])
    }

    // Show celebration confetti
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    })
    
    // Create notifications milestone if loan is closed
    if (updatedBalance === 0) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'achievement',
        title: 'Loan Fully Repaid! 🎉',
        message: `Congratulations! You have fully closed your loan: ${loan.name} from ${loan.lender}.`
      })
    }

    setLogConfirmOpen(false)
    setSelectedLoanForLog(null)
    router.refresh()
  }

  const handleUndoPayment = (loan: Loan) => {
    setSelectedLoanForUndo(loan)
    setUndoConfirmOpen(true)
  }

  const executeUndoPayment = async () => {
    if (!selectedLoanForUndo) return
    const loan = selectedLoanForUndo

    // Find the last payment for this loan
    const loanPayments = payments.filter(p => p.loan_id === loan.id && p.status === 'paid')
    if (loanPayments.length === 0) {
      alert('No payments found to undo for this loan.')
      setUndoConfirmOpen(false)
      return
    }

    const lastPayment = loanPayments[0] // since new payments are unshifted, index 0 is the last logged one.

    const duration = getMonthsDifference(loan.start_date, loan.end_date)
    const { scheduleRows } = parseLoanSchedule(
      loan.notes || '',
      loan.emi,
      loan.principal,
      duration,
      loan.start_date,
      loan.due_day
    )

    const paymentsCount = loanPayments.length
    if (paymentsCount === 0) {
      setUndoConfirmOpen(false)
      return
    }

    // Revert balance to startingBalance of the deleted row
    const revertedBalance = scheduleRows[paymentsCount - 1] ? scheduleRows[paymentsCount - 1].startingBalance : loan.principal

    // 1. Delete payment record
    const { error: deleteError } = await supabase
      .from('loan_payments')
      .delete()
      .eq('id', lastPayment.id)

    if (deleteError) {
      alert('Failed to delete payment record: ' + deleteError.message)
      setUndoConfirmOpen(false)
      return
    }

    // 2. Revert loan balance & status
    const { error: loanError } = await supabase
      .from('loans')
      .update({
        current_balance: revertedBalance,
        status: 'active'
      })
      .eq('id', loan.id)

    if (loanError) {
      alert('Payment deleted but balance revert failed: ' + loanError.message)
      setUndoConfirmOpen(false)
      return
    }

    // 3. Log to audit_logs
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'undo_emi_payment',
      details: { loan_name: loan.name, reverted_amount: lastPayment.amount, reverted_balance: revertedBalance }
    })

    // 4. Update Client State
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, current_balance: revertedBalance, status: 'active' } : l))
    setPayments(prev => prev.filter(p => p.id !== lastPayment.id))

    setUndoConfirmOpen(false)
    setSelectedLoanForUndo(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">Loans & EMI Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">Maintain active borrow sheets, log payments, and schedule EMIs.</p>
        </div>

        {/* Tab triggers & Add Button */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 border border-slate-200 p-1 rounded-lg flex text-xs">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Active Debts
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Payment Logs
            </button>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow-md shadow-blue-500/10 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Loan</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Outstanding</span>
          <span className="text-sm lg:text-lg font-black text-slate-800 mt-1 block">
            {formatCurrency(totalRemaining)}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Next EMI Pool</span>
          <span className="text-sm lg:text-lg font-black text-blue-600 mt-1 block">
            {formatCurrency(totalEMI)}
          </span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Avg Interest (APR)</span>
          <span className="text-sm lg:text-lg font-black text-emerald-600 mt-1 block">
            {averageInterest}%
          </span>
        </div>
      </div>

      {activeTab === 'active' ? (
        /* Active Loans Grid */
        loans.filter(l => l.status === 'active').length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-white/50 space-y-3">
            <Wallet className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">Zero Active Borrowings</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">No outstanding loans mapped to this command center. Keep it up!</p>
            <button
              onClick={openAddModal}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Add your first loan records
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {loans.filter(l => l.status === 'active').map((loan) => {
              const duration = getMonthsDifference(loan.start_date, loan.end_date)
              const { schedule, textNotes, impliedAPR, scheduleRows } = parseLoanSchedule(
                loan.notes || '',
                loan.emi,
                loan.principal,
                duration,
                loan.start_date,
                loan.due_day
              )
              
              const paymentsCount = payments.filter(p => p.loan_id === loan.id && p.status === 'paid').length
              const nextPayment = schedule[paymentsCount]
              const nextEMIAmount = nextPayment !== undefined ? nextPayment.amount : loan.emi
              const nextDueDateStr = nextPayment ? nextPayment.resolvedDate : ''
              
              const daysRemaining = nextDueDateStr ? calculateDaysUntilDate(nextDueDateStr) : calculateDaysRemaining(loan.due_day)
              const percentPaid = Math.round(((loan.principal - loan.current_balance) / loan.principal) * 100)
              const isExpanded = !!expandedSchedules[loan.id]

              return (
                <div key={loan.id} className="bg-white border border-slate-200/80 p-5 rounded-2xl flex flex-col gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  
                  {/* Top Header Card */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-md text-slate-900">{loan.name}</h3>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          loan.priority === 'high' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : loan.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {loan.priority} priority
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">{loan.lender} &bull; {loan.loan_type}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(loan)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Edit Loan"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete Loan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Principal Paid Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500">
                      <span>Remaining Balance</span>
                      <span>{percentPaid}% Repaid</span>
                    </div>
                    <div className="text-lg font-black text-slate-800">
                      {formatCurrency(loan.current_balance)}
                      <span className="text-[10px] text-slate-400 font-semibold ml-1">of {formatCurrency(loan.principal)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial detail stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-b border-slate-100 py-3 text-[11px] font-semibold text-slate-500">
                    <div>
                      <span className="text-slate-400 block">Implied Interest</span>
                      <span className="text-emerald-600 font-extrabold mt-0.5 block">{impliedAPR.toFixed(2)}% APR</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Next EMI Due</span>
                      <span className="text-blue-600 font-extrabold mt-0.5 block">
                        {paymentsCount >= schedule.length ? 'Fully Paid' : formatCurrency(nextEMIAmount)}
                        <span className="text-[9px] text-slate-400 font-normal ml-0.5">({paymentsCount + 1}/{schedule.length})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Due Date</span>
                      <span className="text-slate-700 font-bold mt-0.5 block">{nextDueDateStr || `Day ${loan.due_day}`}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Status Runway</span>
                      <span className={`font-bold mt-0.5 block ${daysRemaining <= 3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {paymentsCount >= schedule.length 
                          ? 'Closed' 
                          : (daysRemaining === 0 
                            ? 'Due Today' 
                            : daysRemaining < 0 
                              ? `Overdue by ${Math.abs(daysRemaining)} days` 
                              : `${daysRemaining} days left`)}
                      </span>
                    </div>
                  </div>

                  {/* Accordion Trigger & Mark Paid Button */}
                  <div className="flex justify-between items-center gap-4 text-xs font-semibold">
                    <button
                      onClick={() => toggleScheduleDrawer(loan.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                    >
                      <List className="h-3.5 w-3.5" />
                      <span>{isExpanded ? 'Hide Amortization' : 'View Amortization'}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      {paymentsCount > 0 && (
                        <button
                          onClick={() => handleUndoPayment(loan)}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition-all cursor-pointer"
                          title="Undo last EMI payment"
                        >
                          <Undo className="h-3.5 w-3.5" />
                          <span>Undo Last</span>
                        </button>
                      )}
                      
                      {paymentsCount < schedule.length && (
                        <button
                          onClick={() => handleMarkPaid(loan)}
                          className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Log Month {paymentsCount + 1} EMI</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Amortization Drawer */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-200 overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[10px] font-semibold text-slate-500">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400">
                            <th className="pb-2">Month</th>
                            <th className="pb-2 text-right">EMI Amount</th>
                            <th className="pb-2 text-right">Interest Portion</th>
                            <th className="pb-2 text-right">Principal Portion</th>
                            <th className="pb-2 text-right">Outstanding</th>
                            <th className="pb-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduleRows.map((row) => {
                            const isPaid = row.month <= paymentsCount;
                            const isNext = row.month === paymentsCount + 1;
                            return (
                              <tr key={row.month} className={`border-b border-slate-100/50 hover:bg-slate-50/50 ${isNext ? 'bg-blue-50/30' : ''}`}>
                                <td className="py-2">
                                  <div>Month {row.month}</div>
                                  {row.resolvedDate && (
                                    <div className="text-[9px] text-slate-400 mt-0.5 font-normal">
                                      Due: {row.resolvedDate} {row.dueDateType === 'relative' && `(${row.relativeWeek} ${row.relativeDay})`}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 text-right text-slate-800">{formatCurrency(row.emi)}</td>
                                <td className="py-2 text-right text-rose-600">+{formatCurrency(row.interestPaid)}</td>
                                <td className="py-2 text-right text-emerald-600">-{formatCurrency(row.principalPaid)}</td>
                                <td className="py-2 text-right text-slate-700">{formatCurrency(row.endingBalance)}</td>
                                <td className="py-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold ${
                                    isPaid 
                                      ? 'bg-emerald-50 text-emerald-700' 
                                      : (isNext ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400')
                                  }`}>
                                    {isPaid ? 'Paid' : (isNext ? 'Due' : 'Pending')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Historical Payments list */
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <History className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">EMI Payment History Log</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-500">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="pb-3 pr-2">Loan Name</th>
                  <th className="pb-3 px-2 text-right">Amount Paid</th>
                  <th className="pb-3 px-2">Payment Date</th>
                  <th className="pb-3 pl-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 font-medium">
                      No payments registered in the ledger history.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100/50 hover:bg-slate-50">
                      <td className="py-3 pr-2 font-bold text-slate-800">{p.loans?.name || 'Deleted Loan'}</td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                      <td className="py-3 px-2 text-slate-400">{p.payment_date}</td>
                      <td className="py-3 pl-2 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD LOAN
         ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-3 mb-4">
              <h3 className="font-bold text-md text-slate-900">Track New Borrowing</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-500 hover:text-slate-800 text-sm font-semibold p-1 cursor-pointer">Close</button>
            </div>
            
            <form onSubmit={handleAddLoan} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Loan Name</label>
                  <input type="text" required placeholder="e.g. HDFC Personal" value={formFields.name} onChange={e => setFormFields({...formFields, name: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Lender / Institution</label>
                  <input type="text" required placeholder="e.g. HDFC Bank" value={formFields.lender} onChange={e => setFormFields({...formFields, lender: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Loan Type</label>
                  <select value={formFields.loan_type} onChange={e => setFormFields({...formFields, loan_type: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="Personal">Personal Loan</option>
                    <option value="Home">Home Loan</option>
                    <option value="Car">Car Loan</option>
                    <option value="Education">Education Loan</option>
                    <option value="Business">Business Loan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Total Loan Amount</label>
                  <input type="number" required placeholder="₹ Principal" value={formFields.principal} onChange={e => setFormFields({...formFields, principal: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Duration (Months)</label>
                  <input type="number" required min="1" max="120" placeholder="Months" value={formFields.durationMonths} onChange={e => handleDurationChange(Number(e.target.value) || 12)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Start Date</label>
                  <input type="date" required value={formFields.start_date} onChange={e => setFormFields({...formFields, start_date: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>

              {/* Dynamic EMIs Area */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Configure Monthly Schedule ({formFields.durationMonths} months)</span>
                  <button type="button" onClick={handleApplySameEMI} className="text-[10px] text-blue-600 hover:underline">Apply Month 1's settings to all</button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 p-3 rounded-lg bg-white">
                  {Array.from({ length: Number(formFields.durationMonths) || 12 }).map((_, index) => {
                    const item = customSchedule[index] || {
                      amount: '',
                      dueDateType: 'date',
                      dateVal: '',
                      relativeWeek: '2nd',
                      relativeDay: 'Wednesday'
                    };
                    
                    return (
                      <div key={index} className="p-3 border border-slate-100 rounded-lg bg-slate-50/30 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-b border-slate-100/50 pb-1">
                          <span>Month {index + 1}</span>
                          <span className="text-emerald-600 font-bold">
                            Resolved: {resolveScheduleDueDate(
                              formFields.start_date || getLocalTodayStr(),
                              index,
                              {
                                dueDateType: item.dueDateType,
                                dateVal: item.dateVal,
                                relativeWeek: item.relativeWeek,
                                relativeDay: item.relativeDay,
                                dueDay: Number(formFields.due_day)
                              }
                            )}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] text-slate-400 mb-0.5">EMI Amount</label>
                            <input 
                              type="number" 
                              required 
                              placeholder="₹ Amount" 
                              value={item.amount} 
                              onChange={e => {
                                const val = e.target.value
                                setCustomSchedule(prev => {
                                  const next = [...prev]
                                  next[index] = { ...next[index], amount: val }
                                  return next
                                })
                              }} 
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500" 
                            />
                          </div>
                          
                          <div>
                            <label className="block text-[9px] text-slate-400 mb-0.5">Due Date Mode</label>
                            <select 
                              value={item.dueDateType} 
                              onChange={e => {
                                const val = e.target.value as 'date' | 'relative'
                                setCustomSchedule(prev => {
                                  const next = [...prev]
                                  next[index] = { ...next[index], dueDateType: val }
                                  return next
                                })
                              }}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500"
                            >
                              <option value="date">Specific Date</option>
                              <option value="relative">Weekday Rule</option>
                            </select>
                          </div>
                          
                          <div>
                            {item.dueDateType === 'date' ? (
                              <>
                                <label className="block text-[9px] text-slate-400 mb-0.5">Choose Date</label>
                                <input 
                                  type="date" 
                                  value={item.dateVal} 
                                  onChange={e => {
                                    const val = e.target.value
                                    setCustomSchedule(prev => {
                                      const next = [...prev]
                                      next[index] = { ...next[index], dateVal: val }
                                      return next
                                    })
                                  }} 
                                  className="w-full p-1 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500" 
                                />
                              </>
                            ) : (
                              <div className="grid grid-cols-2 gap-1">
                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-0.5">Week</label>
                                  <select 
                                    value={item.relativeWeek} 
                                    onChange={e => {
                                      const val = e.target.value as any
                                      setCustomSchedule(prev => {
                                        const next = [...prev]
                                        next[index] = { ...next[index], relativeWeek: val }
                                        return next
                                      })
                                    }}
                                    className="w-full p-1 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500"
                                  >
                                    <option value="1st">1st</option>
                                    <option value="2nd">2nd</option>
                                    <option value="3rd">3rd</option>
                                    <option value="4th">4th</option>
                                    <option value="last">last</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-0.5">Day</label>
                                  <select 
                                    value={item.relativeDay} 
                                    onChange={e => {
                                      const val = e.target.value as any
                                      setCustomSchedule(prev => {
                                        const next = [...prev]
                                        next[index] = { ...next[index], relativeDay: val }
                                        return next
                                      })
                                    }}
                                    className="w-full p-1 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500"
                                  >
                                    <option value="Monday">Mon</option>
                                    <option value="Tuesday">Tue</option>
                                    <option value="Wednesday">Wed</option>
                                    <option value="Thursday">Thu</option>
                                    <option value="Friday">Fri</option>
                                    <option value="Saturday">Sat</option>
                                    <option value="Sunday">Sun</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Math Predictions */}
              <div className="grid grid-cols-3 gap-2 text-center border-t border-b border-slate-100 py-3">
                <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-lg">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Implied APR</span>
                  <span className="text-xs font-black text-emerald-600 mt-1 block">
                    {previewStats.apr > 0 ? `${previewStats.apr.toFixed(2)}%` : '0%'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-lg">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Interest Cost</span>
                  <span className="text-xs font-black text-slate-700 mt-1 block">
                    {formatCurrency(previewStats.totalInterest)}
                  </span>
                </div>
                <div className={`border p-2.5 rounded-lg ${previewStats.riskColor}`}>
                  <span className="text-[9px] text-slate-400/80 block uppercase font-bold tracking-wider">Calculated Risk</span>
                  <span className="text-xs font-black mt-1 block uppercase">
                    {previewStats.riskLevel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Repayment Priority</label>
                  <select value={formFields.priority} onChange={e => setFormFields({...formFields, priority: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="high">High (Accelerate Repayment)</option>
                    <option value="medium">Medium (Pay standard EMIs)</option>
                    <option value="low">Low (Minimum Repayments)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">EMI Due Calendar Day</label>
                  <input type="number" min="1" max="31" required placeholder="e.g. 5" value={formFields.due_day} onChange={e => setFormFields({...formFields, due_day: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Audit / Personal Notes</label>
                <input type="text" placeholder="e.g. foreclosure details, remarks" value={formFields.notes} onChange={e => setFormFields({...formFields, notes: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-500/10 mt-2 cursor-pointer">Register Loan Record</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT LOAN
         ======================================================== */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-3 mb-4">
              <h3 className="font-bold text-md text-slate-900">Modify Loan Record</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-500 hover:text-slate-800 text-sm font-semibold p-1 cursor-pointer">Close</button>
            </div>
            
            <form onSubmit={handleEditLoan} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Loan Name</label>
                  <input type="text" required value={formFields.name} onChange={e => setFormFields({...formFields, name: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Lender</label>
                  <input type="text" required value={formFields.lender} onChange={e => setFormFields({...formFields, lender: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Loan Type</label>
                  <select value={formFields.loan_type} onChange={e => setFormFields({...formFields, loan_type: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="Personal">Personal Loan</option>
                    <option value="Home">Home Loan</option>
                    <option value="Car">Car Loan</option>
                    <option value="Education">Education Loan</option>
                    <option value="Business">Business Loan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Principal</label>
                  <input type="number" required value={formFields.principal} onChange={e => setFormFields({...formFields, principal: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Duration (Months)</label>
                  <input type="number" required min="1" max="120" value={formFields.durationMonths} onChange={e => handleDurationChange(Number(e.target.value) || 12)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Start Date</label>
                  <input type="date" required value={formFields.start_date} onChange={e => setFormFields({...formFields, start_date: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>

              {/* Dynamic EMIs Area */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Configure Monthly Schedule ({formFields.durationMonths} months)</span>
                  <button type="button" onClick={handleApplySameEMI} className="text-[10px] text-blue-600 hover:underline">Apply Month 1's settings to all</button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 p-3 rounded-lg bg-white">
                  {Array.from({ length: Number(formFields.durationMonths) || 12 }).map((_, index) => {
                    const item = customSchedule[index] || {
                      amount: '',
                      dueDateType: 'date',
                      dateVal: '',
                      relativeWeek: '2nd',
                      relativeDay: 'Wednesday'
                    };
                    
                    return (
                      <div key={index} className="p-3 border border-slate-100 rounded-lg bg-slate-50/30 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-b border-slate-100/50 pb-1">
                          <span>Month {index + 1}</span>
                          <span className="text-emerald-600 font-bold">
                            Resolved: {resolveScheduleDueDate(
                              formFields.start_date || getLocalTodayStr(),
                              index,
                              {
                                dueDateType: item.dueDateType,
                                dateVal: item.dateVal,
                                relativeWeek: item.relativeWeek,
                                relativeDay: item.relativeDay,
                                dueDay: Number(formFields.due_day)
                              }
                            )}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] text-slate-400 mb-0.5">EMI Amount</label>
                            <input 
                              type="number" 
                              required 
                              placeholder="₹ Amount" 
                              value={item.amount} 
                              onChange={e => {
                                const val = e.target.value
                                setCustomSchedule(prev => {
                                  const next = [...prev]
                                  next[index] = { ...next[index], amount: val }
                                  return next
                                })
                              }} 
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500" 
                            />
                          </div>
                          
                          <div>
                            <label className="block text-[9px] text-slate-400 mb-0.5">Due Date Mode</label>
                            <select 
                              value={item.dueDateType} 
                              onChange={e => {
                                const val = e.target.value as 'date' | 'relative'
                                setCustomSchedule(prev => {
                                  const next = [...prev]
                                  next[index] = { ...next[index], dueDateType: val }
                                  return next
                                })
                              }}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500"
                            >
                              <option value="date">Specific Date</option>
                              <option value="relative">Weekday Rule</option>
                            </select>
                          </div>
                          
                          <div>
                            {item.dueDateType === 'date' ? (
                              <>
                                <label className="block text-[9px] text-slate-400 mb-0.5">Choose Date</label>
                                <input 
                                  type="date" 
                                  value={item.dateVal} 
                                  onChange={e => {
                                    const val = e.target.value
                                    setCustomSchedule(prev => {
                                      const next = [...prev]
                                      next[index] = { ...next[index], dateVal: val }
                                      return next
                                    })
                                  }} 
                                  className="w-full p-1 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500" 
                                />
                              </>
                            ) : (
                              <div className="grid grid-cols-2 gap-1">
                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-0.5">Week</label>
                                  <select 
                                    value={item.relativeWeek} 
                                    onChange={e => {
                                      const val = e.target.value as any
                                      setCustomSchedule(prev => {
                                        const next = [...prev]
                                        next[index] = { ...next[index], relativeWeek: val }
                                        return next
                                      })
                                    }}
                                    className="w-full p-1 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500"
                                  >
                                    <option value="1st">1st</option>
                                    <option value="2nd">2nd</option>
                                    <option value="3rd">3rd</option>
                                    <option value="4th">4th</option>
                                    <option value="last">last</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-0.5">Day</label>
                                  <select 
                                    value={item.relativeDay} 
                                    onChange={e => {
                                      const val = e.target.value as any
                                      setCustomSchedule(prev => {
                                        const next = [...prev]
                                        next[index] = { ...next[index], relativeDay: val }
                                        return next
                                      })
                                    }}
                                    className="w-full p-1 bg-white border border-slate-200 rounded text-slate-800 text-[11px] focus:outline-none focus:border-blue-500"
                                  >
                                    <option value="Monday">Mon</option>
                                    <option value="Tuesday">Tue</option>
                                    <option value="Wednesday">Wed</option>
                                    <option value="Thursday">Thu</option>
                                    <option value="Friday">Fri</option>
                                    <option value="Saturday">Sat</option>
                                    <option value="Sunday">Sun</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Math Predictions */}
              <div className="grid grid-cols-3 gap-2 text-center border-t border-b border-slate-100 py-3">
                <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-lg">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Implied APR</span>
                  <span className="text-xs font-black text-emerald-600 mt-1 block">
                    {previewStats.apr > 0 ? `${previewStats.apr.toFixed(2)}%` : '0%'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-lg">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Interest Cost</span>
                  <span className="text-xs font-black text-slate-700 mt-1 block">
                    {formatCurrency(previewStats.totalInterest)}
                  </span>
                </div>
                <div className={`border p-2.5 rounded-lg ${previewStats.riskColor}`}>
                  <span className="text-[9px] text-slate-400/80 block uppercase font-bold tracking-wider">Calculated Risk</span>
                  <span className="text-xs font-black mt-1 block uppercase">
                    {previewStats.riskLevel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Repayment Priority</label>
                  <select value={formFields.priority} onChange={e => setFormFields({...formFields, priority: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">EMI Due Day</label>
                  <input type="number" min="1" max="31" required value={formFields.due_day} onChange={e => setFormFields({...formFields, due_day: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Notes</label>
                <input type="text" placeholder="Audit notes" value={formFields.notes} onChange={e => setFormFields({...formFields, notes: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white" />
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-500/10 mt-2 cursor-pointer">Update Loan Record</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRM EMI PAYMENT
         ======================================================== */}
      {logConfirmOpen && selectedLoanForLog && (() => {
        const loan = selectedLoanForLog
        const duration = getMonthsDifference(loan.start_date, loan.end_date)
        const { schedule } = parseLoanSchedule(loan.notes || '', loan.emi, loan.principal, duration, loan.start_date, loan.due_day)
        const paymentsCount = payments.filter(p => p.loan_id === loan.id && p.status === 'paid').length
        const amount = schedule[paymentsCount]?.amount || loan.emi

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-3 mb-4">
                <h3 className="font-bold text-md text-slate-900 flex items-center gap-1.5">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <span>Confirm EMI Logging</span>
                </h3>
                <button onClick={() => { setLogConfirmOpen(false); setSelectedLoanForLog(null); }} className="text-slate-500 hover:text-slate-800 text-sm font-semibold p-1 cursor-pointer">Close</button>
              </div>

              <div className="space-y-4 text-xs font-semibold text-slate-700">
                <div className="bg-emerald-50 border border-emerald-200/60 p-3.5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-emerald-800 uppercase block tracking-wider font-bold">Month {paymentsCount + 1} EMI Amount</span>
                  <span className="text-xl font-black text-emerald-600 block">{formatCurrency(amount)}</span>
                  <span className="text-[9px] text-slate-400 block font-normal">Loan: {loan.name}</span>
                </div>

                <p className="text-slate-500 font-normal leading-normal text-center">
                  Are you sure you want to log this EMI payment? This will update the loan outstanding balance and record the payment in your transaction history ledger.
                </p>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setLogConfirmOpen(false); setSelectedLoanForLog(null); }}
                    className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeMarkPaid}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all cursor-pointer text-center"
                  >
                    Confirm & Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ========================================================
          MODAL: CONFIRM UNDO EMI PAYMENT
         ======================================================== */}
      {undoConfirmOpen && selectedLoanForUndo && (() => {
        const loan = selectedLoanForUndo
        const loanPayments = payments.filter(p => p.loan_id === loan.id && p.status === 'paid')
        const lastPayment = loanPayments[0]

        if (!lastPayment) return null

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-3 mb-4">
                <h3 className="font-bold text-md text-slate-900 flex items-center gap-1.5">
                  <Undo className="h-5 w-5 text-rose-600" />
                  <span>Confirm Undo Payment</span>
                </h3>
                <button onClick={() => { setUndoConfirmOpen(false); setSelectedLoanForUndo(null); }} className="text-slate-500 hover:text-slate-800 text-sm font-semibold p-1 cursor-pointer">Close</button>
              </div>

              <div className="space-y-4 text-xs font-semibold text-slate-700">
                <div className="bg-rose-50 border border-rose-200/60 p-3.5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-rose-800 uppercase block tracking-wider font-bold">Last Logged Payment</span>
                  <span className="text-xl font-black text-rose-600 block">{formatCurrency(lastPayment.amount)}</span>
                  <span className="text-[9px] text-slate-400 block font-normal">Paid Date: {lastPayment.payment_date}</span>
                </div>

                <p className="text-slate-500 font-normal leading-normal text-center">
                  Are you sure you want to undo this payment? The payment record will be permanently deleted, and the loan's outstanding balance will be reverted.
                </p>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setUndoConfirmOpen(false); setSelectedLoanForUndo(null); }}
                    className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeUndoPayment}
                    className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold transition-all cursor-pointer text-center"
                  >
                    Yes, Undo Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
