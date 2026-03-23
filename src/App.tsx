import { useEffect, useMemo, useState } from 'react'
import { FloatingNotes } from './components/FloatingNotes'
import { SummaryCards } from './components/SummaryCards'
import { SessionsTable } from './components/SessionsTable'
import { CumulativeWinsChart } from './components/charts/CumulativeWinsChart'
import { LocationBreakdownChart } from './components/charts/LocationBreakdownChart'
import { SessionWinsChart } from './components/charts/SessionWinsChart'
import { fetchSheetData } from './lib/fetchSheetData'
import { parseBestEffortDate } from './lib/dates'
import { buildDashboardStats } from './lib/stats'
import type { SessionRow } from './types/session'

const SESSION_CACHE_KEY = 'big-2-stats-session-cache'

type CachedSessionRow = Omit<SessionRow, 'date'> & {
  date: string | null
}

function loadCachedSessions(): SessionRow[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((session) => {
      if (
        typeof session !== 'object' ||
        session === null ||
        typeof session.rawDate !== 'string' ||
        typeof session.owenWins !== 'number' ||
        typeof session.fionaWins !== 'number' ||
        typeof session.location !== 'string' ||
        typeof session.notes !== 'string' ||
        !Array.isArray(session.people)
      ) {
        return []
      }

      return [
        {
          rawDate: session.rawDate,
          date:
            'date' in session && typeof session.date === 'string'
              ? parseBestEffortDate(session.date) ?? parseBestEffortDate(session.rawDate)
              : parseBestEffortDate(session.rawDate),
          owenWins: session.owenWins,
          fionaWins: session.fionaWins,
          location: session.location,
          notes: session.notes,
          people: session.people.filter(
            (person: unknown): person is string => typeof person === 'string',
          ),
        },
      ]
    })
  } catch {
    return []
  }
}

function saveCachedSessions(rows: SessionRow[]) {
  if (typeof window === 'undefined') {
    return
  }

  const serializableRows: CachedSessionRow[] = rows.map((row) => ({
    rawDate: row.rawDate,
    date: row.date ? row.date.toISOString() : null,
    owenWins: row.owenWins,
    fionaWins: row.fionaWins,
    location: row.location,
    notes: row.notes,
    people: row.people,
  }))

  window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(serializableRows))
}

function getInitialSessionsState() {
  const cachedSessions = loadCachedSessions()

  return {
    cachedSessions,
    hasCachedSessions: cachedSessions.length > 0,
  }
}

function App() {
  const [{ cachedSessions, hasCachedSessions }] = useState(() => getInitialSessionsState())
  const [sessions, setSessions] = useState<SessionRow[]>(cachedSessions)
  const [isLoading, setIsLoading] = useState(() => !hasCachedSessions)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() =>
    hasCachedSessions ? new Date() : null,
  )

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

    const loadSessions = async (showFullLoading: boolean) => {
      try {
        if (showFullLoading) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }
        setError(null)
        const rows = await fetchSheetData(csvUrl)

        if (!isMounted) {
          return
        }

        setSessions(rows)
        saveCachedSessions(rows)
        setLastSyncedAt(new Date())
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
          if (showFullLoading) {
            setIsLoading(false)
          } else {
            setIsRefreshing(false)
          }
        }
      }
    }

    void loadSessions(!hasCachedSessions)

    return () => {
      isMounted = false
    }
  }, [hasCachedSessions])

  const handleRefresh = async () => {
    const csvUrl = import.meta.env.VITE_SHEET_CSV_URL?.trim()

    if (!csvUrl || isRefreshing || isLoading) {
      return
    }

    try {
      setIsRefreshing(true)
      setError(null)
      const rows = await fetchSheetData(csvUrl)
      setSessions(rows)
      saveCachedSessions(rows)
      setLastSyncedAt(new Date())
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load spreadsheet data.'

      setError(
        `${message} Confirm the Google Sheet is published as CSV and the URL is reachable from the browser.`,
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  const stats = useMemo(() => buildDashboardStats(sessions), [sessions])
  const isSyncing = isLoading || isRefreshing

  return (
    <main className="page-shell">
      <div className="page-canvas">
        <FloatingNotes />
        <section className="page-header">
          <div className="page-header-topline">
            <div>
              <p className="eyebrow">Card Game Dashboard</p>
              <h1>Big 2 Stats</h1>
              <p className="subtitle">Owen vs Fiona</p>
            </div>
            <div className="page-header-actions">
              <button
                className={`refresh-button ${isRefreshing ? 'is-refreshing' : ''}`.trim()}
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isLoading || isRefreshing}
              >
                <span className="refresh-button-icon" aria-hidden="true">
                  ↻
                </span>
                <span>{isRefreshing ? 'Refreshing' : 'Refresh CSV'}</span>
              </button>
              {lastSyncedAt ? (
                <span className={`sync-pill ${isRefreshing ? 'is-refreshing' : ''}`.trim()}>
                  {isRefreshing
                    ? 'Refreshing from CSV...'
                    : `Updated ${lastSyncedAt.toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {isSyncing ? (
          <section className="sync-banner" aria-live="polite">
            <span className="sync-banner-spinner" aria-hidden="true" />
            <div className="sync-banner-copy">
              <strong>{isLoading ? 'Loading from CSV' : 'Refreshing from CSV'}</strong>
              <span>
                {isLoading
                  ? 'Pulling the latest spreadsheet data and restoring the dashboard.'
                  : 'Fetching the newest spreadsheet changes without clearing the page.'}
              </span>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <section className="panel state-panel">
            <h2>Loading sessions</h2>
            <p>Fetching the published Google Sheets CSV and building the dashboard.</p>
          </section>
        ) : null}

        {!isLoading && error && sessions.length === 0 ? (
          <section className="panel state-panel error-panel">
            <h2>Could not load data</h2>
            <p>{error}</p>
          </section>
        ) : null}

        {!isLoading && error && sessions.length > 0 ? (
          <section className="panel state-panel error-panel">
            <h2>Showing saved data</h2>
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
