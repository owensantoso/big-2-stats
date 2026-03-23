import { Line } from 'react-chartjs-2'
import type { CumulativeWinsPoint } from '../../types/session'

type CumulativeWinsChartProps = {
  points: CumulativeWinsPoint[]
}

export function CumulativeWinsChart({ points }: CumulativeWinsChartProps) {
  return (
    <article className="chart-panel">
      <div className="chart-copy">
        <h2>Cumulative Wins</h2>
        <p>Overall rivalry trend across the sessions with usable ordering.</p>
      </div>
      <div className="chart-wrap">
        <Line
          data={{
            labels: points.map((point) => point.label),
            datasets: [
              {
                label: 'Owen',
                data: points.map((point) => point.owenTotal),
                borderColor: '#1d6fdc',
                backgroundColor: 'rgba(29, 111, 220, 0.14)',
                tension: 0.25,
                fill: true,
              },
              {
                label: 'Fiona',
                data: points.map((point) => point.fionaTotal),
                borderColor: '#d65445',
                backgroundColor: 'rgba(214, 84, 69, 0.08)',
                tension: 0.25,
                fill: true,
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
