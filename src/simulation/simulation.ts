import type { ParticleId, LineageId, SimulationParams, SimulationState } from './types'
import { Particle, Monomer, Template } from './particles'

/**
 * Main simulation class that manages the entire particle system.
 * Handles particle creation, updates, interactions, and data export.
 */
export class Simulation {
  private params: SimulationParams
  private particles: Map<ParticleId, Particle> = new Map()
  private availableIds: ParticleId[] = []
  private nextLineageId: number = 1
  private frameCount: number = 0

  // Spatial partitioning for efficient collision detection
  private grid: Map<string, ParticleId[]> = new Map()
  private gridCellSize: number = 0

  constructor(params: SimulationParams) {
    this.params = params
    this.initializeParticlePool()
    this.initializeSeedTemplates()
    this.setupSpatialGrid()
  }

  /**
   * Initializes the pool of available particle IDs.
   */
  private initializeParticlePool(): void {
    this.availableIds = []
    for (let i = this.params.particleCount - 1; i >= 0; i--) {
      this.availableIds.push(i as ParticleId)
    }
  }

  /**
   * Creates initial seed templates to kickstart the simulation.
   */
  private initializeSeedTemplates(): void {
    for (let i = 0; i < this.params.seedTemplates; i++) {
      const id = this.availableIds.pop()
      if (id === undefined) break

      const x = this.params.Lx * (0.25 + Math.random() * 0.25)
      const y = Math.random() * this.params.Ly
      const angle = Math.random() * 2 * Math.PI
      const lineageId = this.nextLineageId++ as LineageId

      const template = new Template(id, x, y, angle, lineageId, this.params)
      this.particles.set(id, template)
    }
  }

  /**
   * Sets up the spatial partitioning grid for efficient neighbor queries.
   */
  private setupSpatialGrid(): void {
    this.gridCellSize = this.params.monomerDiameter * 3 // Larger than particle diameter
    this.grid.clear()
  }

