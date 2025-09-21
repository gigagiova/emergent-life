import { create } from 'zustand'
import type {
  SimulationParams,
  SimulationState,
  WorkerCommand,
} from '../simulation/types.js'

// Initialize the simulation worker.
const worker = new Worker(new URL('../simulation/worker.ts', import.meta.url), {
  type: 'module',
})

/**
 * Defines the state and actions for the simulation's Zustand store.
 * This store manages UI state, simulation parameters, and communication
 * with the simulation worker.
 */
interface SimulationStore {
  // State
  isRunning: boolean
  isInitialized: boolean
  params: SimulationParams
  simulationState: SimulationState | null
  stats: Record<string, number>

  // Actions
  init: () => void
  start: () => void
  stop: () => void
  reset: () => void
  setParams: (newParams: Partial<SimulationParams>) => void
}

// Default simulation parameters for autocatalytic system
const defaultParams: SimulationParams = {
  // World dimensions
  Lx: 800,
  Ly: 600,
  
  // Particle counts
  particleCountA: 50,
  particleCountB: 50,
  particleCountC: 50,
  particleCountD: 50,
  particleCountBinder: 20,
  energyParticleCount: 250,
  
  // Particle properties
  particleDiameter: 8,
  
  // Dynamics
  timeStep: 0.02,
  diffusionCoefficient: 5, // Increased random motion
  energyFlowVelocity: 80, // Faster base speed for energy
  energyInflowRate: 4,           // Energy particles spawned per inflow event
  energyTurbulence: 0.5, // Significant vertical motion
  
  // Physics & Lifespan
  primordialWindStrength: 0.02, // A gentle but constant outward push
  windShelterRadius: 30, // 2x reaction radius
  binderAttractionForce: 40, // Drastically increased to overcome diffusion
  substrateRepulsionForce: 50, // Drastically increased to ensure spreading
  particleLifespan: 300, // Shorter lifespan increases pressure
  
  // Reactions
  reactionRadius: 15,            // How close particles need to be to react
  reactionDiscoveryProbability: 0.001, // Very low chance to discover a new reaction pathway
  reactionProbability: 0.1,      // Chance of reaction when A+B+Energy are close
  energyRequiredPerReaction: 1,  // Energy cost for each reaction
  
  // Mutation
  mutationProbability: 0.02,     // Chance a new particle mutates to the other type
  
  // Decay (No longer used, replaced by lifespan)
  particleDecayRate: 0.0,
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Initial state
  isRunning: false,
  isInitialized: false,
  params: defaultParams,
  simulationState: null,
  stats: {},

  // Actions implementation
  init: () => {
    worker.postMessage({ type: 'init', params: get().params } as WorkerCommand);
  },
  start: () => {
    worker.postMessage({ type: 'start' } as WorkerCommand)
    set({ isRunning: true })
  },
  stop: () => {
    worker.postMessage({ type: 'stop' } as WorkerCommand)
    set({ isRunning: false })
  },
  reset: () => {
    worker.postMessage({ type: 'reset' } as WorkerCommand)
  },
  setParams: (newParams: Partial<SimulationParams>) => {
    set((state) => ({ params: { ...state.params, ...newParams } }))
    worker.postMessage({ type: 'setParams', params: newParams } as WorkerCommand)
  },
}))

// Listen for messages from the worker and update the store accordingly.
worker.onmessage = (e: MessageEvent) => {
  const { type, state } = e.data
  if (type === 'initialized') {
    useSimulationStore.setState({ isInitialized: true })
  }
  if (type === 'stateUpdate' && state) {
    useSimulationStore.setState({ simulationState: state, stats: state.stats });
  }
};