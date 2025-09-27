import { useSimulationStore } from "../store/simulationStore";

/**
* Provides UI controls for the simulation.
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

export default function Controls() {
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
       <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 150, 200)' }}></span>E Particles: {stats.particleCountE || 0}</p>
       <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(200, 200, 200)' }}></span>Binder Particles: {stats.particleCountBinder || 0}</p>
       <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 200, 50)' }}></span>Attractor Particles: {stats.particleCountAttractor || 0}</p>
       <p><span className="particle-color-swatch" style={{ backgroundColor: 'rgb(255, 255, 100)' }}></span>Energy Particles: {stats.energyParticleCount || 0}</p>
       <p>Total Reactions: {stats.totalReactions || 0}</p>
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
