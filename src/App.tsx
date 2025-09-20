import { useEffect, useRef } from 'react'
import './App.css'
import { useSimulationStore } from './store/simulationStore'
import { ParticleType } from './simulation/types'

// A color palette for visualizing different lineages.
const lineageColors = [
  '#FF6347', '#4682B4', '#32CD32', '#FFD700', '#6A5ACD',
  '#FF4500', '#2E8B57', '#DAA520', '#8A2BE2', '#20B2AA'
]

/**
 * The main application component.
 * It orchestrates the UI, including the simulation canvas, controls, and stats.
 */
function App() {
  return (
    <div className='app-container'>
      <main>
        <div className='simulation-panel'>
          <SimulationCanvas />
        </div>
        <div className='controls-panel'>
          <Controls />
        </div>
      </main>
    </div>
  )
}

/**
 * Renders the simulation on a canvas.
 */
function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simulationState = useSimulationStore((state) => state.simulationState)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const panel = canvas.parentElement
    if (!panel) return

    const resizeObserver = new ResizeObserver(() => {
      const { isInitialized, params, setParams, init, reset } =
        useSimulationStore.getState()

      const { clientWidth, clientHeight } = panel
      if (clientWidth <= 0 || clientHeight <= 0) return

      canvas.width = clientWidth
      canvas.height = clientHeight

      const dimensionsChanged =
        params.Lx !== clientWidth || params.Ly !== clientHeight

      if (!isInitialized) {
        setParams({ Lx: clientWidth, Ly: clientHeight })
        init()
      } else if (dimensionsChanged) {
        setParams({ Lx: clientWidth, Ly: clientHeight })
        reset()
      }
    })

    resizeObserver.observe(panel)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!context || !canvas || canvas.width === 0) return

    context.fillStyle = '#1a1a1a'
    context.fillRect(0, 0, canvas.width, canvas.height)

    if (!simulationState) return

    const { positions, types, lineageIds, diameters } = simulationState

    for (let i = 0; i < positions.length / 2; i++) {
      const x = positions[i * 2]
      const y = positions[i * 2 + 1]
      const type = types[i]
      const lineageId = lineageIds[i]
      const radius = diameters[i] / 2

      context.beginPath()
      context.arc(x, y, radius, 0, 2 * Math.PI)

      if (type === ParticleType.Template) {
        context.fillStyle = lineageColors[lineageId % lineageColors.length]
      } else {
        context.fillStyle = 'rgba(200, 200, 200, 0.7)'
      }

      context.fill()
    }
  }, [simulationState])

  return <canvas ref={canvasRef} className='simulation-canvas' />
}

/**
 * Provides UI controls for the simulation.
 */
function Controls() {
  const { start, stop, reset, isRunning, params, setParams, stats } = useSimulationStore()

  return (
    <div>
      <div className='control-group'>
        <button onClick={start} disabled={isRunning}>Start</button>
        <button onClick={stop} disabled={!isRunning}>Stop</button>
        <button onClick={reset}>Reset</button>
      </div>
      <div className='stats-display'>
        <h4>Simulation Stats</h4>
        <p>Frame: {stats.frameCount || 0}</p>
        <p>Active Particles: {stats.activeParticles || 0}</p>
        <p>Monomers: {stats.monomerCount || 0}</p>
        <p>Templates: {stats.templateCount || 0}</p>
      </div>
      <div className='params-editor'>
        <h4>Parameters</h4>
        <label>
          Diffusion
          <input
            type='range'
            min='0'
            max='100'
            step='0.1'
            value={params.diffusionCoefficient}
            onChange={(e) => setParams({ diffusionCoefficient: parseFloat(e.target.value) })}
          />
          <span>{params.diffusionCoefficient.toFixed(1)}</span>
        </label>
        <label>
          Flow Velocity
          <input
            type='range'
            min='0'
            max='100'
            step='1'
            value={params.flowVelocity}
            onChange={(e) => setParams({ flowVelocity: parseFloat(e.target.value) })}
          />
          <span>{params.flowVelocity.toFixed(1)}</span>
        </label>
        <label>
          Release Probability (p_rel)
          <input
            type='range'
            min='0.001'
            max='0.2'
            step='0.001'
            value={params.releaseProb}
            onChange={(e) => setParams({ releaseProb: parseFloat(e.target.value) })}
          />
          <span>{params.releaseProb.toFixed(3)}</span>
        </label>
        {/* Add more parameter controls here */}
      </div>
    </div>
  )
}

export default App
