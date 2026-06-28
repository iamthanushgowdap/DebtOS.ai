'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  Coins,
  DollarSign,
  AlertCircle
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { formatCurrency, getLocalTodayStr } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

interface IncomeEntry {
  id: string
  source: 'Salary' | 'Freelancing' | 'Part Time' | 'Business' | 'Other'
  expected_amount: number
  received_amount: number
  status: 'expected' | 'received' | 'pending'
  entry_date: string
}

interface IncomeClientProps {
  userId: string
  initialEntries: IncomeEntry[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export default function IncomeClient({
  userId,
  initialEntries
}: IncomeClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)

  const [entries, setEntries] = useState<IncomeEntry[]>(initialEntries)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<IncomeEntry | null>(null)

  const [formData, setFormData] = useState({
    source: 'Salary',
    expected_amount: '',
    received_amount: '',
    status: 'received',
    entry_date: ''
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculations
  const totalExpected = entries.reduce((sum, e) => sum + Number(e.expected_amount), 0)
  const totalReceived = entries.reduce((sum, e) => sum + Number(e.received_amount), 0)
  const totalPending = entries.reduce((sum, e) => sum + (e.status === 'pending' || e.status === 'expected' ? Number(e.expected_amount) - Number(e.received_amount) : 0), 0)

  // Chart aggregation
  const getChartData = () => {
    const categories: Record<string, number> = {
      Salary: 0,
      Freelancing: 0,
      'Part Time': 0,
      Business: 0,
      Other: 0
    }
    
    entries.forEach(e => {
      categories[e.source] += Number(e.received_amount)
    })

    return Object.keys(categories).map(key => ({
      name: key,
      value: categories[key]
    })).filter(c => c.value > 0)
  }

  const chartData = getChartData()

  const openAddModal = () => {
    setFormData({
      source: 'Salary',
      expected_amount: '',
      received_amount: '',
      status: 'received',
      entry_date: getLocalTodayStr()
    })
    setIsAddOpen(true)
  }

  const openEditModal = (entry: IncomeEntry) => {
    setSelectedEntry(entry)
    setFormData({
      source: entry.source,
      expected_amount: String(entry.expected_amount),
      received_amount: String(entry.received_amount),
      status: entry.status,
      entry_date: entry.entry_date
    })
    setIsEditOpen(true)
  }

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { data, error } = await supabase
      .from('income_entries')
      .insert({
        user_id: userId,
        source: formData.source,
        expected_amount: Number(formData.expected_amount),
        received_amount: Number(formData.received_amount || 0),
        status: formData.status,
        entry_date: formData.entry_date
      })
      .select()

    if (error) {
      alert('Error logging income: ' + error.message)
    } else if (data) {
      setEntries(prev => [data[0] as IncomeEntry, ...prev])
      setIsAddOpen(false)
      confetti({ particleCount: 50, spread: 30 })
      router.refresh()
    }
  }

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEntry) return

    const { data, error } = await supabase
      .from('income_entries')
      .update({
        source: formData.source,
        expected_amount: Number(formData.expected_amount),
        received_amount: Number(formData.received_amount),
        status: formData.status,
        entry_date: formData.entry_date
      })
      .eq('id', selectedEntry.id)
      .select()

    if (error) {
      alert('Error updating income: ' + error.message)
    } else if (data) {
      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? (data[0] as IncomeEntry) : e))
      setIsEditOpen(false)
      router.refresh()
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income record?')) return

