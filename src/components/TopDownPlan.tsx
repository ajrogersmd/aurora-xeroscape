import { useMemo, useRef, useState } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import { MATERIAL_LABELS, PIXELS_PER_FOOT, SITE_RECT_LABELS } from '../data'
import { coerceWithinSite, feetToPixels, formatFeet, getBoulderPoints, getPlantLabel, plantDefinitionById, roundToGrid } from '../lib/utils'
import type { Boulder, DesignState, ExistingPlantKey, MaterialType, Selection, SiteRectKey, SurfaceZoneKey } from '../types'

type PaletteDrop =
  | { kind: 'plant'; plantId: string }
  | { kind: 'boulder' }
  | { kind: 'utility'; shape: 'circle' | 'rectangle' }

const zoneColor: Record<MaterialType, string> = {
  'gray-stone': '#cfd6db',
  'rose-stone': '#b78b7c',
  mulch: '#8a6b49',
  gravel: '#b7b2a2',
  'rose-cobble': '#bf8f80',
  'gray-river-rock': '#9ea9b1',
  'mixed-tan-gray-cobble': '#c0b3a0',
  'large-rounded-cobble': '#bca996',
}

type Props = {
  design: DesignState
  selection: Selection
  setSelection: (selection: Selection) => void
  setDesign: (updater: (draft: DesignState) => void, recordHistory?: boolean) => void
  activePaintMaterial: MaterialType
  activeRiverEdit: boolean
  activeDrop: PaletteDrop | null
  clearActiveDrop: () => void
  onExportReady: (stage: Konva.Stage | null) => void
}

type ActiveSelection = Exclude<Selection, null>


