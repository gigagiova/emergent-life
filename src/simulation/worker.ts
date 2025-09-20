/* eslint-disable no-console */
import type {
  SimulationParams,
  WorkerCommand,
  WorkerEvent,
  ParticleId,
  LineageId
} from './types'
import { ParticleType } from './types'

// The state of the simulation is managed here.
// These variables are scoped to the worker's global context.
let params: SimulationParams
let simulationRunning = false
let frameCount = 0
let nextParticleId = 0
let nextLineageId = 1

// Structure-of-Arrays (SoA) for particle data.
// This layout is chosen for performance, as it improves cache locality
// when iterating over specific properties of all particles.
let p_id: ParticleId[]
let p_type: Uint8Array
let p_x: Float32Array
let p_y: Float32Array
let p_angle: Float32Array
let p_lineageId: LineageId[]
// Add more particle properties here as needed for the simulation logic.
// For example, timers for capture, starvation, etc.

// Uniform grid for spatial hashing, to accelerate neighbor lookups.
let grid: ParticleId[][]
let gridCellSize: number
let gridWidth: number
let gridHeight: number

/**
 * Posts a message back to the main thread.
 * @param event The message to send.
 * @param transferables Optional array of objects to transfer ownership of.
 */
const post = (event: WorkerEvent, transferables?: Transferable[]) => {
  if (transferables) {
    self.postMessage(event, transferables)
  } else {
    self.postMessage(event)
  }
}

/**
 * Initializes the entire simulation state.
 * This function is called when the worker receives the 'init' command.
 */
function init(_params: SimulationParams) {
  params = _params
  const { particleCount, Lx, Ly, monomerDiameter } = params

  // Allocate memory for all particles.
  p_id = new Array(particleCount).fill(0).map((_, i) => i as ParticleId)
  p_type = new Uint8Array(particleCount)
  p_x = new Float32Array(particleCount)
  p_y = new Float32Array(particleCount)
  p_angle = new Float32Array(particleCount)
  p_lineageId = new Array(particleCount).fill(0 as LineageId)

  // Initialize particles with random positions.
  for (let i = 0; i < particleCount; i++) {
    p_id[i] = nextParticleId++ as ParticleId
    p_type[i] = ParticleType.Monomer
    p_x[i] = Math.random() * Lx
    p_y[i] = Math.random() * Ly
    p_angle[i] = Math.random() * 2 * Math.PI
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
 * This function is called for each step of the simulation.
 */
function tick() {
  if (!simulationRunning) return

  frameCount++

  // Core simulation logic goes here.
  // 1. Update grid
  // 2. Apply brownian motion
  // 3. Handle collisions
  // 4. Apply boundary conditions
  // 5. Inflow/Outflow
  // 6. Template logic (capture, ligation, release, decay, mutation)

  // Example: simple diffusion for all particles
  const diffusionStep = Math.sqrt(2 * params.diffusionCoefficient * params.dt)
  for (let i = 0; i < params.particleCount; i++) {
    p_x[i] += diffusionStep * (Math.random() - 0.5) * 2
    p_y[i] += diffusionStep * (Math.random() - 0.5) * 2

    // Periodic boundary for Y
    if (p_y[i] < 0) p_y[i] += params.Ly
    if (p_y[i] > params.Ly) p_y[i] -= params.Ly

    // Open boundary for X (outflow)
    if (p_x[i] > params.Lx) {
      // A simple way to handle outflow is to move the particle
      // back to the inflow region and reset its state.
      p_x[i] = Math.random() * params.inflowStripWidth
      p_y[i] = Math.random() * params.Ly
      p_type[i] = ParticleType.Monomer
    }
  }
  
  // Inflow
  if (frameCount % params.inflowInterval === 0) {
    // This is a simplified inflow logic. A more robust implementation
    // would find inactive particles to overwrite, or dynamically resize arrays.
    console.log(`Injecting ${params.inflowRate} new monomers.`)
  }


  // Prepare data for rendering.
  const positions = new Float32Array(params.particleCount * 2)
  const diameters = new Float32Array(params.particleCount)
  for (let i = 0; i < params.particleCount; i++) {
    positions[i * 2] = p_x[i]
    positions[i * 2 + 1] = p_y[i]
    diameters[i] = params.monomerDiameter
  }
  
  // Post state back to the main thread for visualization.
  post(
    {
      type: 'stateUpdate',
      state: {
        positions,
        types: p_type.slice(),
        lineageIds: new Uint32Array(p_lineageId),
        diameters,
        stats: {
          frameCount,
          monomerCount: params.particleCount, // placeholder
          templateCount: 0, // placeholder
        },
      },
    },
    [positions.buffer]
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
