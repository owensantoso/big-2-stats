import { useEffect, useMemo, useRef, useState } from 'react'

type FloatingNote = {
  id: string
  type: 'text' | 'drawing'
  text: string
  drawingUrl: string | null
  xPercent: number
  yOffset: number
  createdAt: string
}

type DraftTextNote = {
  type: 'text'
  xPercent: number
  yOffset: number
  text: string
} | null

type DraftDrawingNote = {
  type: 'drawing'
  xPercent: number
  yOffset: number
} | null

type DragState = {
  id: string
  pointerOffsetX: number
  pointerOffsetY: number
} | null

const STORAGE_KEY = 'big-2-stats-floating-notes'
const CLEAR_ALL_PASSWORD = 'omegalul'
const MIN_X_PERCENT = 1
const MAX_X_PERCENT = 92
const DRAWING_WIDTH = 220
const DRAWING_HEIGHT = 120

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
      if (typeof note !== 'object' || note === null || !('id' in note)) {
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
      const text = 'text' in note && typeof note.text === 'string' ? note.text : ''
      const drawingUrl =
        'drawingUrl' in note && typeof note.drawingUrl === 'string'
          ? note.drawingUrl
          : null

      if (
        typeof note.id === 'string' &&
        maybeXPercent !== null &&
        maybeYOffset !== null &&
        (text.trim().length > 0 || drawingUrl)
      ) {
        return [
          {
            id: note.id,
            type:
              'type' in note && note.type === 'drawing'
                ? 'drawing'
                : drawingUrl && text.trim().length === 0
                  ? 'drawing'
                  : 'text',
            text,
            drawingUrl,
            xPercent: clamp(maybeXPercent, MIN_X_PERCENT, MAX_X_PERCENT),
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

function buildNotePreview(note: FloatingNote): string {
  if (note.type === 'drawing') {
    return 'Drawing annotation'
  }

  return note.text.length > 52 ? `${note.text.slice(0, 52).trim()}...` : note.text
}

function initializeDrawingCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.fillStyle = 'rgba(255, 250, 240, 0.94)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#5a4210'
  context.lineWidth = 3
}

export function FloatingNotes() {
  const [notes, setNotes] = useState<FloatingNote[]>(() => loadNotes())
  const [placementMode, setPlacementMode] = useState<'text' | 'drawing' | null>(null)
  const [isEditingPositions, setIsEditingPositions] = useState(false)
  const [draftTextNote, setDraftTextNote] = useState<DraftTextNote>(null)
  const [draftDrawingNote, setDraftDrawingNote] = useState<DraftDrawingNote>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [showWrongPassword, setShowWrongPassword] = useState(false)
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)

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
        MIN_X_PERCENT,
        MAX_X_PERCENT,
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

  useEffect(() => {
    if (!draftDrawingNote || !drawingCanvasRef.current) {
      return
    }

    initializeDrawingCanvas(drawingCanvasRef.current)
  }, [draftDrawingNote])

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

  const resetDrafts = () => {
    setDraftTextNote(null)
    setDraftDrawingNote(null)
    setPlacementMode(null)
  }

  const handlePlacementClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((draftTextNote || draftDrawingNote) || isEditingPositions || !placementMode) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const xPercent = clamp(
      ((event.clientX - bounds.left) / bounds.width) * 100,
      MIN_X_PERCENT,
      MAX_X_PERCENT,
    )
    const yOffset = Math.max(event.clientY - bounds.top, 0)

    if (placementMode === 'text') {
      setDraftTextNote({ type: 'text', xPercent, yOffset, text: '' })
    } else {
      setDraftDrawingNote({ type: 'drawing', xPercent, yOffset })
    }

    setPlacementMode(null)
  }

  const saveDraftTextNote = () => {
    if (!draftTextNote) {
      return
    }

    const text = draftTextNote.text.trim()

    if (!text) {
      setDraftTextNote(null)
      return
    }

    setNotes((currentNotes) => [
      ...currentNotes,
      {
        id: createNoteId(),
        type: 'text',
        text,
        drawingUrl: null,
        xPercent: draftTextNote.xPercent,
        yOffset: draftTextNote.yOffset,
        createdAt: new Date().toISOString(),
      },
    ])
    setDraftTextNote(null)
  }

  const clearDraftDrawing = () => {
    if (drawingCanvasRef.current) {
      initializeDrawingCanvas(drawingCanvasRef.current)
    }
  }

  const saveDraftDrawingNote = () => {
    if (!draftDrawingNote || !drawingCanvasRef.current) {
      return
    }

    const drawingUrl = drawingCanvasRef.current.toDataURL('image/png')

    setNotes((currentNotes) => [
      ...currentNotes,
      {
        id: createNoteId(),
        type: 'drawing',
        text: '',
        drawingUrl,
        xPercent: draftDrawingNote.xPercent,
        yOffset: draftDrawingNote.yOffset,
        createdAt: new Date().toISOString(),
      },
    ])
    setDraftDrawingNote(null)
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

    resetDrafts()
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
    resetDrafts()
    setIsEditingPositions(false)
    setHighlightedNoteId(null)
  }

  const startPlacementMode = (mode: 'text' | 'drawing') => {
    setIsEditingPositions(false)
    setDragState(null)
    setDraftTextNote(null)
    setDraftDrawingNote(null)
    setPlacementMode((currentMode) => (currentMode === mode ? null : mode))
  }

  const handleDrawingPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    const bounds = canvas.getBoundingClientRect()
    context.beginPath()
    context.moveTo(event.clientX - bounds.left, event.clientY - bounds.top)
    isDrawingRef.current = true
  }

  const handleDrawingPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return
    }

    const canvas = event.currentTarget
    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    const bounds = canvas.getBoundingClientRect()
    context.lineTo(event.clientX - bounds.left, event.clientY - bounds.top)
    context.stroke()
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
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
              className={`floating-action-button ${placementMode === 'text' ? 'active' : ''}`.trim()}
              type="button"
              onClick={() => startPlacementMode('text')}
            >
              {placementMode === 'text' ? 'Cancel text' : 'Add annotation'}
            </button>
            <button
              className={`floating-action-button subtle ${
                placementMode === 'drawing' ? 'is-editing' : ''
              }`.trim()}
              type="button"
              onClick={() => startPlacementMode('drawing')}
            >
              {placementMode === 'drawing' ? 'Cancel drawing' : 'Add drawing'}
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
              disabled={notes.length === 0 && !draftTextNote && !draftDrawingNote}
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
                  <strong>{buildNotePreview(note)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="annotation-sidebar-empty">No annotations yet.</p>
          )}

          {isEditingPositions ? (
            <p className="annotation-sidebar-empty">
              Drag any note or drawing on the page to reposition it.
            </p>
          ) : null}
        </div>
      </aside>

      {placementMode ? (
        <div
          className="floating-notes-placement-layer"
          onClick={handlePlacementClick}
          role="presentation"
        >
          <div className="floating-placement-hint">
            {placementMode === 'text'
              ? 'Click anywhere on the page to place text there.'
              : 'Click anywhere on the page to place a drawing there.'}
          </div>
        </div>
      ) : null}

      <div className="floating-notes-layer">
        {notes.map((note) => (
          <article
            className={`floating-note floating-note-${note.type} ${
              highlightedNoteId === note.id ? 'is-highlighted' : ''
            } ${isEditingPositions ? 'is-editing' : ''}`.trim()}
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
            {note.type === 'drawing' && note.drawingUrl ? (
              <img
                alt="Annotation drawing"
                className="floating-note-drawing-image"
                src={note.drawingUrl}
              />
            ) : (
              <p>{note.text}</p>
            )}
            <span className="floating-note-time">{formatCreatedAt(note.createdAt)}</span>
          </article>
        ))}

        {draftTextNote ? (
          <div
            className="floating-note draft"
            style={{ left: `${draftTextNote.xPercent}%`, top: `${draftTextNote.yOffset}px` }}
          >
            <textarea
              autoFocus
              rows={4}
              placeholder="Write text for this spot."
              value={draftTextNote.text}
              onChange={(event) =>
                setDraftTextNote((currentDraft) =>
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
                onClick={() => setDraftTextNote(null)}
              >
                Cancel
              </button>
              <button
                className="floating-action-button"
                type="button"
                onClick={saveDraftTextNote}
              >
                Save text
              </button>
            </div>
          </div>
        ) : null}

        {draftDrawingNote ? (
          <div
            className="floating-note floating-note-drawing draft"
            style={{ left: `${draftDrawingNote.xPercent}%`, top: `${draftDrawingNote.yOffset}px` }}
          >
            <canvas
              ref={drawingCanvasRef}
              className="floating-note-drawing-canvas"
              height={DRAWING_HEIGHT}
              onPointerDown={handleDrawingPointerDown}
              onPointerLeave={stopDrawing}
              onPointerMove={handleDrawingPointerMove}
              onPointerUp={stopDrawing}
              width={DRAWING_WIDTH}
            />
            <div className="floating-note-draft-actions">
              <button
                className="floating-action-button subtle"
                type="button"
                onClick={() => setDraftDrawingNote(null)}
              >
                Cancel
              </button>
              <button
                className="floating-action-button subtle"
                type="button"
                onClick={clearDraftDrawing}
              >
                Clear
              </button>
              <button
                className="floating-action-button"
                type="button"
                onClick={saveDraftDrawingNote}
              >
                Save drawing
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
