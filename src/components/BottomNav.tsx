'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Wallet, 
  CreditCard, 
  Brain, 
  Menu, 
  X,
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3,
  LogOut,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  const primaryItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Loans', href: '/loans', icon: Wallet },
    { name: 'Cards', href: '/cards', icon: CreditCard },
    { name: 'AI Advisor', href: '/advisor', icon: Brain },
  ]

  const moreItems = [
    { name: 'EMI Calendar', href: '/calendar', icon: Calendar },
    { name: 'Income Tracker', href: '/income', icon: TrendingUp },
    { name: 'Expense Tracker', href: '/expense', icon: TrendingDown },
    { name: 'Debt Goals', href: '/goals', icon: Target },
    { name: 'Reports & Export', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 flex items-center justify-around px-2 pb-safe">
        {primaryItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
            </Link>
          )
        })}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-lg transition-colors",
            isOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* Slide-up Menu Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div 
            className="absolute bottom-16 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">More Operations</h2>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {moreItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-medium",
                      isActive 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "border-border bg-secondary/30 text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 p-3 mt-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-all font-medium text-sm w-full"
            >
              <LogOut className="h-4 w-4" />
              <span>Disconnect Center</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
