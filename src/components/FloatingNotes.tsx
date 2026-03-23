import { useEffect, useMemo, useRef, useState } from 'react'

type FloatingNote = {
  id: string
  type: 'text' | 'drawing' | 'image'
  text: string
  drawingUrl: string | null
  imageUrl: string | null
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

type DraftImageNote = {
  type: 'image'
  xPercent: number
  yOffset: number
  file: File | null
  previewUrl: string | null
  isUploading: boolean
} | null

type DragState = {
  kind: 'saved-note' | 'draft-text' | 'draft-drawing' | 'draft-image'
  id?: string
  pointerOffsetX: number
  pointerOffsetY: number
} | null

const STORAGE_KEY = 'big-2-stats-floating-notes'
const CLEAR_ALL_PASSWORD = 'omegalul'
const MIN_X_PERCENT = 1
const MAX_X_PERCENT = 92
const DRAWING_WIDTH = 220
const DRAWING_HEIGHT = 120
const IMAGE_MAX_DIMENSION = 256
const IMAGE_DEEP_FRY_PASSES = 5
const IMAGE_JPEG_QUALITY = 0.12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function createNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Could not read the selected image file.'))
    }

    reader.onerror = () => reject(new Error('Could not read the selected image file.'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the selected image.'))
    image.src = src
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error('Could not encode the image for upload.'))
    }, type, quality)
  })
}

