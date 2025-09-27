import type { SimulationParams, SimulationState, ParticleId, Reaction } from './types';
import { ParticleType } from './types';
import { SubstrateParticle, EnergyParticle } from './particles';


/**
 * Autocatalytic reaction simulation
 *
 * This simulation models the emergence of self-sustaining chemical reaction networks.
 * - A variety of substrate particles (A, B, C, D, E) exist.
 * - An energy gradient flows from left to right.
 * - When particles and energy collide, new chemical reactions can be "discovered".
 * - Discovered reactions are added to a global "reaction catalog".
 * - Sets of reactions that can sustain each other (autocatalytic sets) can emerge,
 *   compete for resources, and spread, demonstrating open-ended evolution.
 */
export class Simulation {
  private params: SimulationParams;
  private Lx: number = 800;
  private Ly: number = 600;

  // Simplified physics constants not exposed
  private readonly energyInflowPerTick = 2;
  private readonly energyFlowVelocity = 60;
  private readonly energyTurbulence = 0.4;

  // A single map to hold all substrate particles, distinguished by their internal 'type'
  private particles = new Map<ParticleId, SubstrateParticle>();
  private energyParticles = new Map<ParticleId, EnergyParticle>();

  // The catalog of all "discovered" chemical reactions
  private reactionCatalog = new Map<string, Reaction>();

  // Simulation state
  private frameCount: number = 0;
  private nextId: ParticleId = 0;
  private totalReactions: number = 0;

  constructor(params: SimulationParams) {
    this.params = params;
    this.Lx = params.Lx;
    this.Ly = params.Ly;
  }

  /**
   * Initializes the simulation with starting particles.
   */
  public initialize(): void {
    this.particles.clear();
    this.energyParticles.clear();
    this.reactionCatalog.clear();
    this.frameCount = 0;
    this.nextId = 0;
    this.totalReactions = 0;

    // Pre-populate the reaction catalog with a fixed set that
    // encourages autocatalysis, diversity, and membrane formation
    this.seedFixedReactions()

    // Create initial particles for each type based on params
    this.createInitialParticles(ParticleType.A, this.params.particleCountA);
    this.createInitialParticles(ParticleType.B, this.params.particleCountB);
    this.createInitialParticles(ParticleType.C, this.params.particleCountC);
    this.createInitialParticles(ParticleType.D, this.params.particleCountD);
    this.createInitialParticles(ParticleType.Binder, this.params.particleCountBinder);

    // Create initial energy particles
    for (let i = 0; i < this.params.energyParticleCount; i++) {
      const x = Math.random() * (this.Lx * 0.1); // Start near left edge
      const y = Math.random() * this.Ly;
      this.energyParticles.set(this.nextId, new EnergyParticle(this.nextId, x, y));
      this.nextId++;
    }
  }

  /**
   * Seeds a fixed set of reactions with hand-picked efficiencies.
   * Design goals:
   * - Ensure each base substrate has at least one autocatalytic route
   * - Provide two routes that produce binders from cross-pairs
   * - Make binders catalyze replication to favor compartment growth
   */
  private seedFixedReactions(): void {
    const add = (a: ParticleType, b: ParticleType, catalyst: ParticleType, product1: ParticleType, product2: ParticleType, efficiency: number) => {
      const key = this.getReactionKey(a, b)
      this.reactionCatalog.set(key, {
        reactant1: a,
        reactant2: b,
        catalyst: catalyst,
        product1: product1,
        product2: product2,
        efficiency: efficiency
      })
    }

    // Autocatalytic base loops: each pair replicates one member
    add(ParticleType.A, ParticleType.B, ParticleType.A, ParticleType.A, ParticleType.A, 0.5)
    add(ParticleType.B, ParticleType.C, ParticleType.B, ParticleType.B, ParticleType.B, 0.5)
    add(ParticleType.C, ParticleType.D, ParticleType.C, ParticleType.C, ParticleType.C, 0.5)
    add(ParticleType.D, ParticleType.A, ParticleType.D, ParticleType.D, ParticleType.D, 0.5)

    // Cross-pair binder production pathways to promote membranes
    add(ParticleType.A, ParticleType.C, ParticleType.A, ParticleType.Binder, ParticleType.A, 0.3)
    add(ParticleType.B, ParticleType.D, ParticleType.B, ParticleType.Binder, ParticleType.B, 0.3)

    // Binder-catalyzed replication favors growth inside/near membranes
    add(ParticleType.A, ParticleType.Binder, ParticleType.Binder, ParticleType.A, ParticleType.A, 0.7)
    add(ParticleType.B, ParticleType.Binder, ParticleType.Binder, ParticleType.B, ParticleType.B, 0.7)
    add(ParticleType.C, ParticleType.Binder, ParticleType.Binder, ParticleType.C, ParticleType.C, 0.6)
    add(ParticleType.D, ParticleType.Binder, ParticleType.Binder, ParticleType.D, ParticleType.D, 0.6)
  }

