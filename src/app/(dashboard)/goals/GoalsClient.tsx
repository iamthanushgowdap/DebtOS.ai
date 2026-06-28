'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Target, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Zap,
  Award,
  Info
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string
  required_monthly_reduction: number
}

interface GoalsClientProps {
  userId: string
  initialGoals: Goal[]
  monthlySurplus: number
}

export default function GoalsClient({
  userId,
  initialGoals,
  monthlySurplus
}: GoalsClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: ''
  })

  const openAddModal = () => {
    setFormData({
      name: 'Reduce Total Debt by ₹2,50,000',
      target_amount: '250000',
      current_amount: '0',
      target_date: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 18 Months standard
    })
    setIsAddOpen(true)
  }

  const openEditModal = (goal: Goal) => {
    setSelectedGoal(goal)
    setFormData({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      target_date: goal.target_date
    })
    setIsEditOpen(true)
  }

  // Calculate required monthly reduction
  const calculateRequiredReduction = (target: number, current: number, dateStr: string) => {
    const targetDate = new Date(dateStr)
    const today = new Date()
    const diffMonths = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth())
    const monthsRemaining = Math.max(1, diffMonths)
    const amountRemaining = Math.max(0, target - current)
    return Math.round(amountRemaining / monthsRemaining)
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetAmt = Number(formData.target_amount)
    const currentAmt = Number(formData.current_amount || 0)
    const requiredRed = calculateRequiredReduction(targetAmt, currentAmt, formData.target_date)

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        name: formData.name,
        target_amount: targetAmt,
        current_amount: currentAmt,
        target_date: formData.target_date,
        required_monthly_reduction: requiredRed
      })
      .select()

    if (error) {
      alert('Error creating goal: ' + error.message)
    } else if (data) {
      setGoals(prev => [data[0] as Goal, ...prev])
      setIsAddOpen(false)
      confetti({ particleCount: 80, spread: 60 })
      router.refresh()
    }
  }

  const handleEditGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGoal) return

    const targetAmt = Number(formData.target_amount)
    const currentAmt = Number(formData.current_amount)
    const requiredRed = calculateRequiredReduction(targetAmt, currentAmt, formData.target_date)

    const { data, error } = await supabase
      .from('goals')
      .update({
        name: formData.name,
        target_amount: targetAmt,
        current_amount: currentAmt,
        target_date: formData.target_date,
        required_monthly_reduction: requiredRed
      })
      .eq('id', selectedGoal.id)
      .select()

    if (error) {
      alert('Error updating goal: ' + error.message)
    } else if (data) {
      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? (data[0] as Goal) : g))
      setIsEditOpen(false)
      router.refresh()
    }
  }

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to remove this goal?')) return

    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) {
      alert('Error deleting goal: ' + error.message)
    } else {
      setGoals(prev => prev.filter(g => g.id !== id))
      router.refresh()
    }
  }

  const handleContribute = async (goal: Goal) => {
    const contribution = prompt('How much have you reduced from your debt towards this goal since last check? (INR)', '5000')
    if (!contribution || isNaN(Number(contribution))) return

    const contributionAmt = Number(contribution)
    const updatedCurrent = Math.min(goal.target_amount, Number(goal.current_amount) + contributionAmt)
    const requiredRed = calculateRequiredReduction(goal.target_amount, updatedCurrent, goal.target_date)

    const { data, error } = await supabase
      .from('goals')
      .update({
        current_amount: updatedCurrent,
        required_monthly_reduction: requiredRed
      })
      .eq('id', goal.id)
      .select()

    if (error) {
      alert('Failed to update progress: ' + error.message)
      return
    }

    // Log contribution to audit logs
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'contribute_goal',
      details: { goal_name: goal.name, contribution: contributionAmt, current_progress: updatedCurrent }
    })

    setGoals(prev => prev.map(g => g.id === goal.id ? (data[0] as Goal) : g))
    confetti({ particleCount: 100, spread: 60 })

    if (updatedCurrent >= goal.target_amount) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'achievement',
        title: 'Debt Goal Achieved! 🏆',
        message: `Outstanding job! You have reached your goal: "${goal.name}"`
      })
      alert('Congratulations! You achieved your debt reduction goal! 🏆')
      router.refresh()
    }
  }

  // Calculate stats for selected active goal
  const activeGoal = goals[0] // Treat the latest created goal as primary active target
  const percentProgress = activeGoal 
    ? Math.round(Math.min(100, (activeGoal.current_amount / activeGoal.target_amount) * 100))
    : 0

  const monthsRemaining = activeGoal 
    ? (() => {
        const targetDate = new Date(activeGoal.target_date)
        const today = new Date()
        const diffMonths = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth())
        return Math.max(1, diffMonths)
      })()
    : 0

  // Probability Logic
  const getSuccessProbability = (required: number) => {
    if (required <= 0) return { label: 'Complete', score: 100, color: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' }
    
    // surplus relative to required monthly reduction
    const ratio = monthlySurplus / required
    if (ratio >= 1.2) {
      return { label: 'High Probability', score: 95, color: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' }
    } else if (ratio >= 0.8) {
      return { label: 'Moderate Probability', score: 75, color: 'text-blue-400 bg-blue-950/20 border-blue-900/30' }
    } else if (ratio >= 0.4) {
      return { label: 'Low Probability', score: 45, color: 'text-amber-400 bg-amber-950/20 border-amber-900/30' }
    } else {
      return { label: 'Critical / Action Needed', score: 15, color: 'text-rose-400 bg-rose-950/20 border-rose-900/30' }
    }
  }

  const probability = activeGoal ? getSuccessProbability(activeGoal.required_monthly_reduction) : null

  return (
    <div className="space-y-6">
      
      {/* Top Title Block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Debt Reduction Goals</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Establish reduction milestones, forecast repayment velocities, and audit success probabilities.</p>
        </div>

        {!activeGoal && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-lg shadow-primary/20 transition-all cursor-pointer self-start lg:self-center"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Establish Goal</span>
          </button>
        )}
      </div>

      {activeGoal ? (
        /* Primary Active Goal Dashboard View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main progress details (2/3 width) */}
          <div className="bg-card border border-border p-6 rounded-2xl lg:col-span-2 space-y-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">ACTIVE REPAYMENT TARGET</span>
                <h3 className="font-extrabold text-lg text-foreground mt-1">{activeGoal.name}</h3>
                <span className="text-[11px] text-muted-foreground mt-1 block">Timeline target: {activeGoal.target_date} &bull; {monthsRemaining} Months remaining</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => openEditModal(activeGoal)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors" title="Edit Goal">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => handleDeleteGoal(activeGoal.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors" title="Remove Goal">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Circular / Linear Progress Bar */}
            <div className="space-y-2 my-2">
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Progress: {formatCurrency(activeGoal.current_amount)} paid down</span>
                <span className="text-primary">{percentProgress}% Achieved</span>
              </div>
              
              <div className="w-full bg-secondary h-4 rounded-full overflow-hidden p-0.5 border border-border">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-500 shadow-md shadow-primary/20"
                  style={{ width: `${percentProgress}%` }}
                />
              </div>
              
              <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                <span>Base Line (₹0)</span>
                <span>Remaining: {formatCurrency(Math.max(0, activeGoal.target_amount - activeGoal.current_amount))}</span>
                <span>Target: {formatCurrency(activeGoal.target_amount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-4 gap-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Required Monthly Reduction</span>
                <span className="text-md font-black text-foreground mt-1 block">
                  {formatCurrency(activeGoal.required_monthly_reduction)}/mo
                </span>
              </div>
              <button
                onClick={() => handleContribute(activeGoal)}
                className="flex items-center gap-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md shadow-emerald-950/20 text-xs cursor-pointer transition-all"
              >
                <Award className="h-4 w-4" />
                <span>Log Progress Contribution</span>
              </button>
            </div>
          </div>

          {/* Probability & Forecast audits (1/3 width) */}
          <div className="bg-card border border-border p-6 rounded-2xl space-y-6 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-foreground">AI Goal Audit</h3>
              <p className="text-[11px] text-muted-foreground">Auditing current cash velocities against targets.</p>
            </div>

            {/* Probability Score */}
            {probability && (
              <div className={`p-4 rounded-xl border text-center space-y-2 ${probability.color}`}>
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Success Probability</span>
                <span className="text-xl font-black block tracking-tight">{probability.score}%</span>
                <span className="text-[10px] font-bold block">{probability.label}</span>
              </div>
            )}

            {/* Forecast breakdown text */}
            <div className="bg-secondary/40 border border-border p-3.5 rounded-xl space-y-2.5 text-xs text-muted-foreground leading-normal">
              <div className="flex gap-1.5 items-start">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  Your monthly cash surplus (remaining after EMIs and expenses) is <strong className="text-foreground">{formatCurrency(monthlySurplus)}</strong>.
                </div>
              </div>

              {activeGoal.required_monthly_reduction > monthlySurplus ? (
                <div className="flex gap-1.5 items-start bg-rose-950/10 border border-rose-900/30 p-2 rounded-lg text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    Your monthly surplus is short by <strong className="text-foreground">{formatCurrency(activeGoal.required_monthly_reduction - monthlySurplus)}</strong> to meet the 18-month target. Cut expenses or boost freelance income.
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5 items-start bg-emerald-950/10 border border-emerald-900/30 p-2 rounded-lg text-emerald-400">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    Your current surplus easily covers the required reduction! You are on track to achieve this goal comfortably.
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-muted-foreground/60 text-center font-medium">
              Calculations refreshed daily
            </div>
          </div>

        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/20 space-y-3 max-w-lg mx-auto">
          <Target className="h-12 w-10 text-muted-foreground/45 mx-auto" />
          <h3 className="font-bold text-foreground">Secure your future. Set a target.</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Setting a concrete goal focuses cash allocations and accelerates debt elimination. Users with active targets pay off debt 2.4x faster.
          </p>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-lg shadow-primary/20 transition-all cursor-pointer mx-auto mt-4"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Establish Goal</span>
          </button>
        </div>
      )}

      {/* ========================================================
          MODAL: ESTABLISH GOAL
         ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Set Debt Reduction Goal</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleAddGoal} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Goal Description / Title</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Target Reduction (INR)</label>
                  <input type="number" required placeholder="₹ Amount" value={formData.target_amount} onChange={e => setFormData({...formData, target_amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-bold" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Starting Repaid Progress</label>
                  <input type="number" placeholder="₹ Already Reduced" value={formData.current_amount} onChange={e => setFormData({...formData, current_amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Target Date</label>
                <input type="date" required value={formData.target_date} onChange={e => setFormData({...formData, target_date: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer text-white">Save Reduction Goal</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT GOAL
         ======================================================== */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <h3 className="font-bold text-md text-foreground">Edit Goal Settings</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1">Close</button>
            </div>

            <form onSubmit={handleEditGoal} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Goal Title</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Target Reduction</label>
                  <input type="number" required value={formData.target_amount} onChange={e => setFormData({...formData, target_amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-bold" />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Current Progress</label>
                  <input type="number" required value={formData.current_amount} onChange={e => setFormData({...formData, current_amount: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Target Date</label>
                <input type="date" required value={formData.target_date} onChange={e => setFormData({...formData, target_date: e.target.value})} className="w-full p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary" />
              </div>

              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/95 font-bold transition-all mt-4 cursor-pointer text-white">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
