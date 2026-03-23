export type SessionRow = {
  rawDate: string
  date: Date | null
  owenWins: number
  fionaWins: number
  location: string
  notes: string
  people: string[]
}

export type SessionWinner = 'Owen' | 'Fiona' | 'Tie'

export type CumulativeWinsPoint = {
  label: string
  rawDate: string
  date: Date | null
  owenTotal: number
  fionaTotal: number
}

export type WinsByLocationRow = {
  location: string
  owenWins: number
  fionaWins: number
}
