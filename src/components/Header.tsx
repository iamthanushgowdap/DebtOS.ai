'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Bell, 
  Sparkles, 
  Coins, 
  ShieldAlert, 
  LogOut, 
  CheckCircle,
  HelpCircle,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  
  // Modals & Triggers
  const [isGotMoneyOpen, setIsGotMoneyOpen] = useState(false)
  const [isWhatNowOpen, setIsWhatNowOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  
  // State for "I GOT MONEY"
  const [amount, setAmount] = useState('')
  const [gotMoneyResult, setGotMoneyResult] = useState<any>(null)
  const [gotMoneyLoading, setGotMoneyLoading] = useState(false)

  // State for "WHAT NOW"
  const [whatNowResult, setWhatNowResult] = useState<any>(null)
  const [whatNowLoading, setWhatNowLoading] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let active = true
    let cleanup: (() => void) | undefined

    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      
      setUserEmail(user.email || null)
      fetchNotifications(user.id)
      
      const fetchProfileName = async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single()
        if (active) {
          if (profile?.name) {
            setDisplayName(profile.name)
          } else {
            setDisplayName(user.email?.split('@')[0] || null)
          }
        }
      }
      
      fetchProfileName()
      
      const handleProfileUpdate = () => {
        fetchProfileName()
      }
      window.addEventListener('profile-updated', handleProfileUpdate)
      cleanup = () => {
        window.removeEventListener('profile-updated', handleProfileUpdate)
      }
    }
    
    getUser()
    
    return () => {
      active = false
      if (cleanup) cleanup()
    }
  }, [])

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    }
  }

  const handleMarkNotifRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  const handleGotMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return
    
    setGotMoneyLoading(true)
    setGotMoneyResult(null)
    try {
      const res = await fetch('/api/ai/got-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) })
      })
      const data = await res.json()
      setGotMoneyResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setGotMoneyLoading(false)
    }
  }

  const triggerWhatNow = async () => {
    setIsWhatNowOpen(true)
    setWhatNowLoading(true)
    setWhatNowResult(null)
    try {
      const res = await fetch('/api/ai/what-now', {
        method: 'POST',
      })
      const data = await res.json()
      setWhatNowResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setWhatNowLoading(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border h-16 z-30 flex items-center justify-between px-4 lg:px-6">
        {/* Branding (Mobile only) */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold text-md bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            DebtOS AI
          </span>
        </div>
        
        {/* Spacer on desktop */}
        <div className="hidden lg:block text-sm text-muted-foreground">
          Welcome back to the Command Center
        </div>

        {/* Actions panel */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* WHAT NOW Button */}
          <button
            onClick={triggerWhatNow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-900/30 transition-all scale-95 hover:scale-100 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>WHAT NOW?</span>
          </button>

          {/* I GOT MONEY Button */}
          <button
            onClick={() => {
              setIsGotMoneyOpen(true)
              setGotMoneyResult(null)
              setAmount('')
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 transition-all scale-95 hover:scale-100 cursor-pointer"
          >
            <Coins className="h-3.5 w-3.5" />
            <span>I GOT MONEY</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl p-3 z-50 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Alerts</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-4">
                      No recent notifications.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`text-xs p-2 rounded-lg transition-colors border ${notif.read ? 'bg-secondary/20 border-transparent' : 'bg-primary/5 border-primary/20'}`}
                        onClick={() => handleMarkNotifRead(notif.id)}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-semibold text-foreground">{notif.title}</span>
                          {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />}
                        </div>
                        <p className="text-muted-foreground text-[10px] mt-0.5">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile / Logout (Desktop only) */}
          <div className="hidden lg:flex items-center gap-3 pl-2 border-l border-border/50">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                {displayName || userEmail?.split('@')[0] || 'User'}
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold">
                Active Session
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Disconnect command center"
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          MODAL: I GOT MONEY
         ======================================================== */}
      {isGotMoneyOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Coins className="h-5 w-5" />
                <h3 className="font-bold text-lg">I GOT MONEY</h3>
              </div>
              <button 
                onClick={() => setIsGotMoneyOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleGotMoneySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  How much unexpected money did you get? (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    required
                    className="w-full pl-7 pr-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-sm font-medium"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={gotMoneyLoading}
                className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {gotMoneyLoading ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>AI Allocating Cash...</span>
                  </>
                ) : (
                  <span>Optimize Cash Allocation</span>
                )}
              </button>
            </form>

            {/* Got Money Results */}
            {gotMoneyResult && (
              <div className="mt-6 space-y-4 border-t border-border/50 pt-5 animate-in fade-in duration-300">
                <h4 className="text-sm font-bold text-foreground">AI Repayment & Savings Plan</h4>
                
                {/* Allocation grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/5 border border-primary/10 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-muted-foreground block font-medium">DEBT REPAYMENT</span>
                    <span className="text-md font-extrabold text-blue-400 mt-1 block">
                      {formatCurrency(gotMoneyResult.allocation.debtRepayment)}
                    </span>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-muted-foreground block font-medium">EMERGENCY BUFFER</span>
                    <span className="text-md font-extrabold text-emerald-400 mt-1 block">
                      {formatCurrency(gotMoneyResult.allocation.emergencyBuffer)}
                    </span>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-muted-foreground block font-medium">SAVINGS</span>
                    <span className="text-md font-extrabold text-amber-400 mt-1 block">
                      {formatCurrency(gotMoneyResult.allocation.savings)}
                    </span>
                  </div>
                  <div className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-muted-foreground block font-medium">PERSONAL SPENDING</span>
                    <span className="text-md font-extrabold text-rose-400 mt-1 block">
                      {formatCurrency(gotMoneyResult.allocation.personalSpending)}
                    </span>
                  </div>
                </div>

                <div className="bg-secondary/40 border border-border p-3.5 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">AI Allocation Explanation</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {gotMoneyResult.explanation}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-950/20 border border-blue-900/30 p-3.5 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">Recommended Next Action</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {gotMoneyResult.recommendedAction}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: WHAT SHOULD I DO NOW?
         ======================================================== */}
      {isWhatNowOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border/50 pb-3 mb-4">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-bold text-lg">WHAT SHOULD I DO NOW?</h3>
              </div>
              <button 
                onClick={() => setIsWhatNowOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>

            {whatNowLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted-foreground font-medium animate-pulse">
                  AI Analyzing your entire debt, EMI history, CC utilization, and goals...
                </p>
              </div>
            )}

            {whatNowResult && (
              <div className="space-y-4 animate-in fade-in duration-300">
                
                {/* 1. TOP PRIORITY ACTION */}
                <div className="bg-blue-950/20 border border-blue-900/50 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                    Top Priority
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-blue-400 block uppercase tracking-wider">Today's Mission</span>
                      <p className="text-sm font-semibold text-foreground mt-1 leading-snug">
                        {whatNowResult.topPriorityAction}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. SECONDARY ACTION */}
                <div className="bg-secondary/40 border border-border p-4 rounded-xl relative">
                  <div className="absolute top-0 right-0 bg-muted text-muted-foreground text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                    Secondary
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">Supporting Task</span>
                      <p className="text-xs font-medium text-foreground mt-1 leading-normal">
                        {whatNowResult.secondaryAction}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. WARNING */}
                {whatNowResult.warning && (
                  <div className="bg-rose-950/20 border border-rose-900/50 p-4 rounded-xl relative">
                    <div className="absolute top-0 right-0 bg-rose-500/15 text-rose-400 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                      Warning
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-rose-400 block uppercase tracking-wider">High Risk Alert</span>
                        <p className="text-xs font-medium text-foreground mt-1 leading-normal">
                          {whatNowResult.warning}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. EXPECTED OUTCOME */}
                <div className="bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl relative">
                  <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                    Outcome
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">Financial Benefit</span>
                      <p className="text-xs font-medium text-foreground mt-1 leading-normal">
                        {whatNowResult.expectedOutcome}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
