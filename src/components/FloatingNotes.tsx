import { useEffect, useMemo, useState } from 'react'

type FloatingNote = {
  id: string
  text: string
  xPercent: number
  yOffset: number
}

type DraftNote = {
  xPercent: number
  yOffset: number
  text: string
} | null

const STORAGE_KEY = 'big-2-stats-floating-notes'
const CLEAR_ALL_PASSWORD = 'omegalul'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function createNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadNotes(): FloatingNote[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((note) => {
      if (
        typeof note === 'object' &&
        note !== null &&
        'id' in note &&
        'text' in note &&
        'xPercent' in note &&
        'yOffset' in note &&
        typeof note.id === 'string' &&
        typeof note.text === 'string' &&
        typeof note.xPercent === 'number' &&
        typeof note.yOffset === 'number'
      ) {
        return [
          {
            id: note.id,
            text: note.text,
            xPercent: clamp(note.xPercent, 1, 76),
            yOffset: Math.max(note.yOffset, 0),
          },
        ]
      }

      return []
    })
  } catch {
    return []
  }
}

export function FloatingNotes() {
  const [notes, setNotes] = useState<FloatingNote[]>(() => loadNotes())
  const [isPlacing, setIsPlacing] = useState(false)
  const [draftNote, setDraftNote] = useState<DraftNote>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const noteCountLabel = useMemo(() => {
    if (notes.length === 1) {
      return '1 annotation'
    }

    return `${notes.length} annotations`
  }, [notes.length])

  const handlePlacementClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draftNote) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const xPercent = clamp(
      ((event.clientX - bounds.left) / bounds.width) * 100,
      1,
      76,
    )
    const yOffset = Math.max(event.clientY - bounds.top, 0)

    setDraftNote({ xPercent, yOffset, text: '' })
    setIsPlacing(false)
  }

  const saveDraftNote = () => {
    if (!draftNote) {
      return
    }

    const text = draftNote.text.trim()

    if (!text) {
      setDraftNote(null)
      return
    }

    setNotes((currentNotes) => [
      ...currentNotes,
      {
        id: createNoteId(),
        text,
        xPercent: draftNote.xPercent,
        yOffset: draftNote.yOffset,
      },
    ])
    setDraftNote(null)
  }

  const deleteNote = (id: string) => {
    const enteredPassword = window.prompt(
      'Enter the annotation delete password to remove this annotation:',
    )

    if (enteredPassword !== CLEAR_ALL_PASSWORD) {
      return
    }

    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
  }

  const clearAllNotes = () => {
    const enteredPassword = window.prompt(
      'Enter the annotation clear password to remove all annotations:',
    )

    if (enteredPassword !== CLEAR_ALL_PASSWORD) {
      return
    }

    setNotes([])
    setDraftNote(null)
    setIsPlacing(false)
  }

  return (
    <>
      <div className="floating-notes-toolbar">
        <div className="floating-notes-meta">
          <strong>Page Annotations</strong>
          <span>{noteCountLabel}</span>
        </div>
        <button
          className="floating-action-button subtle"
          type="button"
          onClick={() => setIsCollapsed((currentValue) => !currentValue)}
        >
          {isCollapsed ? 'Open' : 'Hide'}
        </button>
        <div
          className={`floating-notes-actions ${isCollapsed ? 'is-collapsed' : ''}`.trim()}
        >
          <button
            className={`floating-action-button ${isPlacing ? 'active' : ''}`.trim()}
            type="button"
            onClick={() => {
              setDraftNote(null)
              setIsPlacing((currentValue) => !currentValue)
            }}
          >
            {isPlacing ? 'Cancel placement' : 'Add annotation'}
          </button>
          <button
            className="floating-action-button subtle"
            type="button"
            onClick={clearAllNotes}
            disabled={notes.length === 0 && !draftNote}
          >
            Clear all
          </button>
        </div>
      </div>

      {isPlacing ? (
        <div
          className="floating-notes-placement-layer"
          onClick={handlePlacementClick}
          role="presentation"
        >
          <div className="floating-placement-hint">
            Click anywhere on the page to place text there.
          </div>
        </div>
      ) : null}

      <div className="floating-notes-layer" aria-hidden="true">
        {notes.map((note) => (
          <article
            className="floating-note"
            key={note.id}
            style={{ left: `${note.xPercent}%`, top: `${note.yOffset}px` }}
          >
            <button
              className="floating-note-delete"
              type="button"
              aria-label="Delete note"
              onClick={() => deleteNote(note.id)}
            >
              ×
            </button>
            <p>{note.text}</p>
          </article>
        ))}

        {draftNote ? (
          <div
            className="floating-note draft"
            style={{ left: `${draftNote.xPercent}%`, top: `${draftNote.yOffset}px` }}
          >
            <textarea
              autoFocus
              rows={4}
              placeholder="Write text for this spot."
              value={draftNote.text}
              onChange={(event) =>
                setDraftNote((currentDraft) =>
                  currentDraft
                    ? {
                        ...currentDraft,
                        text: event.target.value,
                      }
                    : null,
                )
              }
            />
            <div className="floating-note-draft-actions">
              <button
                className="floating-action-button subtle"
                type="button"
                onClick={() => setDraftNote(null)}
              >
                Cancel
              </button>
              <button
                className="floating-action-button"
                type="button"
                onClick={saveDraftNote}
              >
                Save text
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
