import { Bar } from 'react-chartjs-2'
import { formatDisplayDate } from '../../lib/dates'
import type { SessionRow } from '../../types/session'

type SessionWinsChartProps = {
  sessions: SessionRow[]
}

export function SessionWinsChart({ sessions }: SessionWinsChartProps) {
  return (
    <article className="chart-panel">
      <div className="chart-copy">
        <h2>Session Wins</h2>
        <p>Per-session comparison of Owen and Fiona wins.</p>
      </div>
      <div className="chart-wrap">
        <Bar
          data={{
            labels: sessions.map((session, index) =>
              formatDisplayDate(session.date, session.rawDate || `Session ${index + 1}`),
            ),
            datasets: [
              {
                label: 'Owen',
                data: sessions.map((session) => session.owenWins),
                backgroundColor: '#1d6fdc',
                borderRadius: 8,
              },
              {
                label: 'Fiona',
                data: sessions.map((session) => session.fionaWins),
                backgroundColor: '#d65445',
                borderRadius: 8,
              },
            ],
          }}
          options={{
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                },
              },
            },
          }}
        />
      </div>
    </article>
  )
}
