import Papa from 'papaparse'
import { parseSessionRows } from './parseSessionRows'
import type { SessionRow } from '../types/session'

export async function fetchSheetData(csvUrl: string): Promise<SessionRow[]> {
  const response = await fetch(csvUrl)

  if (!response.ok) {
    throw new Error(`Spreadsheet request failed with ${response.status}`)
  }

  const csvText = await response.text()
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.warn('CSV parse warnings:', parsed.errors)
  }

  return parseSessionRows(parsed.data)
}
