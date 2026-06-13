import { useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import './App.css'
import { TopDownPlan } from './components/TopDownPlan'
import { StreetView } from './components/StreetView'
import { DEFAULT_DESIGN, MATERIAL_LABELS, PLANT_PALETTE, PRESET_KEY, STORAGE_KEY } from './data'
import { cloneDesign, createPromptText, getSelectionSummary, normalizeDesign, plantDefinitionById, validateDesign } from './lib/utils'
import type { Boulder, DesignState, Grade, MaterialType, Selection, SiteDimensions } from './types'

type HistoryState = {
  past: DesignState[]
  present: DesignState
  future: DesignState[]
}

type PaletteDrop =
  | { kind: 'plant'; plantId: string }
  | { kind: 'boulder' }
  | { kind: 'utility'; shape: 'circle' | 'rectangle' }
  | null

type Tab = 'designer' | 'street' | 'help'

type SavedPreset = {
  id: string
  name: string
  savedAt: string
  design: DesignState
}

type SiteRectKey = 'house' | 'garage' | 'porch' | 'driveway' | 'frontWalk' | 'mainBed' | 'leftSideBed' | 'sidewalk' | 'curbStrip'
type SiteRectField = 'x' | 'y' | 'width' | 'depth'

const SITE_RECT_SECTIONS: Array<{ key: SiteRectKey; label: string }> = [
  { key: 'house', label: 'House footprint' },
  { key: 'garage', label: 'Garage' },
  { key: 'porch', label: 'Porch' },
  { key: 'driveway', label: 'Driveway' },
  { key: 'frontWalk', label: 'Front walk' },
  { key: 'mainBed', label: 'Main bed' },
  { key: 'leftSideBed', label: 'Left side bed' },
  { key: 'sidewalk', label: 'Sidewalk' },
  { key: 'curbStrip', label: 'Curb strip' },
]

const loadInitial = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return cloneDesign(DEFAULT_DESIGN)
  try {
    const parsed = JSON.parse(raw) as DesignState
    return normalizeDesign(parsed)
  } catch {
    return cloneDesign(DEFAULT_DESIGN)
  }
}

const loadPresets = () => {
  const raw = localStorage.getItem(PRESET_KEY)
  if (!raw) return [] as SavedPreset[]
  try {
    return JSON.parse(raw) as SavedPreset[]
  } catch {
    return [] as SavedPreset[]
  }
}

