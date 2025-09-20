/* eslint-disable no-console */
import type {
  SimulationParams,
  WorkerCommand,
  WorkerEvent,
  ParticleId,
  LineageId,
} from './types'
import { ParticleType } from './types'

// The state of the simulation is managed here.
let params: SimulationParams
let simulationRunning = false
let frameCount = 0
let nextLineageId = 1

// Structure-of-Arrays (SoA) for particle data.
let p_id: ParticleId[]
let p_type: Uint8Array
let p_x: Float32Array
let p_y: Float32Array
let p_angle: Float32Array
let p_lineageId: LineageId[]
let p_active: Uint8Array // 1 for active, 0 for inactive.
let inactiveIndices: ParticleId[] // A stack of indices for inactive particles, for efficient reuse.

// Uniform grid for spatial hashing (not yet fully implemented)
let grid: ParticleId[][]
let gridCellSize: number
let gridWidth: number
let gridHeight: number

/**
 * Posts a message back to the main thread.
 */
const post = (event: WorkerEvent, transferables?: Transferable[]) => {
  self.postMessage(event, transferables || [])
}

/**
 * Initializes the entire simulation state.
 */
function init(_params: SimulationParams) {
  params = _params
  const { particleCount, Lx, Ly, monomerDiameter, seedTemplates } = params

  // Allocate memory for the maximum number of particles.
  p_id = new Array(particleCount).fill(0).map((_, i) => i as ParticleId)
  p_type = new Uint8Array(particleCount)
  p_x = new Float32Array(particleCount)
  p_y = new Float32Array(particleCount)
  p_angle = new Float32Array(particleCount)
  p_lineageId = new Array(particleCount).fill(0 as LineageId)
  p_active = new Uint8Array(particleCount)

  // All particles start as inactive.
  inactiveIndices = new Array(particleCount)
  for (let i = 0; i < particleCount; i++) {
    inactiveIndices[i] = (particleCount - 1 - i) as ParticleId
  }

  // Seed the world with a few initial templates.
  for (let i = 0; i < seedTemplates; i++) {
    const pId = inactiveIndices.pop()
    if (pId === undefined) break // No more space in the pool.

    p_active[pId] = 1
    p_type[pId] = ParticleType.Template
    // Place templates in the middle-left of the world.
    p_x[pId] = Lx * (0.25 + Math.random() * 0.25)
    p_y[pId] = Math.random() * Ly
    p_angle[pId] = Math.random() * 2 * Math.PI
    p_lineageId[pId] = nextLineageId++ as LineageId
  }

  // Set up the spatial hash grid.
  gridCellSize = monomerDiameter * 2
  gridWidth = Math.ceil(Lx / gridCellSize)
  gridHeight = Math.ceil(Ly / gridCellSize)
  grid = Array.from({ length: gridWidth * gridHeight }, () => [])

  console.log('Simulation worker initialized.')
  post({ type: 'initialized' })
}

/**
 * The main simulation loop.
 */
function tick() {
  if (!simulationRunning) return
  frameCount++

  // Main simulation logic (diffusion, collision, replication) will operate on active particles.
  const diffusionStep = Math.sqrt(2 * params.diffusionCoefficient * params.dt)
  const activeIds: ParticleId[] = []

  for (let i = 0; i < params.particleCount; i++) {
    if (p_active[i]) {
      // 1. Apply brownian motion
      const brownianX = diffusionStep * (Math.random() - 0.5) * 2
      const brownianY = diffusionStep * (Math.random() - 0.5) * 2

      if (p_type[i] === ParticleType.Monomer) {
        p_x[i] += brownianX + params.flowVelocity * params.dt
      } else {
        p_x[i] += brownianX
      }
      p_y[i] += brownianY

      // 2. Apply boundary conditions
      // Periodic in Y
      if (p_y[i] < 0) p_y[i] += params.Ly
      if (p_y[i] > params.Ly) p_y[i] -= params.Ly
      // Open in X (outflow)
      if (p_x[i] > params.Lx || p_x[i] < 0) {
        p_active[i] = 0 // Deactivate particle.
        inactiveIndices.push(i as ParticleId) // Add back to pool.
        continue // Skip to next particle.
      }
      activeIds.push(i as ParticleId)
    }
  }

  // 3. Inflow new monomers from the left edge.
  if (frameCount % params.inflowInterval === 0) {
    for (let i = 0; i < params.inflowRate; i++) {
      const pId = inactiveIndices.pop()
      if (pId === undefined) break // Particle pool is full.

      p_active[pId] = 1
      p_type[pId] = ParticleType.Monomer
      p_x[pId] = Math.random() * params.inflowStripWidth
      p_y[pId] = Math.random() * params.Ly
      p_angle[pId] = 0
      p_lineageId[pId] = 0 as LineageId
    }
  }

  // 4. Update grid, handle collisions, and run replication logic (TODO)
  // ...

  // Prepare data for rendering (only active particles).
  let monomerCount = 0
  let templateCount = 0
  const currentActiveIds = []
  for (let i = 0; i < params.particleCount; i++) {
    if (p_active[i]) {
      currentActiveIds.push(i as ParticleId)
      if (p_type[i] === ParticleType.Monomer) monomerCount++
      else templateCount++
    }
  }

  const activeCount = currentActiveIds.length
  const positions = new Float32Array(activeCount * 2)
  const types = new Uint8Array(activeCount)
  const lineageIds = new Uint32Array(activeCount)
  const diameters = new Float32Array(activeCount)

  for (let i = 0; i < activeCount; i++) {
    const pId = currentActiveIds[i]
    positions[i * 2] = p_x[pId]
    positions[i * 2 + 1] = p_y[pId]
    types[i] = p_type[pId]
    lineageIds[i] = p_lineageId[pId]
    diameters[i] = params.monomerDiameter
  }

  // Post state back to the main thread.
  post(
    {
      type: 'stateUpdate',
      state: {
        positions,
        types,
        lineageIds,
        diameters,
        stats: {
          frameCount,
          monomerCount,
          templateCount,
          activeParticles: activeCount,
        },
      },
    },
    [positions.buffer, types.buffer, lineageIds.buffer, diameters.buffer]
  )
}

/**
 * Handles commands sent from the main thread.
 */
self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data
  switch (cmd.type) {
    case 'init':
      init(cmd.params)
      break
    case 'start':
      if (!simulationRunning) {
        simulationRunning = true
        // Use setInterval for a fixed time step loop.
        setInterval(tick, 1000 / 60) // Aim for 60 FPS
        console.log('Simulation started.')
      }
      break
    case 'stop':
      simulationRunning = false
      console.log('Simulation stopped.')
      break
    case 'reset':
      // Re-initialize the simulation with current parameters.
      if (params) init(params)
      break
    case 'setParams':
      if (cmd.params) {
        params = { ...params, ...cmd.params }
        console.log('Simulation parameters updated.')
      }
      break
  }
}
