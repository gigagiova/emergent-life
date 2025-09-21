import type { ParticleId, SimulationParams } from './types';
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

  /**
   * Update particle position with Brownian motion
   */
  protected brownianStep(params: SimulationParams): void {
    const diffusionStep = Math.sqrt(2 * params.diffusionCoefficient * params.timeStep);
    this.x += diffusionStep * (Math.random() - 0.5) * 2;
    this.y += diffusionStep * (Math.random() - 0.5) * 2;
  }

  abstract update(params: SimulationParams, Lx: number, Ly: number): void;
}

/**
 * A generic particle class for the substrate/product types (A, B, C, D, E).
 * Their specific behavior is determined by the reaction catalog in the main simulation.
 */
export class SubstrateParticle extends Particle {
  public energy: number = 0; // Internal energy for visualization
  public type: ParticleType;

  constructor(id: ParticleId, x: number, y: number, type: ParticleType) {
    super(id, x, y);
    this.type = type;
  }

  update(params: SimulationParams, Lx: number, Ly: number): void {
    // Simple Brownian motion
    this.brownianStep(params);
    
    // Apply periodic boundary conditions in Y
    if (this.y < 0) this.y += Ly;
    if (this.y > Ly) this.y -= Ly;
    
    // Remove particles that drift too far out in X
    if (this.x < -50 || this.x > Lx + 50) {
      this.active = false;
    }
    
    // Spontaneous decay to prevent runaway growth
    if (Math.random() < params.particleDecayRate * params.timeStep) {
      this.active = false;
    }
  }
}

/**
 * Energy particle - flows from left to right, powers reactions
 */
export class EnergyParticle extends Particle {
  update(params: SimulationParams, Lx: number, Ly: number): void {
    // Strong rightward flow with some diffusion
    const diffusionStep = Math.sqrt(2 * params.diffusionCoefficient * params.timeStep);
    this.x += params.energyFlowVelocity * params.timeStep + diffusionStep * (Math.random() - 0.5);
    this.y += diffusionStep * (Math.random() - 0.5) * 2;
    
    // Apply periodic boundary conditions in Y
    if (this.y < 0) this.y += Ly;
    if (this.y > Ly) this.y -= Ly;
    
    // Remove energy particles that exit the right boundary
    if (this.x > Lx) {
      this.active = false;
    }
  }
}