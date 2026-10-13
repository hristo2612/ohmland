// Sparse LU for circuit matrices. Devices stamp into a dense row-major matrix `a` (simple and fast for the small
// circuits of the labs); factor() gathers the structurally non-zero entries into a compact array and eliminates
// there with precomputed index lists, so `a` is never overwritten and only needs partial refills between Newton
// iterations. A dense factorisation with partial pivoting chooses the row order once; later factorisations reuse
// that order and its fill pattern until a reused pivot becomes too small relative to its column (then the order is
// chosen again). This is the idea behind KLU's refactor. All buffers are allocated up front: no garbage.

/** A reused pivot is rejected when an entry below it is more than 1 / PIVOT_TOL times bigger. */
const PIVOT_TOL = 1e-3;

export class SparseLU {
  readonly n: number;
  /** Assembly matrix, row-major n x n. Callers fill it, then call factor(). factor() does not modify it. */
  readonly a: Float64Array;
  /** Structural pattern (n x n, 1 where an entry can ever be non-zero). */
  private readonly mask: Uint8Array;
  /** Physical row at each pivot position. */
  private readonly perm: Int32Array;
  private havePattern = false;

  // Compact factors, CSR by pivot row (columns are unknowns: only rows are permuted).
  private rowStart = new Int32Array(1);
  private col = new Int32Array(1);
  private diag = new Int32Array(1);
  private v = new Float64Array(1);
  /** Index into `a` for each compact entry (fill-in entries point at a's trailing zero). */
  private src = new Int32Array(1);
  // Elimination program, row by row: for each multiplier, its compact position, its pivot row and a range of
  // updates (target and source positions).
  private rowMul = new Int32Array(1);
  private mulPos = new Int32Array(1);
  private mulRow = new Int32Array(1);
  private mulStart = new Int32Array(1);
  private updTgt = new Int32Array(1);
  private updSrc = new Int32Array(1);

  private readonly y: Float64Array;
  /** 1 / pivot for each pivot row. */
  private readonly inv: Float64Array;
  private readonly work: Float64Array;
  private readonly ro: Int32Array;
  /** Pivot searches (full factorisations) so far, for diagnostics. */
  pivotSearches = 0;

  constructor(n: number, mask?: Uint8Array) {
    this.n = n;
    const nn = n * n;
    // One extra trailing element that is always 0: fill-in entries gather from it.
    this.a = new Float64Array(nn + 1);
    this.mask = new Uint8Array(Math.max(1, nn));
    if (mask) this.mask.set(mask.subarray(0, nn));
    else this.mask.fill(1);
    for (let i = 0; i < n; i++) this.mask[i * n + i] = 1;
    this.perm = new Int32Array(Math.max(1, n));
    this.y = new Float64Array(Math.max(1, n));
    this.inv = new Float64Array(Math.max(1, n));
    this.work = new Float64Array(Math.max(1, nn));
    this.ro = new Int32Array(Math.max(1, n));
  }

  /** Factorises the matrix in `a` (left unchanged). Returns false only if it is numerically singular. */
  factor(): boolean {
    if (this.havePattern && this.refactor(false)) return true;
    const ok = this.pivotSearch();
    this.buildPattern();
    // With the order just chosen every multiplier is at most 1, unless the matrix is singular: then zero pivots
    // become tiny ones so the caller still gets a finite (if meaningless) answer.
    this.refactor(!ok);
    if (!ok) this.havePattern = false;
    return ok;
  }

  /** Forgets the row order, so the next factor() searches for pivots again. */
  invalidate(): void {
    this.havePattern = false;
  }

  /** Gathers `a` into the compact array and eliminates with the stored program. False if a pivot is too small. */
  private refactor(force: boolean): boolean {
    const a = this.a;
    const v = this.v;
    const src = this.src;
    const nnz = v.length;
    for (let p = 0; p < nnz; p++) v[p] = a[src[p]!]!;
    const n = this.n;
    const rowMul = this.rowMul;
    const mulPos = this.mulPos;
    const mulRow = this.mulRow;
    const mulStart = this.mulStart;
    const updTgt = this.updTgt;
    const updSrc = this.updSrc;
    const inv = this.inv;
    const diag = this.diag;
    const lim = 1 / PIVOT_TOL;
    for (let i = 0; i < n; i++) {
      const m1 = rowMul[i + 1]!;
      for (let m = rowMul[i]!; m < m1; m++) {
        const pv = v[mulPos[m]!]!;
        if (pv === 0) continue;
        const l = pv * inv[mulRow[m]!]!;
        if (!(l <= lim && l >= -lim) && !force) return false;
        v[mulPos[m]!] = l;
        const e = mulStart[m + 1]!;
        for (let q = mulStart[m]!; q < e; q++) v[updTgt[q]!]! -= l * v[updSrc[q]!]!;
      }
      let d = v[diag[i]!]!;
      if (d === 0) {
        // Only an exact zero is rejected here; small pivots show up as large multipliers in later rows.
        if (!force) return false;
        d = v[diag[i]!] = 1e-300;
      }
      inv[i] = 1 / d;
    }
    return true;
  }

