import { useEffect, useMemo, useState } from 'react'

type FloatingNote = {
  id: string
  text: string
  xPercent: number
  yOffset: number
  createdAt: string
}

type DraftNote = {
  xPercent: number
  yOffset: number
  text: string
} | null

type DragState = {
  id: string
  pointerOffsetX: number
  pointerOffsetY: number
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

function toIsoStringOrNow(value: unknown): string {
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date().toISOString()
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
      if (typeof note !== 'object' || note === null || !('id' in note) || !('text' in note)) {
        return []
      }

      const maybeXPercent =
        'xPercent' in note && typeof note.xPercent === 'number'
          ? note.xPercent
          : 'x' in note && typeof note.x === 'number'
            ? note.x
            : null
      const maybeYOffset =
        'yOffset' in note && typeof note.yOffset === 'number'
          ? note.yOffset
          : 'y' in note && typeof note.y === 'number'
            ? note.y
            : null

      if (
        typeof note.id === 'string' &&
        typeof note.text === 'string' &&
        maybeXPercent !== null &&
        maybeYOffset !== null
      ) {
        return [
          {
            id: note.id,
            text: note.text,
            xPercent: clamp(maybeXPercent, 1, 76),
            yOffset: Math.max(maybeYOffset, 0),
            createdAt: toIsoStringOrNow('createdAt' in note ? note.createdAt : null),
          },
        ]
      }

      return []
    })
  } catch {
    return []
  }
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function buildNotePreview(value: string): string {
  return value.length > 52 ? `${value.slice(0, 52).trim()}...` : value
}

