/**
 * FSC (Federal Supply Class) code → human-readable name.
 *
 * Covers the DLA medical + related classes Abe + the team actually bid
 * against. Fallback to `FSC {code}` when not in the map. Source: DLA
 * FSC structure plus the active-category list curated at
 * /settings/fsc-codes (hardcoded list there duplicated — move both to
 * this one module for a single source of truth).
 */

export const FSC_NAMES: Record<string, string> = {
  // Medical cluster — DLA DTW Troop Support Medical (our bread + butter)
  "6505": "Drugs & Biologicals",
  "6508": "Medicated Cosmetics & Toiletries",
  "6510": "Surgical Dressing Materials",
  "6515": "Medical & Surgical Instruments",
  "6520": "Dental Instruments & Supplies",
  "6525": "Medical X-Ray Equipment",
  "6530": "Hospital Furniture & Equipment",
  "6532": "Hospital & Surgical Clothing",
  "6540": "Ophthalmic Instruments & Equipment",
  "6545": "Medical Sets, Kits & Outfits",
  "6550": "In Vitro Diagnostics",
  // Safety / PPE
  "4240": "Safety & Rescue Equipment",
  // Lab + instrument
  "6640": "Laboratory Equipment",
  "6665": "Hazard-Detecting Instruments",
  "6675": "Drafting / Survey / Mapping Instruments",
  "6680": "Liquid & Gas Flow / Liquid Level / Mechanical Motion Measuring Instruments",
  "6685": "Pressure & Temperature Instruments",
  // Power / batteries
  "6135": "Batteries, Nonrechargeable",
  "6140": "Batteries, Rechargeable",
  // Consumables
  "7310": "Food Cooking & Serving Equipment",
  "8520": "Toilet Soap, Shaving Prep",
  // Hardware / fasteners / pipe fittings — occasionally on DLA reqs
  "5305": "Screws",
  "5306": "Bolts",
  "5307": "Studs",
  "5310": "Nuts & Washers",
  "5315": "Nails, Machine Keys & Pins",
  "5320": "Rivets",
  "5325": "Fastening Devices",
  "5330": "Packing & Gasket Materials",
  "5340": "Miscellaneous Hardware",
  "4730": "Hose, Pipe, Tube, Lubrication & Railing Fittings",
  // Electrical / electronic
  "5935": "Connectors, Electrical",
  "5998": "Electrical & Electronic Assemblies & Parts",
  "5999": "Miscellaneous Electrical & Electronic Components",
  "6025": "Fiber Optic Cables",
  "6210": "Indoor/Outdoor Electric Lighting Fixtures",
  "6220": "Electric Vehicular Lights & Fixtures",
  "6230": "Electric Portable & Hand Lighting Equipment",
  // Refrigeration / HVAC
  "4110": "Refrigeration Equipment",
  "4120": "Air Conditioning Equipment",
  // Other common gov
  "6850": "Miscellaneous Chemical Specialties",
  "7025": "ADPE Peripheral Equipment",
  "8415": "Clothing, Special Purpose",
  "8465": "Individual Equipment",
  "8470": "Armor, Personal",
  "1005": "Guns, Through 30mm",
  // Protective gear / medical adjacent
  "8510": "Perfumes / Cosmetics / Toilet Articles",
  "4210": "Fire Fighting Equipment",
  "4220": "Marine Lifesaving & Diving Equipment",
};

export function fscName(code: string | null | undefined): string {
  if (!code) return "Unknown FSC";
  const c = String(code).trim();
  return FSC_NAMES[c] || `FSC ${c}`;
}

export function fscLabel(code: string | null | undefined): string {
  const c = String(code || "").trim();
  if (!c) return "Unknown";
  const name = FSC_NAMES[c];
  return name ? `${c} · ${name}` : c;
}
