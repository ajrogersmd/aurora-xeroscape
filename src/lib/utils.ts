import { MATERIAL_LABELS, PIXELS_PER_FOOT, PLANT_PALETTE } from '../data'
import type {
  DesignState,
  ExistingPlantKey,
  MaterialType,
  PlacedPlant,
  Selection,
  SiteDimensions,
} from '../types'

export const cloneDesign = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
export const roundToGrid = (value: number, gridFeet: number) => Math.round(value / gridFeet) * gridFeet
export const feetToPixels = (feet: number) => feet * PIXELS_PER_FOOT
export const pixelsToFeet = (pixels: number) => pixels / PIXELS_PER_FOOT
export const formatFeet = (value: number) => `${value.toFixed(value < 5 ? 1 : 0)} ft`
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

const bedBounds = (site: SiteDimensions) => [site.mainBed, site.curbStrip, site.leftSideBed]

export const isInsideAnyDesignArea = (site: SiteDimensions, point: { x: number; y: number }) =>
  bedBounds(site).some(
    (zone) => point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.depth,
  )

export const plantDefinitionById = (plantId: string) => PLANT_PALETTE.find((plant) => plant.id === plantId)

export const getPlantLabel = (plant: PlacedPlant) => {
  const definition = plantDefinitionById(plant.plantId)
  return definition ? `${definition.code} · ${definition.commonName}` : plant.plantId
}

export const getMaterialLabel = (material: MaterialType) => MATERIAL_LABELS[material]

export const getSelectionSummary = (design: DesignState, selection: Selection) => {
  if (!selection) return 'Nothing selected'
  if (selection.kind === 'plant') {
    const plant = design.placedPlants.find((item) => item.id === selection.id)
    return plant ? getPlantLabel(plant) : 'Plant'
  }
  if (selection.kind === 'boulder') return 'Boulder'
  if (selection.kind === 'utility') return 'Utility cover'
  if (selection.kind === 'riverPoint') return 'Dry river control point'
  return design.siteDimensions.existingPlants[selection.id].commonName
}

export const createPromptText = (design: DesignState, mode: 'street' | 'topdown') => {
  const { siteDimensions, placedPlants, boulders, dryRiverBed, surfaceZones } = design
  const frontGroups = { front: [] as string[], middle: [] as string[], back: [] as string[] }
  placedPlants.forEach((plant) => {
    const definition = plantDefinitionById(plant.plantId)
    if (!definition) return
    const zone = plant.y >= 40 ? 'front' : plant.y >= 24 ? 'middle' : 'back'
    frontGroups[zone].push(
      `${definition.commonName} (${definition.cultivar}) at approximately (${plant.x.toFixed(1)} ft, ${plant.y.toFixed(1)} ft), mature spread ${plant.matureSpread.toFixed(1)} ft`,
    )
  })

  const existingTrees = Object.values(siteDimensions.existingPlants)
    .map(
      (plant) => `${plant.commonName} at (${plant.x.toFixed(1)} ft, ${plant.y.toFixed(1)} ft) with mature canopy radius ${plant.canopyRadius.toFixed(1)} ft`,
    )
    .join('; ')

  const riverPath = dryRiverBed.points.map((point) => `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`).join(' → ')
  const boulderText = boulders
    .map((boulder) => `size ${boulder.sizeFt} ft at (${boulder.x.toFixed(1)} ft, ${boulder.y.toFixed(1)} ft)`)
    .join('; ')

  const shared = [
    'Use user-editable estimate dimensions, not survey-grade measurements.',
    'Colorado suburban front yard xeriscape design.',
    'Preserve the actual house architecture and existing trees.',
    `Lot orientation: house/north at top, street/south at bottom, slope ${siteDimensions.slope.direction} with ${siteDimensions.slope.grade} grade.`,
    `House: single-level Colorado suburban home with light gray hardieboard, gray roof, stone accents at garage columns/foundation and front porch, and wood porch accents.`,
    `Total frontage ${siteDimensions.totalFrontage} ft and total depth ${siteDimensions.totalDepth} ft.`,
    `Driveway on the left at x=${siteDimensions.driveway.x}–${siteDimensions.driveway.x + siteDimensions.driveway.width} ft, y=${siteDimensions.driveway.y}–${siteDimensions.driveway.y + siteDimensions.driveway.depth} ft.`,
    `Sidewalk at y=${siteDimensions.sidewalk.y}–${siteDimensions.sidewalk.y + siteDimensions.sidewalk.depth} ft and porch at x=${siteDimensions.porch.x}–${siteDimensions.porch.x + siteDimensions.porch.width} ft.`,
    `Front walk at x=${siteDimensions.frontWalk.x}–${siteDimensions.frontWalk.x + siteDimensions.frontWalk.width} ft.`,
    `Main bed uses ${getMaterialLabel(surfaceZones.mainBed)} and curb strip uses ${getMaterialLabel(surfaceZones.curbStrip)}.`,
    `Dry river bed uses ${getMaterialLabel(dryRiverBed.material)} with approximate path ${riverPath}, width ${dryRiverBed.widthFt} ft${dryRiverBed.taperEnds ? ', tapered at the ends' : ''}${dryRiverBed.addBoulderEdging ? ', with optional boulder edging' : ''}.`,
    `Boulders: ${boulderText || 'none'}.`,
    `Existing trees: ${existingTrees}.`,
    `Front-yard plant placements: front zone — ${frontGroups.front.join('; ') || 'none'}; middle zone — ${frontGroups.middle.join('; ') || 'none'}; back zone — ${frontGroups.back.join('; ') || 'none'}.`,
  ]

  if (mode === 'street') {
    shared.push('Render a realistic street-view image from the curb looking toward the house.')
    shared.push('Preserve sight lines, plant massing, driveway position, sidewalk, porch, dry river bed, and stone selections.')
  } else {
    shared.push('Render a clean top-down landscape plan with labels, mature spread rings, surface materials, and dry river bed geometry.')
  }

  return shared.join(' ')
}

