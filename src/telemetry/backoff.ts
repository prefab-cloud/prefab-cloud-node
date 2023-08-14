export class Backoff {
  private readonly maxDelay: number;
  private readonly multiplier: number;
  private delay: number;

  constructor({
    maxDelay,
    initialDelay = 2,
    multiplier = 2,
  }: {
    maxDelay: number;
    initialDelay?: number;
    multiplier?: number;
  }) {
    this.maxDelay = maxDelay;
    this.multiplier = multiplier;
    this.delay = initialDelay;
  }

  call(): number {
    const delay = this.delay;
    this.delay = Math.min(this.delay * this.multiplier, this.maxDelay);
    return delay;
  }
}
