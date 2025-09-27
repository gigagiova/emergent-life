import { createNoise3D } from 'simplex-noise';
import type { SimulationParams, SimulationState, ParticleId, Reaction } from './types';
import { ParticleType } from './types';
import { SubstrateParticle, EnergyParticle } from './particles';

declare module './particles' {
    interface SubstrateParticle {
        tempForceX?: number;
        tempForceY?: number;
    }
}

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

  // Noise function for generating the dynamic wind field
  private noise3D: ReturnType<typeof createNoise3D>;

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
    this.noise3D = createNoise3D();
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
   * Updates particle lifespans and applies all physics (diffusion, forces).
   */
  private updateAndMoveParticles(): void {
    // First, update internal state (like lifespan) for all substrate particles
    for (const p of this.particles.values()) {
      if (p.active) p.update();
    }
    // THEN, update the energy particles, which have their own simple movement logic.
    for (const p of this.energyParticles.values()) {
      if (p.active) p.update(this.params, this.Lx, this.Ly);
    }
    
    const activeParticles = Array.from(this.particles.values()).filter(p => p.active);
    
    // Initialize temporary forces for this physics step.
    for (const p of activeParticles) {
        p.tempForceX = 0;
        p.tempForceY = 0;
    }

    // Apply forces and diffusion in a second pass
    for (let i = 0; i < activeParticles.length; i++) {
        const p1 = activeParticles[i];

        // --- Start of Physics Calculations ---
        let totalForceX = 0;
        let totalForceY = 0;

        // 1. Brownian motion (random jiggle)
        const diffusionStep = Math.sqrt(2 * this.params.diffusionCoefficient * this.params.timeStep);
        totalForceX += diffusionStep * (Math.random() - 0.5) * 2;
        totalForceY += diffusionStep * (Math.random() - 0.5) * 2;

        // 2. Dynamic, Swirling Wind (based on Perlin/Simplex noise)
        const noiseScale = 0.005; // How "zoomed in" the wind pattern is
        const timeScale = 0.001; // How fast the wind pattern changes
        const windAngle = this.noise3D(p1.x * noiseScale, p1.y * noiseScale, this.frameCount * timeScale) * Math.PI * 2;
        
        // Calculate local binder density for sheltering effect
        let binderCount = 0;
        for (const p2 of activeParticles) {
            if (p1.id !== p2.id && p2.type === ParticleType.Binder) {
                if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < this.params.windShelterRadius) {
                    binderCount++;
                }
            }
        }
        
        // Wind force is inversely proportional to local binder density.
        // A dense membrane provides significant shelter.
        const shelterFactor = 1 / (1 + binderCount);
        const windForce = this.params.primordialWindStrength * shelterFactor;
        
        totalForceX += Math.cos(windAngle) * windForce;
        totalForceY += Math.sin(windAngle) * windForce;


        // 3. Inter-particle forces (attraction/repulsion)
        for (let j = i + 1; j < activeParticles.length; j++) {
            const p2 = activeParticles[j];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 0 && dist < this.params.reactionRadius * 2) {
                const force = this.calculateForce(p1, p2, dist);
                const forceComponent = force * this.params.timeStep;
                
                // We'll apply this force component to p1 now, and subtract it from p2 later
                // to avoid calculating the force twice.
                totalForceX += (dx / dist) * forceComponent;
                totalForceY += (dy / dist) * forceComponent;
                
                // Store the force to apply to p2 (Newton's 3rd law)
                p2.tempForceX = (p2.tempForceX || 0) - (dx / dist) * forceComponent;
                p2.tempForceY = (p2.tempForceY || 0) - (dy / dist) * forceComponent;
            }
        }
        
        // Add forces accumulated from previous particles
        totalForceX += p1.tempForceX || 0;
        totalForceY += p1.tempForceY || 0;

        // --- Apply all calculated forces to move the particle ---
        p1.x += totalForceX;
        p1.y += totalForceY;
        
        // Apply periodic boundary conditions for Y axis
        if (p1.y < 0) p1.y += this.Ly;
        if (p1.y > this.Ly) p1.y -= this.Ly;
    }
  }

  /**
   * Calculates the force between two particles based on the new rules.
   */
  private calculateForce(p1: SubstrateParticle, p2: SubstrateParticle, dist: number): number {
      // Rule 1: If either particle is a Binder, they attract all other substrates.
      if (p1.type === ParticleType.Binder || p2.type === ParticleType.Binder) {
          return this.params.binderAttractionForce;
      }
      
      // Rule 2: Otherwise, all other substrate particles repel each other.
      // The force is stronger at closer distances (inverse relationship).
      return -this.params.substrateRepulsionForce / (dist + 1e-6);
  }

  /**
   * Spawns a constant number of new energy particles from the left edge on each step.
   */
  private handleEnergyInflow(): void {
    // Spawn 'energyInflowRate' new particles each step to create a constant stream.
    for (let i = 0; i < this.params.energyInflowRate; i++) {
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

        if (dist < this.params.reactionRadius) {
          // Find a nearby energy particle to power the reaction
          for (const energy of activeEnergy) {
            if (!energy.active) continue;

            const distE = Math.hypot(p1.x - energy.x, p1.y - energy.y);
            if (distE < this.params.reactionRadius) {
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
   * Given two substrate particles and an energy particle, attempt to either
   * perform a known reaction or discover a new one.
   */
  private attemptReaction(p1: SubstrateParticle, p2: SubstrateParticle, energy: EnergyParticle): void {
    const reactionKey = this.getReactionKey(p1.type, p2.type);
    let reaction = this.reactionCatalog.get(reactionKey);

    // --- Reaction Discovery ---
    if (!reaction) {
      if (Math.random() < this.params.reactionDiscoveryProbability) {
        reaction = this.discoverNewReaction(p1.type, p2.type);
        this.reactionCatalog.set(reactionKey, reaction);
      } else {
        // No reaction known, and discovery failed.
        return;
      }
    }

    // --- Reaction Execution ---
    if (Math.random() < reaction.efficiency) {
      this.executeReaction(p1, p2, energy, reaction);
    }
  }

  /**
   * Creates a new, random reaction and returns it.
   */
  private discoverNewReaction(type1: ParticleType, type2: ParticleType): Reaction {
    const substrateTypes = [ParticleType.A, ParticleType.B, ParticleType.C, ParticleType.D, ParticleType.Binder];
    
    // The product can be any two substrate types.
    const product1 = substrateTypes[Math.floor(Math.random() * substrateTypes.length)];
    const product2 = substrateTypes[Math.floor(Math.random() * substrateTypes.length)];

    return {
      reactant1: type1,
      reactant2: type2,
      // The catalyst must be one of the reactants.
      catalyst: Math.random() < 0.5 ? type1 : type2,
      product1,
      product2,
      // Efficiency is randomly assigned upon discovery.
      efficiency: Math.random() * 0.5 + 0.1, // Efficiency between 10% and 60%
    };
  }

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
      const distance = this.params.particleDiameter * (1.5 + Math.random() * 2.0); // "Birth kick"
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
