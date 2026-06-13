import { MATERIAL_LABELS, PLANT_PALETTE } from '../data'
import { getMaterialLabel, plantDefinitionById } from '../lib/utils'
import type { DesignState } from '../types'

type Props = {
  design: DesignState
}

const depthColor = ['#dce6ef', '#d1dde8', '#c4d2de', '#bac9d7']

export function StreetView({ design }: Props) {
  const sortedPlants = [...design.placedPlants].sort((left, right) => right.y - left.y)
  const river = [...design.dryRiverBed.points].sort((left, right) => left.y - right.y)

  return (
    <div className="street-view">
      <svg viewBox="0 0 1200 700" role="img" aria-label="Simplified street-view preview">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#eff6ff" />
          </linearGradient>
          <linearGradient id="lawn" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d9e7d4" />
            <stop offset="100%" stopColor="#c6d8c0" />
          </linearGradient>
        </defs>
        <rect width="1200" height="700" fill="url(#sky)" />
        <rect x="0" y="410" width="1200" height="290" fill="url(#lawn)" />
        {depthColor.map((color, index) => (
          <line key={color} x1={0} y1={440 + index * 45} x2={1200} y2={440 + index * 45} stroke={color} strokeWidth={2} />
        ))}
        <polygon points="0,700 1200,700 980,430 220,430" fill="#bfc8ce" />
        <polygon points="0,520 1200,520 1080,450 120,450" fill="#d9dde1" />
        <polygon points="300,430 900,430 810,220 390,220" fill="#d5dae1" stroke="#64748b" strokeWidth={3} />
        <polygon points="320,430 510,430 485,230 345,230" fill="#c4ccd6" stroke="#64748b" strokeWidth={3} />
        <polygon points="600,430 770,430 748,232 622,232" fill="#cdb396" stroke="#7c5a3f" strokeWidth={3} />
        <polygon points="390,220 810,220 770,170 430,170" fill="#7f8ea4" />
        <text x="380" y="270" fontSize="20" fill="#334155">Colorado house facade reference</text>
        <text x="40" y="575" fontSize="18" fill="#334155">Driveway</text>
        <text x="500" y="505" fontSize="18" fill="#334155">Sidewalk</text>
        <text x="640" y="410" fontSize="18" fill="#334155">Porch</text>
        <text x="870" y="180" fontSize="18" fill="#1d4ed8">Slope rises toward house</text>
        <line x1="920" y1="470" x2="920" y2="200" stroke="#1d4ed8" strokeWidth={3} strokeDasharray="10 8" />

        <path
          d={river
            .map((point, index) => {
              const x = 350 + point.x * 8
              const y = 520 - point.y * 5
              return `${index === 0 ? 'M' : 'Q'} ${x} ${y} ${x + 15} ${y - 10}`
            })
            .join(' ')}
          fill="none"
          stroke="#b38374"
          strokeWidth={28}
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d={river
            .map((point, index) => {
              const x = 350 + point.x * 8
              const y = 520 - point.y * 5
              return `${index === 0 ? 'M' : 'Q'} ${x} ${y} ${x + 15} ${y - 10}`
            })
            .join(' ')}
          fill="none"
          stroke="#efe7dd"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={design.dryRiverBed.randomizeTexture ? '8 14' : undefined}
          opacity="0.9"
        />

        {Object.values(design.siteDimensions.existingPlants).map((tree) => {
          const x = 280 + tree.x * 9
          const y = 540 - tree.y * 5.2
          const radius = tree.canopyRadius * 11
          return (
            <g key={tree.commonName}>
              <rect x={x - 8} y={y + radius * 0.1} width="16" height={radius * 0.9} fill="#7c5a3f" rx="3" />
              <ellipse cx={x} cy={y} rx={radius} ry={radius * 0.75} fill={tree.color} opacity="0.92" />
              <text x={x - radius} y={y - radius - 10} fontSize="16" fill="#1f2937">{tree.commonName}</text>
            </g>
          )
        })}

        {design.boulders.map((boulder) => {
          const x = 300 + boulder.x * 9
          const y = 540 - boulder.y * 5.3
          const size = boulder.sizeFt * 12
          return <ellipse key={boulder.id} cx={x} cy={y} rx={size} ry={size * 0.6} fill="#9a948d" stroke="#57534e" strokeWidth={2} />
        })}

        {sortedPlants.map((plant) => {
          const definition = plantDefinitionById(plant.plantId)
          if (!definition) return null
          const x = 280 + plant.x * 9
          const y = 550 - plant.y * 5.6
          const size = Math.max(10, 16 + (54 - plant.y) * 0.75 + definition.matureSpreadFt * 4)
          const height = size * (1.3 + definition.matureHeightFt * 0.12)
          return (
            <g key={plant.id}>
              <ellipse cx={x} cy={y} rx={size} ry={size * 0.45} fill={definition.defaultColor} opacity="0.18" />
              <path
                d={`M ${x} ${y} C ${x - size * 0.8} ${y - height * 0.5}, ${x - size * 0.5} ${y - height}, ${x} ${y - height} C ${x + size * 0.5} ${y - height}, ${x + size * 0.8} ${y - height * 0.5}, ${x} ${y}`}
                fill={definition.defaultColor}
                opacity="0.95"
              />
              <text x={x - size} y={y - height - 6} fontSize="14" fill="#0f172a">{definition.code}</text>
            </g>
          )
        })}
      </svg>
      <div className="street-caption">
        <p>
          Simplified curb-to-house preview using the current layout, slope, stones, dry river bed, boulders, porch, driveway, sidewalk,
          and existing trees.
        </p>
        <p>
          Main bed: {getMaterialLabel(design.surfaceZones.mainBed)} · River bed: {MATERIAL_LABELS[design.dryRiverBed.material]} · Plants: {design.placedPlants.length}
        </p>
      </div>
    </div>
  )
}
