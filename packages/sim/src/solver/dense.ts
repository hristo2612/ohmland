// Dense LU factorisation with partial pivoting on a row-major Float64Array.
// All buffers are allocated once per circuit size, so the hot loop makes no garbage.

export class DenseLU {
  readonly n: number;
  /** Working matrix, row-major. Callers fill it, then call factor(). */
  readonly a: Float64Array;
  private readonly piv: Int32Array;
  private readonly y: Float64Array;
  private readonly cols: Int32Array;
  /** True after a successful factor() until the matrix is refilled by the caller. */
  factored = false;

  constructor(n: number) {
    this.n = n;
    this.a = new Float64Array(Math.max(1, n * n));
    this.piv = new Int32Array(Math.max(1, n));
    this.y = new Float64Array(Math.max(1, n));
    this.cols = new Int32Array(Math.max(1, n));
  }

  /** In-place LU with partial pivoting. Returns false only if the matrix is numerically singular. */
  factor(): boolean {
    const n = this.n;
    const a = this.a;
    const piv = this.piv;
    let ok = true;
    for (let k = 0; k < n; k++) {
      // Pivot search in column k.
      let p = k;
      let best = Math.abs(a[k * n + k]!);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(a[i * n + k]!);
        if (v > best) {
          best = v;
          p = i;
        }
      }
      piv[k] = p;
      if (p !== k) {
        const rk = k * n;
        const rp = p * n;
        for (let j = 0; j < n; j++) {
          const t = a[rk + j]!;
          a[rk + j] = a[rp + j]!;
          a[rp + j] = t;
        }
      }
      let d = a[k * n + k]!;
      if (best < 1e-300) {
        // Singular column: keep going with a tiny pivot so the caller still gets a finite answer.
        ok = false;
        d = 1e-300;
        a[k * n + k] = d;
      }
      const inv = 1 / d;
      const rk = k * n;
      // Circuit matrices are very sparse: only update the columns where the pivot row is non-zero.
      const cols = this.cols;
      let m = 0;
      for (let j = k + 1; j < n; j++) if (a[rk + j] !== 0) cols[m++] = j;
      if (m === 0) {
        for (let i = k + 1; i < n; i++) a[i * n + k]! *= inv;
        continue;
      }
      for (let i = k + 1; i < n; i++) {
        const ri = i * n;
        const v = a[ri + k]!;
        if (v === 0) continue;
        const l = v * inv;
        a[ri + k] = l;
        for (let t = 0; t < m; t++) {
          const j = cols[t]!;
          a[ri + j]! -= l * a[rk + j]!;
        }
      }
    }
    this.factored = true;
    return ok;
  }

  /** Solves A x = b using the stored factors. b is not modified. x may alias nothing else. */
  solve(b: Float64Array, x: Float64Array): void {
    const n = this.n;
    const a = this.a;
    const piv = this.piv;
    const y = this.y;
    for (let i = 0; i < n; i++) y[i] = b[i]!;
    // Apply the row swaps in the order they were made.
    for (let k = 0; k < n; k++) {
      const p = piv[k]!;
      if (p !== k) {
        const t = y[k]!;
        y[k] = y[p]!;
        y[p] = t;
      }
    }
    // Forward substitution (unit lower triangle).
    for (let i = 0; i < n; i++) {
      let s = y[i]!;
      const ri = i * n;
      for (let j = 0; j < i; j++) s -= a[ri + j]! * y[j]!;
      y[i] = s;
    }
    // Back substitution.
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i]!;
      const ri = i * n;
      for (let j = i + 1; j < n; j++) s -= a[ri + j]! * x[j]!;
      x[i] = s / a[ri + i]!;
    }
  }
}
