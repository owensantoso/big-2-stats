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
                borderColor: '#4d78b7',
                backgroundColor: 'rgba(77, 120, 183, 0.14)',
                tension: 0.25,
                fill: true,
              },
              {
                label: 'Fiona',
                data: points.map((point) => point.fionaTotal),
                borderColor: '#c96a5c',
                backgroundColor: 'rgba(201, 106, 92, 0.1)',
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
