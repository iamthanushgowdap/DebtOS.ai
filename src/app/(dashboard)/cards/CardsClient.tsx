'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  CreditCard as CardIcon, 
  TrendingDown, 
  AlertTriangle,
  History,
  CheckCircle,
  HelpCircle,
  Clock,
  Zap,
  Info
} from 'lucide-react'
import { formatCurrency, getLocalTodayStr } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

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
  interest_rate?: number
  statement_date_full?: string
  due_date_full?: string
  bill_due?: number
}

interface Payment {
  id: string
  credit_card_id: string
  amount: number
  payment_date: string
  credit_cards?: {
    card_name: string
  }
}

interface CardsClientProps {
  userId: string
  initialCards: CreditCard[]
  initialPayments: any[]
}

export default function CardsClient({
  userId,
  initialCards,
  initialPayments
}: CardsClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [cards, setCards] = useState<CreditCard[]>(initialCards)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [activeTab, setActiveTab] = useState<'cards' | 'history'>('cards')

  // Modals Toggle
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPayOpen, setIsPayOpen] = useState(false)
  const [isStatementOpen, setIsStatementOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null)

  // MPIN Validation States
  const [userMpin, setUserMpin] = useState<string | null>(null)
  const [addCardMpin, setAddCardMpin] = useState('')
  const [addCardMpinError, setAddCardMpinError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserMpin(user.user_metadata?.mpin || '')
      }
    })
  }, [])

  // Form Fields
  const [formData, setFormData] = useState({
    card_name: '',
    bank: '',
    credit_limit: '',
    current_utilization: '0',
    minimum_due: '0',
    bill_due: '0',
    statement_date: '10',
    due_date: '25',
    annual_fee: '0',
    status: 'active',
    interest_rate: '40.0'
  })

  // Payment Modal Fields
  const [paymentAmount, setPaymentAmount] = useState('')

  // Statement Modal Fields
  const [statementBill, setStatementBill] = useState('')
  const [statementMinDue, setStatementMinDue] = useState('')
  const [statementDateFull, setStatementDateFull] = useState('')
  const [statementDueDateFull, setStatementDueDateFull] = useState('')
  const [statementInterestRate, setStatementInterestRate] = useState('40.0')

  // Rotation Modal Fields
  const [isRotateOpen, setIsRotateOpen] = useState(false)
  const [rotateAmount, setRotateAmount] = useState('')
  const [cashoutAmount, setCashoutAmount] = useState('')
  const [rotationFeePercent, setRotationFeePercent] = useState('2.0')

  const openRotateModal = (card: CreditCard) => {
    setSelectedCard(card)
    setRotateAmount(String(card.current_utilization || ''))
    setCashoutAmount(String(card.current_utilization || ''))
    setRotationFeePercent('2.0')
    setIsRotateOpen(true)
  }

  const handleRotateCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard || !rotateAmount || !cashoutAmount || isNaN(Number(rotateAmount)) || isNaN(Number(cashoutAmount))) return

    const payAmt = Number(rotateAmount)
    const drawAmt = Number(cashoutAmount)
    const feePct = Number(rotationFeePercent) || 0
    const feeAmt = Math.round((drawAmt * feePct) / 100)

    const updatedUtilization = Math.max(0, Number(selectedCard.current_utilization) - payAmt + drawAmt)
    const updatedBillDue = Math.max(0, Number(selectedCard.bill_due || 0) - payAmt)

    // 1. Log Payment
    const { data: newPayment, error: payError } = await supabase
      .from('credit_card_payments')
      .insert({
        credit_card_id: selectedCard.id,
        user_id: userId,
        amount: payAmt,
        payment_date: getLocalTodayStr()
      })
      .select('*, credit_cards(card_name)')

    if (payError) {
      alert('Failed to log rotation payment: ' + payError.message)
      return
    }

    // 2. Log Cashout Income
    if (drawAmt > 0) {
      const { error: incError } = await supabase
        .from('income_entries')
        .insert({
          user_id: userId,
          source: 'Other',
          expected_amount: drawAmt,
          received_amount: drawAmt,
          status: 'received',
          entry_date: getLocalTodayStr()
        })
      if (incError) {
        alert('Failed to log cashout income: ' + incError.message)
        return
      }
    }

    // 3. Log Rotation Fee Expense
    if (feeAmt > 0) {
      const { error: expError } = await supabase
        .from('expense_entries')
        .insert({
          user_id: userId,
          category: 'Bills',
          amount: feeAmt,
          entry_date: getLocalTodayStr(),
          description: `CC Rotation Fee (${feePct}%) - ${selectedCard.card_name}`
        })
      if (expError) {
        alert('Failed to log rotation fee expense: ' + expError.message)
        return
      }
    }

    // 4. Update Card Utilization and Bill Due
    const { error: cardError } = await supabase
      .from('credit_cards')
      .update({ current_utilization: updatedUtilization, bill_due: updatedBillDue })
      .eq('id', selectedCard.id)

    if (cardError) {
      alert('Failed to update card details: ' + cardError.message)
      return
    }

    // 5. Log Audit
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'rotate_credit_card',
      details: { card_name: selectedCard.card_name, payment_amount: payAmt, cashout_amount: drawAmt, fee: feeAmt, utilization_remaining: updatedUtilization, bill_due_remaining: updatedBillDue }
    })

    // 6. Update local state
    setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, current_utilization: updatedUtilization, bill_due: updatedBillDue } : c))
    if (newPayment) {
      setPayments(prev => [newPayment[0] as unknown as Payment, ...prev])
    }

    setIsRotateOpen(false)
    confetti({ particleCount: 100, spread: 60 })
    router.refresh()
  }

  // Calculations
  const totalLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit), 0)
  const totalUtilization = cards.reduce((sum, c) => sum + Number(c.current_utilization), 0)
  const totalBillDue = cards.reduce((sum, c) => sum + Number(c.bill_due || 0), 0)
  const totalAvailable = totalLimit - totalUtilization
  const globalUtilizationPercent = totalLimit > 0 ? Math.round((totalUtilization / totalLimit) * 100) : 0

  const openAddModal = () => {
    setAddCardMpin('')
    setAddCardMpinError('')
    setFormData({
      card_name: '',
      bank: '',
      credit_limit: '',
      current_utilization: '0',
      minimum_due: '0',
      bill_due: '0',
      statement_date: '10',
      due_date: '25',
      annual_fee: '0',
      status: 'active',
      interest_rate: '40.0'
    })
    setIsAddOpen(true)
  }

  const openEditModal = (card: CreditCard) => {
    setSelectedCard(card)
    setFormData({
      card_name: card.card_name,
      bank: card.bank,
      credit_limit: String(card.credit_limit),
      current_utilization: String(card.current_utilization),
      minimum_due: String(card.minimum_due),
      bill_due: String(card.bill_due || '0'),
      statement_date: String(card.statement_date),
      due_date: String(card.due_date),
      annual_fee: String(card.annual_fee),
      status: card.status,
      interest_rate: String(card.interest_rate || '40.0')
    })
    setIsEditOpen(true)
  }

  const openPayModal = (card: CreditCard) => {
    setSelectedCard(card)
    const displayMinDue = card.minimum_due > 0 ? card.minimum_due : Math.round(card.current_utilization * 0.05)
    setPaymentAmount(String(displayMinDue || ''))
    setIsPayOpen(true)
  }

  const openStatementModal = (card: CreditCard) => {
    setSelectedCard(card)
    setStatementBill(String(card.bill_due || ''))
    const defaultMinDue = card.minimum_due > 0 ? card.minimum_due : Math.round(card.current_utilization * 0.05)
    setStatementMinDue(String(defaultMinDue || ''))
    setStatementDateFull(card.statement_date_full || '')
    setStatementDueDateFull(card.due_date_full || '')
    setStatementInterestRate(String(card.interest_rate || '40.0'))
    setIsStatementOpen(true)
  }

  // API Methods
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userMpin) {
      if (addCardMpin !== userMpin) {
        setAddCardMpinError('Incorrect 4-digit MPIN. Please try again.')
        return
      }
    }
    const limit = Number(formData.credit_limit)
    const utilization = Number(formData.current_utilization || 0)
    const minDue = 0
    const billDueVal = 0
    const interestRateVal = 40.0

    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        user_id: userId,
        card_name: formData.card_name,
        bank: formData.bank,
        credit_limit: limit,
        current_utilization: utilization,
        minimum_due: minDue,
        bill_due: billDueVal,
        statement_date: 10,
        due_date: 25,
        annual_fee: 0,
        status: 'active',
        interest_rate: interestRateVal
      })
      .select()

    if (error) {
      alert('Error creating credit card: ' + error.message)
    } else if (data) {
      setCards(prev => [...prev, data[0] as CreditCard])
      setIsAddOpen(false)
      confetti({ particleCount: 60, spread: 40 })
      router.refresh()
    }
  }

  const handleEditCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard) return

    const { data, error } = await supabase
      .from('credit_cards')
      .update({
        card_name: formData.card_name,
        bank: formData.bank,
        credit_limit: Number(formData.credit_limit),
        current_utilization: Number(formData.current_utilization)
      })
      .eq('id', selectedCard.id)
      .select()

    if (error) {
      alert('Error updating credit card: ' + error.message)
    } else if (data) {
      setCards(prev => prev.map(c => c.id === selectedCard.id ? (data[0] as CreditCard) : c))
      setIsEditOpen(false)
      router.refresh()
    }
  }

  const handleStatementSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard || !statementBill || !statementMinDue || !statementDateFull || !statementDueDateFull) return

    const billVal = Number(statementBill)
    const minDueVal = Number(statementMinDue)
    const rateVal = Number(statementInterestRate) || 40.0

    const stmtDateObj = new Date(statementDateFull)
    const dueDateObj = new Date(statementDueDateFull)
    const stmtDay = isNaN(stmtDateObj.getDate()) ? 10 : stmtDateObj.getDate()
    const dueDay = isNaN(dueDateObj.getDate()) ? 25 : dueDateObj.getDate()

    const { data, error } = await supabase
      .from('credit_cards')
      .update({
        current_utilization: Math.max(selectedCard.current_utilization, billVal),
        minimum_due: minDueVal,
        bill_due: billVal,
        statement_date: stmtDay,
        due_date: dueDay,
        statement_date_full: statementDateFull,
        due_date_full: statementDueDateFull,
        interest_rate: rateVal
      })
      .eq('id', selectedCard.id)
      .select()

    if (error) {
      alert('Failed to update statement: ' + error.message)
      return
    }

    if (data) {
      setCards(prev => prev.map(c => c.id === selectedCard.id ? (data[0] as CreditCard) : c))
      setIsStatementOpen(false)
      confetti({ particleCount: 100, spread: 60 })
      router.refresh()
    }
  }

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credit card?')) return

    const { error } = await supabase.from('credit_cards').delete().eq('id', id)
    if (error) {
      alert('Error deleting credit card: ' + error.message)
    } else {
      setCards(prev => prev.filter(c => c.id !== id))
      router.refresh()
    }
  }

  const handlePayCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard || !paymentAmount || isNaN(Number(paymentAmount))) return

    const amountPaid = Number(paymentAmount)
    const updatedUtilization = Math.max(0, Number(selectedCard.current_utilization) - amountPaid)

    // 1. Log Payment
    const { data: newPayment, error: payError } = await supabase
      .from('credit_card_payments')
      .insert({
        credit_card_id: selectedCard.id,
        user_id: userId,
        amount: amountPaid,
        payment_date: getLocalTodayStr()
      })
      .select('*, credit_cards(card_name)')

    if (payError) {
      alert('Failed to log payment: ' + payError.message)
      return
    }

    // 2. Update Card Utilization
    const { error: cardError } = await supabase
      .from('credit_cards')
      .update({ current_utilization: updatedUtilization })
      .eq('id', selectedCard.id)

    if (cardError) {
      alert('Payment registered but utilization update failed: ' + cardError.message)
      return
    }

    // 3. Log Audit
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'pay_credit_card',
      details: { card_name: selectedCard.card_name, amount: amountPaid, utilization_remaining: updatedUtilization }
    })

    // 4. Update state
    setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, current_utilization: updatedUtilization } : c))
    if (newPayment) {
      setPayments(prev => [newPayment[0] as unknown as Payment, ...prev])
    }

    setIsPayOpen(false)
    confetti({ particleCount: 100, spread: 60 })
    router.refresh()
  }

  // Help utilities to evaluate risk color
  const getCardStatusStyles = (utilizationPercent: number) => {
    if (utilizationPercent < 30) {
      return {
        progressBar: 'bg-emerald-500',
        badge: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30',
        cardBorder: 'hover:border-emerald-500/20',
        text: 'text-emerald-400',
        riskLevel: 'Low Risk'
      }
    } else if (utilizationPercent < 70) {
      return {
        progressBar: 'bg-amber-500',
        badge: 'bg-amber-950/20 text-amber-400 border-amber-900/30',
        cardBorder: 'hover:border-amber-500/20',
        text: 'text-amber-400',
        riskLevel: 'Moderate Risk'
      }
    } else if (utilizationPercent < 90) {
      return {
        progressBar: 'bg-rose-500',
        badge: 'bg-rose-950/20 text-rose-400 border-rose-900/30',
        cardBorder: 'hover:border-rose-500/20 shadow-md shadow-rose-950/10',
        text: 'text-rose-400',
        riskLevel: 'High Risk'
      }
    } else {
      return {
        progressBar: 'bg-red-600 animate-pulse',
        badge: 'bg-red-950/30 text-red-500 border-red-900/40 font-black animate-pulse',
        cardBorder: 'border-red-900/60 hover:border-red-600 shadow-lg shadow-red-950/20',
        text: 'text-red-500 font-extrabold',
        riskLevel: 'Critical'
      }
    }
  }



  return (
    <div className="space-y-6">
      
      {/* Top Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Credit Cards Command</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Control credit limits, monitor risk ratios, and review payment warnings.</p>
        </div>

        {/* Tab triggers & Add Button */}
        <div className="flex items-center gap-3">
          <div className="bg-secondary/40 border border-border p-1 rounded-lg flex text-xs">
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${activeTab === 'cards' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Active Cards
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${activeTab === 'history' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Payment Logs
            </button>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-lg shadow-primary/20 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Card</span>
          </button>
        </div>
      </div>

      {/* Global Card Ratios */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <div className="bg-card border border-border p-4 rounded-xl">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Borrowed</span>
          <span className="text-md lg:text-lg font-black text-foreground mt-1 block">{formatCurrency(totalUtilization)}</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Rotation Cost (2%)</span>
          <span className="text-md lg:text-lg font-black text-blue-400 mt-1 block">{formatCurrency(totalUtilization * 0.02)}</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Available Limit</span>
          <span className="text-md lg:text-lg font-black text-emerald-400 mt-1 block">{formatCurrency(totalAvailable)}</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Total Credit Pool</span>
          <span className="text-md lg:text-lg font-black text-foreground mt-1 block">{formatCurrency(totalLimit)}</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Avg Utilization</span>
          <span className={`text-md lg:text-lg font-black mt-1 block ${globalUtilizationPercent > 70 ? 'text-rose-400' : 'text-foreground'}`}>
            {globalUtilizationPercent}%
          </span>
        </div>
      </div>

      {activeTab === 'cards' ? (
        /* Credit Cards Grid */
        cards.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-card/20 space-y-3">
            <CardIcon className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">No Credit Cards Mapped</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">Track utilization, minimum dues, and risk warning thresholds.</p>
            <button onClick={openAddModal} className="text-xs font-bold text-primary hover:underline">Add your first card</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const utilPercent = card.credit_limit > 0 ? Math.round((card.current_utilization / card.credit_limit) * 100) : 0
              const styles = getCardStatusStyles(utilPercent)

              // Suggesion: pay down to below 30%
              const targetUtilizationLimit = card.credit_limit * 0.3
              const amountToPayForHealthy = Math.max(0, card.current_utilization - targetUtilizationLimit)

              return (
                <div key={card.id} className={`bg-card border p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-all relative overflow-hidden group ${card.status === 'inactive' ? 'opacity-50' : ''} ${styles.cardBorder}`}>
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{card.card_name}</h3>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${styles.badge}`}>
                          {styles.riskLevel}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">{card.bank}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(card)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Edit Card"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteCard(card.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" title="Delete Card"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  {/* Utilization Progress Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                      <span>Card Spent (Utilization)</span>
                      <span className={styles.text}>{utilPercent}% Used</span>
                    </div>
                    <div className="text-md font-extrabold text-foreground">
                      {formatCurrency(card.current_utilization)}
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">of {formatCurrency(card.credit_limit)}</span>
                    </div>
                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${styles.progressBar}`} style={{ width: `${utilPercent}%` }} />
                    </div>
                  </div>

                  {/* Payment Suggestion Alerts */}
                  {amountToPayForHealthy > 0 && (
                    <div className="bg-amber-950/20 border border-amber-900/30 p-2.5 rounded-xl flex items-start gap-2 text-[10px]">
                      <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="text-muted-foreground leading-normal">
                        Pay <strong className="text-foreground">{formatCurrency(amountToPayForHealthy)}</strong> to restore utilization below <strong className="text-emerald-400">30%</strong> (ideal credit health).
                      </div>
                    </div>
                  )}

                  {/* Dynamic stats */}
                  <div className="grid grid-cols-2 gap-2 border-t border-b border-border/50 py-2.5 text-[10px] font-medium">
                    <div>
                      <span className="text-muted-foreground block">Available Credit</span>
                      <span className="text-emerald-400 font-bold mt-0.5 block">{formatCurrency(card.credit_limit - card.current_utilization)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Rotation Cost (2%)</span>
                      <span className="text-blue-400 font-bold mt-0.5 block">{formatCurrency(card.current_utilization * 0.02)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-1.5 pt-2 border-t border-border/20">
                    <button
                      onClick={() => openRotateModal(card)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg transition-all cursor-pointer text-[10px] font-bold shadow-sm shadow-blue-500/10"
                      title="Refinance by rotating limit"
                    >
                      <Zap className="h-3.5 w-3.5 text-blue-100" />
                      <span>Rotate Card</span>
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Historical Credit Card Payments */
        <div className="bg-card border border-border rounded-2xl p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">Credit Card Payments Log</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="pb-3 pr-2">Card Name</th>
                  <th className="pb-3 px-2 text-right">Amount Paid</th>
                  <th className="pb-3 px-2">Payment Date</th>
                  <th className="pb-3 pl-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">No payments logged for credit cards.</td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/10">
                      <td className="py-3 pr-2 font-bold text-foreground">{p.credit_cards?.card_name || 'Deleted Card'}</td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-400">{formatCurrency(p.amount)}</td>
                      <td className="py-3 px-2 text-muted-foreground">{p.payment_date}</td>
                      <td className="py-3 pl-2 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 font-bold uppercase">Paid</span>
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
          MODAL: ADD CREDIT CARD
         ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Map New Credit Card</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Card Name</label>
                  <input type="text" required placeholder="e.g. SBI Cashback" value={formData.card_name} onChange={e => setFormData({...formData, card_name: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Bank / Issuer</label>
                  <input type="text" required placeholder="e.g. State Bank of India" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Credit Limit</label>
                  <input type="number" required placeholder="₹ Credit Limit" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Current Utilization</label>
                  <input type="number" required placeholder="₹ Spent Amount" value={formData.current_utilization} onChange={e => setFormData({...formData, current_utilization: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              {userMpin === '' ? (
                <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl flex gap-2 text-[10px] text-amber-400 font-semibold leading-normal">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p>You must set up a 4-digit MPIN in Settings before adding credit cards.</p>
                    <a href="/settings" className="text-blue-400 hover:underline block mt-1.5 font-bold">Go to Settings &rarr;</a>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Enter 4-Digit MPIN to Confirm Creation</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={addCardMpin}
                    onChange={e => {
                      setAddCardMpin(e.target.value.replace(/\D/g, ''))
                      setAddCardMpinError('')
                    }}
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-center font-mono tracking-widest text-sm font-bold"
                  />
                  {addCardMpinError && (
                    <p className="text-rose-500 text-[10px] font-semibold text-center mt-1">{addCardMpinError}</p>
                  )}
                </div>
              )}

              {userMpin !== '' && (
                <button type="submit" disabled={addCardMpin.length !== 4} className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer">Register Credit Card</button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT CREDIT CARD
         ======================================================== */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Edit Credit Card</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleEditCard} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Card Name</label>
                  <input type="text" required value={formData.card_name} onChange={e => setFormData({...formData, card_name: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Bank</label>
                  <input type="text" required value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Credit Limit</label>
                  <input type="number" required value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Current Utilization</label>
                  <input type="number" required value={formData.current_utilization} onChange={e => setFormData({...formData, current_utilization: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer">Update Card Details</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: PAY CREDIT CARD
         ======================================================== */}
      {isPayOpen && selectedCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Repay {selectedCard.card_name}</h3>
              <button onClick={() => setIsPayOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handlePayCardSubmit} className="space-y-4 text-xs">
              <div className="bg-secondary/40 border border-border p-3.5 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Current Balance Due</span>
                <span className="text-lg font-black text-rose-400 block">{formatCurrency(selectedCard.current_utilization)}</span>
                <span className="text-[9px] text-muted-foreground block">Minimum Due: {formatCurrency(selectedCard.minimum_due)}</span>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Enter Payment Amount (INR)</label>
                <input
                  type="number"
                  required
                  placeholder="₹ Amount to pay"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentAmount(String(selectedCard.minimum_due))}
                  className="flex-1 py-1.5 px-2 bg-secondary text-foreground hover:bg-secondary/80 rounded font-semibold text-[10px] cursor-pointer"
                >
                  Pay Min Due
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(String(selectedCard.current_utilization))}
                  className="flex-1 py-1.5 px-2 bg-secondary text-foreground hover:bg-secondary/80 rounded font-semibold text-[10px] cursor-pointer"
                >
                  Pay Full Balance
                </button>
              </div>

              {Number(paymentAmount) < selectedCard.current_utilization && Number(paymentAmount) >= selectedCard.minimum_due && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10px] text-amber-800 flex gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="leading-normal">
                    ⚠️ Paying less than the full statement balance will accrue interest at <strong className="text-foreground">{selectedCard.interest_rate || 40}% p.a.</strong> on the remaining unpaid balance of <strong className="text-foreground">{formatCurrency(selectedCard.current_utilization - Number(paymentAmount))}</strong> (approx. <strong className="text-foreground">{formatCurrency(Math.round(((selectedCard.current_utilization - Number(paymentAmount)) * (selectedCard.interest_rate || 40.0) / 100) / 12))}/month</strong>).
                  </p>
                </div>
              )}

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold transition-all text-white cursor-pointer mt-4">Confirm Payment Receipt</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: UPDATE STATEMENT DETAILS
         ======================================================== */}
      {isStatementOpen && selectedCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Log Card Statement</h3>
              <button onClick={() => setIsStatementOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleStatementSubmit} className="space-y-3.5 text-xs text-slate-700">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[10px] text-amber-700 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="leading-normal">
                  Log your latest credit card statement details. This updates the outstanding balance, minimum due, and tracks payment deadlines in your calendar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Bill Due (Statement Total)</label>
                  <input
                    type="number"
                    required
                    placeholder="₹ Statement Balance"
                    value={statementBill}
                    onChange={e => {
                      const val = e.target.value
                      setStatementBill(val)
                      setStatementMinDue(String(Math.round(Number(val) * 0.05)))
                    }}
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Minimum Due</label>
                  <input
                    type="number"
                    required
                    placeholder="₹ Minimum Payment"
                    value={statementMinDue}
                    onChange={e => setStatementMinDue(e.target.value)}
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Statement Date</label>
                  <input
                    type="date"
                    required
                    placeholder="DD/MM/YYYY"
                    value={statementDateFull}
                    onChange={e => setStatementDateFull(e.target.value)}
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    placeholder="DD/MM/YYYY"
                    value={statementDueDateFull}
                    onChange={e => setStatementDueDateFull(e.target.value)}
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Interest Rate (% per annum)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="40.0"
                  value={statementInterestRate}
                  onChange={e => setStatementInterestRate(e.target.value)}
                  className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                />
              </div>

              {Number(statementBill) > 0 && Number(statementMinDue) > 0 && Number(statementBill) > Number(statementMinDue) && (
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[10px] text-rose-700 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="leading-normal">
                    <strong>⚠️ Interest Warning:</strong> If you only pay the minimum due of <strong>{formatCurrency(Number(statementMinDue))}</strong>, the remaining balance of <strong>{formatCurrency(Number(statementBill) - Number(statementMinDue))}</strong> will accrue finance charges at <strong>{statementInterestRate}% p.a.</strong>, costing approximately <strong>{formatCurrency(Math.round(((Number(statementBill) - Number(statementMinDue)) * (Number(statementInterestRate) / 100)) / 12))}/month</strong>.
                  </div>
                </div>
              )}

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all mt-4 cursor-pointer">Update Card Statement</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ROTATE CREDIT CARD LIMIT
         ======================================================== */}
      {isRotateOpen && selectedCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Rotate {selectedCard.card_name} Limit</h3>
              <button onClick={() => setIsRotateOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleRotateCardSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="bg-blue-950/20 border border-blue-900/30 p-3 rounded-xl text-[10px] text-muted-foreground flex gap-2">
                <Zap className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="leading-normal">
                  Rotation logs a credit card statement payment and immediately re-draws the limit. Cash-out charges (1.5% - 3%) will be registered as an expense to keep your cash balance accurate.
                </p>
              </div>

              <div className="bg-secondary/40 border border-border p-3 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase block font-bold">Current Balance Outstanding</span>
                <span className="text-md font-black text-rose-400 block">{formatCurrency(selectedCard.current_utilization)}</span>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Rotation Payment Amount (INR)</label>
                <input
                  type="number"
                  required
                  placeholder="₹ Amount to pay"
                  value={rotateAmount}
                  onChange={e => setRotateAmount(e.target.value)}
                  className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-muted-foreground font-semibold">Re-drawn Cashout Amount (INR)</label>
                  <button type="button" onClick={() => setCashoutAmount(rotateAmount)} className="text-[10px] text-primary font-bold hover:underline">Match Payment</button>
                </div>
                <input
                  type="number"
                  required
                  placeholder="₹ Amount to cashout back"
                  value={cashoutAmount}
                  onChange={e => setCashoutAmount(e.target.value)}
                  className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Cash-out Fee (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    placeholder="e.g. 2.0"
                    value={rotationFeePercent}
                    onChange={e => setRotationFeePercent(e.target.value)}
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-bold"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-[9px] text-muted-foreground block uppercase font-bold">Calculated Fee Cost</span>
                  <span className="text-sm font-black text-rose-400 mt-1 block">
                    {formatCurrency(Math.round((Number(cashoutAmount) * (Number(rotationFeePercent) || 0)) / 100))}
                  </span>
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold transition-all text-white cursor-pointer mt-2">Confirm Limit Rotation</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
