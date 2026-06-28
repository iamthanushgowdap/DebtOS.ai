'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  TrendingDown, 
  HelpCircle,
  FileText,
  AlertTriangle,
  Receipt
} from 'lucide-react'
import { 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { formatCurrency, getLocalTodayStr } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface ExpenseEntry {
  id: string
  category: 'Home' | 'Food' | 'Travel' | 'Bills' | 'Entertainment' | 'Shopping' | 'Medical' | 'Education' | 'Other'
  amount: number
  entry_date: string
  description: string
  credit_card_id?: string | null
}

interface CreditCard {
  id: string
  card_name: string
  bank: string
  credit_limit: number
  current_utilization: number
}

interface ExpenseClientProps {
  userId: string
  initialEntries: ExpenseEntry[]
  cards: CreditCard[]
}

const COLORS = [
  '#f43f5e', // Home - rose
  '#f59e0b', // Food - amber
  '#3b82f6', // Travel - blue
  '#10b981', // Bills - emerald
  '#8b5cf6', // Entertainment - violet
  '#ec4899', // Shopping - pink
  '#ef4444', // Medical - red
  '#06b6d4', // Education - cyan
  '#64748b'  // Other - slate
]

export default function ExpenseClient({
  userId,
  initialEntries,
  cards
}: ExpenseClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)

  const [entries, setEntries] = useState<ExpenseEntry[]>(initialEntries)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ExpenseEntry | null>(null)

  const [formData, setFormData] = useState({
    category: 'Food',
    amount: '',
    entry_date: '',
    description: '',
    credit_card_id: ''
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculations
  const totalExpenses = entries.reduce((sum, e) => sum + Number(e.amount), 0)
  
  // Highest Category calculation
  const getCategoryBreakdown = () => {
    const categories: Record<string, number> = {
      Home: 0, Food: 0, Travel: 0, Bills: 0, Entertainment: 0, Shopping: 0, Medical: 0, Education: 0, Other: 0
    }
    entries.forEach(e => {
      if (categories[e.category] !== undefined) {
        categories[e.category] += Number(e.amount)
      }
    })
    return categories
  }
  
  const categoriesBreakdown = getCategoryBreakdown()
  
  const getHighestCategory = () => {
    let maxCat = 'None'
    let maxVal = 0
    Object.keys(categoriesBreakdown).forEach(key => {
      if (categoriesBreakdown[key] > maxVal) {
        maxVal = categoriesBreakdown[key]
        maxCat = key
      }
    })
    return { name: maxCat, value: maxVal }
  }

  const highestCategory = getHighestCategory()
  const dailyBurn = (totalExpenses / 30).toFixed(0)

  // Chart data formatting
  const chartData = Object.keys(categoriesBreakdown)
    .map(key => ({
      name: key,
      value: categoriesBreakdown[key]
    }))
    .filter(c => c.value > 0)

  const openAddModal = () => {
    setFormData({
      category: 'Food',
      amount: '',
      entry_date: getLocalTodayStr(),
      description: '',
      credit_card_id: ''
    })
    setIsAddOpen(true)
  }

  const openEditModal = (entry: ExpenseEntry) => {
    setSelectedEntry(entry)
    setFormData({
      category: entry.category,
      amount: String(entry.amount),
      entry_date: entry.entry_date,
      description: entry.description || '',
      credit_card_id: entry.credit_card_id || ''
    })
    setIsEditOpen(true)
  }

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data, error } = await supabase
      .from('expense_entries')
      .insert({
        user_id: userId,
        category: formData.category,
        amount: Number(formData.amount),
        entry_date: formData.entry_date,
        description: formData.description,
        credit_card_id: formData.credit_card_id || null
      })
      .select()

    if (error) {
      alert('Error logging expense: ' + error.message)
    } else if (data) {
      if (formData.credit_card_id) {
        const card = cards?.find(c => c.id === formData.credit_card_id)
        if (card) {
          const updatedUtil = Number(card.current_utilization) + Number(formData.amount)
          await supabase
            .from('credit_cards')
            .update({ current_utilization: updatedUtil })
            .eq('id', card.id)
        }
      }

      setEntries(prev => [data[0] as ExpenseEntry, ...prev])
      setIsAddOpen(false)
      router.refresh()
    }
  }

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEntry) return

    const { data, error } = await supabase
      .from('expense_entries')
      .update({
        category: formData.category,
        amount: Number(formData.amount),
        entry_date: formData.entry_date,
        description: formData.description,
        credit_card_id: formData.credit_card_id || null
      })
      .eq('id', selectedEntry.id)
      .select()

    if (error) {
      alert('Error updating expense: ' + error.message)
    } else if (data) {
      // Revert old credit card utilization
      if (selectedEntry.credit_card_id) {
        const oldCard = cards?.find(c => c.id === selectedEntry.credit_card_id)
        if (oldCard) {
          const revertedUtil = Math.max(0, Number(oldCard.current_utilization) - Number(selectedEntry.amount))
          await supabase
            .from('credit_cards')
            .update({ current_utilization: revertedUtil })
            .eq('id', oldCard.id)
        }
      }

      // Apply new credit card utilization
      if (formData.credit_card_id) {
        const newCard = cards?.find(c => c.id === formData.credit_card_id)
        if (newCard) {
          const { data: latestCard } = await supabase
            .from('credit_cards')
            .select('current_utilization')
            .eq('id', newCard.id)
            .single()
          const baseUtil = latestCard ? Number(latestCard.current_utilization) : Number(newCard.current_utilization)
          const updatedUtil = Number(baseUtil) + Number(formData.amount)
          await supabase
            .from('credit_cards')
            .update({ current_utilization: updatedUtil })
            .eq('id', newCard.id)
        }
      }

      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? (data[0] as ExpenseEntry) : e))
      setIsEditOpen(false)
      router.refresh()
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return

    const deletedEntry = entries.find(e => e.id === id)
    const { error } = await supabase.from('expense_entries').delete().eq('id', id)
    if (error) {
      alert('Error deleting expense record: ' + error.message)
    } else {
      if (deletedEntry && deletedEntry.credit_card_id) {
        const card = cards?.find(c => c.id === deletedEntry.credit_card_id)
        if (card) {
          const updatedUtil = Math.max(0, Number(card.current_utilization) - Number(deletedEntry.amount))
          await supabase
            .from('credit_cards')
            .update({ current_utilization: updatedUtil })
            .eq('id', card.id)
        }
      }

      setEntries(prev => prev.filter(e => e.id !== id))
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Top Title Block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Expense Ledger</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Control discretionary costs, audit category burns, and check daily cash drain.</p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-lg shadow-primary/20 transition-all cursor-pointer self-start lg:self-center"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Log Expense</span>
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Spent</span>
          <span className="text-sm lg:text-lg font-black text-rose-400 mt-1 block">
            {formatCurrency(totalExpenses)}
          </span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Highest Peak</span>
          <span className="text-sm lg:text-lg font-black text-foreground mt-1 block truncate max-w-full">
            {highestCategory.name} ({formatCurrency(highestCategory.value)})
          </span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Daily Average</span>
          <span className="text-sm lg:text-lg font-black text-foreground mt-1 block">
            {formatCurrency(dailyBurn)}/day
          </span>
        </div>
      </div>

      {/* Main Grid: Ledger & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ledger Entries Table (2/3 width) */}
        <div className="bg-card border border-border rounded-2xl p-5 overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">Discretionary Expense Logs</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="pb-3 pr-2">Category</th>
                  <th className="pb-3 px-2">Description</th>
                  <th className="pb-3 px-2 text-right">Amount</th>
                  <th className="pb-3 px-2">Entry Date</th>
                  <th className="pb-3 pl-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">No expenses logged. Keep spending low!</td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/30 hover:bg-secondary/10 group">
                      <td className="py-3 pr-2">
                        <span className="font-bold text-foreground block">{entry.category}</span>
                        {entry.credit_card_id && (
                          <span className="inline-block mt-0.5 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                            💳 {cards?.find(c => c.id === entry.credit_card_id)?.card_name || 'Credit Card'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground max-w-[150px] truncate">{entry.description || '-'}</td>
                      <td className="py-3 px-2 text-right font-bold text-rose-400">{formatCurrency(entry.amount)}</td>
                      <td className="py-3 px-2 text-muted-foreground">{entry.entry_date}</td>
                      <td className="py-3 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(entry)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteEntry(entry.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual breakdowns (1/3 width) */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Spending Breakdown</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Aggregate burn rate by category.</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151722', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '10px' }}
                  />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-12">
                No active spending logged to render charts.
              </div>
            )}
          </div>

          {/* Color keys */}
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground justify-center">
            {chartData.map((d, index) => (
              <span key={index} className="flex items-center gap-1 border border-border/50 px-2 py-0.5 rounded bg-secondary/10">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{d.name}: {formatCurrency(d.value)}</span>
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ========================================================
          MODAL: LOG EXPENSE
         ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Log Ledger Expense</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Expense Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
                  <option value="Food">Food (Groceries, dining out)</option>
                  <option value="Home">Home (Rent, maintenance)</option>
                  <option value="Bills">Bills (Utilities, subscriptions, phone)</option>
                  <option value="Travel">Travel (Commute, fuel, flights)</option>
                  <option value="Entertainment">Entertainment (Movies, outings)</option>
                  <option value="Shopping">Shopping (Clothes, gadgets)</option>
                  <option value="Medical">Medical (Health, meds)</option>
                  <option value="Education">Education (Fees, courses, books)</option>
                  <option value="Other">Other (Miscellaneous)</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Paid Via</label>
                <select value={formData.credit_card_id} onChange={e => setFormData({...formData, credit_card_id: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold">
                  <option value="">Cash / Bank Account</option>
                  {cards.map(card => (
                    <option key={card.id} value={card.id}>
                      💳 {card.card_name} ({card.bank})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Amount Spent (INR)</label>
                <input type="number" required placeholder="₹ Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Date</label>
                  <input type="date" required value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Description</label>
                  <input type="text" placeholder="Short description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer">Log Expense Entry</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT EXPENSE
         ======================================================== */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Edit Expense Record</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleEditEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Expense Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
                  <option value="Food">Food</option>
                  <option value="Home">Home</option>
                  <option value="Bills">Bills</option>
                  <option value="Travel">Travel</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Medical">Medical</option>
                  <option value="Education">Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Paid Via</label>
                <select value={formData.credit_card_id} onChange={e => setFormData({...formData, credit_card_id: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold">
                  <option value="">Cash / Bank Account</option>
                  {cards.map(card => (
                    <option key={card.id} value={card.id}>
                      💳 {card.card_name} ({card.bank})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Amount Spent (INR)</label>
                <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Date</label>
                  <input type="date" required value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Description</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer">Update Expense Record</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