  /** Helper to create initial substrate particles */
  private createInitialParticles(type: ParticleType, count: number): void {
    for (let i = 0; i < count; i++) {
      // Spawn only in the middle 60% of the canvas
      const x = this.Lx * (0.2 + Math.random() * 0.6);
      const y = this.Ly * (0.2 + Math.random() * 0.6);
      this.particles.set(this.nextId, new SubstrateParticle(this.nextId, x, y, type, this.params.particleLifespan));
      this.nextId++;
    }
  }

  public step(): void {
    this.frameCount++;
    this.updateAndMoveParticles();
    this.handleEnergyInflow();
    this.processReactionsAndDiscovery();
    this.cleanupInactiveParticles();
  }
  
  /**
   * Updates lifespans and applies simplified physics per tick
   */
  private updateAndMoveParticles(): void {
    // Update substrate lifespans
    for (const p of this.particles.values()) {
      if (p.active) p.update()
    }

    // Update energy particles simple flow
    for (const e of this.energyParticles.values()) {
      if (!e.active) continue
      e.x += this.energyFlowVelocity * 1.0 / 60.0
      e.y += (Math.random() - 0.5) * this.energyTurbulence
      if (e.y < 0) e.y += this.Ly
      if (e.y > this.Ly) e.y -= this.Ly
      if (e.x > this.Lx) e.active = false
    }

    const active = Array.from(this.particles.values()).filter(p => p.active)
    if (active.length === 0) return

    const r = this.params.particleRadius
    const binderRange = this.params.binderForceUnitDistanceInR * r

    // Spatial hash grid for neighbor queries
    const cellSize = Math.max(2 * r, binderRange)
    const grid = new Map<string, SubstrateParticle[]>()
    const cellKey = (x: number, y: number) => `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`

    for (const p of active) {
      const key = cellKey(p.x, p.y)
      const arr = grid.get(key)
      if (arr) arr.push(p)
      else grid.set(key, [p])
    }

    const getNeighbors = (x: number, y: number, radius: number): SubstrateParticle[] => {
      const cx = Math.floor(x / cellSize)
      const cy = Math.floor(y / cellSize)
      const res: SubstrateParticle[] = []
      const span = 1
      for (let ix = cx - span; ix <= cx + span; ix++) {
        for (let iy = cy - span; iy <= cy + span; iy++) {
          const arr = grid.get(`${ix}:${iy}`)
          if (!arr) continue
          for (const p of arr) {
            const dx = p.x - x
            const dy = p.y - y
            if (Math.hypot(dx, dy) <= radius + 1e-6) res.push(p)
          }
        }
      }
      return res
    }

    // Step vectors per particle id
    const stepX = new Map<ParticleId, number>()
    const stepY = new Map<ParticleId, number>()

    // 1) Base random step X
    for (const p of active) {
      const angle = Math.random() * Math.PI * 2
      stepX.set(p.id, Math.cos(angle) * this.params.randomStepMagnitudeX)
      stepY.set(p.id, Math.sin(angle) * this.params.randomStepMagnitudeX)
    }

    // 2) Binder attraction inverse-square, normalized to X at N radii
    for (const p of active) {
      const neighbors = getNeighbors(p.x, p.y, binderRange)
      for (const q of neighbors) {
        if (p.id === q.id) continue
        if (q.type !== ParticleType.Binder) continue
        const dx = q.x - p.x
        const dy = q.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 1e-6) continue
        const dClamped = Math.max(dist, 2 * r)
        const unitX = dx / dist
        const unitY = dy / dist
        const mag = this.params.randomStepMagnitudeX * Math.pow(binderRange / dClamped, 2)
        stepX.set(p.id, (stepX.get(p.id) || 0) + unitX * mag)
        stepY.set(p.id, (stepY.get(p.id) || 0) + unitY * mag)
      }
    }

    // 3) Apply steps tentatively
    for (const p of active) {
      p.x += stepX.get(p.id) || 0
      p.y += stepY.get(p.id) || 0
    }

    // 4) Resolve collisions using nearest neighbors
    grid.clear()
    for (const p of active) {
      const key = cellKey(p.x, p.y)
      const arr = grid.get(key)
      if (arr) arr.push(p)
      else grid.set(key, [p])
    }

