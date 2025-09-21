import { useEffect, useRef } from 'react'
import './App.css'
import { useSimulationStore } from './store/simulationStore'
import { ParticleType } from './simulation/types'

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationState = useSimulationStore((state) => state.simulationState);

  useEffect(() => {
    const canvas = canvasRef.current;
    const panel = canvas?.parentElement;
    if (!panel) return;

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = panel;
      if (clientWidth > 0 && clientHeight > 0) {
        // This is the crucial part: sync the canvas buffer size with its display size
        if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
          canvas.width = clientWidth;
          canvas.height = clientHeight;
        }
        // Inform the simulation of the new dimensions
        useSimulationStore.getState().setParams({ Lx: clientWidth, Ly: clientHeight });
      }
    });
    resizeObserver.observe(panel);

    // Initial init call once we have dimensions
    useSimulationStore.getState().init();

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context || !canvas || !simulationState) return;

    context.fillStyle = '#1a1a1a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const { positions, types, energies } = simulationState;

    // Draw Particles
    for (let i = 0; i < positions.length / 2; i++) {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      const type = types[i];
      const energy = energies[i];
      const radius = useSimulationStore.getState().params.particleDiameter / 2;
      
      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      
      if (type === ParticleType.A) {
        context.fillStyle = `rgba(50, 100, 255, ${Math.max(0.3, energy)})`; // Blue
      } else if (type === ParticleType.B) {
        context.fillStyle = `rgba(255, 50, 50, ${Math.max(0.3, energy)})`; // Red
      } else if (type === ParticleType.C) {
        context.fillStyle = `rgba(50, 255, 50, ${Math.max(0.3, energy)})`; // Green
      } else if (type === ParticleType.D) {
        context.fillStyle = `rgba(200, 50, 255, ${Math.max(0.3, energy)})`; // Purple
      } else if (type === ParticleType.E) {
        context.fillStyle = `rgba(255, 150, 50, ${Math.max(0.3, energy)})`; // Orange
      } else if (type === ParticleType.Energy) {
        context.fillStyle = 'rgba(255, 255, 100, 0.9)';
      }
      
      context.fill();
      
      // Add a subtle white outline for better visibility
      context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      context.lineWidth = 1;
      context.stroke();
    }
  }, [simulationState]);

  return <canvas ref={canvasRef} className='simulation-canvas' />;
}

/**
 * Provides UI controls for the simulation.
 */
function Controls() {
  const { start, stop, reset, isRunning, params, setParams, stats } = useSimulationStore();

  return (
    <div>
      <div className='control-group'>
        <button onClick={start} disabled={isRunning}>Start</button>
        <button onClick={stop} disabled={!isRunning}>Stop</button>
        <button onClick={reset}>Reset</button>
      </div>
      
      <div className='stats-display'>
        <h4>System Stats</h4>
        <p>Frame: {stats.frameCount || 0}</p>
        <p>A Particles: {stats.particleCountA || 0}</p>
        <p>B Particles: {stats.particleCountB || 0}</p>
        <p>C Particles: {stats.particleCountC || 0}</p>
        <p>D Particles: {stats.particleCountD || 0}</p>
        <p>E Particles: {stats.particleCountE || 0}</p>
        <p>Energy: {stats.energyParticleCount || 0}</p>
        <p>Total Reactions: {stats.totalReactions || 0}</p>
        <p>Discovered Reactions: {stats.discoveredReactions || 0}</p>
      </div>

      <div className='params-editor'>
        <h4>Dynamics</h4>
        <label>
          Diffusion Coefficient
          <input
            type='range' min='0.5' max='10' step='0.1'
            value={params.diffusionCoefficient}
            onChange={(e) => setParams({ diffusionCoefficient: parseFloat(e.target.value) })}
          />
          <span>{params.diffusionCoefficient.toFixed(1)}</span>
        </label>
        
        <label>
          Energy Flow Velocity
          <input
            type='range' min='5' max='100' step='1'
            value={params.energyFlowVelocity}
            onChange={(e) => setParams({ energyFlowVelocity: parseFloat(e.target.value) })}
          />
          <span>{params.energyFlowVelocity.toFixed(0)}</span>
        </label>
        
        <label>
          Energy Inflow Rate
          <input
            type='range' min='1' max='10' step='1'
            value={params.energyInflowRate}
            onChange={(e) => setParams({ energyInflowRate: parseInt(e.target.value) })}
          />
          <span>{params.energyInflowRate}</span>
        </label>

        <h4>Reactions</h4>
        <label>
          Reaction Radius
          <input
            type='range' min='5' max='30' step='1'
            value={params.reactionRadius}
            onChange={(e) => setParams({ reactionRadius: parseFloat(e.target.value) })}
          />
          <span>{params.reactionRadius.toFixed(0)}</span>
        </label>
        
        <label>
          Discovery Probability
          <input
            type='range' min='0' max='0.01' step='0.0001'
            value={params.reactionDiscoveryProbability}
            onChange={(e) => setParams({ reactionDiscoveryProbability: parseFloat(e.target.value) })}
          />
          <span>{params.reactionDiscoveryProbability.toFixed(4)}</span>
        </label>
        
        <label>
          Particle Decay Rate
          <input
            type='range' min='0' max='0.01' step='0.0001'
            value={params.particleDecayRate}
            onChange={(e) => setParams({ particleDecayRate: parseFloat(e.target.value) })}
          />
          <span>{(params.particleDecayRate * 100).toFixed(2)}%</span>
        </label>
      </div>
    </div>
  );
}


export default App
