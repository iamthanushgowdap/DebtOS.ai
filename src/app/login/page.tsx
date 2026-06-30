'use client'

import { useState } from 'react'
import { Sparkles, Mail, Lock, LogIn, UserPlus, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setMessage(null)

    if (activeTab === 'login') {
      // Email + Password Log In
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setMessage({ text: error.message, type: 'error' })
      } else if (data.user) {
        window.location.href = '/dashboard'
      }
    } else {
      // Email + Password Sign Up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || email.split('@')[0]
          }
        }
      })

      if (error) {
        setMessage({ text: error.message, type: 'error' })
      } else {
        setMessage({ 
          text: 'Account registered successfully! You can now log in.', 
          type: 'success' 
        });
        setActiveTab('login');
      }
    }
    setLoading(false)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50/50 px-4 overflow-hidden">
      
      {/* Soft Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl" />

      {/* Main Glassmorphism Card */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200/80 p-6 lg:p-8 rounded-3xl shadow-xl relative z-10 space-y-6">
        
        {/* Branding header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-1 overflow-hidden mb-1">
            <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
          </div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
            DebtOS AI
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            Personal Debt Command Center & Repayment Ledger.
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`p-3.5 rounded-xl border text-xs font-semibold flex gap-2 items-start ${
            message.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs">
          <button
            onClick={() => { setActiveTab('login'); setMessage(null); }}
            className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'login' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setActiveTab('signup'); setMessage(null); }}
            className={`py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'signup' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
          {activeTab === 'signup' && (
            <div className="space-y-1">
              <label className="block text-slate-600">Full Name</label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-slate-600">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="e.g. yourname@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-slate-600">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/10"
          >
            {activeTab === 'login' ? (
              <>
                <LogIn className="h-4 w-4" />
                <span>Log In</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Register & Join</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[10px] text-slate-400 font-semibold text-center mt-2">
          Provide your own Supabase credentials in <code className="bg-slate-100 p-0.5 rounded text-slate-600">.env.local</code> to host this dashboard.
        </div>

      </div>
    </div>
  )
}
