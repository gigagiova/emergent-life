/**
 * This file defines the core data structures and types used in the simulation.
 * A clear and well-structured type system is essential for managing the complexity
 * of the particle interactions and state changes.
 */

// Using a nominal typing pattern to avoid mixing up different kinds of IDs.
export type ParticleId = number & { readonly __brand: 'ParticleId' };
export type LineageId = number & { readonly __brand: 'LineageId' };

/**
 * Defines the types of particles that can exist in the simulation.
 * - Monomer: A basic building block.
 * - Template: A complex, self-replicating particle.
 */
export enum ParticleType {
  Monomer = 0,
  Template = 1,
}

/**
 * Simulation parameters that can be tuned from the UI.
 * These control the physics, replication, and environmental drive of the simulation.
 */
export interface SimulationParams {
  // World dimensions
  Lx: number;
  Ly: number;

  // Particle properties
  particleCount: number;
  monomerDiameter: number;
  k: number; // Number of sites on a template

  // Dynamics
  dt: number;
  diffusionCoefficient: number;
  flowVelocity: number; // Rightward drift for monomers

  // Gradient Drive
  inflowRate: number; // N_in: number of monomers to inject
  inflowInterval: number; // n_inj: steps between injections
  inflowStripWidth: number;

  // Spontaneous nucleation (optional)
  nucleationEnabled: boolean;
  nucleationRadius: number; // r_nuc
  nucleationSteps: number; // tau_nuc

  // Template Replication
  captureRadius: number; // r_c
  captureSteps: number; // tau_cap
  releaseProb: number; // p_rel
  coopWindow: number; // ΔT_coop

  // Starvation and Decay
  starvationSteps: number; // tau_starve
  decayProb: number; // p_decay

  // Mutation
  geomMutationStdDev: number; // σ_geom
  releaseProbMutationStdDev: number; // σ_rel
  siteCountMutationProb: number; // μ_k
  newLinageThreshold: number;

  // Initial seed
  seedTemplates: number;
}

/**
 * Data sent from the worker to the main thread for rendering.
 * positions is a transferable object for performance.
 */
export interface SimulationState {
  // Using Float32Array for continuous data and Uint32Array for discrete data.
  // This data is structured for efficient rendering.
  positions: Float32Array; // [x1, y1, x2, y2, ...]
  types: Uint8Array; // [type1, type2, ...]
  lineageIds: Uint32Array; // [lineageId1, lineageId2, ...]
  diameters: Float32Array; // [d1, d2, ...]
  stats: Record<string, number>;
}

/**
 * Defines the messages that can be sent *to* the simulation worker.
 * This is the command interface for controlling the simulation.
 */
export type WorkerCommand =
  | { type: 'init'; params: SimulationParams }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'setParams'; params: Partial<SimulationParams> };

/**
 * Defines the messages that can be sent *from* the simulation worker.
 * This is how the worker communicates its state back to the main thread.
 */
export type WorkerEvent =
  | { type: 'initialized' }
  | { type: 'stateUpdate'; state: SimulationState };
