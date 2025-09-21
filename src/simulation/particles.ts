import type { ParticleId, LineageId, SimulationParams } from './types'
import { ParticleType } from './types'

/**
 * Base class for all particles in the simulation.
 * Provides common properties and behaviors shared by monomers and templates.
 */
export abstract class Particle {
  public id: ParticleId
  public x: number
  public y: number
  public angle: number
  public active: boolean = true

  constructor(id: ParticleId, x: number, y: number, angle: number = 0) {
    this.id = id
    this.x = x
    this.y = y
    this.angle = angle
  }

  /**
   * Updates the particle's position based on Brownian motion and other forces.
   * @param params Simulation parameters
   */
  abstract update(params: SimulationParams): void

  /**
   * Returns the particle type for rendering and logic purposes.
   */
  abstract getType(): ParticleType

  /**
   * Returns the particle's diameter for collision detection and rendering.
   */
  getDiameter(params: SimulationParams): number {
    return params.monomerDiameter
  }

  /**
   * Applies boundary conditions to the particle.
   * @param params Simulation parameters
   * @returns true if particle should be removed (went out of bounds)
   */
  applyBoundaryConditions(params: SimulationParams): boolean {
    // Periodic boundary in Y
    if (this.y < 0) this.y += params.Ly
    if (this.y > params.Ly) this.y -= params.Ly

    // Open boundary in X - remove particles that exit
    if (this.x > params.Lx || this.x < 0) {
      this.active = false
      return true
    }
    return false
  }

  /**
   * Checks if this particle collides with another particle.
   */
  collidesWith(other: Particle, params: SimulationParams): boolean {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const minDistance = (this.getDiameter(params) + other.getDiameter(params)) / 2
    return distance < minDistance
  }
}

/**
 * A monomer particle - the basic building block.
 * Monomers drift rightward and can be captured by templates.
 */
export class Monomer extends Particle {
  constructor(id: ParticleId, x: number, y: number) {
    super(id, x, y, 0)
  }

  update(params: SimulationParams): void {
    const diffusionStep = Math.sqrt(2 * params.diffusionCoefficient * params.timeStep)
    
    // Brownian motion with rightward bias
    const brownianX = diffusionStep * (Math.random() - 0.5) * 2
    const brownianY = diffusionStep * (Math.random() - 0.5) * 2
    
    this.x += brownianX + params.flowVelocity * params.timeStep
    this.y += brownianY
  }

  getType(): ParticleType {
    return ParticleType.Monomer
  }
}

/**
 * A template particle - a self-replicating structure.
 * Templates can capture monomers, replicate, and undergo mutation.
 */
export class Template extends Particle {
  public readonly lineageId: LineageId
  public readonly k: number // Number of capture sites
  public readonly captureRadius: number
  public readonly releaseProb: number
  
  // Capture site positions relative to template center
  public readonly captureOffsets: Array<{ dx: number; dy: number }>
  
  // State for replication process
  public capturedMonomers: (Monomer | null)[] = []
  public captureTimers: number[] = []
  public starvationTimer: number = 0

  constructor(
    id: ParticleId,
    x: number,
    y: number,
    angle: number,
    lineageId: LineageId,
    params: SimulationParams
  ) {
    super(id, x, y, angle)
    this.lineageId = lineageId
    this.k = params.k
    this.captureRadius = params.captureRadius
    this.releaseProb = params.releaseProb
    
    // Initialize capture sites in a regular polygon
    this.captureOffsets = []
    for (let i = 0; i < this.k; i++) {
      const siteAngle = (2 * Math.PI * i) / this.k
      this.captureOffsets.push({
        dx: this.captureRadius * Math.cos(siteAngle),
        dy: this.captureRadius * Math.sin(siteAngle)
      })
    }
    
    // Initialize capture state
    this.capturedMonomers = new Array(this.k).fill(null)
    this.captureTimers = new Array(this.k).fill(0)
  }

  update(params: SimulationParams): void {
    const diffusionStep = Math.sqrt(2 * params.diffusionCoefficient * params.timeStep)
    
    // Templates move with pure Brownian motion (no bias)
    this.x += diffusionStep * (Math.random() - 0.5) * 2
    this.y += diffusionStep * (Math.random() - 0.5) * 2
    
    // Update angle slightly for more realistic behavior
    this.angle += 0.1 * (Math.random() - 0.5)
  }

  getType(): ParticleType {
    return ParticleType.Template
  }

  /**
   * Gets the global positions of all capture sites.
   */
  getCaptureSites(): Array<{ x: number; y: number; occupied: boolean }> {
    return this.captureOffsets.map((offset, i) => ({
      x: this.x + offset.dx * Math.cos(this.angle) - offset.dy * Math.sin(this.angle),
      y: this.y + offset.dx * Math.sin(this.angle) + offset.dy * Math.cos(this.angle),
      occupied: this.capturedMonomers[i] !== null
    }))
  }

  /**
   * Attempts to capture a monomer at the specified site index.
   * @param siteIndex Index of the capture site
   * @param monomer Monomer to capture
   * @param params Simulation parameters
   * @returns true if capture was successful
   */
  attemptCapture(siteIndex: number, monomer: Monomer, params: SimulationParams): boolean {
    if (this.capturedMonomers[siteIndex] !== null) return false
    
    const sites = this.getCaptureSites()
    const site = sites[siteIndex]
    const dx = monomer.x - site.x
    const dy = monomer.y - site.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance < this.captureRadius) {
      this.captureTimers[siteIndex]++
      if (this.captureTimers[siteIndex] >= params.captureSteps) {
        this.capturedMonomers[siteIndex] = monomer
        monomer.active = false // Remove from free particle pool
        return true
      }
    } else {
      this.captureTimers[siteIndex] = 0 // Reset timer if monomer moves away
    }
    
    return false
  }

  /**
   * Checks if all sites are captured and ready for replication.
   */
  isReadyForReplication(): boolean {
    return this.capturedMonomers.every(m => m !== null)
  }

  /**
   * Attempts to release the completed replica.
   * @param params Simulation parameters
   * @returns new Template if release was successful, null otherwise
   */
  attemptRelease(params: SimulationParams): Template | null {
    if (!this.isReadyForReplication()) return null
    
    if (Math.random() < this.releaseProb) {
      // Create child template
      const childX = this.x + params.monomerDiameter * 2 // Place next to parent
      const childY = this.y
      const childAngle = this.angle + (Math.random() - 0.5) * 0.2 // Small angular mutation
      
      const child = new Template(
        -1 as ParticleId, // Will be assigned proper ID by simulation
        childX,
        childY,
        childAngle,
        this.lineageId, // Inherit lineage (mutation handling would go here)
        params
      )
      
      // Reset parent's capture state
      this.capturedMonomers.fill(null)
      this.captureTimers.fill(0)
      this.starvationTimer = 0
      
      return child
    }
    
    return null
  }

  /**
   * Updates starvation timer and checks for decay.
   * @param params Simulation parameters
   * @returns true if template should decay into monomers
   */
  updateStarvation(params: SimulationParams): boolean {
    const hasAnyCapture = this.capturedMonomers.some(m => m !== null)
    
    if (!hasAnyCapture) {
      this.starvationTimer++
      if (this.starvationTimer >= params.starvationSteps) {
        if (Math.random() < params.decayProb) {
          this.active = false
          return true
        }
      }
    } else {
      this.starvationTimer = 0
    }
    
    return false
  }
}
