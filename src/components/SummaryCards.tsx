import { formatDisplayDate } from '../lib/dates'
import { StatCard } from './StatCard'
import type { SessionRow } from '../types/session'

type SummaryCardsProps = {
  stats: {
    totalOwenWins: number
    totalFionaWins: number
    totalSessions: number
    leader: {
      leader: 'Owen' | 'Fiona' | 'Tie'
      margin: number
    }
    averageWins: {
      owen: number
      fiona: number
    }
    latestSession: SessionRow | null
  }
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  const latestSessionLabel = stats.latestSession
    ? `${formatDisplayDate(stats.latestSession.date, stats.latestSession.rawDate)} · ${stats.latestSession.owenWins}-${stats.latestSession.fionaWins}`
    : 'No sessions yet'

  const leaderCaption =
    stats.leader.leader === 'Tie'
      ? 'Both players are level overall.'
      : `Ahead by ${stats.leader.margin} wins overall.`

  const leaderAccentClassName =
    stats.leader.leader === 'Owen'
      ? 'owen-accent'
      : stats.leader.leader === 'Fiona'
        ? 'fiona-accent'
        : 'neutral-accent'

  return (
    <section className="summary-grid">
      <StatCard
        title="Owen Total Wins"
        value={String(stats.totalOwenWins)}
        caption={`Average ${stats.averageWins.owen.toFixed(1)} wins per session`}
        accentClassName="owen-accent"
      />
      <StatCard
        title="Fiona Total Wins"
        value={String(stats.totalFionaWins)}
        caption={`Average ${stats.averageWins.fiona.toFixed(1)} wins per session`}
        accentClassName="fiona-accent"
      />
      <StatCard
        title="Total Sessions"
        value={String(stats.totalSessions)}
        caption={latestSessionLabel}
      />
      <StatCard
        title="Leader"
        value={stats.leader.leader}
        caption={leaderCaption}
        accentClassName={leaderAccentClassName}
      />
    </section>
  )
}
