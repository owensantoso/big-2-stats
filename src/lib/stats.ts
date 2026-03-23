import { formatDisplayDate } from './dates'
import type {
  CumulativeWinsPoint,
  SessionRow,
  SessionWinner,
  WinsByLocationRow,
} from '../types/session'

type LeaderSummary = {
  leader: 'Owen' | 'Fiona' | 'Tie'
  margin: number
}

type SessionOutcomeSummary = {
  owen: number
  draws: number
  fiona: number
}

export function getTotalOwenWins(rows: SessionRow[]): number {
  return rows.reduce((sum, row) => sum + row.owenWins, 0)
}

export function getTotalFionaWins(rows: SessionRow[]): number {
  return rows.reduce((sum, row) => sum + row.fionaWins, 0)
}

export function getTotalSessions(rows: SessionRow[]): number {
  return rows.length
}

export function getSessionWinner(row: SessionRow): SessionWinner {
  if (row.owenWins > row.fionaWins) {
    return 'Owen'
  }

  if (row.fionaWins > row.owenWins) {
    return 'Fiona'
  }

  return 'Tie'
}

export function getLeader(rows: SessionRow[]): LeaderSummary {
  const owenWins = getTotalOwenWins(rows)
  const fionaWins = getTotalFionaWins(rows)

  if (owenWins === fionaWins) {
    return { leader: 'Tie', margin: 0 as const }
  }

  if (owenWins > fionaWins) {
    return { leader: 'Owen', margin: owenWins - fionaWins }
  }

  return { leader: 'Fiona', margin: fionaWins - owenWins }
}

export function getAverageWinsPerSession(rows: SessionRow[]) {
  if (rows.length === 0) {
    return { owen: 0, fiona: 0 }
  }

  return {
    owen: getTotalOwenWins(rows) / rows.length,
    fiona: getTotalFionaWins(rows) / rows.length,
  }
}

export function getSessionOutcomeSummary(rows: SessionRow[]): SessionOutcomeSummary {
  return rows.reduce<SessionOutcomeSummary>(
    (summary, row) => {
      const winner = getSessionWinner(row)

      if (winner === 'Owen') {
        summary.owen += 1
      } else if (winner === 'Fiona') {
        summary.fiona += 1
      } else {
        summary.draws += 1
      }

      return summary
    },
    { owen: 0, draws: 0, fiona: 0 },
  )
}

function compareSessionsByDate(a: SessionRow, b: SessionRow): number {
  if (a.date && b.date) {
    return a.date.getTime() - b.date.getTime()
  }

  if (a.date) {
    return -1
  }

  if (b.date) {
    return 1
  }

  return 0
}

export function sortSessionsChronologically(rows: SessionRow[]): SessionRow[] {
  return [...rows].sort(compareSessionsByDate)
}

export function sortSessionsNewestFirst(rows: SessionRow[]): SessionRow[] {
  return [...rows].sort((a, b) => compareSessionsByDate(b, a))
}

export function getLatestSession(rows: SessionRow[]): SessionRow | null {
  const sorted = sortSessionsChronologically(rows)
  return sorted.at(-1) ?? null
}

export function getCumulativeWinsSeries(rows: SessionRow[]): CumulativeWinsPoint[] {
  const sorted = sortSessionsChronologically(rows)
  let owenTotal = 0
  let fionaTotal = 0

  return sorted.map((row, index) => {
    owenTotal += row.owenWins
    fionaTotal += row.fionaWins

    return {
      label: row.date
        ? formatDisplayDate(row.date, row.rawDate)
        : row.rawDate || `Session ${index + 1}`,
      rawDate: row.rawDate,
      date: row.date,
      owenTotal,
      fionaTotal,
    }
  })
}

export function getWinsByLocation(rows: SessionRow[]): WinsByLocationRow[] {
  const map = new Map<string, WinsByLocationRow>()

  for (const row of rows) {
    const key = row.location || 'Unknown'
    const current = map.get(key) ?? { location: key, owenWins: 0, fionaWins: 0 }
    current.owenWins += row.owenWins
    current.fionaWins += row.fionaWins
    map.set(key, current)
  }

  return [...map.values()].sort((a, b) => {
    const totalDifference =
      b.owenWins + b.fionaWins - (a.owenWins + a.fionaWins)

    if (totalDifference !== 0) {
      return totalDifference
    }

    return a.location.localeCompare(b.location)
  })
}

export function buildDashboardStats(rows: SessionRow[]) {
  const totalOwenWins = getTotalOwenWins(rows)
  const totalFionaWins = getTotalFionaWins(rows)
  const totalSessions = getTotalSessions(rows)
  const leader = getLeader(rows)
  const averageWins = getAverageWinsPerSession(rows)
  const sessionOutcomes = getSessionOutcomeSummary(rows)
  const latestSession = getLatestSession(rows)

  return {
    totalOwenWins,
    totalFionaWins,
    totalSessions,
    leader,
    averageWins,
    sessionOutcomes,
    latestSession,
    cumulativeWinsSeries: getCumulativeWinsSeries(rows),
    winsByLocation: getWinsByLocation(rows),
    sessionsByDate: sortSessionsChronologically(rows),
    sessionsForDisplay: sortSessionsNewestFirst(rows),
  }
}
