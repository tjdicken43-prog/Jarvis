// Tradesheet math. Plain functions, no DOM, so node tests them and the pages use the same code.
(function (root) {
  "use strict";

  const round = (n, d = 0) => { const k = Math.pow(10, d); return Math.round(n * k) / k; };
  const ceil = (n) => Math.ceil(round(n, 6));   // 27.500000000000004 must not become 28

  // Exact: a roof rising p inches per 12 inches of run is longer than its footprint by sqrt(1 + (p/12)^2).
  function pitchFactor(rise) {
    return Math.sqrt(1 + Math.pow(rise / 12, 2));
  }

  const WASTE = { simple: 0.10, moderate: 0.15, cut_up: 0.20 };

  // Roof materials for a gable or hip roof. Coverage per bundle/roll is an input because it differs by product:
  // the defaults are common values and the page tells people to check their wrapper.
  function roofing(i) {
    const footprint = i.area_mode === "roof" ? null : i.length * i.width;
    const roofArea = i.area_mode === "roof" ? i.roof_area : footprint * pitchFactor(i.pitch) * (i.planes_factor || 1);
    if (!(roofArea > 0)) throw new Error("Roof area must be more than zero.");
    const waste = WASTE[i.complexity];
    if (waste === undefined) throw new Error("Pick how cut-up the roof is.");
    const squares = roofArea / 100;
    const squaresWithWaste = squares * (1 + waste);
    const bundlesPerSq = i.bundles_per_square || 3;
    const eave = i.eave_rake_lf !== undefined && i.eave_rake_lf !== null ? i.eave_rake_lf
      : (i.area_mode === "roof" ? 0 : 2 * (i.length + i.width));
    const ridge = i.ridge_hip_lf !== undefined && i.ridge_hip_lf !== null ? i.ridge_hip_lf
      : (i.area_mode === "roof" ? 0 : Math.max(i.length, i.width));
    const out = {
      roof_area_sqft: round(roofArea),
      squares: round(squares, 1),
      squares_with_waste: round(squaresWithWaste, 1),
      waste_pct: round(waste * 100),
      shingle_bundles: ceil(squaresWithWaste * bundlesPerSq),
      underlayment_rolls: ceil(squares / (i.underlayment_squares_per_roll || 10)),
      starter_bundles: eave > 0 ? ceil(eave / (i.starter_lf_per_bundle || 105)) : 0,
      ridge_cap_bundles: ridge > 0 ? ceil(ridge / (i.ridge_lf_per_bundle || 30)) : 0,
      drip_edge_pieces: eave > 0 ? ceil(eave / 10) : 0,   // 10 ft pieces
      eave_rake_lf: round(eave),
      ridge_hip_lf: round(ridge),
      pitch_factor: i.area_mode === "roof" ? null : round(pitchFactor(i.pitch), 4),
    };
    return out;
  }

  const NOMINAL_TONS = [1.5, 2, 2.5, 3, 3.5, 4, 5];
  const INSUL = { poor: 1.15, average: 1.0, good: 0.88 };
  const WINDOWS = { few: 0.95, average: 1.0, many: 1.10 };
  const SUN = { shaded: 0.95, mixed: 1.0, sunny: 1.08 };

  // A rough cooling-load check. NOT Manual J. A base of 25 BTU per square foot for a mixed-humid climate,
  // scaled by the factors above, then a range of plus or minus 12 percent.
  function hvac(i) {
    if (!(i.sqft >= 400 && i.sqft <= 8000)) throw new Error("Square feet should be between 400 and 8,000.");
    const ceil = i.ceiling_ft || 8;
    if (!(ceil >= 7 && ceil <= 20)) throw new Error("Ceiling height should be between 7 and 20 ft.");
    const f = INSUL[i.insulation] * WINDOWS[i.windows] * SUN[i.sun];
    if (!f) throw new Error("Answer every question.");
    const people = Math.max(0, (i.people === undefined ? 2 : i.people) - 2);
    const mid = i.sqft * 25 * (ceil / 8) * f + people * 400;
    const lo = mid * 0.88, hi = mid * 1.12;
    const tons = (btu) => btu / 12000;
    const snap = (t) => NOMINAL_TONS.reduce((best, n) => (Math.abs(n - t) < Math.abs(best - t) ? n : best));  // nearest size, tie goes smaller
    return {
      btu_mid: round(mid, -2), btu_low: round(lo, -2), btu_high: round(hi, -2),
      tons_low: round(tons(lo), 2), tons_high: round(tons(hi), 2), tons_mid: round(tons(mid), 2),
      nominal_tons: snap(tons(mid)),
      sqft_per_ton: round(i.sqft / tons(mid)),
      over_max: tons(mid) > NOMINAL_TONS[NOMINAL_TONS.length - 1],
    };
  }

  // Estimate: lines of {desc, qty, unit, taxable}. Markup is on materials only. Tax applies to lines marked taxable.
  function estimate(i) {
    const lines = (i.lines || []).filter((l) => l.desc && l.qty > 0);
    if (!lines.length) throw new Error("Add at least one line.");
    const markup = (i.markup_pct || 0) / 100, tax = (i.tax_pct || 0) / 100, dep = (i.deposit_pct || 0) / 100;
    let subtotal = 0, taxable = 0;
    const out = lines.map((l) => {
      const base = l.qty * l.unit;
      const price = l.kind === "material" ? base * (1 + markup) : base;
      subtotal += price;
      if (l.taxable) taxable += price;
      return { desc: l.desc, qty: l.qty, kind: l.kind, total: round(price, 2) };
    });
    const taxAmt = taxable * tax;
    const total = subtotal + taxAmt;
    return {
      lines: out, subtotal: round(subtotal, 2), tax: round(taxAmt, 2), total: round(total, 2),
      deposit: round(total * dep, 2), balance: round(total - total * dep, 2),
    };
  }

  const api = { pitchFactor, roofing, hvac, estimate, WASTE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Tradesheet = api;
})(typeof window !== "undefined" ? window : globalThis);
