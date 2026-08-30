export const FIXED_SCALE = 1_000_000;

export type Fixed = number & { readonly __fixed: unique symbol };

export const fixed = {
  zero: 0 as Fixed,
  one: FIXED_SCALE as Fixed,

  fromInt(value: number): Fixed {
    if (!Number.isInteger(value)) throw new Error(`fromInt requires integer, got ${value}`);
    return (value * FIXED_SCALE) as Fixed;
  },

  fromRatio(numerator: number, denominator: number): Fixed {
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
      throw new Error('fromRatio requires integer numerator/denominator and non-zero denominator');
    }
    return Math.trunc((numerator * FIXED_SCALE) / denominator) as Fixed;
  },

  add(a: Fixed, b: Fixed): Fixed {
    return (a + b) as Fixed;
  },

  sub(a: Fixed, b: Fixed): Fixed {
    return (a - b) as Fixed;
  },

  mul(a: Fixed, b: Fixed): Fixed {
    return Math.trunc((a * b) / FIXED_SCALE) as Fixed;
  },

  div(a: Fixed, b: Fixed): Fixed {
    if (b === 0) throw new Error('fixed division by zero');
    return Math.trunc((a * FIXED_SCALE) / b) as Fixed;
  },

  abs(value: Fixed): Fixed {
    return Math.abs(value) as Fixed;
  },

  sign(value: Fixed): -1 | 0 | 1 {
    return value === 0 ? 0 : value > 0 ? 1 : -1;
  },

  toNumber(value: Fixed): number {
    return value / FIXED_SCALE;
  },
};