  /**
   * Updates the spatial grid with current particle positions.
   */
  private updateSpatialGrid(): void {
    this.grid.clear()
    
    for (const [id, particle] of this.particles) {
      if (!particle.active) continue
      
      const cellX = Math.floor(particle.x / this.gridCellSize)
      const cellY = Math.floor(particle.y / this.gridCellSize)
      const cellKey = `${cellX},${cellY}`
      
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, [])
      }
      this.grid.get(cellKey)!.push(id)
    }
  }

  /**
   * Gets nearby particles for collision detection and interactions.
   */
  private getNearbyParticles(particle: Particle): Particle[] {
    const cellX = Math.floor(particle.x / this.gridCellSize)
    const cellY = Math.floor(particle.y / this.gridCellSize)
    const nearby: Particle[] = []
    
    // Check 3x3 grid around the particle
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cellKey = `${cellX + dx},${cellY + dy}`
        const cellParticles = this.grid.get(cellKey) || []
        
        for (const id of cellParticles) {
          const other = this.particles.get(id)
          if (other && other !== particle && other.active) {
            nearby.push(other)
          }
        }
      }
    }
    
    return nearby
  }

  /**
   * Creates new monomer particles during inflow events.
   */
  private handleInflow(): void {
    if (this.frameCount % this.params.inflowInterval !== 0) return

    for (let i = 0; i < this.params.inflowRate; i++) {
      const id = this.availableIds.pop()
      if (id === undefined) break // No more available IDs

      const x = Math.random() * this.params.inflowStripWidth
      const y = Math.random() * this.params.Ly
      const monomer = new Monomer(id, x, y)
      
      this.particles.set(id, monomer)
    }
  }

  /**
   * Removes inactive particles and returns their IDs to the pool.
   */
  private cleanupInactiveParticles(): void {
    const toRemove: ParticleId[] = []
    
    for (const [id, particle] of this.particles) {
      if (!particle.active) {
        toRemove.push(id)
      }
    }
    
    for (const id of toRemove) {
      this.particles.delete(id)
      this.availableIds.push(id)
    }
  }

  /**
   * Handles template-monomer interactions for capture and replication.
   */
  private handleTemplateInteractions(): void {
    const templates = Array.from(this.particles.values()).filter(
      p => p instanceof Template && p.active
    ) as Template[]

    const monomers = Array.from(this.particles.values()).filter(
      p => p instanceof Monomer && p.active
    ) as Monomer[]

    for (const template of templates) {
      // Check for monomer capture
      const nearbyMonomers = monomers.filter(m => {
        const dx = m.x - template.x
        const dy = m.y - template.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance < template.captureRadius * 3 // Broad check first
      })

      // Attempt capture at each site
      for (let siteIndex = 0; siteIndex < template.k; siteIndex++) {
        if (template.capturedMonomers[siteIndex] !== null) continue

        for (const monomer of nearbyMonomers) {
          if (template.attemptCapture(siteIndex, monomer, this.params)) {
            break // Move to next site
          }
        }
      }

      // Check for replication
      const newTemplate = template.attemptRelease(this.params)
      if (newTemplate) {
        const newId = this.availableIds.pop()
        if (newId !== undefined) {
          newTemplate.id = newId
          this.particles.set(newId, newTemplate)
        }
      }

      // Check for starvation/decay
      if (template.updateStarvation(this.params)) {
        // Template decays - create k monomers at its position
        for (let i = 0; i < template.k; i++) {
          const monomerId = this.availableIds.pop()
          if (monomerId === undefined) break

          const decayMonomer = new Monomer(
            monomerId,
            template.x + (Math.random() - 0.5) * this.params.monomerDiameter,
            template.y + (Math.random() - 0.5) * this.params.monomerDiameter
          )
          this.particles.set(monomerId, decayMonomer)
        }
      }
    }
  }

  /**
   * Resolves collisions between particles using simple separation.
   */
  private handleCollisions(): void {
    const activeParticles = Array.from(this.particles.values()).filter(p => p.active)
    
    for (let i = 0; i < activeParticles.length; i++) {
      const p1 = activeParticles[i]
      const nearby = this.getNearbyParticles(p1)
      
      for (const p2 of nearby) {
        if (p1.collidesWith(p2, this.params)) {
          // Simple collision resolution - push particles apart
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance > 0) {
            const overlap = (p1.getDiameter(this.params) + p2.getDiameter(this.params)) / 2 - distance
            const separationX = (dx / distance) * overlap * 0.5
            const separationY = (dy / distance) * overlap * 0.5
            
            p1.x += separationX
            p1.y += separationY
            p2.x -= separationX
            p2.y -= separationY
          }
        }
      }
    }
  }

  /**
   * Updates the simulation parameters.
   */
  updateParams(newParams: Partial<SimulationParams>): void {
    this.params = { ...this.params, ...newParams }
  }

  /**
   * Advances the simulation by one time step.
   */
  step(): void {
    this.frameCount++

    // Update spatial grid
    this.updateSpatialGrid()

    // Update all particle positions
    for (const particle of this.particles.values()) {
      if (particle.active) {
        particle.update(this.params, this.params.dt)
        particle.applyBoundaryConditions(this.params)
      }
    }

    // Handle particle interactions
    this.handleCollisions()
    this.handleTemplateInteractions()

    // Handle inflow of new monomers
    this.handleInflow()

    // Clean up inactive particles
    this.cleanupInactiveParticles()
  }

  /**
   * Exports the current simulation state for rendering.
   */
  exportState(): SimulationState {
    const activeParticles = Array.from(this.particles.values()).filter(p => p.active)
    const count = activeParticles.length

    const positions = new Float32Array(count * 2)
    const types = new Uint8Array(count)
    const lineageIds = new Uint32Array(count)
    const diameters = new Float32Array(count)

    let monomerCount = 0
    let templateCount = 0

    for (let i = 0; i < count; i++) {
      const particle = activeParticles[i]
      
      positions[i * 2] = particle.x
      positions[i * 2 + 1] = particle.y
      types[i] = particle.getType()
      diameters[i] = particle.getDiameter(this.params)

      if (particle instanceof Template) {
        lineageIds[i] = particle.lineageId
        templateCount++
      } else {
        lineageIds[i] = 0
        monomerCount++
      }
    }

    return {
      positions,
      types,
      lineageIds,
      diameters,
      stats: {
        frameCount: this.frameCount,
        activeParticles: count,
        monomerCount,
        templateCount,
      },
    }
  }

  /**
   * Resets the simulation to initial state.
   */
  reset(): void {
    this.particles.clear()
    this.grid.clear()
    this.frameCount = 0
    this.nextLineageId = 1
    
    this.initializeParticlePool()
    this.initializeSeedTemplates()
    this.setupSpatialGrid()
  }
}
