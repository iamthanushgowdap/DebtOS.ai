'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Wallet, 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Brain, 
  BarChart3,
  Sparkles,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Loans & EMIs', href: '/loans', icon: Wallet },
  { name: 'Credit Cards', href: '/cards', icon: CreditCard },
  { name: 'EMI Calendar', href: '/calendar', icon: Calendar },
  { name: 'Income Tracker', href: '/income', icon: TrendingUp },
  { name: 'Expense Tracker', href: '/expense', icon: TrendingDown },
  { name: 'Debt Goals', href: '/goals', icon: Target },
  { name: 'AI Advisor', href: '/advisor', icon: Brain },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border min-h-screen sticky top-0 p-4 shrink-0 justify-between">
      <div className="flex flex-col gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-border/50">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              DebtOS AI
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">
              Command Center
            </p>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive ? "" : "text-muted-foreground group-hover:text-foreground")} />
                <span>{item.name}</span>
                {isActive && (
                  <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer / Branding */}
      <div className="px-2 py-3 border-t border-border/50 text-[11px] text-muted-foreground/60 text-center">
        Private Financial Center &copy; 2026
      </div>
    </aside>
  )
}