export const validateDesign = (design: DesignState) => {
  const warnings: string[] = []
  const { siteDimensions, placedPlants, utilityCovers } = design

  placedPlants.forEach((plant, index) => {
    const definition = plantDefinitionById(plant.plantId)
    if (!definition) return
    for (let nextIndex = index + 1; nextIndex < placedPlants.length; nextIndex += 1) {
      const other = placedPlants[nextIndex]
      const overlapDistance = plant.matureSpread / 2 + other.matureSpread / 2
      if (distance(plant, other) < overlapDistance * 0.6) {
        warnings.push(`Potential mature spread overlap between ${definition.commonName} and ${getPlantLabel(other)}.`)
      }
    }

    if (!isInsideAnyDesignArea(siteDimensions, plant)) {
      warnings.push(`${definition.commonName} sits outside the main designable planting areas.`)
    }

    utilityCovers.forEach((cover) => {
      const xHit = Math.abs(plant.x - cover.x) <= cover.width / 2 + plant.matureSpread / 2
      const yHit = Math.abs(plant.y - cover.y) <= cover.height / 2 + plant.matureSpread / 2
      if (cover.avoidPlanting && xHit && yHit) {
        warnings.push(`${definition.commonName} overlaps a utility cover marked “avoid planting here.”`)
      }
    })
  })

  ;(['ornamentalCherry', 'maple', 'blueSpruce'] as ExistingPlantKey[]).forEach((key) => {
    const plant = siteDimensions.existingPlants[key]
    if (plant.locked) return
    const inDriveway =
      plant.x > siteDimensions.driveway.x &&
      plant.x < siteDimensions.driveway.x + siteDimensions.driveway.width &&
      plant.y > siteDimensions.driveway.y &&
      plant.y < siteDimensions.driveway.y + siteDimensions.driveway.depth
    const inSidewalk = plant.y > siteDimensions.sidewalk.y && plant.y < siteDimensions.sidewalk.y + siteDimensions.sidewalk.depth
    if (inDriveway || inSidewalk) {
      warnings.push(`${plant.commonName} overlaps the driveway or sidewalk footprint.`)
    }
  })

  if (design.dryRiverBed.points.length < 3) {
    warnings.push('Dry river bed should have at least three control points for a natural flow.')
  }

  return Array.from(new Set(warnings))
}

export const getBoulderPoints = (sizeFt: number, seed: number) => {
  const radius = sizeFt * 0.55
  const points: number[] = []
  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7
    const variance = 0.82 + ((((seed + index * 13) % 9) - 4) * 0.05)
    points.push(Math.cos(angle) * radius * variance * PIXELS_PER_FOOT)
    points.push(Math.sin(angle) * radius * variance * PIXELS_PER_FOOT)
  }
  return points
}

export const coerceWithinSite = (
  site: SiteDimensions,
  x: number,
  y: number,
  width = 0,
  height = 0,
) => ({
  x: clamp(x, 0, site.totalFrontage - width),
  y: clamp(y, 0, site.totalDepth - height),
})
