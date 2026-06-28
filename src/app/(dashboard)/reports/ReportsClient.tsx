'use client'

import { useState } from 'react'
import { 
  FileText, 
  Download, 
  Printer, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ReportsClientProps {
  loans: any[]
  cards: any[]
  income: any[]
  expenses: any[]
  loanPayments: any[]
  cardPayments: any[]
}

type ReportType = 'monthly' | 'debt' | 'income' | 'expense' | 'emi' | 'card'

export default function ReportsClient({
  loans,
  cards,
  income,
  expenses,
  loanPayments,
  cardPayments
}: ReportsClientProps) {
  const [reportType, setReportType] = useState<ReportType>('monthly')

  // CSV Export utility helper
  const triggerCSVDownload = (headers: string[], rows: string[][], filename: string) => {
    const csvRows = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ]
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\n'))
    const link = document.createElement('a')
    link.setAttribute('href', csvContent)
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle Export CSV action
  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    
    switch (reportType) {
      case 'debt': {
        const headers = ['Loan Name', 'Lender', 'Type', 'Principal', 'Remaining Balance', 'Interest Rate (%)', 'Monthly EMI', 'Start Date', 'End Date', 'Priority', 'Status']
        const rows = loans.map(l => [
          l.name, l.lender, l.loan_type, l.principal, l.current_balance, l.interest_rate, l.emi, l.start_date, l.end_date, l.priority, l.status
        ])
        triggerCSVDownload(headers, rows, `debt_report_${timestamp}`)
        break
      }
      case 'card': {
        const headers = ['Card Name', 'Bank', 'Credit Limit', 'Current Utilization', 'Minimum Due', 'Statement Day', 'Due Day', 'Annual Fee', 'Status']
        const rows = cards.map(c => [
          c.card_name, c.bank, c.credit_limit, c.current_utilization, c.minimum_due, c.statement_date, c.due_date, c.annual_fee, c.status
        ])
        triggerCSVDownload(headers, rows, `credit_card_report_${timestamp}`)
        break
      }
      case 'income': {
        const headers = ['Source', 'Expected Amount', 'Received Amount', 'Status', 'Entry Date']
        const rows = income.map(i => [
          i.source, i.expected_amount, i.received_amount, i.status, i.entry_date
        ])
        triggerCSVDownload(headers, rows, `income_ledger_${timestamp}`)
        break
      }
      case 'expense': {
        const headers = ['Category', 'Amount', 'Entry Date', 'Description']
        const rows = expenses.map(e => [
          e.category, e.amount, e.entry_date, e.description || ''
        ])
        triggerCSVDownload(headers, rows, `expense_ledger_${timestamp}`)
        break
      }
      case 'emi': {
        const headers = ['Loan / Card Name', 'EMI Amount', 'Due Day of Month', 'Lender / Bank', 'Type']
        const rows = loans.map(l => [l.name, l.emi, l.due_day, l.lender, 'Loan EMI']).concat(
          cards.map(c => [c.card_name, c.minimum_due, c.due_date, c.bank, 'Credit Card Minimum Due'])
        )
        triggerCSVDownload(headers, rows, `upcoming_emi_schedule_${timestamp}`)
        break
      }
      case 'monthly': {
        const headers = ['Category / Metric', 'Value', 'Calculation Base / Source']
        const totalRemainingBalance = loans.reduce((sum, l) => sum + Number(l.current_balance), 0)
        const totalCCUtilization = cards.reduce((sum, c) => sum + Number(c.current_utilization), 0)
        const totalEarnings = income.reduce((sum, i) => sum + Number(i.received_amount), 0)
        const totalSpending = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        const totalEMIPayable = loans.reduce((sum, l) => sum + Number(l.emi), 0) + cards.reduce((sum, c) => sum + Number(c.minimum_due), 0)

        const rows = [
          ['Total Debt Remaining', totalRemainingBalance + totalCCUtilization, 'Loans balances + Cards utilization'],
          ['Active Loan Balances', totalRemainingBalance, 'Outstanding principals'],
          ['Credit Card Balances', totalCCUtilization, 'Current utilizations'],
          ['Monthly EMI Commitments', totalEMIPayable, 'Required regular payments'],
          ['Received Income (Month)', totalEarnings, 'Completed cash receipts'],
          ['Logged Expenses (Month)', totalSpending, 'Ledger outflows'],
          ['Estimated Cash Surplus', Math.max(0, totalEarnings - totalSpending - totalEMIPayable), 'Income minus expenses and EMIs']
        ].map(row => [row[0].toString(), row[1].toString(), row[2].toString()])
        
        triggerCSVDownload(headers, rows, `monthly_cashflow_summary_${timestamp}`)
        break
      }
    }
  }

  // Print PDF
  const handlePrintPDF = () => {
    window.print()
  }

  // Render report preview based on selection
  const renderReportPreview = () => {
    switch (reportType) {
      case 'debt': {
        return (
          <div className="space-y-4 print-card">
            <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center justify-between">
              <span>Active Debt Outstanding Inventory</span>
              <span className="text-[10px] text-muted-foreground print-text-muted">Generated: {new Date().toLocaleDateString()}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2">Loan Name</th>
                    <th className="pb-2">Lender</th>
                    <th className="pb-2 text-right">Principal</th>
                    <th className="pb-2 text-right">Current Balance</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">EMI</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(l => (
                    <tr key={l.id} className="border-b border-border/30">
                      <td className="py-2.5 font-bold text-foreground">{l.name}</td>
                      <td className="py-2.5 text-muted-foreground">{l.lender}</td>
                      <td className="py-2.5 text-right">{formatCurrency(l.principal)}</td>
                      <td className="py-2.5 text-right font-bold">{formatCurrency(l.current_balance)}</td>
                      <td className="py-2.5 text-right">{l.interest_rate}%</td>
                      <td className="py-2.5 text-right text-primary font-semibold">{formatCurrency(l.emi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'card': {
        return (
          <div className="space-y-4 print-card">
            <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center justify-between">
              <span>Credit Card Utilization Summary</span>
              <span className="text-[10px] text-muted-foreground print-text-muted">Generated: {new Date().toLocaleDateString()}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2">Card Name</th>
                    <th className="pb-2">Bank</th>
                    <th className="pb-2 text-right">Limit</th>
                    <th className="pb-2 text-right">Utilization</th>
                    <th className="pb-2 text-right">Use %</th>
                    <th className="pb-2 text-right">Min Due</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map(c => (
                    <tr key={c.id} className="border-b border-border/30">
                      <td className="py-2.5 font-bold text-foreground">{c.card_name}</td>
                      <td className="py-2.5 text-muted-foreground">{c.bank}</td>
                      <td className="py-2.5 text-right">{formatCurrency(c.credit_limit)}</td>
                      <td className="py-2.5 text-right font-bold text-rose-400">{formatCurrency(c.current_utilization)}</td>
                      <td className="py-2.5 text-right">{c.credit_limit > 0 ? Math.round((c.current_utilization / c.credit_limit) * 100) : 0}%</td>
                      <td className="py-2.5 text-right text-primary font-semibold">{formatCurrency(c.minimum_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
      case 'income': {
        return (
          <div className="space-y-4 print-card">
            <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center justify-between">
              <span>Income Statement Log</span>
              <span className="text-[10px] text-muted-foreground print-text-muted">Generated: {new Date().toLocaleDateString()}</span>
            </h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-right">Expected</th>
                  <th className="pb-2 text-right">Received</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {income.map(i => (
                  <tr key={i.id} className="border-b border-border/30">
                    <td className="py-2.5 font-bold text-foreground">{i.source}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{formatCurrency(i.expected_amount)}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">{formatCurrency(i.received_amount)}</td>
                    <td className="py-2.5 text-muted-foreground">{i.entry_date}</td>
                    <td className="py-2.5 text-right font-semibold uppercase">{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      case 'expense': {
        return (
          <div className="space-y-4 print-card">
            <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center justify-between">
              <span>Expense Auditing Statement</span>
              <span className="text-[10px] text-muted-foreground print-text-muted">Generated: {new Date().toLocaleDateString()}</span>
            </h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b border-border/30">
                    <td className="py-2.5 font-bold text-foreground">{e.category}</td>
                    <td className="py-2.5 text-muted-foreground">{e.description || '-'}</td>
                    <td className="py-2.5 text-right font-bold text-rose-400">{formatCurrency(e.amount)}</td>
                    <td className="py-2.5 text-muted-foreground">{e.entry_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      case 'emi': {
        return (
          <div className="space-y-4 print-card">
            <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center justify-between">
              <span>EMI Regular Obligation Schedule</span>
              <span className="text-[10px] text-muted-foreground print-text-muted">Generated: {new Date().toLocaleDateString()}</span>
            </h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2">Account Name</th>
                  <th className="pb-2">Institution</th>
                  <th className="pb-2 text-right">EMI Amount</th>
                  <th className="pb-2 text-right">Calendar Due Day</th>
                  <th className="pb-2 text-right">Type</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id} className="border-b border-border/30">
                    <td className="py-2.5 font-bold text-foreground">{l.name}</td>
                    <td className="py-2.5 text-muted-foreground">{l.lender}</td>
                    <td className="py-2.5 text-right font-bold text-primary">{formatCurrency(l.emi)}</td>
                    <td className="py-2.5 text-right">Day {l.due_day}</td>
                    <td className="py-2.5 text-right text-muted-foreground font-semibold">Loan EMI</td>
                  </tr>
                ))}
                {cards.map(c => (
                  <tr key={c.id} className="border-b border-border/30">
                    <td className="py-2.5 font-bold text-foreground">{c.card_name}</td>
                    <td className="py-2.5 text-muted-foreground">{c.bank}</td>
                    <td className="py-2.5 text-right font-bold text-primary">{formatCurrency(c.minimum_due)}</td>
                    <td className="py-2.5 text-right">Day {c.due_date}</td>
                    <td className="py-2.5 text-right text-muted-foreground font-semibold">Card Minimum</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      case 'monthly':
      default: {
        const totalRemainingBalance = loans.reduce((sum, l) => sum + Number(l.current_balance), 0)
        const totalCCUtilization = cards.reduce((sum, c) => sum + Number(c.current_utilization), 0)
        const totalEarnings = income.reduce((sum, i) => sum + Number(i.received_amount), 0)
        const totalSpending = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        const totalEMIPayable = loans.reduce((sum, l) => sum + Number(l.emi), 0) + cards.reduce((sum, c) => sum + Number(c.minimum_due), 0)
        
        return (
          <div className="space-y-5 print-card">
            <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center justify-between">
              <span>Monthly Command Center Statement</span>
              <span className="text-[10px] text-muted-foreground print-text-muted">Generated: {new Date().toLocaleDateString()}</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border/30 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Net Debt Remaining</span>
                <span className="text-xl font-black text-rose-400 block">{formatCurrency(totalRemainingBalance + totalCCUtilization)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Monthly Income Cash Receipts</span>
                <span className="text-xl font-black text-emerald-400 block">{formatCurrency(totalEarnings)}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2">Financial Metric Category</th>
                  <th className="pb-2 text-right">Value (INR)</th>
                  <th className="pb-2">Description Basis</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 font-bold text-foreground">Active Loan Balance</td>
                  <td className="py-2.5 text-right font-bold">{formatCurrency(totalRemainingBalance)}</td>
                  <td className="py-2.5 text-muted-foreground">Sum of active loans outstanding</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 font-bold text-foreground">Credit Card Debt</td>
                  <td className="py-2.5 text-right font-bold text-rose-400">{formatCurrency(totalCCUtilization)}</td>
                  <td className="py-2.5 text-muted-foreground">Sum of active card utilization balances</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 font-bold text-foreground">Expected Expenses Outflow</td>
                  <td className="py-2.5 text-right font-bold">{formatCurrency(totalSpending)}</td>
                  <td className="py-2.5 text-muted-foreground">Sum of discretionary expenses logged</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 font-bold text-foreground">Total Regular EMIs Pool</td>
                  <td className="py-2.5 text-right font-bold">{formatCurrency(totalEMIPayable)}</td>
                  <td className="py-2.5 text-muted-foreground">Loans EMI + credit cards minimum dues</td>
                </tr>
                <tr className="border-b border-border/30 bg-secondary/10">
                  <td className="py-2.5 font-bold text-foreground">Monthly Liquid Cash Surplus</td>
                  <td className="py-2.5 text-right font-black text-emerald-400">{formatCurrency(Math.max(0, totalEarnings - totalSpending - totalEMIPayable))}</td>
                  <td className="py-2.5 text-muted-foreground">Cash remaining for goals / emergency buffer</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      }
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Title (Hidden in print) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">Reporting & Exports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Generate structured audit reports and export to PDF, CSV, or Microsoft Excel.</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-secondary/40 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV / Excel</span>
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Selectors Panel (Hidden in print) */}
      <div className="bg-card border border-border p-4 rounded-2xl flex flex-wrap gap-4 items-center no-print text-xs">
        <div className="space-y-1">
          <label className="block text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Select Report Template</label>
          <select 
            value={reportType} 
            onChange={e => setReportType(e.target.value as ReportType)}
            className="p-2 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-bold cursor-pointer"
          >
            <option value="monthly">Monthly Cash Flow Statement</option>
            <option value="debt">Debt Outstanding Inventory</option>
            <option value="card">Credit Card Utilization Status</option>
            <option value="income">Income statement logs</option>
            <option value="expense">Expense ledger sheets</option>
            <option value="emi">Upcoming EMI calendar schedule</option>
          </select>
        </div>
        <div className="text-[11px] text-muted-foreground flex-1 leading-normal max-w-sm">
          💡 <strong>Tip:</strong> The printed layout is specifically optimized for black-and-white business statements. Click "Print / Save PDF" and select "Save as PDF" to download.
        </div>
      </div>

      {/* Printable Report View (Visible in print and screen preview) */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-xl min-h-[300px]">
        {renderReportPreview()}
      </div>

    </div>
  )
}