    const { error } = await supabase.from('income_entries').delete().eq('id', id)
    if (error) {
      alert('Error deleting income record: ' + error.message)
    } else {
      setEntries(prev => prev.filter(e => e.id !== id))
      router.refresh()
    }
  }

  const handleMarkReceived = async (entry: IncomeEntry) => {
    const { data, error } = await supabase
      .from('income_entries')
      .update({
        received_amount: entry.expected_amount,
        status: 'received'
      })
      .eq('id', entry.id)
      .select()

    if (error) {
      alert('Failed to update: ' + error.message)
      return
    }

    setEntries(prev => prev.map(e => e.id === entry.id ? (data[0] as IncomeEntry) : e))
    confetti({ particleCount: 80, spread: 45 })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Income Ledger</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Log cash flow streams, pending paychecks, and client receivables.</p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-lg shadow-primary/20 transition-all cursor-pointer self-start lg:self-center"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Log Income</span>
        </button>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Expected</span>
          <span className="text-sm lg:text-lg font-black text-foreground mt-1 block">
            {formatCurrency(totalExpected)}
          </span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Total Received</span>
          <span className="text-sm lg:text-lg font-black text-emerald-400 mt-1 block">
            {formatCurrency(totalReceived)}
          </span>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Pending / Expected</span>
          <span className="text-sm lg:text-lg font-black text-amber-400 mt-1 block">
            {formatCurrency(totalPending)}
          </span>
        </div>
      </div>

      {/* Main Grid: Entries and Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Income Logs Table (2/3 width) */}
        <div className="bg-card border border-border rounded-2xl p-5 overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
            <Coins className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">Income Entry Logs</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="pb-3 pr-2">Source</th>
                  <th className="pb-3 px-2 text-right">Expected</th>
                  <th className="pb-3 px-2 text-right">Received</th>
                  <th className="pb-3 px-2">Date</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 pl-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">No income entries logged yet.</td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/30 hover:bg-secondary/10 group">
                      <td className="py-3 pr-2 font-bold text-foreground">{entry.source}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{formatCurrency(entry.expected_amount)}</td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-400">{formatCurrency(entry.received_amount)}</td>
                      <td className="py-3 px-2 text-muted-foreground">{entry.entry_date}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          entry.status === 'received' 
                            ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' 
                            : entry.status === 'pending'
                              ? 'bg-amber-950/20 text-amber-400 border-amber-900/30'
                              : 'bg-blue-950/20 text-blue-400 border-blue-900/30'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                          {entry.status !== 'received' && (
                            <button
                              onClick={() => handleMarkReceived(entry)}
                              className="p-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 cursor-pointer"
                              title="Mark as Received"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
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
            <h3 className="font-bold text-sm text-foreground">Income Distribution</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Visual representation of earnings by category.</p>
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
                No active income data to render.
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
          MODAL: ADD ENTRY
         ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Log Income Cash Flow</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Income Source</label>
                <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
                  <option value="Salary">Salary (Primary paycheck)</option>
                  <option value="Freelancing">Freelancing (Contracts)</option>
                  <option value="Part Time">Part Time (Side jobs)</option>
                  <option value="Business">Business (Ventures)</option>
                  <option value="Other">Other (Gifts, investments)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Expected Amount</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="₹ Expected" 
                    value={formData.expected_amount} 
                    onChange={e => {
                      const val = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        expected_amount: val,
                        received_amount: prev.status === 'received' ? val : prev.received_amount
                      }))
                    }} 
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" 
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Received Amount</label>
                  <input 
                    type="number" 
                    placeholder="₹ Received" 
                    value={formData.received_amount} 
                    onChange={e => setFormData({...formData, received_amount: e.target.value})} 
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => {
                      const newStatus = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        status: newStatus as any,
                        received_amount: newStatus === 'received' && (prev.received_amount === '0' || !prev.received_amount) 
                          ? prev.expected_amount 
                          : prev.received_amount
                      }))
                    }} 
                    className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="pending">Pending (Expected soon)</option>
                    <option value="received">Received (Already in bank)</option>
                    <option value="expected">Future Expected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Entry Date</label>
                  <input type="date" required value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer">Register Income Stream</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT ENTRY
         ======================================================== */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Edit Income Record</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleEditEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Income Source</label>
                <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
                  <option value="Salary">Salary</option>
                  <option value="Freelancing">Freelancing</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Business">Business</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Expected Amount</label>
                  <input type="number" required value={formData.expected_amount} onChange={e => setFormData({...formData, expected_amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Received Amount</label>
                  <input type="number" required value={formData.received_amount} onChange={e => setFormData({...formData, received_amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary">
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                    <option value="expected">Future Expected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Entry Date</label>
                  <input type="date" required value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer">Update Income Record</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
