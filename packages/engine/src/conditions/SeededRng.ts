export class SeededRng {
  constructor(private seed: string) {}

  next(key: string): number {
    const input = this.seed + key;
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h = Math.imul(h ^ input.charCodeAt(i), 16777619);
    }
    h = h >>> 0;
    return h / 4294967296.0;
  }
}
