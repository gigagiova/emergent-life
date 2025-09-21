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

    // Create initial particles for each type based on params
    this.createInitialParticles(ParticleType.A, this.params.particleCountA);
    this.createInitialParticles(ParticleType.B, this.params.particleCountB);
    this.createInitialParticles(ParticleType.C, this.params.particleCountC);
    this.createInitialParticles(ParticleType.D, this.params.particleCountD);
    this.createInitialParticles(ParticleType.E, this.params.particleCountE);

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
      const x = Math.random() * this.Lx;
      const y = Math.random() * this.Ly;
      this.particles.set(this.nextId, new SubstrateParticle(this.nextId, x, y, type));
      this.nextId++;
    }
  }

  public step(): void {
    this.frameCount++;

    this.updateParticles();
    this.handleEnergyInflow();
    this.processReactionsAndDiscovery();
    this.cleanupInactiveParticles();
  }

  private updateParticles(): void {
    for (const particle of this.particles.values()) {
      if (particle.active) particle.update(this.params, this.Lx, this.Ly);
    }
    for (const particle of this.energyParticles.values()) {
      if (particle.active) particle.update(this.params, this.Lx, this.Ly);
    }
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
    const substrateTypes = [ParticleType.A, ParticleType.B, ParticleType.C, ParticleType.D, ParticleType.E];
    
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
      const distance = this.params.particleDiameter * (1 + Math.random());
      const newX = catalyst.x + Math.cos(angle) * distance;
      const newY = catalyst.y + Math.sin(angle) * distance;
      
      const newParticle = new SubstrateParticle(this.nextId, newX, newY, productType);
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
        particleCountE: counts[ParticleType.E] || 0,
        energyParticleCount: activeEnergy.length,
        totalReactions: this.totalReactions,
        discoveredReactions: this.reactionCatalog.size,
        reactionRateA: 0, // These specific rates are no longer tracked
        reactionRateB: 0,
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
