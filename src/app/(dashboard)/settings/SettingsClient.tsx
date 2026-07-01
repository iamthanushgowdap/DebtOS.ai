'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Key, 
  User, 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles,
  Info,
  Clock,
  Lock,
  Shield
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

interface SettingsClientProps {
  userId: string
  userEmail: string
  profileName: string
  initialMpin: string
}

export default function SettingsClient({
  userId,
  userEmail,
  profileName,
  initialMpin
}: SettingsClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // Profile Form States
  const [name, setName] = useState(profileName)
  
  // MPIN States
  const [currentMpin, setCurrentMpin] = useState(initialMpin)
  const [mpinInput, setMpinInput] = useState('')
  const [oldMpinInput, setOldMpinInput] = useState('')
  const [mpinLoading, setMpinLoading] = useState(false)
  const [mpinMsg, setMpinMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Forgot MPIN States
  const [showForgotMpin, setShowForgotMpin] = useState(false)
  const [forgotPassword, setForgotPassword] = useState('')
  const [forgotNewMpin, setForgotNewMpin] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleSaveMpin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mpinInput.length !== 4 || !/^\d+$/.test(mpinInput)) {
      setMpinMsg({ text: 'MPIN must be exactly 4 digits.', type: 'error' })
      return
    }
    setMpinLoading(true)
    setMpinMsg(null)

    // If change PIN mode (not first time), verify old pin
    if (currentMpin) {
      if (oldMpinInput !== currentMpin) {
        setMpinMsg({ text: 'Incorrect old MPIN.', type: 'error' })
        setMpinLoading(false)
        return
      }
    }

    const { error } = await supabase.auth.updateUser({
      data: { mpin: mpinInput }
    })

    if (error) {
      setMpinMsg({ text: 'Failed to update MPIN: ' + error.message, type: 'error' })
    } else {
      setMpinMsg({ text: currentMpin ? 'MPIN successfully changed!' : 'MPIN successfully set up!', type: 'success' })
      setCurrentMpin(mpinInput)
      setMpinInput('')
      setOldMpinInput('')
      confetti({ particleCount: 40, spread: 30 })
    }
    setMpinLoading(false)
  }

  const handleForgotMpin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (forgotNewMpin.length !== 4 || !/^\d+$/.test(forgotNewMpin)) {
      setForgotMsg({ text: 'New MPIN must be exactly 4 digits.', type: 'error' })
      return
    }
    setForgotLoading(true)
    setForgotMsg(null)

    // Verify password by logging in again
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: forgotPassword
    })

    if (authError) {
      setForgotMsg({ text: 'Incorrect account password: ' + authError.message, type: 'error' })
      setForgotLoading(false)
      return
    }

    // Password correct, update MPIN
    const { error: updateError } = await supabase.auth.updateUser({
      data: { mpin: forgotNewMpin }
    })

    if (updateError) {
      setForgotMsg({ text: 'Failed to reset MPIN: ' + updateError.message, type: 'error' })
    } else {
      setForgotMsg({ text: 'MPIN successfully reset!', type: 'success' })
      setCurrentMpin(forgotNewMpin)
      setForgotPassword('')
      setForgotNewMpin('')
      setShowForgotMpin(false)
      confetti({ particleCount: 50, spread: 45 })
    }
    setForgotLoading(false)
  }
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Password Form States
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Reset States
  const [confirmEmail, setConfirmEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg(null)

    const { error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', userId)

    if (error) {
      setProfileMsg({ text: 'Failed to update profile: ' + error.message, type: 'error' })
    } else {
      setProfileMsg({ text: 'Profile name successfully updated!', type: 'success' })
      confetti({ particleCount: 40, spread: 30 })
      window.dispatchEvent(new Event('profile-updated'))
      router.refresh()
    }
    setProfileLoading(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setPasswordMsg({ text: 'Passwords do not match.', type: 'error' })
      return
    }
    if (password.length < 6) {
      setPasswordMsg({ text: 'Password must be at least 6 characters.', type: 'error' })
      return
    }

    setPasswordLoading(true)
    setPasswordMsg(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setPasswordMsg({ text: 'Failed to set password: ' + error.message, type: 'error' })
    } else {
      setPasswordMsg({ text: 'Security credentials updated! Your new password is set.', type: 'success' })
      setPassword('')
      setConfirmPassword('')
      confetti({ particleCount: 50, spread: 45 })
    }
    setPasswordLoading(false)
  }

  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirmEmail !== userEmail) {
      setResetMsg({ text: 'Email confirmation does not match.', type: 'error' })
      return
    }

    if (!confirm('CRITICAL WARNING: This will permanently delete all your loans, credit cards, income, expenses, and advisor logs. This cannot be undone. Are you absolutely sure?')) {
      return
    }

    setResetLoading(true)
    setResetMsg(null)

    try {
      // Execute deletions sequentially or via a single transaction/multiple queries
      const tables = [
        'loan_payments',
        'credit_card_payments',
        'loans',
        'credit_cards',
        'income_entries',
        'expense_entries',
        'goals',
        'advisor_logs',
        'notifications',
        'audit_logs'
      ]

      for (const table of tables) {
        await supabase.from(table).delete().eq('user_id', userId)
      }

      setResetMsg({ text: 'All command center database ledgers have been wiped.', type: 'success' })
      setConfirmEmail('')
      router.refresh()
    } catch (err: any) {
      setResetMsg({ text: 'Wipe failed: ' + err.message, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Security & Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Manage whitelisted credentials, configure personal names, update passwords, and manage ledger wipes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Profile & Password Changer */}
        <div className="space-y-6">
          
          {/* Card 1: Change Profile Name */}
          <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>Identity Profile</span>
            </h3>

            {profileMsg && (
              <div className={`p-3 rounded-xl border text-[11px] font-semibold ${
                profileMsg.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
              }`}>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">User Email (Whitelisted)</label>
                <input
                  type="text"
                  disabled
                  value={userEmail}
                  className="w-full p-2.5 bg-secondary/20 border border-border/50 rounded-xl text-muted-foreground cursor-not-allowed font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Display / Nick Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thanush"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-2 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {profileLoading ? <Clock className="h-4 w-4 animate-spin" /> : <span>Update Nickname</span>}
              </button>
            </form>
          </div>

          {/* Card 2: Set / Change Password */}
          <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <span>Security Credentials (Set Password)</span>
            </h3>

            <div className="bg-blue-950/15 border border-blue-900/30 p-3 rounded-xl flex gap-2 text-[10px] text-muted-foreground">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p>Useful if you registered using Google SSO and want to set an independent password to log in directly via email.</p>
            </div>

            {passwordMsg && (
              <div className={`p-3 rounded-xl border text-[11px] font-semibold ${
                passwordMsg.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
              }`}>
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-2 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {passwordLoading ? <Clock className="h-4 w-4 animate-spin" /> : <span>Update Password</span>}
              </button>
            </form>
          </div>

          {/* Card: Manage MPIN */}
          <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span>{currentMpin ? 'Change 4-Digit MPIN' : 'Set up 4-Digit MPIN'}</span>
            </h3>

            <div className="bg-blue-950/15 border border-blue-900/30 p-3 rounded-xl flex gap-2 text-[10px] text-muted-foreground">
              <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p>Your 4-digit MPIN secures your transaction commands. It will be required when logging EMI payments or adding new loans and credit cards.</p>
            </div>

            {mpinMsg && (
              <div className={`p-3 rounded-xl border text-[11px] font-semibold ${
                mpinMsg.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
              }`}>
                {mpinMsg.text}
              </div>
            )}

            {!showForgotMpin ? (
              <form onSubmit={handleSaveMpin} className="space-y-3 text-xs">
                {currentMpin && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Old 4-Digit MPIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      pattern="\d{4}"
                      required
                      placeholder="Enter old 4-digit pin"
                      value={oldMpinInput}
                      onChange={e => setOldMpinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-mono font-bold text-center tracking-widest text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">
                    {currentMpin ? 'New 4-Digit MPIN' : 'Enter 4-Digit MPIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    required
                    placeholder="Enter 4-digit pin"
                    value={mpinInput}
                    onChange={e => setMpinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-mono font-bold text-center tracking-widest text-sm"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={mpinLoading}
                    className="w-full py-2 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {mpinLoading ? <Clock className="h-4 w-4 animate-spin" /> : <span>{currentMpin ? 'Change MPIN' : 'Save MPIN'}</span>}
                  </button>

                  {currentMpin && (
                    <button
                      type="button"
                      onClick={() => { setShowForgotMpin(true); setForgotMsg(null); }}
                      className="text-[10px] text-primary hover:underline font-semibold block text-center mt-1 cursor-pointer"
                    >
                      Forgot MPIN? Reset with password
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotMpin} className="space-y-3 text-xs">
                <h4 className="font-bold text-rose-400 text-[11px] mb-2">Reset MPIN using Account Password</h4>
                
                {forgotMsg && (
                  <div className={`p-3 rounded-xl border text-[11px] font-semibold ${
                    forgotMsg.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
                  }`}>
                    {forgotMsg.text}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Account Login Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your account password"
                    value={forgotPassword}
                    onChange={e => setForgotPassword(e.target.value)}
                    className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">New 4-Digit MPIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    required
                    placeholder="Enter new 4-digit pin"
                    value={forgotNewMpin}
                    onChange={e => setForgotNewMpin(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary font-mono font-bold text-center tracking-widest text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotMpin(false)}
                    className="flex-1 py-2 px-4 border border-border rounded-xl text-muted-foreground hover:bg-secondary/50 font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? <Clock className="h-4 w-4 animate-spin" /> : <span>Reset MPIN</span>}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Right Column: Danger Zone */}
        <div className="space-y-6">
          
          {/* Danger Zone: Wipe Ledger Data */}
          <div className="bg-rose-50 border border-rose-200/80 p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <span>Danger Zone</span>
            </h3>

            <p className="text-xs text-slate-500 leading-normal font-semibold">
              Wiping your data resets your entire command center database tables (outstanding loans, logged payments, cards utilization, goals achievements, and AI chats history).
            </p>

            {resetMsg && (
              <div className={`p-3 rounded-xl border text-[11px] font-semibold ${
                resetMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {resetMsg.text}
              </div>
            )}

            <form onSubmit={handleResetData} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-rose-600 font-semibold block">To confirm, type your registered email below:</label>
                <span className="text-[10px] text-slate-500 block font-medium">"{userEmail}"</span>
                <input
                  type="email"
                  required
                  placeholder="Confirm email address"
                  value={confirmEmail}
                  onChange={e => setConfirmEmail(e.target.value)}
                  className="w-full p-2.5 bg-white border border-rose-200 rounded-xl text-slate-800 focus:outline-none focus:border-rose-500 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading || confirmEmail !== userEmail}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30"
              >
                {resetLoading ? <Clock className="h-4 w-4 animate-spin" /> : <span>Delete All Command Ledgers</span>}
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  )
}
