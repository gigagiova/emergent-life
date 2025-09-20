// src/simulation/types.ts

/**
 * Defines the parameters that control the simulation.
 * These can be adjusted by the user in the UI.
 */
export interface SimulationParams {
  // World dimensions
  width: number
  height: number

  // Particle properties
  particleRadius: number
  k: number // monomers per template

  // Dynamics
  dt: number // simulation time step
  diffusionCoefficient: number

  // Gradient drive
  inflowRate: number // N_in monomers
  inflowInterval: number // n_inj steps

  // Template formation and replication
  captureRadius: number
  tauCap: number
  pRel: number // release probability per step

  // Spontaneous nucleation (optional)
  nucleationRadius: number
  tauNuc: number

  // Starvation and decay
  tauStarve: number
  pDecay: number // decay probability per step

  // Mutation
  mutationRateGeom: number
  mutationRateKinetics: number
  kMutationRate: number
  kMutationStep: number // +1 or -1
  lineageThreshold: number
}

/**
 * Represents the state of a single particle.
 * Using a structure-of-arrays layout for performance.
 */
export type ParticleState = {
  // Position
  x: Float32Array
  y: Float32Array
  // Type: 0 for monomer, >0 for template ID
  type: Int32Array
  // For templates, the angle
  angle: Float32Array
  // For templates, lineage ID
  lineageId: Int32Array
}

/**
 * The full state of the simulation at a given time.
 * This is what's sent from the worker to the main thread for rendering.
 */
export interface SimulationState {
  particles: ParticleState
  particleCount: number
  // Additional stats for visualization
  stats: {
    timestamp: number
    monomerCount: number
    templateCount: number
    lineageCount: number
  }
}

/**
 * Messages sent from the main thread to the worker.
 */
export type WorkerCommand =
  | { type: 'start'; params: SimulationParams }
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'updateParams'; params: Partial<SimulationParams> }

/**
 * Messages sent from the worker to the main thread.
 */
export type WorkerResponse =
  | { type: 'update'; state: SimulationState }
  | { type: 'ready' }
