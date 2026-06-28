import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content body */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pb-16 lg:pb-0">
        {/* Dynamic header control bar */}
        <Header />
        
        {/* Main scrollable grid */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Bar */}
      <BottomNav />
    </div>
  )
}
