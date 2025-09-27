import type { ParticleId } from './types';
import { ParticleType } from './types';

/**
 * Base particle class with common properties
 */
abstract class Particle {
  public id: ParticleId;
  public x: number;
  public y: number;
  public active: boolean = true;

  constructor(id: ParticleId, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }

  // Base particle has no intrinsic per-tick behavior in this model
}

/**
 * A generic particle class for the substrate/product types (A, B, C, D, E).
 * Their specific behavior is determined by the reaction catalog in the main simulation.
 */
export class SubstrateParticle extends Particle {
  public energy: number = 0; // Internal energy for visualization
  public type: ParticleType;
  public birthFrame: number; // Frame at which the particle was created

  constructor(id: ParticleId, x: number, y: number, type: ParticleType, birthFrame: number) {
    super(id, x, y);
    this.type = type;
    this.birthFrame = birthFrame;
  }

  update(currentFrame: number, globalLifespan: number): void {
    // Age-based deactivation: compare current frame to birthFrame
    // Movement is handled by the main simulation loop
    const age = currentFrame - this.birthFrame;
    if (age >= globalLifespan) this.active = false;
  }
}

/**
 * Energy particle - flows from left to right, powers reactions
 */
export class EnergyParticle extends Particle {
  // Movement is handled by the main simulation loop
}