import { useEffect, useRef } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { ParticleType } from "../simulation/types";

/**
 * Renders the simulation on a canvas.
 */
export default function SimulationCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const simulationState = useSimulationStore((state) => state.simulationState);
    const isInitialized = useSimulationStore((state) => state.isInitialized)
    const start = useSimulationStore((state) => state.start)
    const reset = useSimulationStore((state) => state.reset)
  
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
  
    // Automatically reset and start the simulation once the worker reports initialized
    // This ensures the world size is known and the worker is ready before starting
    useEffect(() => {
      if (!isInitialized) return
      setTimeout(() => {
        reset()
        start()
      }, 500)
    }, [isInitialized, reset, start])
  
    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!context || !canvas || !simulationState) return;
  
      context.fillStyle = '#1a1a1a';
      context.fillRect(0, 0, canvas.width, canvas.height);
  
      const { positions, types } = simulationState;
  
      // Draw Particles
      for (let i = 0; i < positions.length / 2; i++) {
        const x = positions[i * 2];
        const y = positions[i * 2 + 1];
        const type = types[i];
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
            context.fillStyle = `rgba(50, 100, 255, 0.9)` // Blue
          } else if (type === ParticleType.B) {
            context.fillStyle = `rgba(255, 50, 50, 0.9)` // Red
          } else if (type === ParticleType.C) {
            context.fillStyle = `rgba(50, 255, 50, 0.9)` // Green
          } else if (type === ParticleType.D) {
            context.fillStyle = `rgba(200, 50, 255, 0.9)` // Purple
          } else if (type === ParticleType.Binder) {
            context.fillStyle = `rgba(200, 200, 200, 0.9)` // White/Gray
          } else if (type === ParticleType.Attractor) {
            context.fillStyle = `rgba(255, 200, 50, 0.9)` // Orange-gold for attractor
          } else if (type === ParticleType.E) {
            context.fillStyle = `rgba(255, 150, 200, 0.9)` // Pinkish for E
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