function App() {
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: loadInitial(), future: [] }))
  const [selection, setSelection] = useState<Selection>(null)
  const [activeTab, setActiveTab] = useState<Tab>('designer')
  const [activePaintMaterial, setActivePaintMaterial] = useState<MaterialType>('gray-stone')
  const [activeRiverEdit, setActiveRiverEdit] = useState(false)
  const [activeDrop, setActiveDrop] = useState<PaletteDrop>(null)
  const [statusMessage, setStatusMessage] = useState('Ready')
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => loadPresets())
  const stageRef = useRef<Konva.Stage | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const design = history.present
  const warnings = useMemo(() => validateDesign(design), [design])

  const updateDesign = (mutator: (draft: DesignState) => void | undefined, recordHistory = true) => {
    setHistory((current) => {
      const next = cloneDesign(current.present)
      const result = mutator(next)
      void result
      next.updatedAt = new Date().toISOString()
      if (recordHistory) {
        return {
          past: [...current.past, current.present],
          present: next,
          future: [],
        }
      }
      return {
        ...current,
        present: next,
      }
    })
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
  }, [design])

  useEffect(() => {
    localStorage.setItem(PRESET_KEY, JSON.stringify(savedPresets))
  }, [savedPresets])

  const selectedPlant = selection?.kind === 'plant' ? design.placedPlants.find((item) => item.id === selection.id) : null
  const selectedBoulder = selection?.kind === 'boulder' ? design.boulders.find((item) => item.id === selection.id) : null
  const selectedUtility = selection?.kind === 'utility' ? design.utilityCovers.find((item) => item.id === selection.id) : null
  const selectedExistingPlant = selection?.kind === 'existingPlant' ? design.siteDimensions.existingPlants[selection.id] : null
  const selectedRiverPoint = selection?.kind === 'riverPoint' ? design.dryRiverBed.points[Number(selection.id.split('-')[1])] : null

  const copyPrompt = async (mode: 'street' | 'topdown') => {
    const text = createPromptText(design, mode === 'street' ? 'street' : 'topdown')
    await navigator.clipboard.writeText(text)
    setStatusMessage(mode === 'street' ? 'Street-view prompt copied.' : 'Top-down prompt copied.')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'xeriscape-design.json'
    link.click()
    URL.revokeObjectURL(href)
    setStatusMessage('Design JSON exported.')
  }

  const exportPng = () => {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 })
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'xeriscape-plan.png'
    link.click()
    setStatusMessage('Top-down plan exported as PNG.')
  }

  const savePreset = () => {
    const name = window.prompt('Preset name', design.name)
    if (!name) return
    const preset: SavedPreset = { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), design: cloneDesign(design) }
    setSavedPresets((current) => [preset, ...current])
    setStatusMessage(`Saved preset “${name}”.`)
  }

  const loadPreset = (presetId: string) => {
    const preset = savedPresets.find((entry) => entry.id === presetId)
    if (!preset) return
    setHistory((current) => ({ past: [...current.past, current.present], present: normalizeDesign(preset.design), future: [] }))
    setSelection(null)
    setStatusMessage(`Loaded preset “${preset.name}”.`)
  }

  const resetDesign = () => {
    setHistory((current) => ({ past: [...current.past, current.present], present: cloneDesign(DEFAULT_DESIGN), future: [] }))
    setSelection(null)
    setStatusMessage('Reset to default design.')
  }

  const loadExample = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}examples/default-design.json`)
    const example = normalizeDesign((await response.json()) as DesignState)
    setHistory((current) => ({ past: [...current.past, current.present], present: example, future: [] }))
    setStatusMessage('Loaded the bundled example design.')
  }

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const imported = normalizeDesign(JSON.parse(text) as DesignState)
    setHistory((current) => ({ past: [...current.past, current.present], present: imported, future: [] }))
    setSelection(null)
    setStatusMessage(`Imported ${file.name}.`)
    event.target.value = ''
  }

  const importPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateDesign((draft) => {
        draft.housePhotoReference = typeof reader.result === 'string' ? reader.result : null
      })
      setStatusMessage(`Loaded reference photo: ${file.name}`)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const updateNumericField = (path: 'x' | 'y' | 'rotation' | 'matureSpread' | 'sizeFt' | 'width' | 'height' | 'canopyRadius', value: number) => {
    if (selectedPlant) {
      updateDesign((draft) => {
        const plant = draft.placedPlants.find((item) => item.id === selectedPlant.id)
        if (!plant) return
        if (path === 'x' || path === 'y' || path === 'rotation' || path === 'matureSpread') {
          ;(plant[path] as number) = value
        }
      })
      return
    }
    if (selectedBoulder) {
      updateDesign((draft) => {
        const boulder = draft.boulders.find((item) => item.id === selectedBoulder.id)
        if (!boulder) return
        if (path === 'x' || path === 'y' || path === 'rotation') {
          ;(boulder[path] as number) = value
        }
        if (path === 'sizeFt') {
          boulder.sizeFt = value as Boulder['sizeFt']
        }
      })
      return
    }
    if (selectedUtility) {
      updateDesign((draft) => {
        const cover = draft.utilityCovers.find((item) => item.id === selectedUtility.id)
        if (!cover) return
        if (path === 'x' || path === 'y' || path === 'width' || path === 'height') {
          ;(cover[path] as number) = value
        }
      })
      return
    }
    if (selectedExistingPlant && selection?.kind === 'existingPlant') {
      updateDesign((draft) => {
        const tree = draft.siteDimensions.existingPlants[selection.id]
        if (path === 'x' || path === 'y' || path === 'canopyRadius') {
          ;(tree[path] as number) = value
        }
      })
      return
    }
    if (selectedRiverPoint && selection?.kind === 'riverPoint') {
      const pointIndex = Number(selection.id.split('-')[1])
      updateDesign((draft) => {
        const point = draft.dryRiverBed.points[pointIndex]
        if (!point) return
        if (path === 'x' || path === 'y') {
          point[path] = value
        }
      })
    }
  }

  const updateSiteMetric = (field: 'totalFrontage' | 'totalDepth' | 'gridFeet', value: number) => {
    updateDesign((draft) => {
      if (field === 'gridFeet') {
        draft.siteDimensions.gridFeet = Math.max(0.5, Number.isFinite(value) ? value : 0.5)
        return
      }
      const nextValue = Math.max(1, Number.isFinite(value) ? value : 1)
      draft.siteDimensions[field] = nextValue
      if (field === 'totalFrontage') {
        draft.siteDimensions.rightBoundaryX = nextValue
      }
    })
  }

  const updateSiteRect = (section: SiteRectKey, field: SiteRectField, value: number) => {
    updateDesign((draft) => {
      const rect = draft.siteDimensions[section] as SiteDimensions['house']
      rect[field] = Math.max(0, Number.isFinite(value) ? value : 0)
    })
  }

  const updateSlopeGrade = (grade: Grade) => {
    updateDesign((draft) => {
      draft.siteDimensions.slope.grade = grade
    })
  }

  const deleteSelection = () => {
    if (!selection) return
    updateDesign((draft) => {
      if (selection.kind === 'plant') {
        draft.placedPlants = draft.placedPlants.filter((item) => item.id !== selection.id)
      }
      if (selection.kind === 'boulder') {
        draft.boulders = draft.boulders.filter((item) => item.id !== selection.id)
      }
      if (selection.kind === 'utility') {
        draft.utilityCovers = draft.utilityCovers.filter((item) => item.id !== selection.id)
      }
      if (selection.kind === 'riverPoint') {
        const index = Number(selection.id.split('-')[1])
        if (draft.dryRiverBed.points.length > 3) draft.dryRiverBed.points.splice(index, 1)
      }
    })
    setSelection(null)
  }

  const duplicateSelection = () => {
    if (!selectedPlant) return
    updateDesign((draft) => {
      draft.placedPlants.push({ ...selectedPlant, id: `plant-${crypto.randomUUID()}`, x: selectedPlant.x + 2, y: selectedPlant.y + 2 })
    })
  }

  const toggleLock = () => {
    if (selection?.kind === 'plant') {
      updateDesign((draft) => {
        const plant = draft.placedPlants.find((item) => item.id === selection.id)
        if (plant) plant.locked = !plant.locked
      })
      return
    }
    if (selection?.kind === 'boulder') {
      updateDesign((draft) => {
        const boulder = draft.boulders.find((item) => item.id === selection.id)
        if (boulder) boulder.locked = !boulder.locked
      })
      return
    }
    if (selection?.kind === 'utility') {
      updateDesign((draft) => {
        const cover = draft.utilityCovers.find((item) => item.id === selection.id)
        if (cover) cover.locked = !cover.locked
      })
      return
    }
    if (selection?.kind === 'existingPlant') {
      updateDesign((draft) => {
        draft.siteDimensions.existingPlants[selection.id].locked = !draft.siteDimensions.existingPlants[selection.id].locked
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Static React + TypeScript app for GitHub Pages</p>
          <h1>Colorado Xeriscape Designer</h1>
          <p>
            Plan a Colorado front-yard xeriscape, preview it from the curb, and copy prompts for realistic image generation.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setHistory((current) => current.past.length ? ({ past: current.past.slice(0, -1), present: current.past.at(-1)!, future: [current.present, ...current.future] }) : current)} disabled={!history.past.length}>Undo</button>
          <button type="button" onClick={() => setHistory((current) => current.future.length ? ({ past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) }) : current)} disabled={!history.future.length}>Redo</button>
          <button type="button" onClick={exportJson}>Export JSON</button>
          <button type="button" onClick={exportPng}>Export PNG</button>
          <button type="button" onClick={() => importRef.current?.click()}>Import JSON</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={importJson} />
        </div>
      </header>

      <section className="app-statusbar">
        <span>{statusMessage}</span>
        <span>{warnings.length ? `${warnings.length} warning(s)` : 'No active layout warnings'}</span>
        <span>Auto-saved locally</span>
      </section>

      <div className="app-layout">
        <aside className="sidebar">
          <section className="card tabs-card">
            <div className="tabs">
              <button type="button" className={activeTab === 'designer' ? 'active' : ''} onClick={() => setActiveTab('designer')}>Designer</button>
              <button type="button" className={activeTab === 'street' ? 'active' : ''} onClick={() => setActiveTab('street')}>Street View</button>
              <button type="button" className={activeTab === 'help' ? 'active' : ''} onClick={() => setActiveTab('help')}>Help</button>
            </div>
          </section>

          <section className="card">
            <h2>Quick actions</h2>
            <div className="button-grid">
              <button type="button" onClick={savePreset}>Save preset</button>
              <button type="button" onClick={loadExample}>Load bundled example</button>
              <button type="button" onClick={resetDesign}>Reset default design</button>
              <button type="button" onClick={() => copyPrompt('street')}>Copy realistic street-view prompt</button>
              <button type="button" onClick={() => copyPrompt('topdown')}>Copy top-down render prompt</button>
              <button type="button" onClick={() => photoInputRef.current?.click()}>Upload house photo reference</button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={importPhoto} />
            {savedPresets.length > 0 && (
              <label>
                Saved presets
                <select defaultValue="" onChange={(event) => event.target.value && loadPreset(event.target.value)}>
                  <option value="">Choose a preset…</option>
                  {savedPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name} · {new Date(preset.savedAt).toLocaleString()}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section className="card">
            <h2>Palette</h2>
            <p className="muted">Drag plants into the plan. Click the other tools, then click the plan to place them.</p>
            <div className="palette-grid">
              {PLANT_PALETTE.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  className="palette-item"
                  draggable
                  onDragStart={(event) => {
                    const payload = JSON.stringify({ kind: 'plant', plantId: plant.id })
                    event.dataTransfer.setData('application/x-xeriscape-item', payload)
                    setActiveDrop({ kind: 'plant', plantId: plant.id })
                  }}
                >
                  <span className="palette-icon" style={{ backgroundColor: plant.defaultColor }}>{plant.icon}</span>
                  <span>
                    <strong>{plant.code}</strong> {plant.commonName}
                    <small>{plant.cultivar} · {plant.matureSpreadFt} ft spread</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="button-grid compact">
              <button type="button" onClick={() => setActiveDrop({ kind: 'boulder' })}>Place boulder</button>
              <button type="button" onClick={() => setActiveDrop({ kind: 'utility', shape: 'circle' })}>Place circular utility cover</button>
              <button type="button" onClick={() => setActiveDrop({ kind: 'utility', shape: 'rectangle' })}>Place rectangular utility cover</button>
              <button type="button" onClick={() => setActiveRiverEdit((current) => !current)} className={activeRiverEdit ? 'active' : ''}>{activeRiverEdit ? 'Stop river editing' : 'Edit dry river bed'}</button>
            </div>
          </section>

          <section className="card">
            <h2>View & materials</h2>
            <label>
              Surface paint material
              <select value={activePaintMaterial} onChange={(event) => setActivePaintMaterial(event.target.value as MaterialType)}>
                {Object.entries(MATERIAL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <div className="toggle-grid">
              <label><input type="checkbox" checked={design.settings.snapToGrid} onChange={() => updateDesign((draft) => { draft.settings.snapToGrid = !draft.settings.snapToGrid })} /> Snap to grid</label>
              <label><input type="checkbox" checked={design.settings.showLabels} onChange={() => updateDesign((draft) => { draft.settings.showLabels = !draft.settings.showLabels })} /> Show labels</label>
              <label><input type="checkbox" checked={design.settings.showMatureRings} onChange={() => updateDesign((draft) => { draft.settings.showMatureRings = !draft.settings.showMatureRings })} /> Show mature rings</label>
              <label><input type="checkbox" checked={design.settings.panMode} onChange={() => updateDesign((draft) => { draft.settings.panMode = !draft.settings.panMode })} /> Pan mode</label>
              <label><input type="checkbox" checked={design.dryRiverBed.taperEnds} onChange={() => updateDesign((draft) => { draft.dryRiverBed.taperEnds = !draft.dryRiverBed.taperEnds })} /> Taper river ends</label>
              <label><input type="checkbox" checked={design.dryRiverBed.addBoulderEdging} onChange={() => updateDesign((draft) => { draft.dryRiverBed.addBoulderEdging = !draft.dryRiverBed.addBoulderEdging })} /> Boulder edging</label>
              <label><input type="checkbox" checked={design.dryRiverBed.randomizeTexture} onChange={() => updateDesign((draft) => { draft.dryRiverBed.randomizeTexture = !draft.dryRiverBed.randomizeTexture })} /> Randomize river texture</label>
            </div>
            <label>
              River material
              <select value={design.dryRiverBed.material} onChange={(event) => updateDesign((draft) => { draft.dryRiverBed.material = event.target.value as MaterialType; draft.selectedStonePalette.river = event.target.value as MaterialType })}>
                {Object.entries(MATERIAL_LABELS)
                  .filter(([key]) => key.includes('cobble') || key.includes('river'))
                  .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label>
              River width (ft)
              <input type="number" min={1} step={0.5} value={design.dryRiverBed.widthFt} onChange={(event) => updateDesign((draft) => { draft.dryRiverBed.widthFt = Math.max(1, Number(event.target.value) || 1) })} />
            </label>
          </section>

          <section className="card site-model-panel">
            <h2>Yard layout / site model</h2>
            <p className="muted">Adjust the estimated yard geometry that drives the plan and prompt outputs.</p>
            <div className="site-model-grid">
              <label>
                Frontage (ft)
                <input type="number" min={1} step={0.5} value={design.siteDimensions.totalFrontage} onChange={(event) => updateSiteMetric('totalFrontage', Number(event.target.value))} />
              </label>
              <label>
                Depth (ft)
                <input type="number" min={1} step={0.5} value={design.siteDimensions.totalDepth} onChange={(event) => updateSiteMetric('totalDepth', Number(event.target.value))} />
              </label>
              <label>
                Grid spacing (ft)
                <input type="number" min={0.5} step={0.5} value={design.siteDimensions.gridFeet} onChange={(event) => updateSiteMetric('gridFeet', Number(event.target.value))} />
              </label>
              <label>
                Slope grade
                <select value={design.siteDimensions.slope.grade} onChange={(event) => updateSlopeGrade(event.target.value as Grade)}>
                  <option value="flat">Flat</option>
                  <option value="slight">Slight</option>
                  <option value="moderate">Moderate</option>
                  <option value="steep">Steep</option>
                </select>
              </label>
            </div>
            <div className="site-model-sections">
              {SITE_RECT_SECTIONS.map((section) => {
                const rect = design.siteDimensions[section.key]
                return (
                  <details key={section.key} className="site-model-section" open={section.key === 'house' || section.key === 'mainBed'}>
                    <summary>{section.label}</summary>
                    <div className="site-model-grid compact">
                      <label>
                        X (ft)
                        <input type="number" step={0.5} value={rect.x} onChange={(event) => updateSiteRect(section.key, 'x', Number(event.target.value))} />
                      </label>
                      <label>
                        Y (ft)
                        <input type="number" step={0.5} value={rect.y} onChange={(event) => updateSiteRect(section.key, 'y', Number(event.target.value))} />
                      </label>
                      <label>
                        Width (ft)
                        <input type="number" min={0} step={0.5} value={rect.width} onChange={(event) => updateSiteRect(section.key, 'width', Number(event.target.value))} />
                      </label>
                      <label>
                        Depth (ft)
                        <input type="number" min={0} step={0.5} value={rect.depth} onChange={(event) => updateSiteRect(section.key, 'depth', Number(event.target.value))} />
                      </label>
                    </div>
                  </details>
                )
              })}
            </div>
          </section>

          <section className="card">
            <h2>Inspector</h2>
            <p className="muted">{getSelectionSummary(design, selection)}</p>
            {!selection && <p>Select a plant, boulder, utility cover, tree, or river point to edit it.</p>}
            {selectedPlant && (
              <div className="inspector-fields">
                <p><strong>{plantDefinitionById(selectedPlant.plantId)?.commonName}</strong></p>
                <label>X (ft)<input type="number" value={selectedPlant.x} step={0.5} onChange={(event) => updateNumericField('x', Number(event.target.value))} /></label>
                <label>Y (ft)<input type="number" value={selectedPlant.y} step={0.5} onChange={(event) => updateNumericField('y', Number(event.target.value))} /></label>
                <label>Rotation<input type="number" value={selectedPlant.rotation} step={5} onChange={(event) => updateNumericField('rotation', Number(event.target.value))} /></label>
                <label>Mature spread (ft)<input type="number" min={0.5} value={selectedPlant.matureSpread} step={0.5} onChange={(event) => updateNumericField('matureSpread', Number(event.target.value))} /></label>
                <label><input type="checkbox" checked={selectedPlant.labelVisible} onChange={() => updateDesign((draft) => { const plant = draft.placedPlants.find((item) => item.id === selectedPlant.id); if (plant) plant.labelVisible = !plant.labelVisible })} /> Show label</label>
              </div>
            )}
            {selectedBoulder && (
              <div className="inspector-fields">
                <label>X (ft)<input type="number" value={selectedBoulder.x} step={0.5} onChange={(event) => updateNumericField('x', Number(event.target.value))} /></label>
                <label>Y (ft)<input type="number" value={selectedBoulder.y} step={0.5} onChange={(event) => updateNumericField('y', Number(event.target.value))} /></label>
                <label>Rotation<input type="number" value={selectedBoulder.rotation} step={5} onChange={(event) => updateNumericField('rotation', Number(event.target.value))} /></label>
                <label>Size<input type="number" min={2} max={4} step={1} value={selectedBoulder.sizeFt} onChange={(event) => updateNumericField('sizeFt', Number(event.target.value))} /></label>
                <label><input type="checkbox" checked={selectedBoulder.labelVisible} onChange={() => updateDesign((draft) => { const boulder = draft.boulders.find((item) => item.id === selectedBoulder.id); if (boulder) boulder.labelVisible = !boulder.labelVisible })} /> Show label</label>
              </div>
            )}
            {selectedUtility && (
              <div className="inspector-fields">
                <label>X (ft)<input type="number" value={selectedUtility.x} step={0.5} onChange={(event) => updateNumericField('x', Number(event.target.value))} /></label>
                <label>Y (ft)<input type="number" value={selectedUtility.y} step={0.5} onChange={(event) => updateNumericField('y', Number(event.target.value))} /></label>
                <label>Width (ft)<input type="number" min={1} value={selectedUtility.width} step={0.5} onChange={(event) => updateNumericField('width', Number(event.target.value))} /></label>
                <label>Height (ft)<input type="number" min={1} value={selectedUtility.height} step={0.5} onChange={(event) => updateNumericField('height', Number(event.target.value))} /></label>
                <label><input type="checkbox" checked={selectedUtility.avoidPlanting} onChange={() => updateDesign((draft) => { const cover = draft.utilityCovers.find((item) => item.id === selectedUtility.id); if (cover) cover.avoidPlanting = !cover.avoidPlanting })} /> Avoid planting here</label>
              </div>
            )}
            {selectedExistingPlant && selection?.kind === 'existingPlant' && (
              <div className="inspector-fields">
                <p><strong>{selectedExistingPlant.commonName}</strong></p>
                <label>X (ft)<input type="number" value={selectedExistingPlant.x} step={0.5} onChange={(event) => updateNumericField('x', Number(event.target.value))} /></label>
                <label>Y (ft)<input type="number" value={selectedExistingPlant.y} step={0.5} onChange={(event) => updateNumericField('y', Number(event.target.value))} /></label>
                <label>Canopy radius (ft)<input type="number" min={1} value={selectedExistingPlant.canopyRadius} step={0.5} onChange={(event) => updateNumericField('canopyRadius', Number(event.target.value))} /></label>
              </div>
            )}
            {selectedRiverPoint && (
              <div className="inspector-fields">
                <label>X (ft)<input type="number" value={selectedRiverPoint.x} step={0.5} onChange={(event) => updateNumericField('x', Number(event.target.value))} /></label>
                <label>Y (ft)<input type="number" value={selectedRiverPoint.y} step={0.5} onChange={(event) => updateNumericField('y', Number(event.target.value))} /></label>
                <p className="muted">Add points by enabling river editing and clicking the plan. Remove this point with delete.</p>
              </div>
            )}
            <div className="button-grid compact">
              <button type="button" onClick={toggleLock} disabled={!selection || selection.kind === 'riverPoint'}>{(selectedPlant?.locked || selectedBoulder?.locked || selectedUtility?.locked || selectedExistingPlant?.locked) ? 'Unlock' : 'Lock'}</button>
              <button type="button" onClick={duplicateSelection} disabled={!selectedPlant}>Duplicate</button>
              <button type="button" onClick={deleteSelection} disabled={!selection || selection.kind === 'existingPlant'}>Delete</button>
            </div>
          </section>

          <section className="card">
            <h2>Warnings</h2>
            {warnings.length === 0 ? <p>No current layout warnings.</p> : <ul className="warnings">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            <p className="muted">Warnings are advisory only; you can keep the layout as-is.</p>
          </section>

          <section className="card house-photo-card">
            <h2>House photo reference</h2>
            {design.housePhotoReference ? <img src={design.housePhotoReference} alt="Uploaded house reference" /> : <div className="photo-placeholder">Upload the attached house photo or any replacement image here.</div>}
          </section>
        </aside>

        <main className="main-panel">
          {activeTab === 'designer' && (
            <TopDownPlan
              design={design}
              selection={selection}
              setSelection={setSelection}
              setDesign={updateDesign}
              activePaintMaterial={activePaintMaterial}
              activeRiverEdit={activeRiverEdit}
              activeDrop={activeDrop}
              clearActiveDrop={() => setActiveDrop(null)}
              onExportReady={(stage) => {
                stageRef.current = stage
              }}
            />
          )}
          {activeTab === 'street' && <StreetView design={design} />}
          {activeTab === 'help' && (
            <section className="help-grid">
              <article className="card">
                <h2>How to use the planner</h2>
                <ol>
                  <li>Drag plants from the palette into the top-down plan.</li>
                  <li>Click any zone to repaint its surface material.</li>
                  <li>Use “Edit dry river bed” and click the plan to add path points.</li>
                  <li>Select items to adjust position, spread, rotation, labels, and lock state.</li>
                  <li>Export PNG or JSON, or copy a rendering prompt for ChatGPT.</li>
                </ol>
              </article>
              <article className="card">
                <h2>What is stored</h2>
                <p>The app auto-saves the current design, presets, and any uploaded house reference image in your browser localStorage.</p>
                <p>Exported JSON includes the full parameterized site model, current plants, boulders, dry river path, materials, and layout settings.</p>
              </article>
              <article className="card">
                <h2>Default site model</h2>
                <ul>
                  <li>66 ft frontage by 54 ft depth</li>
                  <li>Driveway on the left, main planting bed on the right</li>
                  <li>Sidewalk near the street and porch at the north edge</li>
                  <li>Existing ornamental cherry, maple, and blue spruce start unlocked so you can reposition them</li>
                </ul>
              </article>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
