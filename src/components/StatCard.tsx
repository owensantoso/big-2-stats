import type { ReactNode } from 'react'

type StatCardProps = {
  title: string
  value: ReactNode
  caption?: ReactNode
  accentClassName?: string
}

export function StatCard({
  title,
  value,
  caption,
  accentClassName = '',
}: StatCardProps) {
  return (
    <article className={`stat-card ${accentClassName}`.trim()}>
      <h2>{title}</h2>
      <div className="stat-value">{value}</div>
      {caption ? <p className="stat-caption">{caption}</p> : null}
    </article>
  )
}
