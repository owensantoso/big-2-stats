import { Bar } from 'react-chartjs-2'
import type { WinsByLocationRow } from '../../types/session'

type LocationBreakdownChartProps = {
  rows: WinsByLocationRow[]
}

export function LocationBreakdownChart({ rows }: LocationBreakdownChartProps) {
  return (
    <article className="chart-panel">
      <div className="chart-copy">
        <h2>Wins by Location</h2>
        <p>Where the rivalry has produced the most wins.</p>
      </div>
      <div className="chart-wrap">
        <Bar
          data={{
            labels: rows.map((row) => row.location),
            datasets: [
              {
                label: 'Owen',
                data: rows.map((row) => row.owenWins),
                backgroundColor: '#1d6fdc',
                borderRadius: 8,
              },
              {
                label: 'Fiona',
                data: rows.map((row) => row.fionaWins),
                backgroundColor: '#d65445',
                borderRadius: 8,
              },
            ],
          }}
          options={{
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' },
            },
            scales: {
              x: {
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