  /** Dense elimination with partial pivoting on a copy of `a`, to choose the row order. */
  private pivotSearch(): boolean {
    this.pivotSearches++;
    const n = this.n;
    const w = this.work;
    w.set(this.a.subarray(0, n * n));
    const ro = this.ro;
    for (let i = 0; i < n; i++) ro[i] = i * n;
    let ok = true;
    for (let k = 0; k < n; k++) {
      let p = k;
      let best = Math.abs(w[ro[k]! + k]!);
      for (let i = k + 1; i < n; i++) {
        const x = Math.abs(w[ro[i]! + k]!);
        if (x > best) {
          best = x;
          p = i;
        }
      }
      if (p !== k) {
        const t = ro[k]!;
        ro[k] = ro[p]!;
        ro[p] = t;
      }
      const rk = ro[k]!;
      if (best < 1e-300) {
        ok = false;
        continue;
      }
      const inv = 1 / w[rk + k]!;
      for (let i = k + 1; i < n; i++) {
        const ri = ro[i]!;
        const x = w[ri + k]!;
        if (x === 0) continue;
        const l = x * inv;
        for (let j = k + 1; j < n; j++) {
          const u = w[rk + j]!;
          if (u !== 0) w[ri + j]! -= l * u;
        }
      }
    }
    for (let i = 0; i < n; i++) this.perm[i] = ro[i]! / n;
    return ok;
  }

  /** Symbolic factorisation for the current row order: compact layout, fill-in and the elimination program. */
  private buildPattern(): void {
    const n = this.n;
    const perm = this.perm;
    // Row patterns with fill, in pivot order (up-looking: row i picks up row k's upper part for each k < i in it).
    const rows: number[][] = [];
    const mark = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      mark.fill(0);
      const base = perm[i]! * n;
      for (let j = 0; j < n; j++) if (this.mask[base + j]) mark[j] = 1;
      mark[i] = 1;
      for (let k = 0; k < i; k++) {
        if (!mark[k]) continue;
        for (const j of rows[k]!) if (j > k) mark[j] = 1;
      }
      const r: number[] = [];
      for (let j = 0; j < n; j++) if (mark[j]) r.push(j);
      rows.push(r);
    }
    let nnz = 0;
    for (const r of rows) nnz += r.length;
    this.rowStart = new Int32Array(n + 1);
    this.col = new Int32Array(Math.max(1, nnz));
    this.diag = new Int32Array(Math.max(1, n));
    this.v = new Float64Array(nnz);
    this.src = new Int32Array(Math.max(1, nnz));
    const zero = n * n;
    let p = 0;
    const posOf: Int32Array[] = [];
    for (let i = 0; i < n; i++) {
      this.rowStart[i] = p;
      const m = new Int32Array(n).fill(-1);
      const base = perm[i]! * n;
      for (const j of rows[i]!) {
        this.col[p] = j;
        this.src[p] = this.mask[base + j] ? base + j : zero;
        if (j === i) this.diag[i] = p;
        m[j] = p++;
      }
      posOf.push(m);
    }
    this.rowStart[n] = p;
    const rowMul = new Int32Array(n + 1);
    const mulPos: number[] = [];
    const mulRow: number[] = [];
    const mulStart: number[] = [];
    const tgt: number[] = [];
    const srcU: number[] = [];
    for (let i = 0; i < n; i++) {
      rowMul[i] = mulPos.length;
      const m = posOf[i]!;
      for (const k of rows[i]!) {
        if (k >= i) break;
        mulPos.push(m[k]!);
        mulRow.push(k);
        mulStart.push(tgt.length);
        const mk = posOf[k]!;
        for (const j of rows[k]!) {
          if (j <= k) continue;
          tgt.push(m[j]!);
          srcU.push(mk[j]!);
        }
      }
    }
    mulStart.push(tgt.length);
    rowMul[n] = mulPos.length;
    this.rowMul = rowMul;
    this.mulPos = Int32Array.from(mulPos);
    this.mulRow = Int32Array.from(mulRow);
    this.mulStart = Int32Array.from(mulStart);
    this.updTgt = Int32Array.from(tgt);
    this.updSrc = Int32Array.from(srcU);
    this.havePattern = true;
  }

  /** Solves A x = b with the stored factors. b is not modified. */
  solve(b: Float64Array, x: Float64Array): void {
    const n = this.n;
    const y = this.y;
    const perm = this.perm;
    const rs = this.rowStart;
    const col = this.col;
    const v = this.v;
    const diag = this.diag;
    const inv = this.inv;
    for (let i = 0; i < n; i++) {
      let s = b[perm[i]!]!;
      const d = diag[i]!;
      for (let p = rs[i]!; p < d; p++) s -= v[p]! * y[col[p]!]!;
      y[i] = s;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i]!;
      const d = diag[i]!;
      const e = rs[i + 1]!;
      for (let p = d + 1; p < e; p++) s -= v[p]! * x[col[p]!]!;
      x[i] = s * inv[i]!;
    }
  }
}
