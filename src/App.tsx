import { useEffect, useMemo, useState } from 'react'
import { FloatingNotes } from './components/FloatingNotes'
import { SummaryCards } from './components/SummaryCards'
import { SessionsTable } from './components/SessionsTable'
import { CumulativeWinsChart } from './components/charts/CumulativeWinsChart'
import { LocationBreakdownChart } from './components/charts/LocationBreakdownChart'
import { SessionWinsChart } from './components/charts/SessionWinsChart'
import { fetchSheetData } from './lib/fetchSheetData'
import { buildDashboardStats } from './lib/stats'
import type { SessionRow } from './types/session'

function App() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const csvUrl = import.meta.env.VITE_SHEET_CSV_URL?.trim()

    if (!csvUrl) {
      setError(
        'Missing VITE_SHEET_CSV_URL. Add it to your .env file using a published Google Sheets CSV URL.',
      )
      setIsLoading(false)
      return
    }

    let isMounted = true

    const loadSessions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const rows = await fetchSheetData(csvUrl)

        if (!isMounted) {
          return
        }

        setSessions(rows)
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to load spreadsheet data.'

        setError(
          `${message} Confirm the Google Sheet is published as CSV and the URL is reachable from the browser.`,
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSessions()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo(() => buildDashboardStats(sessions), [sessions])

  return (
    <main className="page-shell">
      <FloatingNotes />
      <div className="page-canvas">
        <section className="page-header">
          <p className="eyebrow">Card Game Dashboard</p>
          <h1>Big 2 Stats</h1>
          <p className="subtitle">Owen vs Fiona</p>
        </section>

        {isLoading ? (
          <section className="panel state-panel">
            <h2>Loading sessions</h2>
            <p>Fetching the published Google Sheets CSV and building the dashboard.</p>
          </section>
        ) : null}

        {!isLoading && error ? (
          <section className="panel state-panel error-panel">
            <h2>Could not load data</h2>
            <p>{error}</p>
          </section>
        ) : null}

        {!isLoading && !error && sessions.length === 0 ? (
          <section className="panel state-panel">
            <h2>No sessions yet</h2>
            <p>The sheet loaded successfully, but it does not contain any usable rows.</p>
          </section>
        ) : null}

        {!isLoading && !error && sessions.length > 0 ? (
          <div className="dashboard-grid">
            <SummaryCards stats={stats} />

            <section className="panel charts-grid">
              <CumulativeWinsChart points={stats.cumulativeWinsSeries} />
              <SessionWinsChart sessions={stats.sessionsByDate} />
              <LocationBreakdownChart rows={stats.winsByLocation} />
            </section>

            <SessionsTable sessions={stats.sessionsForDisplay} />
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default App
