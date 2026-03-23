import { formatDisplayDate } from '../lib/dates'
import { getSessionWinner } from '../lib/stats'
import type { SessionRow } from '../types/session'

type SessionsTableProps = {
  sessions: SessionRow[]
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  return (
    <section className="panel table-panel">
      <div className="table-copy">
        <h2>Session History</h2>
        <p>Newest parseable dates first, with graceful fallback for messy spreadsheet rows.</p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Owen</th>
              <th>Fiona</th>
              <th>Winner</th>
              <th>Location</th>
              <th>People</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, index) => {
              const winner = getSessionWinner(session)
              const winnerClassName =
                winner === 'Owen'
                  ? 'winner-owen'
                  : winner === 'Fiona'
                    ? 'winner-fiona'
                    : 'winner-tie'

              return (
                <tr key={`${session.rawDate}-${session.location}-${index}`}>
                  <td>{formatDisplayDate(session.date, session.rawDate)}</td>
                  <td>{session.owenWins}</td>
                  <td>{session.fionaWins}</td>
                  <td className={winnerClassName}>{winner}</td>
                  <td>{session.location || <span className="muted">Unknown</span>}</td>
                  <td>
                    {session.people.length > 0 ? (
                      <div className="people-list">
                        {session.people.map((person) => (
                          <span className="person-chip" key={person}>
                            {person}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">None listed</span>
                    )}
                  </td>
                  <td>{session.notes || <span className="muted">No notes</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
