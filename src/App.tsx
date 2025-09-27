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
      // Render radius comes from the unified physics parameter
      const radius = useSimulationStore.getState().params.particleRadius;
      
      // Choose shape and color based on particle type
      // - Substrate, binder, attractor, E: draw circles of radius r
      // - Energy: draw a smaller rectangle (~half the circle's diameter) for visual distinction
      if (type === ParticleType.Energy) {
        // Set color for energy particles
        context.fillStyle = 'rgba(255, 255, 100, 0.9)'
        
        // Compute a rectangle roughly a third of the visual size of substrate circles
        const rectW = radius
        const rectH = radius
        const left = x - rectW / 3
        const top = y - rectH / 3
        
        // Draw filled rectangle centered at particle position
        context.beginPath()
        context.rect(left, top, rectW, rectH)
        context.fill()
        
        // Add a subtle outline for better visibility
        context.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        context.lineWidth = 1
        context.stroke()
      } else {
        // Set fill color based on substrate-like particle types
        context.beginPath()
        context.arc(x, y, radius, 0, 2 * Math.PI)
        
        if (type === ParticleType.A) {
          context.fillStyle = `rgba(50, 100, 255, ${Math.max(0.3, energy)})` // Blue
        } else if (type === ParticleType.B) {
          context.fillStyle = `rgba(255, 50, 50, ${Math.max(0.3, energy)})` // Red
        } else if (type === ParticleType.C) {
          context.fillStyle = `rgba(50, 255, 50, ${Math.max(0.3, energy)})` // Green
        } else if (type === ParticleType.D) {
          context.fillStyle = `rgba(200, 50, 255, ${Math.max(0.3, energy)})` // Purple
        } else if (type === ParticleType.Binder) {
          context.fillStyle = `rgba(200, 200, 200, ${Math.max(0.3, energy)})` // White/Gray
        } else if (type === ParticleType.Attractor) {
          context.fillStyle = `rgba(255, 200, 50, ${Math.max(0.4, energy)})` // Orange-gold for attractor
        } else if (type === ParticleType.E) {
          context.fillStyle = `rgba(255, 150, 200, ${Math.max(0.4, energy)})` // Pinkish for E
        }
        
        context.fill()
        
        // Add a subtle white outline for better visibility
        context.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        context.lineWidth = 1
        context.stroke()
      }
    }
  }, [simulationState]);

  return <canvas ref={canvasRef} className='simulation-canvas' />;
}

/**
 * Provides UI controls for the simulation.
 */
/**
 * Control configuration for the simulation parameters
 */
interface ControlConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  formatter: (value: number) => string;
  parser: (value: string) => number;
  section: string;
}

function Controls() {
  const { start, stop, reset, isRunning, params, setParams, stats } = useSimulationStore();

  // Define all control configurations in a single array
  const controlConfigs: ControlConfig[] = [
    // Physics section for the simplified model
    {
      key: 'particleRadius',
      label: 'Particle Radius',
      min: 2,
      max: 12,
      step: 1,
      formatter: (value) => value.toString(),
      parser: parseInt,
      section: 'Physics'
    },
    {
      key: 'current',
      label: 'Current (right bias)',
      min: 0,
      max: 3,
      step: 0.05,
      formatter: (value) => value.toFixed(2),
      parser: parseFloat,
      section: 'Physics'
    },
    {
      key: 'attractorForceUnitDistanceInR',
      label: 'Attractor Unit Dist (r)',
      min: 2,
      max: 16,
      step: 1,
      formatter: (value) => value.toString() + ' r',
      parser: parseInt,
      section: 'Reactions'
    },
    {
      key: 'energyPulsePeriodFrames',
      label: 'Energy Pulse Period',
      min: 120,
      max: 6000,
      step: 60,
      formatter: (value) => value.toString() + ' frames',
      parser: parseInt,
      section: 'Reactions'
    },
    {
      key: 'randomStepMagnitudeX',
      label: 'Random Step X',
      min: 0.1,
      max: 5,
      step: 0.1,
      formatter: (value) => value.toFixed(1),
      parser: parseFloat,
      section: 'Physics'
    },
    {
      key: 'collisionEnergyLossPct',
      label: 'Collision Loss %',
      min: 0,
      max: 90,
      step: 1,
      formatter: (value) => value.toFixed(0) + '%',
      parser: parseFloat,
      section: 'Physics'
    },
    {
      key: 'binderForceUnitDistanceInR',
      label: 'Binder Unit Dist (r)',
      min: 2,
      max: 10,
      step: 1,
      formatter: (value) => value.toString() + ' r',
      parser: parseInt,
      section: 'Physics'
    },
    {
      key: 'binderQuorumRadiusInR',
      label: 'Quorum Radius (r)',
      min: 2,
      max: 16,
      step: 1,
      formatter: (value) => value.toString() + ' r',
      parser: parseInt,
      section: 'Physics'
    },
    {
      key: 'binderQuorumSoftCap',
      label: 'Quorum Soft Cap',
      min: 1,
      max: 24,
      step: 1,
      formatter: (value) => value.toString(),
      parser: parseInt,
      section: 'Physics'
    },
    {
      key: 'particleLifespan',
      label: 'Particle Lifespan',
      min: 100,
      max: 2000,
      step: 50,
      formatter: (value) => value.toString(),
      parser: parseInt,
      section: 'Physics'
    }
    ,
    // Reactions section
    {
      key: 'reactionDistanceInR',
      label: 'Reaction Distance (r)',
      min: 1,
      max: 6,
      step: 1,
      formatter: (value) => value.toString() + ' r',
      parser: parseInt,
      section: 'Reactions'
    }
  ];

  // Group controls by section
  const controlsBySection = controlConfigs.reduce((acc, config) => {
    if (!acc[config.section]) {
      acc[config.section] = [];
    }
    acc[config.section].push(config);
    return acc;
  }, {} as Record<string, ControlConfig[]>);

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
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(50, 100, 255)' }}></span>A Particles: {stats.particleCountA || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 50, 50)' }}></span>B Particles: {stats.particleCountB || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(50, 255, 50)' }}></span>C Particles: {stats.particleCountC || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(200, 50, 255)' }}></span>D Particles: {stats.particleCountD || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 200, 50)' }}></span>Attractors: {stats.particleCountAttractor || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 150, 200)' }}></span>E Particles: {stats.particleCountE || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(200, 200, 200)' }}></span>Binder Particles: {stats.particleCountBinder || 0}</p>
        <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 255, 100)' }}></span>Energy: {stats.energyParticleCount || 0}</p>
        <p>Total Reactions: {stats.totalReactions || 0}</p>
        <p>Discovered Reactions: {stats.discoveredReactions || 0}</p>
      </div>

      <div className='params-editor'>
        {Object.entries(controlsBySection).map(([sectionName, controls]) => (
          <div key={sectionName}>
            <h4>{sectionName}</h4>
            {controls.map((config) => (
              <label key={config.key}>
                {config.label}
                <input
                  type='range'
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  value={params[config.key as keyof typeof params]}
                  onChange={(e) => setParams({ [config.key]: config.parser(e.target.value) } as Partial<typeof params>)}
                />
                <span>{config.formatter(params[config.key as keyof typeof params])}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


export default App
