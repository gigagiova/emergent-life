/**
 * This file defines the core data structures and types for the autocatalytic simulation.
 * 
 * System: Minimal Autocatalytic Sets
 * - Type A particles (blue) 
 * - Type B particles (red)
 * - Energy carriers (yellow, flow left to right)
 * - Reactions: A + B + Energy → 2A, B + A + Energy → 2B
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
  E: 4,
  Energy: 5,
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
  energyParticleCount: number;
  
  // Particle properties
  particleDiameter: number;
  
  // Dynamics
  timeStep: number;
  diffusionCoefficient: number;
  energyFlowVelocity: number;        // How fast energy particles move rightward
  energyInflowRate: number;          // Energy particles spawned per inflow event
  
  // Reactions
  reactionRadius: number;            // How close particles need to be to react
  reactionDiscoveryProbability: number; // Chance to discover a new reaction
  reactionProbability: number;       // Chance of reaction when A+B+Energy are close
  energyRequiredPerReaction: number; // Energy cost for each reaction
  
  // Mutation
  mutationProbability: number;       // Chance a new particle mutates to the other type
  
  // Decay
  particleDecayRate: number;         // Spontaneous decay rate (prevents runaway growth)
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
    particleCountE: number;
    energyParticleCount: number;
    totalReactions: number;
    discoveredReactions: number;
    reactionRateA: number;     // A + B → 2A reactions per second
    reactionRateB: number;     // B + A → 2B reactions per second
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