import { create } from 'zustand'
import type {
  SimulationParams,
  SimulationState,
  WorkerCommand
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

// Default simulation parameters for simplified physics model
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
  
  // Simplified physics parameters
  particleRadius: 4,
  randomStepMagnitudeX: 0.8,
  collisionEnergyLossPct: 20,
  binderForceUnitDistanceInR: 4,
  reactionDistanceInR: 3,
  
  // Lifespan
  particleLifespan: 800
}

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