export function FloatingNotes() {
  const [notes, setNotes] = useState<FloatingNote[]>(() => loadNotes())
  const [isPlacing, setIsPlacing] = useState(false)
  const [isEditingPositions, setIsEditingPositions] = useState(false)
  const [draftNote, setDraftNote] = useState<DraftNote>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [showWrongPassword, setShowWrongPassword] = useState(false)
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    if (!highlightedNoteId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedNoteId(null)
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [highlightedNoteId])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const canvasElement = document.querySelector('.page-canvas')

      if (!(canvasElement instanceof HTMLElement)) {
        return
      }

      const bounds = canvasElement.getBoundingClientRect()
      const nextXPercent = clamp(
        ((event.clientX - bounds.left - dragState.pointerOffsetX) / bounds.width) * 100,
        1,
        76,
      )
      const nextYOffset = Math.max(
        event.clientY - bounds.top - dragState.pointerOffsetY,
        0,
      )

      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === dragState.id
            ? {
                ...note,
                xPercent: nextXPercent,
                yOffset: nextYOffset,
              }
            : note,
        ),
      )
    }

    const stopDragging = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [dragState])

  const noteCountLabel = useMemo(() => {
    if (notes.length === 1) {
      return '1 annotation'
    }

    return `${notes.length} annotations`
  }, [notes.length])

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [notes])

  const handlePlacementClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draftNote || isEditingPositions) {
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
        createdAt: new Date().toISOString(),
      },
    ])
    setDraftNote(null)
  }

  const focusNote = (id: string) => {
    const noteElement = document.getElementById(`annotation-${id}`)

    if (!noteElement) {
      return
    }

    setHighlightedNoteId(id)
    noteElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }

  const deleteNote = (id: string) => {
    const enteredPassword = window.prompt(
      'Enter the annotation delete password to remove this annotation:',
    )

    if (enteredPassword !== CLEAR_ALL_PASSWORD) {
      setShowWrongPassword(true)
      return
    }

    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
    if (highlightedNoteId === id) {
      setHighlightedNoteId(null)
    }
  }

  const toggleEditPositionsMode = () => {
    if (isEditingPositions) {
      setIsEditingPositions(false)
      setDragState(null)
      return
    }

    const enteredPassword = window.prompt(
      'Enter the annotation edit password to move annotations:',
    )

    if (enteredPassword !== CLEAR_ALL_PASSWORD) {
      setShowWrongPassword(true)
      return
    }

    setDraftNote(null)
    setIsPlacing(false)
    setIsEditingPositions(true)
  }

  const startDraggingNote = (
    event: React.PointerEvent<HTMLElement>,
    noteId: string,
  ) => {
    if (!isEditingPositions) {
      return
    }

    const noteElement = event.currentTarget
    const bounds = noteElement.getBoundingClientRect()

    event.preventDefault()
    setHighlightedNoteId(noteId)
    setDragState({
      id: noteId,
      pointerOffsetX: event.clientX - bounds.left,
      pointerOffsetY: event.clientY - bounds.top,
    })
  }

  const clearAllNotes = () => {
    const enteredPassword = window.prompt(
      'Enter the annotation clear password to remove all annotations:',
    )

    if (enteredPassword !== CLEAR_ALL_PASSWORD) {
      setShowWrongPassword(true)
      return
    }

    setNotes([])
    setDraftNote(null)
    setIsPlacing(false)
    setHighlightedNoteId(null)
  }

  return (
    <>
      {showWrongPassword ? (
        <div
          className="wrong-password-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wrong-password-title"
        >
          <div className="wrong-password-modal">
            <p className="wrong-password-kicker">Access denied</p>
            <h2 id="wrong-password-title">WRONG PASSWORD OMEGALUL</h2>
            <button
              className="floating-action-button"
              type="button"
              onClick={() => setShowWrongPassword(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <aside className="annotation-panel" aria-label="Annotations panel">
        <div className="annotation-panel-header">
          <div className="floating-notes-meta">
            <strong>Page Annotations</strong>
            <span>{noteCountLabel}</span>
          </div>
          <button
            className={`annotation-panel-toggle ${isCollapsed ? 'is-collapsed' : ''}`.trim()}
            type="button"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand annotations panel' : 'Collapse annotations panel'}
            onClick={() => setIsCollapsed((currentValue) => !currentValue)}
          >
            <span className="annotation-panel-toggle-chevron" aria-hidden="true" />
          </button>
        </div>

        <div className={`annotation-panel-body ${isCollapsed ? 'is-collapsed' : ''}`.trim()}>
          <div className="floating-notes-actions">
            <button
              className={`floating-action-button ${isPlacing ? 'active' : ''}`.trim()}
              type="button"
              onClick={() => {
                setIsEditingPositions(false)
                setDragState(null)
                setDraftNote(null)
                setIsPlacing((currentValue) => !currentValue)
              }}
            >
              {isPlacing ? 'Cancel placement' : 'Add annotation'}
            </button>
            <button
              className={`floating-action-button subtle ${
                isEditingPositions ? 'is-editing' : ''
              }`.trim()}
              type="button"
              onClick={toggleEditPositionsMode}
              disabled={notes.length === 0}
            >
              {isEditingPositions ? 'Done moving' : 'Edit positions'}
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

          {sortedNotes.length > 0 ? (
            <div className="annotation-sidebar-list">
              {sortedNotes.map((note) => (
                <button
                  className={`annotation-sidebar-item ${
                    highlightedNoteId === note.id ? 'is-active' : ''
                  }`.trim()}
                  key={note.id}
                  type="button"
                  onClick={() => focusNote(note.id)}
                >
                  <span className="annotation-sidebar-time">
                    {formatCreatedAt(note.createdAt)}
                  </span>
                  <strong>{buildNotePreview(note.text)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="annotation-sidebar-empty">No annotations yet.</p>
          )}

          {isEditingPositions ? (
            <p className="annotation-sidebar-empty">
              Drag any note on the page to reposition it.
            </p>
          ) : null}
        </div>
      </aside>

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

      <div className="floating-notes-layer">
        {notes.map((note) => (
          <article
            className={`floating-note ${highlightedNoteId === note.id ? 'is-highlighted' : ''} ${
              isEditingPositions ? 'is-editing' : ''
            }`.trim()}
            id={`annotation-${note.id}`}
            key={note.id}
            onPointerDown={(event) => startDraggingNote(event, note.id)}
            style={{ left: `${note.xPercent}%`, top: `${note.yOffset}px` }}
            tabIndex={-1}
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
            <span className="floating-note-time">{formatCreatedAt(note.createdAt)}</span>
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