export function TopDownPlan({
  design,
  selection,
  setSelection,
  setDesign,
  activePaintMaterial,
  activeRiverEdit,
  activeDrop,
  clearActiveDrop,
  onExportReady,
}: Props) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [zoom, setZoom] = useState(1)
  const [stagePosition, setStagePosition] = useState({ x: 12, y: 12 })
  const riverPointMap = useMemo(
    () => design.dryRiverBed.points.map((_, index) => ({ id: `river-${index}`, index })),
    [design.dryRiverBed.points],
  )

  const siteWidth = feetToPixels(design.siteDimensions.totalFrontage)
  const siteHeight = feetToPixels(design.siteDimensions.totalDepth)
  const gridStep = feetToPixels(design.siteDimensions.gridFeet)
  const activeSiteRectKey = selection?.kind === 'siteRect' ? selection.id : null

  const applyPosition = (nextSelection: ActiveSelection, x: number, y: number) => {
    if (selection?.kind !== nextSelection.kind || selection.id !== nextSelection.id) {
      setSelection(nextSelection)
    }
    setDesign((draft) => {
      const nextX = draft.settings.snapToGrid ? roundToGrid(x, draft.siteDimensions.gridFeet / 2) : x
      const nextY = draft.settings.snapToGrid ? roundToGrid(y, draft.siteDimensions.gridFeet / 2) : y
      if (nextSelection.kind === 'plant') {
        const plant = draft.placedPlants.find((item) => item.id === nextSelection.id)
        if (plant && !plant.locked) {
          plant.x = nextX
          plant.y = nextY
        }
      }
      if (nextSelection.kind === 'boulder') {
        const boulder = draft.boulders.find((item) => item.id === nextSelection.id)
        if (boulder && !boulder.locked) {
          boulder.x = nextX
          boulder.y = nextY
        }
      }
      if (nextSelection.kind === 'utility') {
        const cover = draft.utilityCovers.find((item) => item.id === nextSelection.id)
        if (cover && !cover.locked) {
          cover.x = nextX
          cover.y = nextY
        }
      }
      if (nextSelection.kind === 'existingPlant') {
        const plant = draft.siteDimensions.existingPlants[nextSelection.id]
        if (!plant.locked) {
          plant.x = nextX
          plant.y = nextY
        }
      }
      if (nextSelection.kind === 'riverPoint') {
        const riverPoint = riverPointMap.find((item) => item.id === nextSelection.id)
        if (riverPoint) {
          draft.dryRiverBed.points[riverPoint.index] = { x: nextX, y: nextY }
        }
      }
    }, false)
  }

  const commitDrag = () => setDesign(() => undefined, true)

  const applySiteRectPosition = (section: SiteRectKey, x: number, y: number) => {
    setSelection({ kind: 'siteRect', id: section })
    setDesign((draft) => {
      const rect = draft.siteDimensions[section] as DesignState['siteDimensions']['house']
      const nextX = draft.settings.snapToGrid ? roundToGrid(x, draft.siteDimensions.gridFeet / 2) : x
      const nextY = draft.settings.snapToGrid ? roundToGrid(y, draft.siteDimensions.gridFeet / 2) : y
      const nextPosition = coerceWithinSite(draft.siteDimensions, nextX, nextY, rect.width, rect.depth)
      rect.x = nextPosition.x
      rect.y = nextPosition.y
    }, false)
  }

  const addDroppedItem = (payload: PaletteDrop, x: number, y: number) => {
    setDesign((draft) => {
      const nextX = draft.settings.snapToGrid ? roundToGrid(x, draft.siteDimensions.gridFeet / 2) : x
      const nextY = draft.settings.snapToGrid ? roundToGrid(y, draft.siteDimensions.gridFeet / 2) : y
      if (payload.kind === 'plant') {
        const definition = plantDefinitionById(payload.plantId)
        if (!definition) return
        draft.placedPlants.push({
          id: `plant-${crypto.randomUUID()}`,
          plantId: payload.plantId,
          x: nextX,
          y: nextY,
          rotation: 0,
          matureSpread: definition.matureSpreadFt,
          labelVisible: false,
          locked: false,
        })
      }
      if (payload.kind === 'boulder') {
        draft.boulders.push({
          id: `boulder-${crypto.randomUUID()}`,
          x: nextX,
          y: nextY,
          sizeFt: 3,
          rotation: 0,
          labelVisible: false,
          locked: false,
          seed: Math.floor(Math.random() * 1000),
        })
      }
      if (payload.kind === 'utility') {
        draft.utilityCovers.push({
          id: `utility-${crypto.randomUUID()}`,
          x: nextX,
          y: nextY,
          width: payload.shape === 'circle' ? 2 : 3,
          height: 2,
          shape: payload.shape,
          locked: false,
          avoidPlanting: true,
        })
      }
    })
    clearActiveDrop()
  }

  const renderZoneRect = (key: SurfaceZoneKey, title: string, x: number, y: number, width: number, height: number) => (
    <Group key={key}>
      <Rect
        x={feetToPixels(x)}
        y={feetToPixels(y)}
        width={feetToPixels(width)}
        height={feetToPixels(height)}
        fill={zoneColor[design.surfaceZones[key]]}
        stroke="#6b7280"
        strokeWidth={1}
        cornerRadius={6}
        onClick={() => {
          if (activeDrop || activeRiverEdit) return
          setSelection(null)
          setDesign((draft) => {
            draft.surfaceZones[key] = activePaintMaterial
            if (key === 'mainBed') draft.selectedStonePalette.main = activePaintMaterial
          })
        }}
      />
      <Text x={feetToPixels(x) + 6} y={feetToPixels(y) + 6} text={`${title}: ${MATERIAL_LABELS[design.surfaceZones[key]]}`} fontSize={12} fill="#334155" />
    </Group>
  )

  const riverPoints = design.dryRiverBed.points.flatMap((point) => [feetToPixels(point.x), feetToPixels(point.y)])

  const shapeLabel = (boulder: Boulder) => `${boulder.sizeFt} ft boulder`

  return (
    <div className="plan-shell">
      <div className="plan-toolbar">
        <span>
          {activeDrop
            ? 'Click anywhere in the plan to place the selected item.'
            : activeRiverEdit
              ? 'Click in the plan to add river points, or drag existing points to reshape the bed.'
            : activeSiteRectKey
              ? 'Drag the highlighted footprint to edit the base scene.'
              : 'Click a palette item to place it or select a site-model footprint to edit it.'}
        </span>
        <label>
          Zoom
          <input
            type="range"
            min={0.6}
            max={2}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={() => { setZoom(1); setStagePosition({ x: 12, y: 12 }) }}>
          Reset view
        </button>
      </div>
      <div className="plan-container">
        <Stage
          ref={(node) => {
            stageRef.current = node
            onExportReady(node)
          }}
          width={Math.max(siteWidth + 24, 960)}
          height={Math.max(siteHeight + 24, 700)}
          scaleX={zoom}
          scaleY={zoom}
          x={stagePosition.x}
          y={stagePosition.y}
          draggable={design.settings.panMode}
          onDragEnd={(event) => {
            const stage = event.target.getStage()
            if (!stage || event.target !== stage) return
            setStagePosition({ x: stage.x(), y: stage.y() })
          }}
          onClick={(event) => {
            const position = event.target.getStage()?.getPointerPosition()
            if (!position) {
              setSelection(null)
              return
            }
            const x = (position.x - stagePosition.x) / zoom / PIXELS_PER_FOOT
            const y = (position.y - stagePosition.y) / zoom / PIXELS_PER_FOOT
            if (activeDrop) {
              addDroppedItem(activeDrop, x, y)
              return
            }
            if (activeRiverEdit) {
              setDesign((draft) => {
                draft.dryRiverBed.points.push({
                  x: draft.settings.snapToGrid ? roundToGrid(x, draft.siteDimensions.gridFeet / 2) : x,
                  y: draft.settings.snapToGrid ? roundToGrid(y, draft.siteDimensions.gridFeet / 2) : y,
                })
              })
              return
            }
            if (event.target === event.target.getStage()) {
              setSelection(null)
            }
          }}
        >
          <Layer>
            {Array.from({ length: Math.ceil(siteWidth / gridStep) + 1 }, (_, index) => (
              <Group key={`grid-x-${index}`}>
                <Line points={[index * gridStep, 0, index * gridStep, siteHeight]} stroke="#d8dee6" strokeWidth={1} />
                <Text x={index * gridStep + 2} y={2} text={`${index * design.siteDimensions.gridFeet}`} fontSize={10} fill="#64748b" />
              </Group>
            ))}
            {Array.from({ length: Math.ceil(siteHeight / gridStep) + 1 }, (_, index) => (
              <Group key={`grid-y-${index}`}>
                <Line points={[0, index * gridStep, siteWidth, index * gridStep]} stroke="#d8dee6" strokeWidth={1} />
                <Text x={2} y={index * gridStep + 2} text={`${index * design.siteDimensions.gridFeet}`} fontSize={10} fill="#64748b" />
              </Group>
            ))}

            <Rect x={0} y={0} width={siteWidth} height={siteHeight} fill="#edf2f7" stroke="#475569" strokeWidth={2} />
            {renderZoneRect('leftSideBed', 'Left side bed', design.siteDimensions.leftSideBed.x, design.siteDimensions.leftSideBed.y, design.siteDimensions.leftSideBed.width, design.siteDimensions.leftSideBed.depth)}
            {renderZoneRect('mainBed', 'Main bed', design.siteDimensions.mainBed.x, design.siteDimensions.mainBed.y, design.siteDimensions.mainBed.width, design.siteDimensions.mainBed.depth)}
            {renderZoneRect('curbStrip', 'Curb strip', design.siteDimensions.curbStrip.x, design.siteDimensions.curbStrip.y, design.siteDimensions.curbStrip.width, design.siteDimensions.curbStrip.depth)}

            <Rect
              x={feetToPixels(design.siteDimensions.driveway.x)}
              y={feetToPixels(design.siteDimensions.driveway.y)}
              width={feetToPixels(design.siteDimensions.driveway.width)}
              height={feetToPixels(design.siteDimensions.driveway.depth)}
              fill="#b7bec8"
              stroke="#6b7280"
              strokeWidth={1}
              onClick={() => {
                if (activeDrop || activeRiverEdit) return
                setSelection({ kind: 'siteRect', id: 'driveway' })
              }}
            />
            <Rect
              x={feetToPixels(design.siteDimensions.house.x)}
              y={feetToPixels(design.siteDimensions.house.y)}
              width={feetToPixels(design.siteDimensions.house.width)}
              height={feetToPixels(design.siteDimensions.house.depth)}
              fill="#d8dde5"
              stroke="#64748b"
              strokeWidth={1.5}
              onClick={() => {
                if (activeDrop || activeRiverEdit) return
                setSelection({ kind: 'siteRect', id: 'house' })
              }}
            />
            <Rect
              x={feetToPixels(design.siteDimensions.garage.x)}
              y={feetToPixels(design.siteDimensions.garage.y)}
              width={feetToPixels(design.siteDimensions.garage.width)}
              height={feetToPixels(design.siteDimensions.garage.depth)}
              fill="#c3cad4"
              stroke="#64748b"
              strokeWidth={1.5}
              onClick={() => {
                if (activeDrop || activeRiverEdit) return
                setSelection({ kind: 'siteRect', id: 'garage' })
              }}
            />
            <Rect
              x={feetToPixels(design.siteDimensions.porch.x)}
              y={feetToPixels(design.siteDimensions.porch.y)}
              width={feetToPixels(design.siteDimensions.porch.width)}
              height={feetToPixels(design.siteDimensions.porch.depth)}
              fill="#c6b398"
              stroke="#7c5a3f"
              strokeWidth={1.5}
              onClick={() => {
                if (activeDrop || activeRiverEdit) return
                setSelection({ kind: 'siteRect', id: 'porch' })
              }}
            />
            <Rect
              x={feetToPixels(design.siteDimensions.frontWalk.x)}
              y={feetToPixels(design.siteDimensions.frontWalk.y)}
              width={feetToPixels(design.siteDimensions.frontWalk.width)}
              height={feetToPixels(design.siteDimensions.frontWalk.depth)}
              fill="#d9d9d9"
              stroke="#6b7280"
              strokeWidth={1}
              onClick={() => {
                if (activeDrop || activeRiverEdit) return
                setSelection({ kind: 'siteRect', id: 'frontWalk' })
              }}
            />
            <Rect
              x={feetToPixels(design.siteDimensions.sidewalk.x)}
              y={feetToPixels(design.siteDimensions.sidewalk.y)}
              width={feetToPixels(design.siteDimensions.sidewalk.width)}
              height={feetToPixels(design.siteDimensions.sidewalk.depth)}
              fill="#d7dce1"
              stroke="#64748b"
              strokeWidth={1}
              onClick={() => {
                if (activeDrop || activeRiverEdit) return
                setSelection({ kind: 'siteRect', id: 'sidewalk' })
              }}
            />

            {activeSiteRectKey && (
              <Group>
                <Rect
                  x={feetToPixels(design.siteDimensions[activeSiteRectKey].x)}
                  y={feetToPixels(design.siteDimensions[activeSiteRectKey].y)}
                  width={feetToPixels(design.siteDimensions[activeSiteRectKey].width)}
                  height={feetToPixels(design.siteDimensions[activeSiteRectKey].depth)}
                  fill="rgba(37, 99, 235, 0.08)"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dash={[10, 6]}
                  draggable={!design.settings.panMode}
                  onClick={() => setSelection({ kind: 'siteRect', id: activeSiteRectKey })}
                  onDragStart={() => setSelection({ kind: 'siteRect', id: activeSiteRectKey })}
                  onDragMove={(event) => applySiteRectPosition(activeSiteRectKey, event.target.x() / PIXELS_PER_FOOT, event.target.y() / PIXELS_PER_FOOT)}
                  onDragEnd={() => commitDrag()}
                />
                <Text
                  x={feetToPixels(design.siteDimensions[activeSiteRectKey].x) + 8}
                  y={Math.max(6, feetToPixels(design.siteDimensions[activeSiteRectKey].y) - 18)}
                  text={`Editing ${SITE_RECT_LABELS[activeSiteRectKey]}`}
                  fontSize={12}
                  fill="#1d4ed8"
                  fontStyle="bold"
                />
              </Group>
            )}

            <Text x={feetToPixels(1)} y={feetToPixels(1)} text="House / North" fontSize={14} fontStyle="bold" fill="#1e293b" />
            <Text x={feetToPixels(1)} y={siteHeight - 20} text="Street / South" fontSize={14} fontStyle="bold" fill="#1e293b" />
            <Text x={siteWidth - 160} y={siteHeight - 20} text={`Slope: ${design.siteDimensions.slope.grade}`} fontSize={14} fill="#1e293b" />
            <Line points={[siteWidth - 100, siteHeight - 30, siteWidth - 100, 30]} stroke="#3b82f6" strokeWidth={2} dash={[8, 8]} pointerLength={10} pointerWidth={10} />

            <Line points={riverPoints} stroke={zoneColor[design.dryRiverBed.material]} strokeWidth={feetToPixels(design.dryRiverBed.widthFt)} lineCap="round" lineJoin="round" tension={0.4} opacity={0.75} shadowBlur={design.dryRiverBed.randomizeTexture ? 10 : 0} shadowColor="#7c6b5f" />
            <Line points={riverPoints} stroke="#f5f1ea" strokeWidth={3} lineCap="round" lineJoin="round" tension={0.4} dash={design.dryRiverBed.randomizeTexture ? [4, 10] : undefined} opacity={0.75} />

            {riverPointMap.map((point, index) => {
              const riverPoint = design.dryRiverBed.points[index]
              return (
                <Circle
                  key={point.id}
                  x={feetToPixels(riverPoint.x)}
                  y={feetToPixels(riverPoint.y)}
                  radius={activeRiverEdit || selection?.id === point.id ? 6 : 4}
                  fill={selection?.id === point.id ? '#2563eb' : '#f8fafc'}
                  stroke="#2563eb"
                  strokeWidth={2}
                  draggable={activeRiverEdit}
                  onClick={(event) => {
                    if (activeDrop) return
                    if (activeRiverEdit) {
                      event.cancelBubble = true
                      return
                    }
                    setSelection({ kind: 'riverPoint', id: point.id })
                  }}
                  onDragStart={() => setSelection({ kind: 'riverPoint', id: point.id })}
                  onDragMove={(event) => applyPosition({ kind: 'riverPoint', id: point.id }, event.target.x() / PIXELS_PER_FOOT, event.target.y() / PIXELS_PER_FOOT)}
                  onDragEnd={() => commitDrag()}
                />
              )
            })}

            {Object.entries(design.siteDimensions.existingPlants).map(([key, existingPlant]) => (
              <Group key={key}>
                {design.settings.showMatureRings && (
                  <Circle
                    x={feetToPixels(existingPlant.x)}
                    y={feetToPixels(existingPlant.y)}
                    radius={feetToPixels(existingPlant.canopyRadius)}
                    stroke={existingPlant.color}
                    dash={[6, 6]}
                    opacity={0.35}
                  />
                )}
                <Circle
                  x={feetToPixels(existingPlant.x)}
                  y={feetToPixels(existingPlant.y)}
                  radius={feetToPixels(Math.max(2, existingPlant.canopyRadius / 2.5))}
                  fill={existingPlant.color}
                  stroke={selection?.kind === 'existingPlant' && selection.id === key ? '#0f172a' : '#475569'}
                  strokeWidth={2}
                  draggable={!existingPlant.locked}
                  onClick={() => {
                    if (activeDrop || activeRiverEdit) return
                    setSelection({ kind: 'existingPlant', id: key as ExistingPlantKey })
                  }}
                  onDragStart={() => setSelection({ kind: 'existingPlant', id: key as ExistingPlantKey })}
                  onDragMove={(event) => applyPosition({ kind: 'existingPlant', id: key as ExistingPlantKey }, event.target.x() / PIXELS_PER_FOOT, event.target.y() / PIXELS_PER_FOOT)}
                  onDragEnd={() => commitDrag()}
                />
                {design.settings.showLabels && (
                  <Text x={feetToPixels(existingPlant.x) + 6} y={feetToPixels(existingPlant.y) - 8} text={`EX ${existingPlant.commonName}`} fontSize={11} fill="#1f2937" />
                )}
              </Group>
            ))}

            {design.utilityCovers.map((cover) => (
              <Group key={cover.id}>
                {cover.shape === 'circle' ? (
                  <Circle
                    x={feetToPixels(cover.x)}
                    y={feetToPixels(cover.y)}
                    radius={feetToPixels(cover.width / 2)}
                    fill="#f5f5f4"
                    stroke={selection?.kind === 'utility' && selection.id === cover.id ? '#0f172a' : '#7c2d12'}
                    strokeWidth={2}
                    draggable={!cover.locked}
                    onClick={() => {
                      if (activeDrop || activeRiverEdit) return
                      setSelection({ kind: 'utility', id: cover.id })
                    }}
                    onDragStart={() => setSelection({ kind: 'utility', id: cover.id })}
                    onDragMove={(event) => applyPosition({ kind: 'utility', id: cover.id }, event.target.x() / PIXELS_PER_FOOT, event.target.y() / PIXELS_PER_FOOT)}
                    onDragEnd={() => commitDrag()}
                  />
                ) : (
                  <Rect
                    x={feetToPixels(cover.x - cover.width / 2)}
                    y={feetToPixels(cover.y - cover.height / 2)}
                    width={feetToPixels(cover.width)}
                    height={feetToPixels(cover.height)}
                    fill="#f5f5f4"
                    stroke={selection?.kind === 'utility' && selection.id === cover.id ? '#0f172a' : '#7c2d12'}
                    strokeWidth={2}
                    cornerRadius={4}
                    draggable={!cover.locked}
                    onClick={() => {
                      if (activeDrop || activeRiverEdit) return
                      setSelection({ kind: 'utility', id: cover.id })
                    }}
                    onDragStart={() => setSelection({ kind: 'utility', id: cover.id })}
                    onDragMove={(event) => applyPosition({ kind: 'utility', id: cover.id }, (event.target.x() + feetToPixels(cover.width / 2)) / PIXELS_PER_FOOT, (event.target.y() + feetToPixels(cover.height / 2)) / PIXELS_PER_FOOT)}
                    onDragEnd={() => commitDrag()}
                  />
                )}
                {design.settings.showLabels && <Text x={feetToPixels(cover.x) + 6} y={feetToPixels(cover.y) + 4} text={cover.avoidPlanting ? 'Utility / avoid planting' : 'Utility'} fontSize={10} fill="#7c2d12" />}
              </Group>
            ))}

            {design.boulders.map((boulder) => (
              <Group
                key={boulder.id}
                x={feetToPixels(boulder.x)}
                y={feetToPixels(boulder.y)}
                rotation={boulder.rotation}
                draggable={!boulder.locked}
                onClick={() => {
                  if (activeDrop || activeRiverEdit) return
                  setSelection({ kind: 'boulder', id: boulder.id })
                }}
                onDragStart={() => setSelection({ kind: 'boulder', id: boulder.id })}
                onDragMove={(event) => applyPosition({ kind: 'boulder', id: boulder.id }, event.target.x() / PIXELS_PER_FOOT, event.target.y() / PIXELS_PER_FOOT)}
                onDragEnd={() => commitDrag()}
              >
                <Line
                  points={getBoulderPoints(boulder.sizeFt, boulder.seed)}
                  closed
                  fill="#a8a29e"
                  stroke={selection?.kind === 'boulder' && selection.id === boulder.id ? '#0f172a' : '#57534e'}
                  strokeWidth={2}
                />
                {design.settings.showLabels && boulder.labelVisible && (
                  <Text x={6} y={4} text={shapeLabel(boulder)} fontSize={11} fill="#3f3f46" />
                )}
              </Group>
            ))}

            {design.placedPlants.map((plant) => {
              const definition = plantDefinitionById(plant.plantId)
              if (!definition) return null
              const radius = feetToPixels(Math.max(0.45, plant.matureSpread / 2.5))
              return (
                <Group key={plant.id}>
                  {design.settings.showMatureRings && (
                    <Circle
                      x={feetToPixels(plant.x)}
                      y={feetToPixels(plant.y)}
                      radius={feetToPixels(plant.matureSpread / 2)}
                      stroke={definition.defaultColor}
                      dash={[5, 5]}
                      opacity={0.4}
                    />
                  )}
                  <Circle
                    x={feetToPixels(plant.x)}
                    y={feetToPixels(plant.y)}
                    radius={radius}
                    fill={definition.defaultColor}
                    stroke={selection?.kind === 'plant' && selection.id === plant.id ? '#0f172a' : '#334155'}
                    strokeWidth={2}
                    draggable={!plant.locked}
                    onClick={() => {
                      if (activeDrop || activeRiverEdit) return
                      setSelection({ kind: 'plant', id: plant.id })
                    }}
                   onDragStart={() => setSelection({ kind: 'plant', id: plant.id })}
                   onDragMove={(event) => applyPosition({ kind: 'plant', id: plant.id }, event.target.x() / PIXELS_PER_FOOT, event.target.y() / PIXELS_PER_FOOT)}
                    onDragEnd={() => commitDrag()}
                  />
                  <Text x={feetToPixels(plant.x) - 5} y={feetToPixels(plant.y) - 7} text={definition.icon} fontSize={18} fill="#0f172a" />
                  {design.settings.showLabels && plant.labelVisible && (
                    <Text x={feetToPixels(plant.x) + 8} y={feetToPixels(plant.y) - 6} text={getPlantLabel(plant)} fontSize={11} fill="#0f172a" />
                  )}
                </Group>
              )
            })}

            <Rect x={0} y={0} width={siteWidth} height={siteHeight} stroke="#0f172a" strokeWidth={2} listening={false} />
            <Text x={siteWidth - 160} y={6} text={`Frontage ${formatFeet(design.siteDimensions.totalFrontage)}`} fontSize={12} fill="#0f172a" />
            <Text x={siteWidth - 160} y={22} text={`Depth ${formatFeet(design.siteDimensions.totalDepth)}`} fontSize={12} fill="#0f172a" />
          </Layer>
        </Stage>
      </div>
      <div className="plan-footer">
        <span>{formatFeet(design.siteDimensions.totalFrontage)} frontage</span>
        <span>{formatFeet(design.siteDimensions.totalDepth)} depth</span>
        <span>{MATERIAL_LABELS[design.dryRiverBed.material]} river material</span>
      </div>
    </div>
  )
}
