// src/simulation/worker.ts

import {
  SimulationParams,
  SimulationState,
  WorkerCommand,
  WorkerResponse,
} from './types'

let simulationId: number | null = null
let params: SimulationParams | null = null

// Placeholder for the main simulation loop
function tick(): void {
  if (!params) {
    return
  }

  // This is where the magic will happen.
  // For now, we'll just send back a dummy state.
  const dummyState: SimulationState = {
    particles: {
      x: new Float32Array(),
      y: new Float32Array(),
      type: new Int32Array(),
      angle: new Float32Array(),
      lineageId: new Int32Array(),
    },
    particleCount: 0,
    stats: {
      timestamp: Date.now(),
      monomerCount: 0,
      templateCount: 0,
      lineageCount: 0,
    },
  }

  const response: WorkerResponse = { type: 'update', state: dummyState }
  postMessage(response)
}

function start(newParams: SimulationParams): void {
  params = newParams
  if (simulationId === null) {
    simulationId = setInterval(tick, params.dt * 1000)
    console.log('Simulation worker started')
  }
}

function stop(): void {
  if (simulationId !== null) {
    clearInterval(simulationId)
    simulationId = null
    console.log('Simulation worker stopped')
  }
}

function reset(): void {
  stop()
  // Here we would reset the simulation state
  console.log('Simulation worker reset')
}

// Listen for messages from the main thread
self.onmessage = (e: MessageEvent<WorkerCommand>): void => {
  const command = e.data
  switch (command.type) {
    case 'start':
      start(command.params)
      break
    case 'stop':
      stop()
      break
    case 'reset':
      reset()
      break
    case 'updateParams':
      if (command.params) {
        params = { ...params, ...command.params } as SimulationParams
      }
      break
  }
}

// Notify the main thread that the worker is ready
const readyResponse: WorkerResponse = { type: 'ready' }
postMessage(readyResponse)
console.log('Simulation worker ready')
