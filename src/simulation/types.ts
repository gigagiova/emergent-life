/**
 * Core data structures and types for the autocatalytic simulation
 *
 * Simplified physics model goals:
 * - Particles receive a random step of magnitude X each tick
 * - Binders attract other particles with inverse-square strength
 * - Collisions are elastic with optional damping, binders dissipate incoming energy
 * - Chemical reactions remain intact and operate on proximity and energy
 */

export type ParticleId = number;

/**
 * Particle types in the autocatalytic system
 */
export const ParticleType = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  Binder: 4, // The special "sticky" particle
  Attractor: 5, // Advanced particle that pulls in energy
  E: 6,
  Energy: 7,
} as const;
export type ParticleType = typeof ParticleType[keyof typeof ParticleType];

/**
 * Defines a reaction in the autocatalytic system.
 */
export interface Reaction {
  reactant1: ParticleType;
  reactant2: ParticleType;
  catalyst: ParticleType; // Must be one of the reactants
  product1: ParticleType;
  product2: ParticleType;
  efficiency: number; // 0.0 to 1.0, determines reaction probability
}

/**
 * Simulation parameters that can be tuned from the UI.
 */
export interface SimulationParams {
  // World dimensions
  Lx: number;
  Ly: number;
  
  // Particle counts
  particleCountA: number;
  particleCountB: number;
  particleCountC: number;
  particleCountD: number;
  particleCountE: number;
  particleCountBinder: number;
  energyParticleCount: number;
  
  // Simplified physics parameters
  particleRadius: number; // Radius in pixels, used for physics and rendering
  randomStepMagnitudeX: number; // Magnitude of random step per tick
  collisionEnergyLossPct: number; // Percentage energy loss in non-binder collisions
  binderForceUnitDistanceInR: number; // N radii distance where binder force equals X
  reactionDistanceInR: number; // Distance in radii where reactions can occur
  binderQuorumRadiusInR: number; // Radius in r for local binder-density estimation
  binderQuorumSoftCap: number; // Soft cap for binders within quorum radius
  energyPulsePeriodFrames: number; // Period of energy inflow pulses (frames)
  current: number; // Rightward bias applied to substrate step per tick (pixels)
  attractorForceUnitDistanceInR: number; // N radii where energy pull magnitude equals baseline
  
  // Lifespan
  particleLifespan: number; // In simulation steps
}

/**
 * Data sent from the worker to the main thread for rendering.
 */
export interface SimulationState {
  positions: Float32Array;    // [x1, y1, x2, y2, ...]
  types: Uint8Array;          // ParticleType for each particle
  energies: Float32Array;     // Energy level for each particle (for visualization)
  stats: {
    frameCount: number;
    particleCountA: number;
    particleCountB: number;
    particleCountC: number;
    particleCountD: number;
    particleCountAttractor: number;
    particleCountE: number;
    particleCountBinder: number;
    energyParticleCount: number;
    totalReactions: number;
    discoveredReactions: number;
  };
}

/**
 * Defines the messages that can be sent *to* the simulation worker.
 */
export type WorkerCommand =
  | { type: 'init'; params: SimulationParams }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'setParams'; params: Partial<SimulationParams> };

/**
 * Defines the messages that can be sent *from* the simulation worker.
 */
export type WorkerEvent =
  | { type: 'initialized' }
  | { type: 'stateUpdate'; state: SimulationState };