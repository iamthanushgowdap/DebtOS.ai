'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Brain, 
  Sparkles, 
  Clock, 
  Send, 
  ArrowRight,
  ShieldAlert,
  ListOrdered,
  ChevronRight,
  TrendingDown,
  LineChart,
  History,
  CheckSquare
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface AdvisorLog {
  id: string
  query: string
  response: string
  created_at: string
}

interface AdvisorClientProps {
  userId: string
  initialLogs: AdvisorLog[]
  hasApiKey?: boolean
}

const PRESET_QUERIES = [
  'What should I do today?',
  'Which debt should I close first?',
  'Should I save or repay?',
  'How much emergency fund should I keep?',
  'What happens if I get ₹5,000?',
  'What happens if I get ₹10,000?',
  'What happens if I get ₹20,000?'
]

export default function AdvisorClient({
  userId,
  initialLogs,
  hasApiKey = true
}: AdvisorClientProps) {
  const router = useRouter()
  const [logs, setLogs] = useState<AdvisorLog[]>(initialLogs)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleQuerySubmit = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    setQuery(text)

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      })
      const data = await res.json()
      setResult(data)
      
      // Prepend to logs
      setLogs(prev => [
        {
          id: Math.random().toString(),
          query: text,
          response: data.answer || JSON.stringify(data),
          created_at: new Date().toISOString()
        },
        ...prev.slice(0, 9)
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreLog = (log: AdvisorLog) => {
    // If the response is a structured JSON, parse it, otherwise wrap it
    try {
      const parsed = JSON.parse(log.response)
      if (parsed.answer) {
        setResult(parsed)
      } else {
        setResult({ answer: log.response })
      }
    } catch {
      setResult({ answer: log.response })
    }
    setQuery(log.query)
  }

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold tracking-tight">AI Financial Advisor</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Consult the Gemini-powered credit analyst for allocations, risk shielding, and repayment models.</p>
      </div>

      {/* API Key Missing Alert */}
      {!hasApiKey && (
        <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex gap-3 text-xs text-amber-800">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block uppercase tracking-wider">Offline Simulation Active (Missing API Key)</span>
            <p className="text-slate-500 leading-relaxed font-semibold">
              The Google Gemini API key is currently missing from your local configuration. The advisor is running in offline simulation mode and will return static responses.
            </p>
            <p className="text-slate-500 font-semibold">
              To activate live calculations, retrieve a key from <strong>Google AI Studio</strong> and paste it into your <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-800 font-mono">.env.local</code> file:
            </p>
            <code className="block mt-2 bg-slate-100/85 p-2.5 rounded text-[10px] text-slate-800 font-mono select-all">
              GEMINI_API_KEY=AIzaSy...
            </code>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Preset triggers & Query Input */}
        <div className="space-y-4">
          
          {/* Preset Buttons */}
          <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Inquiries</h3>
            <div className="flex flex-col gap-2">
              {PRESET_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuerySubmit(q)}
                  disabled={loading}
                  className="flex items-center justify-between text-left text-xs p-3 bg-secondary/30 hover:bg-secondary/70 border border-border/50 rounded-xl transition-all font-semibold disabled:opacity-50 cursor-pointer group"
                >
                  <span className="truncate max-w-[90%]">{q}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Query Box */}
          <div className="bg-card border border-border p-4 rounded-2xl">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Custom Query</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Ask e.g. Can I spend ₹3,000 on shopping?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuerySubmit(query)}
                className="w-full pl-3 pr-10 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary text-xs font-medium"
              />
              <button
                onClick={() => handleQuerySubmit(query)}
                disabled={loading || !query.trim()}
                className="absolute right-2 top-2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/95 disabled:opacity-40 transition-all cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Past Query Logs list */}
          {logs.length > 0 && (
            <div className="bg-card border border-border p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5 text-muted-foreground border-b border-border/50 pb-2">
                <History className="h-3.5 w-3.5" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Inquiry Logs</h3>
              </div>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => handleRestoreLog(log)}
                    className="text-left text-[11px] p-2 bg-secondary/15 hover:bg-secondary/35 rounded-lg border border-transparent hover:border-border transition-all truncate block w-full text-muted-foreground hover:text-foreground font-medium"
                  >
                    "{log.query}"
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: AI Analysis Output Dashboard */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground animate-pulse font-semibold">
                AI Consulting ledger logs and running payoff models...
              </p>
            </div>
          )}

          {!loading && !result && (
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] text-center gap-3">
              <Brain className="h-12 w-12 text-primary/20 animate-bounce" />
              <h3 className="font-bold text-foreground">Command Center Ready</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Submit an inquiry or click a quick preset to trigger a structured financial audit.
              </p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Main Text Answer */}
              <div className="bg-card border border-border p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Advisor Advice
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Consultation Response</h4>
                    <p className="text-sm font-semibold text-foreground mt-2 leading-relaxed whitespace-pre-line">
                      {result.answer}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid of structured insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Action Plan */}
                {result.actionPlan && result.actionPlan.length > 0 && (
                  <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckSquare className="h-4 w-4" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Action Plan</h4>
                    </div>
                    <ul className="space-y-2 text-xs text-muted-foreground font-semibold">
                      {result.actionPlan.map((action: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">&bull;</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Priority Ranking */}
                {result.priorityRanking && result.priorityRanking.length > 0 && (
                  <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-blue-600">
                      <ListOrdered className="h-4 w-4" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Priority Ranking</h4>
                    </div>
                    <ol className="space-y-2 text-xs text-muted-foreground font-semibold">
                      {result.priorityRanking.map((rank: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-400 font-bold">{i + 1}.</span>
                          <span>{rank}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* 3. Risk Analysis */}
                {result.riskAnalysis && (
                  <div className="bg-card border border-border p-5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-600">
                      <ShieldAlert className="h-4 w-4" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Risk Analysis</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal font-medium">
                      {result.riskAnalysis}
                    </p>
                  </div>
                )}

                {/* 4. Strategy & Budget */}
                {(result.debtStrategy || result.monthlySuggestions) && (
                  <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-purple-600">
                      <LineChart className="h-4 w-4" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Strategy & Savings</h4>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground font-medium">
                      {result.debtStrategy && (
                        <div>
                          <strong className="text-foreground block">Strategy:</strong>
                          <span className="mt-0.5 block">{result.debtStrategy}</span>
                        </div>
                      )}
                      {result.monthlySuggestions && (
                        <div>
                          <strong className="text-foreground block">Budget Suggestion:</strong>
                          <span className="mt-0.5 block">{result.monthlySuggestions}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  )
}
