import './App.css'
import SimulationCanvas from './components/canvas'
import Controls from './components/panel'

/**
 * The main application component.
 * It orchestrates the UI, including the simulation canvas, controls, and stats.
 */
export default function App() {
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
