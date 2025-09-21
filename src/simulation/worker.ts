import type { SimulationParams, WorkerCommand, WorkerEvent } from './types'
import { Simulation } from './simulation'

// The simulation instance manages all state
let simulation: Simulation | null = null
let simulationRunning = false
let animationFrameId: number | null = null

/**
 * Posts a message back to the main thread.
 */
const post = (event: WorkerEvent, transferables?: Transferable[]) => {
  if (transferables && transferables.length > 0) self.postMessage(event, { transfer: transferables })
  else self.postMessage(event)
}

/**
 * Initializes the simulation with the given parameters.
 */
function init(params: SimulationParams): void {
  simulation = new Simulation(params)
  console.log('Simulation worker initialized with OOP structure.')
  post({ type: 'initialized' })
}

/**
 * The main simulation loop.
 * Uses requestAnimationFrame for smooth animation when possible.
 */
function tick(): void {
  if (!simulationRunning || !simulation) return

  try {
    // Step the simulation forward
    simulation.step()

    // Export state for rendering
    const state = simulation.exportState();
    post(
      { type: 'stateUpdate', state },
      [
        state.positions.buffer,
        state.types.buffer,
        state.energies.buffer,
      ]
    );

    // Schedule next frame
    if (simulationRunning) {
      animationFrameId = setTimeout(tick, 1000 / 60) // 60 FPS target
    }
  } catch (error) {
    console.error('Error in simulation tick:', error)
    simulationRunning = false
  }
}

/**
 * Starts the simulation loop.
 */
function start(): void {
  if (!simulation) {
    console.error('Cannot start simulation: not initialized')
    return
  }

  if (!simulationRunning) {
    simulationRunning = true
    tick()
    console.log('Simulation started.')
  }
}

/**
 * Stops the simulation loop.
 */
function stop(): void {
  simulationRunning = false
  if (animationFrameId !== null) {
    clearTimeout(animationFrameId)
    animationFrameId = null
  }
  console.log('Simulation stopped.')
}

/**
 * Resets the simulation to initial state.
 */
function reset(): void {
  if (simulation) {
    simulation.reset()
    console.log('Simulation reset.')
  }
}

/**
 * Updates simulation parameters.
 */
function setParams(params: Partial<SimulationParams>): void {
  if (simulation) {
    simulation.updateParams(params)
    console.log('Simulation parameters updated:', params)
  }
}

/**
 * Handles commands sent from the main thread.
 */
self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data
  
  try {
    switch (cmd.type) {
      case 'init':
        init(cmd.params)
        break
      case 'start':
        start()
        break
      case 'stop':
        stop()
        break
      case 'reset':
        reset()
        break
      case 'setParams':
        if (cmd.params) {
          setParams(cmd.params)
        }
        break
      default:
        console.warn('Unknown command type:', cmd)
    }
  } catch (error) {
    console.error('Error handling worker command:', error)
  }
}

// Handle worker errors gracefully
self.onerror = (error) => {
  console.error('Worker error:', error)
}

console.log('Simulation worker loaded and ready.')