async function deepFryImageFile(file: File): Promise<Blob> {
  const sourceDataUrl = await readFileAsDataUrl(file)
  let sourceImage = await loadImageElement(sourceDataUrl)

  const scale = Math.min(
    1,
    IMAGE_MAX_DIMENSION / Math.max(sourceImage.width, sourceImage.height),
  )
  const width = Math.max(1, Math.round(sourceImage.width * scale))
  const height = Math.max(1, Math.round(sourceImage.height * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not initialize image compression.')
  }

  canvas.width = width
  canvas.height = height

  for (let pass = 0; pass < IMAGE_DEEP_FRY_PASSES; pass += 1) {
    context.fillStyle = '#fff7ef'
    context.fillRect(0, 0, width, height)
    context.drawImage(sourceImage, 0, 0, width, height)

    const compressedBlob = await canvasToBlob(canvas, 'image/jpeg', IMAGE_JPEG_QUALITY)
    const compressedUrl = await readFileAsDataUrl(compressedBlob)
    sourceImage = await loadImageElement(compressedUrl)
  }

  context.fillStyle = '#fff7ef'
  context.fillRect(0, 0, width, height)
  context.drawImage(sourceImage, 0, 0, width, height)

  return canvasToBlob(canvas, 'image/jpeg', IMAGE_JPEG_QUALITY)
}

async function uploadImageToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim()
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim()

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Missing Cloudinary config. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    )
  }

  const compressedBlob = await deepFryImageFile(file)
  const formData = new FormData()
  formData.append(
    'file',
    compressedBlob,
    `${file.name.replace(/\.[^.]+$/, '') || 'annotation'}-deepfried.jpg`,
  )
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed with ${response.status}.`)
  }

  const payload = (await response.json()) as { secure_url?: unknown }

  if (typeof payload.secure_url !== 'string') {
    throw new Error('Cloudinary upload did not return a usable image URL.')
  }

  return payload.secure_url
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
      const imageUrl =
        'imageUrl' in note && typeof note.imageUrl === 'string'
          ? note.imageUrl
          : null

      if (
        typeof note.id === 'string' &&
        maybeXPercent !== null &&
        maybeYOffset !== null &&
        (text.trim().length > 0 || drawingUrl || imageUrl)
      ) {
        return [
          {
            id: note.id,
            type:
              'type' in note && note.type === 'drawing'
                ? 'drawing'
                : 'type' in note && note.type === 'image'
                  ? 'image'
                  : imageUrl
                    ? 'image'
                : drawingUrl && text.trim().length === 0
                  ? 'drawing'
                  : 'text',
            text,
            drawingUrl,
            imageUrl,
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

  if (note.type === 'image') {
    return 'Image annotation'
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
  const [placementMode, setPlacementMode] = useState<'text' | 'drawing' | 'image' | null>(null)
  const [isEditingPositions, setIsEditingPositions] = useState(false)
  const [draftTextNote, setDraftTextNote] = useState<DraftTextNote>(null)
  const [draftDrawingNote, setDraftDrawingNote] = useState<DraftDrawingNote>(null)
  const [draftImageNote, setDraftImageNote] = useState<DraftImageNote>(null)
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
        dragState.kind === 'saved-note'
          ? currentNotes.map((note) =>
              note.id === dragState.id
                ? {
                    ...note,
                    xPercent: nextXPercent,
                    yOffset: nextYOffset,
                  }
                : note,
            )
          : currentNotes,
      )

      if (dragState.kind === 'draft-text') {
        setDraftTextNote((currentDraft) =>
          currentDraft
            ? {
                ...currentDraft,
                xPercent: nextXPercent,
                yOffset: nextYOffset,
              }
            : null,
        )
      }

      if (dragState.kind === 'draft-drawing') {
        setDraftDrawingNote((currentDraft) =>
          currentDraft
            ? {
                ...currentDraft,
                xPercent: nextXPercent,
                yOffset: nextYOffset,
              }
            : null,
        )
      }

      if (dragState.kind === 'draft-image') {
        setDraftImageNote((currentDraft) =>
          currentDraft
            ? {
                ...currentDraft,
                xPercent: nextXPercent,
                yOffset: nextYOffset,
              }
            : null,
        )
      }
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
    setDraftImageNote(null)
    setPlacementMode(null)
  }

  const handlePlacementClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((draftTextNote || draftDrawingNote || draftImageNote) || isEditingPositions || !placementMode) {
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
    } else if (placementMode === 'drawing') {
      setDraftDrawingNote({ type: 'drawing', xPercent, yOffset })
    } else {
      setDraftImageNote({
        type: 'image',
        xPercent,
        yOffset,
        file: null,
        previewUrl: null,
        isUploading: false,
      })
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
        imageUrl: null,
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
        imageUrl: null,
        xPercent: draftDrawingNote.xPercent,
        yOffset: draftDrawingNote.yOffset,
        createdAt: new Date().toISOString(),
      },
    ])
    setDraftDrawingNote(null)
  }

  const handleDraftImageSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] ?? null

    if (!selectedFile) {
      return
    }

    const previewUrl = await readFileAsDataUrl(selectedFile)

    setDraftImageNote((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            file: selectedFile,
            previewUrl,
          }
        : null,
    )
  }

  const saveDraftImageNote = async () => {
    if (!draftImageNote?.file) {
      window.alert('Choose an image first.')
      return
    }

    try {
      setDraftImageNote((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              isUploading: true,
            }
          : null,
      )

      const imageUrl = await uploadImageToCloudinary(draftImageNote.file)

      setNotes((currentNotes) => [
        ...currentNotes,
        {
          id: createNoteId(),
          type: 'image',
          text: '',
          drawingUrl: null,
          imageUrl,
          xPercent: draftImageNote.xPercent,
          yOffset: draftImageNote.yOffset,
          createdAt: new Date().toISOString(),
        },
      ])
      setDraftImageNote(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Image upload failed.')
      setDraftImageNote((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              isUploading: false,
            }
          : null,
      )
    }
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
      kind: 'saved-note',
      id: noteId,
      pointerOffsetX: event.clientX - bounds.left,
      pointerOffsetY: event.clientY - bounds.top,
    })
  }

  const startDraggingDraft = (
    event: React.PointerEvent<HTMLElement>,
    kind: 'draft-text' | 'draft-drawing' | 'draft-image',
  ) => {
    const element = event.currentTarget.parentElement

    if (!(element instanceof HTMLElement)) {
      return
    }

    const bounds = element.getBoundingClientRect()

    event.preventDefault()
    setDragState({
      kind,
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

  const startPlacementMode = (mode: 'text' | 'drawing' | 'image') => {
    setIsEditingPositions(false)
    setDragState(null)
    setDraftTextNote(null)
    setDraftDrawingNote(null)
    setDraftImageNote(null)
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
                placementMode === 'image' ? 'is-editing' : ''
              }`.trim()}
              type="button"
              onClick={() => startPlacementMode('image')}
            >
              {placementMode === 'image' ? 'Cancel image' : 'Add image'}
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
              disabled={notes.length === 0 && !draftTextNote && !draftDrawingNote && !draftImageNote}
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
              : placementMode === 'drawing'
                ? 'Click anywhere on the page to place a drawing there.'
                : 'Click anywhere on the page to place an image there.'}
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
            ) : note.type === 'image' && note.imageUrl ? (
              <img
                alt="Annotation upload"
                className="floating-note-image"
                src={note.imageUrl}
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
            <div
              className="floating-note-drag-handle"
              onPointerDown={(event) => startDraggingDraft(event, 'draft-text')}
            >
              Drag to move
            </div>
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
            <div
              className="floating-note-drag-handle"
              onPointerDown={(event) => startDraggingDraft(event, 'draft-drawing')}
            >
              Drag to move
            </div>
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

        {draftImageNote ? (
          <div
            className="floating-note floating-note-image-note draft"
            style={{ left: `${draftImageNote.xPercent}%`, top: `${draftImageNote.yOffset}px` }}
          >
            <div
              className="floating-note-drag-handle"
              onPointerDown={(event) => startDraggingDraft(event, 'draft-image')}
            >
              Drag to move
            </div>
            <label className="floating-note-upload-label">
              <span>Select image</span>
              <input
                accept="image/*"
                className="floating-note-file-input"
                type="file"
                onChange={(event) => void handleDraftImageSelection(event)}
              />
            </label>
            {draftImageNote.previewUrl ? (
              <img
                alt="Draft annotation upload preview"
                className="floating-note-image"
                src={draftImageNote.previewUrl}
              />
            ) : (
              <div className="floating-note-image-placeholder">
                Tiny image will be resized to 256px max and deeply fried before upload.
              </div>
            )}
            <div className="floating-note-draft-actions">
              <button
                className="floating-action-button subtle"
                type="button"
                onClick={() => setDraftImageNote(null)}
              >
                Cancel
              </button>
              <button
                className="floating-action-button"
                type="button"
                disabled={!draftImageNote.file || draftImageNote.isUploading}
                onClick={() => void saveDraftImageNote()}
              >
                {draftImageNote.isUploading ? 'Uploading...' : 'Save image'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
