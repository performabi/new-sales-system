export function getSizingName(unit_type: string, units_per_pack: number, packs_per_case: number): string {
  return `${packs_per_case} × ${units_per_pack} ${unit_type}`;
}

export function calculateCaseTotal(packs_per_case: number, units_per_pack: number): number {
  return packs_per_case * units_per_pack;
}
