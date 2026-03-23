import { cleanDateValue, parseBestEffortDate } from './dates'
import type { SessionRow } from '../types/session'

const DATE_KEYS = ['date', 'session date', 'played on']
const OWEN_KEYS = ['owen', 'owen wins', 'owen total']
const FIONA_KEYS = ['fiona', 'fiona wins', 'fiona total']
const LOCATION_KEYS = ['location', 'venue', 'where']
const NOTES_KEYS = ['notes', 'note', 'comments']
const PEOPLE_KEYS = ['people', 'players', 'participants']

type HeaderMap = {
  date: number
  owen: number
  fiona: number
  location: number
  notes: number
  people: number
}

function normalizeCell(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function parseWinCount(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function parsePeople(value: string): string[] {
  if (!value.trim()) {
    return []
  }

  return value
    .split(',')
    .map((person) => person.trim())
    .filter(Boolean)
}

function findColumnIndex(row: string[], aliases: string[]): number {
  return row.findIndex((cell) => aliases.includes(normalizeCell(cell)))
}

function findHeaderMap(rows: string[][]): { headerMap: HeaderMap; headerRowIndex: number } | null {
  for (const [index, row] of rows.entries()) {
    const headerMap: HeaderMap = {
      date: findColumnIndex(row, DATE_KEYS),
      owen: findColumnIndex(row, OWEN_KEYS),
      fiona: findColumnIndex(row, FIONA_KEYS),
      location: findColumnIndex(row, LOCATION_KEYS),
      notes: findColumnIndex(row, NOTES_KEYS),
      people: findColumnIndex(row, PEOPLE_KEYS),
    }

    if (headerMap.date >= 0 && headerMap.owen >= 0 && headerMap.fiona >= 0) {
      return { headerMap, headerRowIndex: index }
    }
  }

  return null
}

function getCell(row: string[], index: number): string {
  if (index < 0) {
    return ''
  }

  return (row[index] ?? '').trim()
}

function isUsableRow(row: SessionRow): boolean {
  const normalizedDate = row.rawDate.toLowerCase()

  if (normalizedDate.includes('running total')) {
    return false
  }

  return Boolean(
    row.rawDate ||
      row.location ||
      row.notes ||
      row.people.length ||
      row.owenWins ||
      row.fionaWins,
  )
}

export function parseSessionRows(rows: string[][]): SessionRow[] {
  const headerInfo = findHeaderMap(rows)

  if (!headerInfo) {
    return []
  }

  const { headerMap, headerRowIndex } = headerInfo

  return rows
    .slice(headerRowIndex + 1)
    .map((row): SessionRow => {
      const rawDate = cleanDateValue(getCell(row, headerMap.date))

      return {
        rawDate,
        date: parseBestEffortDate(rawDate),
        owenWins: parseWinCount(getCell(row, headerMap.owen)),
        fionaWins: parseWinCount(getCell(row, headerMap.fiona)),
        location: getCell(row, headerMap.location),
        notes: getCell(row, headerMap.notes),
        people: parsePeople(getCell(row, headerMap.people)),
      }
    })
    .filter(isUsableRow)
}
