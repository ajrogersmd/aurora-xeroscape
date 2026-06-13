export type Grade = 'flat' | 'slight' | 'moderate' | 'steep'
export type MaterialType =
  | 'gray-stone'
  | 'rose-stone'
  | 'mulch'
  | 'gravel'
  | 'rose-cobble'
  | 'gray-river-rock'
  | 'mixed-tan-gray-cobble'
  | 'large-rounded-cobble'

export type ExistingPlantKey = 'ornamentalCherry' | 'maple' | 'blueSpruce'
export type SurfaceZoneKey = 'mainBed' | 'curbStrip' | 'leftSideBed'
export type SiteRectKey = 'house' | 'garage' | 'porch' | 'driveway' | 'frontWalk' | 'mainBed' | 'leftSideBed' | 'sidewalk' | 'curbStrip'

export type PlantDefinition = {
  id: string
  code: string
  commonName: string
  cultivar: string
  matureHeightFt: number
  matureSpreadFt: number
  waterNeed: string
  category: 'evergreen' | 'deciduous' | 'grass' | 'yucca' | 'shrub'
  colorNotes: string
  icon: string
  silhouette: string
  defaultColor: string
}

export type SiteDimensions = {
  units: 'feet'
  gridFeet: number
  totalFrontage: number
  totalDepth: number
  house: {
    x: number
    y: number
    width: number
    depth: number
  }
  garage: {
    x: number
    y: number
    width: number
    depth: number
  }
  porch: {
    x: number
    y: number
    width: number
    depth: number
  }
  driveway: {
    x: number
    y: number
    width: number
    depth: number
  }
  frontWalk: {
    x: number
    y: number
    width: number
    depth: number
  }
  mainBed: {
    x: number
    y: number
    width: number
    depth: number
  }
  leftSideBed: {
    x: number
    y: number
    width: number
    depth: number
  }
  sidewalk: {
    x: number
    y: number
    width: number
    depth: number
  }
  curbStrip: {
    x: number
    y: number
    width: number
    depth: number
  }
  rightBoundaryX: number
  slope: {
    direction: 'street-to-house'
    grade: Grade
  }
  existingPlants: {
    ornamentalCherry: ExistingPlant
    maple: ExistingPlant
    blueSpruce: ExistingPlant
  }
  utilityCovers: UtilityCover[]
}

export type ExistingPlant = {
  x: number
  y: number
  canopyRadius: number
  locked: boolean
  commonName: string
  silhouette: string
  color: string
}

export type UtilityCover = {
  id: string
  x: number
  y: number
  width: number
  height: number
  shape: 'circle' | 'rectangle'
  locked: boolean
  avoidPlanting: boolean
}

export type PlacedPlant = {
  id: string
  plantId: string
  x: number
  y: number
  rotation: number
  matureSpread: number
  labelVisible: boolean
  locked: boolean
}

export type Boulder = {
  id: string
  x: number
  y: number
  sizeFt: 2 | 3 | 4
  rotation: number
  labelVisible: boolean
  locked: boolean
  seed: number
}

export type DryRiverBed = {
  points: Array<{ x: number; y: number }>
  widthFt: number
  taperEnds: boolean
  material: MaterialType
  addBoulderEdging: boolean
  randomizeTexture: boolean
}

export type DesignSettings = {
  snapToGrid: boolean
  showLabels: boolean
  showMatureRings: boolean
  panMode: boolean
}

export type DesignState = {
  version: number
  name: string
  updatedAt: string
  siteDimensions: SiteDimensions
  surfaceZones: Record<SurfaceZoneKey, MaterialType>
  placedPlants: PlacedPlant[]
  boulders: Boulder[]
  utilityCovers: UtilityCover[]
  dryRiverBed: DryRiverBed
  housePhotoReference: string | null
  selectedStonePalette: {
    main: MaterialType
    river: MaterialType
  }
  settings: DesignSettings
}

export type Selection =
  | { kind: 'plant'; id: string }
  | { kind: 'boulder'; id: string }
  | { kind: 'utility'; id: string }
  | { kind: 'existingPlant'; id: ExistingPlantKey }
  | { kind: 'siteRect'; id: SiteRectKey }
  | { kind: 'riverPoint'; id: string }
  | null
