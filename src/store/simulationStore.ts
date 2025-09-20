import { create } from 'zustand'
import type {
  SimulationParams,
  SimulationState,
  WorkerCommand,
} from '../simulation/types'

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

const defaultParams: SimulationParams = {
  Lx: 600,
  Ly: 300,
  particleCount: 2000,
  monomerDiameter: 5,
  k: 4,
  dt: 0.01,
  diffusionCoefficient: 5, // Increased from 1
  flowVelocity: 20,
  inflowRate: 10,
  inflowInterval: 100,
  inflowStripWidth: 25,
  nucleationEnabled: false,
  nucleationRadius: 9, // 1.8 * 5
  nucleationSteps: 30,
  captureRadius: 7, // 1.4 * 5
  captureSteps: 10,
  releaseProb: 0.05,
  coopWindow: 10,
  starvationSteps: 500,
  decayProb: 0.01,
  geomMutationStdDev: 0.25, // 0.05 * 5
  releaseProbMutationStdDev: 0.1,
  siteCountMutationProb: 0.005,
  newLinageThreshold: 0.5,
  seedTemplates: 5,
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
    worker.postMessage({ type: 'init', params: get().params } as WorkerCommand)
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
worker.onmessage = (e) => {
  const { type, state } = e.data
  if (type === 'initialized') {
    useSimulationStore.setState({ isInitialized: true })
  }
  if (type === 'stateUpdate' && state) {
    useSimulationStore.setState({ simulationState: state, stats: state.stats })
  }
}
