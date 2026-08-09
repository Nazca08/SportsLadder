export type Gender = "male" | "female";
export type Format = "singles" | "doubles";
export type Division = "mens" | "womens" | "mixed";

/** Mixed only exists for doubles; singles is always your own gender's division. */
export function divisionOptions(gender: Gender, format: Format): [Division, string][] {
  if (format === "doubles") {
    return gender === "male"
      ? [["mens", "Men's"], ["mixed", "Mixed"]]
      : [["womens", "Women's"], ["mixed", "Mixed"]];
  }
  return gender === "male" ? [["mens", "Men's"]] : [["womens", "Women's"]];
}

export const SPORTS = ["tennis", "pickleball"] as const;
export const LEVELS = ["3.0", "3.5", "4.0", "4.5"] as const;
