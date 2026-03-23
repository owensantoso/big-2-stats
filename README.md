# Big 2 Stats Dashboard

Tiny static dashboard for tracking Owen vs Fiona Big 2 sessions from a published Google Sheets CSV.

## Stack

- Vite
- React
- TypeScript
- PapaParse
- Chart.js with `react-chartjs-2`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Set `VITE_SHEET_CSV_URL` to your published Google Sheets CSV URL.

Example format:

```text
https://docs.google.com/spreadsheets/d/e/EXAMPLE/pub?output=csv
```

4. Start the app:

```bash
npm run dev
```

## Spreadsheet expectations

The parser matches columns case-insensitively and looks for common aliases for:

- date
- Owen wins
- Fiona wins
- location
- notes
- people

Rows are normalized into:

```ts
type SessionRow = {
  rawDate: string
  date: Date | null
  owenWins: number
  fionaWins: number
  location: string
  notes: string
  people: string[]
}
```

Parsing is intentionally forgiving:

- invalid numeric values fall back to `0`
- people are split by commas and trimmed
- dates use best-effort parsing
- obvious trailing punctuation on dates is stripped
- malformed rows do not crash the app

## How to publish Google Sheets as CSV

1. Open the Google Sheet.
2. Go to `File` -> `Share` -> `Publish to web`.
3. Publish the relevant sheet.
4. Copy the generated CSV link.
5. Paste that link into `VITE_SHEET_CSV_URL`.

## Build

```bash
npm run build
```

## Deployment

This app is static-only and can be deployed to GitHub Pages or Vercel.

### GitHub Pages

Use a GitHub Actions Pages deploy.

1. Add a repository variable named `VITE_SHEET_CSV_URL`.
2. In GitHub `Settings` -> `Pages`, set the source to `GitHub Actions`.
3. Push to `main`.

The workflow at `.github/workflows/deploy-pages.yml` will build `dist/` and deploy it.

### Vercel

- Import the repo into Vercel
- Add `VITE_SHEET_CSV_URL` as an environment variable
- Use the default Vite build settings

## Notes

- No backend
- No database
- No auth
- Google Sheets CSV is the source of truth
- Image annotations upload directly from the browser to Cloudinary unsigned uploads
- Annotation images are intentionally resized to `256px` max and aggressively JPEG-compressed client-side before upload

## TODO

- Update annotations so they are shared between users instead of local-only browser state