    const neighborsForCollision = (p: SubstrateParticle): SubstrateParticle[] => {
      const cx = Math.floor(p.x / cellSize)
      const cy = Math.floor(p.y / cellSize)
      const res: SubstrateParticle[] = []
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
          const arr = grid.get(`${ix}:${iy}`)
          if (!arr) continue
          for (const q of arr) res.push(q)
        }
      }
      return res
    }

    const lossFactor = Math.sqrt(Math.max(0, 1 - this.params.collisionEnergyLossPct / 100))

    for (const p of active) {
      const neigh = neighborsForCollision(p)
      for (const q of neigh) {
        if (q.id <= p.id) continue
        const dx = q.x - p.x
        const dy = q.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist >= 2 * r || dist <= 1e-6) continue

        const nx = dx / dist
        const ny = dy / dist
        const overlap = 2 * r - dist

        // Binder collision rule
        if (p.type === ParticleType.Binder || q.type === ParticleType.Binder) {
          if (p.type === ParticleType.Binder && q.type !== ParticleType.Binder) {
            // Place q tangent to p, dissipate q step
            q.x = p.x + nx * 2 * r
            q.y = p.y + ny * 2 * r
            stepX.set(q.id, 0)
            stepY.set(q.id, 0)
          } else if (q.type === ParticleType.Binder && p.type !== ParticleType.Binder) {
            p.x = q.x - nx * 2 * r
            p.y = q.y - ny * 2 * r
            stepX.set(p.id, 0)
            stepY.set(p.id, 0)
          } else {
            // binder-binder: separate equally and zero both steps
            p.x -= nx * overlap * 0.5
            p.y -= ny * overlap * 0.5
            q.x += nx * overlap * 0.5
            q.y += ny * overlap * 0.5
            stepX.set(p.id, 0)
            stepY.set(p.id, 0)
            stepX.set(q.id, 0)
            stepY.set(q.id, 0)
          }
          continue
        }

        // Elastic collision with damping for two non-binders
        const v1x = stepX.get(p.id) || 0
        const v1y = stepY.get(p.id) || 0
        const v2x = stepX.get(q.id) || 0
        const v2y = stepY.get(q.id) || 0

        // Normal and tangent components
        const v1n = v1x * nx + v1y * ny
        const v2n = v2x * nx + v2y * ny
        const tx = -ny
        const ty = nx
        const v1t = v1x * tx + v1y * ty
        const v2t = v2x * tx + v2y * ty

        // Swap normal components (equal mass), apply damping
        const v1nPrime = v2n * lossFactor
        const v2nPrime = v1n * lossFactor

        const newV1x = v1t * tx + v1nPrime * nx
        const newV1y = v1t * ty + v1nPrime * ny
        const newV2x = v2t * tx + v2nPrime * nx
        const newV2y = v2t * ty + v2nPrime * ny

        stepX.set(p.id, newV1x)
        stepY.set(p.id, newV1y)
        stepX.set(q.id, newV2x)
        stepY.set(q.id, newV2y)

        // Positional correction to remove overlap
        const corr = overlap * 0.5
        p.x -= nx * corr
        p.y -= ny * corr
        q.x += nx * corr
        q.y += ny * corr
      }
    }

    // 5) Enforce boundaries
    for (const p of active) {
      if (p.y < 0) p.y += this.Ly
      if (p.y > this.Ly) p.y -= this.Ly
      if (p.x < 0) p.x = 0
      if (p.x > this.Lx) p.x = this.Lx
    }
  }

  // Legacy force calculation removed by simplified physics

  /**
   * Spawns a constant number of new energy particles from the left edge on each step.
   */
  private handleEnergyInflow(): void {
    for (let i = 0; i < this.energyInflowPerTick; i++) {
      const x = Math.random() * 20; // Spawn in a narrow strip on the far left
      const y = Math.random() * this.Ly;
      this.energyParticles.set(this.nextId, new EnergyParticle(this.nextId, x, y));
      this.nextId++;
    }
  }

  /**
   * Main interaction logic.
   * Iterates through particle triplets to check for reactions or discover new ones.
   */
  private processReactionsAndDiscovery(): void {
    const activeParticles = Array.from(this.particles.values()).filter(p => p.active);
    const activeEnergy = Array.from(this.energyParticles.values()).filter(p => p.active);

    if (activeParticles.length < 2) return;

    // A spatial hash could optimize this, but for now, we iterate.
    for (let i = 0; i < activeParticles.length; i++) {
      for (let j = i + 1; j < activeParticles.length; j++) {
        const p1 = activeParticles[i];
        const p2 = activeParticles[j];

        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const reactionRadius = this.params.particleRadius * this.params.reactionDistanceInR;
        if (dist < reactionRadius) {
          // Find a nearby energy particle to power the reaction
          for (const energy of activeEnergy) {
            if (!energy.active) continue;

            const distE = Math.hypot(p1.x - energy.x, p1.y - energy.y);
            if (distE < reactionRadius) {
              this.attemptReaction(p1, p2, energy);
              // An energy particle can only power one reaction per step
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Given two substrate particles and an energy particle, attempt a known reaction (fixed catalog)
   */
  private attemptReaction(p1: SubstrateParticle, p2: SubstrateParticle, energy: EnergyParticle): void {
    const reactionKey = this.getReactionKey(p1.type, p2.type);
    const reaction = this.reactionCatalog.get(reactionKey);

    // If no known reaction for this pair, nothing happens (fixed catalog)
    if (!reaction) return;

    // --- Reaction Execution ---
    if (Math.random() < reaction.efficiency) {
      this.executeReaction(p1, p2, energy, reaction);
    }
  }

  // Random discovery removed in fixed-catalog model

  /**
   * Executes a reaction: consumes energy and reactant, creates two new product particles.
   */
  private executeReaction(p1: SubstrateParticle, p2: SubstrateParticle, energy: EnergyParticle, reaction: Reaction): void {
    energy.active = false; // Consume energy
    this.totalReactions++;
    
    let catalyst: SubstrateParticle, reactant: SubstrateParticle;
    if (p1.type === reaction.catalyst) {
      catalyst = p1;
      reactant = p2;
    } else {
      catalyst = p2;
      reactant = p1;
    }

    // The reactant is consumed in the reaction.
    reactant.active = false;
    
    // Create the two new product particles near the catalyst.
    const createProduct = (productType: ParticleType) => {
      const angle = Math.random() * 2 * Math.PI;
      const distance = this.params.particleRadius * 2 * (1.5 + Math.random() * 2.0); // birth kick scaled by 2r
      const newX = catalyst.x + Math.cos(angle) * distance;
      const newY = catalyst.y + Math.sin(angle) * distance;
      
      const newParticle = new SubstrateParticle(this.nextId, newX, newY, productType, this.params.particleLifespan);
      this.particles.set(this.nextId, newParticle);
      this.nextId++;
      return newParticle;
    };

    const newParticle1 = createProduct(reaction.product1);
    const newParticle2 = createProduct(reaction.product2);
    
    // Boost energy for visualization
    catalyst.energy = Math.min(1, catalyst.energy + 0.5);
    newParticle1.energy = 1.0; 
    newParticle2.energy = 1.0;
  }

  /** Generates a consistent key for a pair of reactant types. */
  private getReactionKey(type1: ParticleType, type2: ParticleType): string {
    // Sort to ensure A+B is the same as B+A
    return type1 < type2 ? `${type1}-${type2}` : `${type2}-${type1}`;
  }

  private cleanupInactiveParticles(): void {
    for (const [id, particle] of this.particles) {
      if (!particle.active) {
        this.particles.delete(id);
      } else {
        particle.energy = Math.max(0, particle.energy - 0.05);
      }
    }
    for (const [id, particle] of this.energyParticles) {
      if (!particle.active) {
        this.energyParticles.delete(id);
      }
    }
  }

  public exportState(): SimulationState {
    const activeParticles = Array.from(this.particles.values()).filter(p => p.active);
    const activeEnergy = Array.from(this.energyParticles.values()).filter(p => p.active);
    const totalParticles = activeParticles.length + activeEnergy.length;

    const positions = new Float32Array(totalParticles * 2);
    const types = new Uint8Array(totalParticles);
    const energies = new Float32Array(totalParticles);

    let i = 0;
    for (const p of activeParticles) {
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = p.y;
      types[i] = p.type;
      energies[i] = p.energy;
      i++;
    }
    for (const p of activeEnergy) {
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = p.y;
      types[i] = ParticleType.Energy;
      energies[i] = 1.0;
      i++;
    }

    // Count particles of each type for stats
    const counts = activeParticles.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<ParticleType, number>);

    return {
      positions,
      types,
      energies,
      stats: {
        frameCount: this.frameCount,
        particleCountA: counts[ParticleType.A] || 0,
        particleCountB: counts[ParticleType.B] || 0,
        particleCountC: counts[ParticleType.C] || 0,
        particleCountD: counts[ParticleType.D] || 0,
        particleCountBinder: counts[ParticleType.Binder] || 0,
        energyParticleCount: activeEnergy.length,
        totalReactions: this.totalReactions,
        discoveredReactions: this.reactionCatalog.size,
      },
    };
  }

  public updateParams(newParams: Partial<SimulationParams>): void {
    this.params = { ...this.params, ...newParams };
    if (newParams.Lx) this.Lx = newParams.Lx;
    if (newParams.Ly) this.Ly = newParams.Ly;
  }

  public reset(): void {
    this.initialize();
  }
}
