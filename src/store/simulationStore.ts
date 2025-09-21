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
  particleCountA: 100,
  particleCountB: 100,
  particleCountC: 0,
  particleCountD: 0,
  particleCountE: 0,
  energyParticleCount: 200,
  
  // Particle properties
  particleDiameter: 8,
  
  // Dynamics
  timeStep: 0.02,
  diffusionCoefficient: 3,
  energyFlowVelocity: 30,        // How fast energy particles move rightward
  energyInflowRate: 3,           // Energy particles spawned per inflow event
  
  // Reactions
  reactionRadius: 15,            // How close particles need to be to react
  reactionDiscoveryProbability: 0.001, // Very low chance to discover a new reaction pathway
  reactionProbability: 0.1,      // Chance of reaction when A+B+Energy are close
  energyRequiredPerReaction: 1,  // Energy cost for each reaction
  
  // Mutation
  mutationProbability: 0.02,     // Chance a new particle mutates to the other type
  
  // Decay
  particleDecayRate: 0.001,      // Spontaneous decay rate (prevents runaway growth)
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