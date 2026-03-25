import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding DIBS database...\n");

  // ─── FSC Codes (full list of common ones + our active categories) ─────
  const fscData: { code: string; name: string; description: string; isActive: boolean }[] = [
    { code: "1005", name: "Guns, through 30mm", description: "Small arms and light weapons", isActive: false },
    { code: "1010", name: "Guns, over 30mm up to 75mm", description: "Medium caliber weapons", isActive: false },
    { code: "1240", name: "Optical Sighting & Ranging Equipment", description: "Scopes, rangefinders", isActive: false },
    { code: "1367", name: "Tactical Vehicles", description: "Military tactical vehicles", isActive: false },
    { code: "4110", name: "Refrigeration Equipment", description: "Refrigerators, freezers, ice machines", isActive: true },
    { code: "4240", name: "Safety & Rescue Equipment", description: "PPE, safety glasses, hard hats, rescue gear", isActive: true },
    { code: "4510", name: "Plumbing Fixtures & Accessories", description: "Faucets, valves, fittings", isActive: true },
    { code: "4610", name: "Water Purification Equipment", description: "Water filters, purification systems", isActive: true },
    { code: "5120", name: "Hand Tools, Non-edged", description: "Wrenches, pliers, screwdrivers", isActive: true },
    { code: "5130", name: "Hand Tools, Edged", description: "Knives, scissors, cutting tools", isActive: true },
    { code: "5305", name: "Screws", description: "Machine screws, wood screws, self-tapping", isActive: true },
    { code: "5306", name: "Bolts", description: "Hex bolts, carriage bolts, anchor bolts", isActive: true },
    { code: "5310", name: "Nuts & Washers", description: "Hex nuts, lock nuts, flat washers", isActive: true },
    { code: "5330", name: "Packing & Gasket Materials", description: "O-rings, gaskets, seals", isActive: true },
    { code: "6135", name: "Batteries, Nonrechargeable", description: "Disposable batteries", isActive: true },
    { code: "6140", name: "Batteries, Rechargeable", description: "Rechargeable batteries", isActive: true },
    { code: "6210", name: "Indoor & Outdoor Electric Lighting", description: "Light bulbs, fixtures", isActive: true },
    { code: "6505", name: "Drugs & Biologicals", description: "Pharmaceuticals, biologicals, reagents", isActive: true },
    { code: "6508", name: "Medicated Cosmetics & Toiletries", description: "Medicated personal care products", isActive: true },
    { code: "6510", name: "Surgical Dressing Materials", description: "Bandages, gauze, tape, wound care", isActive: true },
    { code: "6515", name: "Medical & Surgical Instruments", description: "Syringes, scalpels, forceps, surgical tools", isActive: true },
    { code: "6520", name: "Dental Instruments & Supplies", description: "Dental tools, materials, equipment", isActive: true },
    { code: "6525", name: "Imaging Equipment & Supplies", description: "X-ray, imaging equipment", isActive: true },
    { code: "6530", name: "Hospital Furniture & Equipment", description: "Beds, carts, splints, hospital fixtures", isActive: true },
    { code: "6532", name: "Hospital & Surgical Clothing", description: "Gowns, gloves, masks, protective apparel", isActive: true },
    { code: "6540", name: "Ophthalmic Instruments & Supplies", description: "Eye care instruments and supplies", isActive: true },
    { code: "6545", name: "Medical Sets, Kits & Outfits", description: "First aid kits, medical field kits", isActive: true },
    { code: "6550", name: "In Vitro Diagnostics", description: "Reagents, test kits, diagnostic supplies", isActive: true },
    { code: "6605", name: "Navigational Instruments", description: "Compasses, navigational tools", isActive: true },
    { code: "6640", name: "Laboratory Equipment & Supplies", description: "Lab equipment, glassware, consumables", isActive: true },
    { code: "6685", name: "Pressure & Temperature Instruments", description: "Gauges, thermometers, sensors", isActive: true },
    { code: "6810", name: "Chemicals", description: "Industrial and laboratory chemicals", isActive: true },
    { code: "7310", name: "Food Cooking & Serving Equipment", description: "Culinary equipment, kitchen items", isActive: true },
    { code: "7510", name: "Office Supplies", description: "Paper, pens, general office supplies", isActive: true },
    { code: "7920", name: "Brooms, Brushes, Mops & Sponges", description: "Cleaning tools", isActive: true },
    { code: "7930", name: "Cleaning & Polishing Compounds", description: "Soaps, detergents, cleaning solutions", isActive: true },
    { code: "8105", name: "Bags & Sacks", description: "Commercial bags, sacks, pouches", isActive: true },
    { code: "8520", name: "Toilet Soap, Shaving Prep", description: "Personal hygiene products, sunscreen", isActive: true },
    { code: "8540", name: "Toiletry Paper Products", description: "Tissue, paper towels, toilet paper", isActive: true },
  ];

  const fscCodes: Record<string, { id: string }> = {};
  for (const fsc of fscData) {
    const created = await prisma.fscCode.upsert({
      where: { code: fsc.code },
      update: { isActive: fsc.isActive },
      create: fsc,
    });
    fscCodes[fsc.code] = created;
  }
  const activeCount = fscData.filter(f => f.isActive).length;
  console.log(`  ${fscData.length} FSC codes (${activeCount} active)`);

  // ─── Vendors (our suppliers) ──────────────────────────────
  const vendorData = [
    { id: "v-mcmaster", name: "McMaster-Carr", website: "mcmaster.com", sellsDirectToGov: false, pricingType: "LIST" as const, notes: "Everyone pays same price. No discounts ever. 15-20% markup standard." },
    { id: "v-grainger", name: "Grainger", website: "grainger.com", sellsDirectToGov: false, pricingType: "LIST" as const },
    { id: "v-medline", name: "Medline Industries", cageCode: "3J4K5", website: "medline.com", sellsDirectToGov: true, pricingType: "NEGOTIATED" as const, contactName: "John Smith", email: "gov@medline.com" },
    { id: "v-cardinal", name: "Cardinal Health", cageCode: "7L8M9", website: "cardinalhealth.com", sellsDirectToGov: true, pricingType: "CONTRACT" as const, notes: "Prime contractor for government medical" },
    { id: "v-mckesson", name: "McKesson Medical", cageCode: "1N2O3", website: "mckesson.com", sellsDirectToGov: true, pricingType: "CONTRACT" as const, notes: "Prime contractor" },
    { id: "v-nar", name: "North American Rescue", cageCode: "5R6S7", website: "narescue.com", sellsDirectToGov: true, pricingType: "NEGOTIATED" as const, notes: "Sells direct but misses quotes. We bid anyway." },
    { id: "v-united", name: "United Spirit", cageCode: "8T9U0", sellsDirectToGov: true, pricingType: "NEGOTIATED" as const, notes: "Warrior sunscreen. Buy by the skid." },
    { id: "v-laerdal", name: "Laerdal Medical", cageCode: "2V3W4", website: "laerdal.com", sellsDirectToGov: true, pricingType: "NEGOTIATED" as const, notes: "Ambu collars, CPR training" },
    { id: "v-vwr", name: "VWR International (Avantor)", cageCode: "6P7Q8", website: "vwr.com", sellsDirectToGov: true, pricingType: "LIST" as const, notes: "Biggest lab distributor. Aggressive gov pricing." },
    { id: "v-armstrong", name: "Armstrong Medical", cageCode: "9X0Y1", website: "armstrongmedical.com", sellsDirectToGov: true, pricingType: "NEGOTIATED" as const, notes: "Sells direct only. Blocked us." },
    { id: "v-3m", name: "3M Health Care", cageCode: "4P5Q6", website: "3m.com", sellsDirectToGov: true, pricingType: "NEGOTIATED" as const },
    { id: "v-kinray", name: "Kinray (Cardinal)", sellsDirectToGov: false, pricingType: "NEGOTIATED" as const, notes: "Pharma distributor" },
    { id: "v-avanti", name: "Avanti Products", sellsDirectToGov: false, pricingType: "CONTRACT" as const, notes: "Refrigerators/freezers. Buy 100-200 direct." },
    { id: "v-airgas", name: "Airgas", website: "airgas.com", sellsDirectToGov: false, pricingType: "LIST" as const, notes: "Earplugs, safety equipment" },
    { id: "v-traeger", name: "Traeger/Drager Medical", sellsDirectToGov: false, pricingType: "NEGOTIATED" as const, notes: "Gas detection equipment" },
  ];

  for (const v of vendorData) {
    const { id, ...rest } = v;
    await prisma.vendor.upsert({
      where: { id },
      update: {},
      create: { id, ...rest } as any,
    });
  }
  console.log(`  ${vendorData.length} vendors`);

  // ─── Competitors ──────────────────────────────────────────
  const competitorData = [
    { cageCode: "0AG09", name: "ERG Supply (Us)", estimatedVolume: "953 awards/15 days", notes: "Our cage code" },
    { cageCode: "6P7Q8", name: "VWR International", estimatedVolume: "High volume lab", notes: "Aggressive on lab items. Hard to compete." },
    { cageCode: "ADS01", name: "Atlantic Diving Supply", estimatedVolume: "2719 awards/15 days", notes: "$1B/year with gov. Does everything." },
    { cageCode: "MLT01", name: "Melton Sales", estimatedVolume: "54 awards/15 days", notes: "Small. Yanmar diesel parts." },
    { cageCode: "MDS01", name: "Midland Scientific", notes: "Lab supplies. Sometimes undercuts aggressively." },
    { cageCode: "5R6S7", name: "North American Rescue", estimatedVolume: "Sells direct", notes: "Manufacturer. Prices at $9.98-$20.98." },
    { cageCode: "8T9U0", name: "United Spirit", estimatedVolume: "Sells direct", notes: "Manufacturer. Warrior sunscreen at ~$300." },
  ];

  for (const c of competitorData) {
    await prisma.competitor.upsert({
      where: { cageCode: c.cageCode },
      update: {},
      create: c,
    });
  }
  console.log(`  ${competitorData.length} competitors`);

  // ─── NSNs (items from Abe's live demo) ────────────────────
  const nsnData = [
    { nsnCode: "6515-01-234-5678", description: "Applicator, Silver Nitrate, 100/vial", fsc: "6515", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "6640-01-345-6789", description: "Spoon, Measuring, Plastic, Laboratory", fsc: "6640", isMedical: false, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "6510-01-456-7890", description: "Ointment, First Aid, 1oz Tube", fsc: "6510", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "12" },
    { nsnCode: "6515-01-567-8901", description: "Chest Seal, Hyfin, Eschmann", fsc: "6515", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "4240-01-678-9012", description: "Earplug, Foam, Disposable, NRR 32dB", fsc: "4240", isMedical: false, fobTerms: "DESTINATION" as const, typicalQup: "100" },
    { nsnCode: "6515-01-789-0123", description: "Bag, Oxygen, Portable, with Mask", fsc: "6515", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "5305-01-890-1234", description: "Screw, Machine, Hex Head, SS, 1/4-20x1", fsc: "5305", isMedical: false, fobTerms: "ORIGIN" as const, typicalQup: "1" },
    { nsnCode: "6545-01-901-2345", description: "Collar, Cervical, Ambu Perfit ACE, Adult", fsc: "6545", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "6515-01-012-3456", description: "Forcep, Dressing, Serrated, 5.5in", fsc: "6515", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "6510-01-123-4567", description: "Bandage, Elastic, 4in x 5yd", fsc: "6510", isMedical: true, fobTerms: "DESTINATION" as const, typicalQup: "10" },
    { nsnCode: "6685-01-234-5679", description: "Gauge, Pressure, 0-100 PSI, 2.5in Dial", fsc: "6685", isMedical: false, fobTerms: "ORIGIN" as const, typicalQup: "1" },
    { nsnCode: "4110-01-345-6780", description: "Refrigerator, Undercounter, 5.5 Cu Ft", fsc: "4110", isMedical: false, fobTerms: "DESTINATION" as const, typicalQup: "1" },
    { nsnCode: "6135-01-456-7891", description: "Battery, Lithium, CR123A, 3V", fsc: "6135", isMedical: false, fobTerms: "ORIGIN" as const, typicalQup: "12" },
    { nsnCode: "8520-01-567-8902", description: "Sunscreen, SPF 50, Warrior Formula, 4oz", fsc: "8520", isMedical: false, fobTerms: "DESTINATION" as const, typicalQup: "12" },
    { nsnCode: "6685-01-678-9013", description: "Detector, Gas Tube, Traeger", fsc: "6685", isMedical: false, fobTerms: "ORIGIN" as const, typicalQup: "1" },
  ];

  const nsns: Record<string, { id: string }> = {};
  for (const n of nsnData) {
    const fsc = fscCodes[n.fsc];
    if (!fsc) { console.log(`  WARN: FSC ${n.fsc} not found`); continue; }
    const created = await prisma.nsn.upsert({
      where: { nsnCode: n.nsnCode },
      update: {},
      create: { nsnCode: n.nsnCode, description: n.description, fscCodeId: fsc.id, isMedical: n.isMedical, fobTerms: n.fobTerms, typicalQup: n.typicalQup },
    });
    nsns[n.nsnCode] = created;
  }
  console.log(`  ${Object.keys(nsns).length} NSNs`);

  // ─── Supplier Catalog ─────────────────────────────────────
  const catalog = [
    { vendorId: "v-mcmaster", partNumber: "91251A144", nsnCode: "5305-01-890-1234", description: "Screw, Hex Head SS 1/4-20x1 (100pk)", ourCost: 73.58, listPrice: 73.58 },
    { vendorId: "v-airgas", partNumber: "EAR-312-1250", nsnCode: "4240-01-678-9012", description: "3M E-A-R Classic Earplug, 200pr/box", ourCost: 4.95, listPrice: 6.50 },
    { vendorId: "v-grainger", partNumber: "3KN97", nsnCode: "6515-01-789-0123", description: "Oxygen Bag, Portable", ourCost: 105.00, listPrice: 147.00 },
    { vendorId: "v-medline", partNumber: "MDS202000", nsnCode: "6510-01-456-7890", description: "Ointment, First Aid, 1oz", ourCost: 2.10, listPrice: 3.50 },
    { vendorId: "v-nar", partNumber: "10-0029", nsnCode: "6515-01-012-3456", description: "Forcep, Dressing, NAR", ourCost: 20.98, listPrice: 27.50 },
    { vendorId: "v-nar", partNumber: "30-0023", nsnCode: "6545-01-901-2345", description: "Ambu Perfit ACE Collar", ourCost: 93.98, listPrice: 115.00 },
    { vendorId: "v-laerdal", partNumber: "375125", nsnCode: "6545-01-901-2345", description: "Ambu Perfit ACE Collar, Adult", ourCost: 140.00, listPrice: 165.00 },
    { vendorId: "v-united", partNumber: "WS-SPF50-4", nsnCode: "8520-01-567-8902", description: "Warrior Sunscreen SPF 50, 4oz", ourCost: 245.00, listPrice: 300.00 },
    { vendorId: "v-avanti", partNumber: "AR5102SS", nsnCode: "4110-01-345-6780", description: "Refrigerator, Undercounter, 5.5cf", ourCost: 285.00, listPrice: 399.00 },
    { vendorId: "v-medline", partNumber: "MDS20225", nsnCode: "6515-01-234-5678", description: "Silver Nitrate Applicator, 100/vial", ourCost: 13.50, listPrice: 18.00 },
    { vendorId: "v-medline", partNumber: "MDS077004", nsnCode: "6510-01-123-4567", description: "Elastic Bandage, 4in, 10/box", ourCost: 8.50, listPrice: 14.00 },
  ];

  for (const item of catalog) {
    const nsn = nsns[item.nsnCode];
    await prisma.supplierCatalog.upsert({
      where: { vendorId_partNumber: { vendorId: item.vendorId, partNumber: item.partNumber } },
      update: { ourCost: item.ourCost, listPrice: item.listPrice },
      create: {
        vendorId: item.vendorId, partNumber: item.partNumber,
        nsnId: nsn?.id || null, description: item.description,
        ourCost: item.ourCost, listPrice: item.listPrice, lastUpdated: new Date(),
      },
    });
  }
  console.log(`  ${catalog.length} supplier catalog entries`);

  // ─── Shipping Locations (real depots + bases) ─────────────
  const locations = [
    { name: "DLA Distribution Susquehanna (East Depot)", addressLine1: "2001 Mission Dr", city: "New Cumberland", state: "PA", zipCode: "17070", isMedical: false, isDepot: true, isNavy: false, region: "east" },
    { name: "DLA Distribution San Joaquin (West Depot)", addressLine1: "25600 S Chrisman Rd", city: "Tracy", state: "CA", zipCode: "95304", isMedical: false, isDepot: true, isNavy: false, region: "west" },
    { name: "Naval Supply Fleet Logistics Norfolk", addressLine1: "1968 Gilbert St", city: "Norfolk", state: "VA", zipCode: "23511", isMedical: true, isDepot: false, isNavy: true, region: "east" },
    { name: "Fort Liberty Medical Supply", addressLine1: "Bldg 4-2832, Bastogne Dr", city: "Fort Liberty", state: "NC", zipCode: "28310", isMedical: true, isDepot: false, isNavy: false, region: "east" },
    { name: "Fort Cavazos (Hood) Medical", addressLine1: "36000 Darnall Loop", city: "Fort Cavazos", state: "TX", zipCode: "76544", isMedical: true, isDepot: false, isNavy: false, region: "east" },
    { name: "Naval Medical Center San Diego", addressLine1: "34800 Bob Wilson Dr", city: "San Diego", state: "CA", zipCode: "92134", isMedical: true, isDepot: false, isNavy: true, region: "west" },
    { name: "Tripler Army Medical Center", addressLine1: "1 Jarrett White Rd", city: "Honolulu", state: "HI", zipCode: "96859", isMedical: true, isDepot: false, isNavy: false, region: "pacific" },
    { name: "Fort Drum Medical Activity", addressLine1: "11040 Mount Belvedere Blvd", city: "Fort Drum", state: "NY", zipCode: "13602", isMedical: true, isDepot: false, isNavy: false, region: "east" },
    { name: "Fresno VA Medical Center", addressLine1: "2615 E Clinton Ave", city: "Fresno", state: "CA", zipCode: "93703", isMedical: true, isDepot: false, isNavy: false, region: "west" },
    { name: "Wright-Patterson AFB Medical", addressLine1: "4881 Sugar Maple Dr", city: "Dayton", state: "OH", zipCode: "45433", isMedical: true, isDepot: false, isNavy: false, region: "east" },
  ];

  for (const loc of locations) {
    await prisma.shippingLocation.create({ data: loc });
  }
  console.log(`  ${locations.length} shipping locations`);

  // ─── Bid History (realistic patterns from Abe's demo) ─────
  const historyData = [
    // Silver Nitrate — winning, incrementing up
    { nsn: "6515-01-234-5678", cage: "0AG09", winner: "ERG Supply", price: 21.95, ours: 21.95, qty: 2, date: "2025-09-15", won: true },
    { nsn: "6515-01-234-5678", cage: "0AG09", winner: "ERG Supply", price: 23.44, ours: 23.44, qty: 1, date: "2025-11-20", won: true },
    { nsn: "6515-01-234-5678", cage: "0AG09", winner: "ERG Supply", price: 23.35, ours: 23.35, qty: 2, date: "2026-01-10", won: true },
    { nsn: "6515-01-234-5678", cage: "MDS01", winner: "Midland Scientific", price: 21.10, ours: 23.35, qty: 1, date: "2026-02-26", won: false },
    // Lab spoon — VWR destroyed us
    { nsn: "6640-01-345-6789", cage: "0AG09", winner: "ERG Supply", price: 24.44, ours: 24.44, qty: 1, date: "2025-08-01", won: true },
    { nsn: "6640-01-345-6789", cage: "6P7Q8", winner: "VWR International", price: 8.30, ours: 24.44, qty: 3, date: "2025-12-15", won: false },
    // Ambu collar — lost to someone at $300+ (pricing opportunity!)
    { nsn: "6545-01-901-2345", cage: "0AG09", winner: "ERG Supply", price: 160.00, ours: 160.00, qty: 4, date: "2025-06-01", won: true },
    { nsn: "6545-01-901-2345", cage: "0AG09", winner: "ERG Supply", price: 165.00, ours: 165.00, qty: 2, date: "2025-09-15", won: true },
    { nsn: "6545-01-901-2345", cage: "UNK01", winner: "Unknown", price: 300.50, ours: 180.00, qty: 3, date: "2026-02-01", won: false },
    // Chest seal — no competition, price climbing for years
    { nsn: "6515-01-567-8901", cage: "0AG09", winner: "ERG Supply", price: 26.92, ours: 26.92, qty: 1, date: "2025-04-01", won: true },
    { nsn: "6515-01-567-8901", cage: "0AG09", winner: "ERG Supply", price: 27.53, ours: 27.53, qty: 2, date: "2025-07-15", won: true },
    { nsn: "6515-01-567-8901", cage: "0AG09", winner: "ERG Supply", price: 31.83, ours: 31.83, qty: 1, date: "2025-10-01", won: true },
    { nsn: "6515-01-567-8901", cage: "0AG09", winner: "ERG Supply", price: 32.50, ours: 32.50, qty: 1, date: "2026-01-20", won: true },
    // Oxygen bag — lost by 50 cents
    { nsn: "6515-01-789-0123", cage: "0AG09", winner: "ERG Supply", price: 147.00, ours: 147.00, qty: 1, date: "2025-08-10", won: true },
    { nsn: "6515-01-789-0123", cage: "UNK02", winner: "Unknown", price: 151.50, ours: 152.00, qty: 1, date: "2026-02-15", won: false },
    // Sunscreen — competing with manufacturer United Spirit
    { nsn: "8520-01-567-8902", cage: "8T9U0", winner: "United Spirit", price: 300.00, ours: 299.75, qty: 5, date: "2026-01-05", won: false },
    { nsn: "8520-01-567-8902", cage: "0AG09", winner: "ERG Supply", price: 299.75, ours: 299.75, qty: 3, date: "2026-03-01", won: true },
    // Ointment — bread and butter
    { nsn: "6510-01-456-7890", cage: "0AG09", winner: "ERG Supply", price: 7.35, ours: 7.35, qty: 7, date: "2025-10-01", won: true },
    { nsn: "6510-01-456-7890", cage: "0AG09", winner: "ERG Supply", price: 7.24, ours: 7.24, qty: 5, date: "2026-01-15", won: true },
  ];

  for (const h of historyData) {
    const nsn = nsns[h.nsn];
    if (!nsn) continue;
    await prisma.bidHistory.create({
      data: {
        nsnId: nsn.id, winnerCageCode: h.cage, winnerName: h.winner,
        winningPrice: h.price, ourPrice: h.ours, quantity: h.qty,
        awardDate: new Date(h.date), weWon: h.won, fobTerms: "DESTINATION",
      },
    });
  }
  console.log(`  ${historyData.length} bid history records`);

  // ─── Pricing Rules ────────────────────────────────────────
  const rules = [
    { fsc: "6515", type: "INCREMENT" as const, params: { incrementPct: 2, maxMarkup: 40, minMarkup: 15 }, notes: "Medical instruments - increment, low competition" },
    { fsc: "6510", type: "COMPETE" as const, params: { targetMarkup: 20, minMarkup: 10 }, notes: "Surgical dressings - competitive, watch VWR/Medline" },
    { fsc: "5305", type: "NEW_ITEM" as const, params: { defaultMarkup: 18, mcmasterMarkup: 15 }, notes: "Screws - McMaster pricing, 15-20%" },
    { fsc: "4240", type: "INCREMENT" as const, params: { incrementPct: 1.5, maxMarkup: 35 }, notes: "Safety equipment - steady, increment carefully" },
    { fsc: "6545", type: "INCREMENT" as const, params: { incrementPct: 3, maxMarkup: 50 }, notes: "Medical kits - low competition, can push higher" },
    { fsc: "8520", type: "MANUFACTURER" as const, params: { undercutPct: 0.1 }, notes: "Sunscreen - competing with United Spirit direct" },
  ];

  for (const r of rules) {
    const fsc = fscCodes[r.fsc];
    if (!fsc) continue;
    await prisma.pricingRule.create({
      data: { fscCodeId: fsc.id, ruleType: r.type, params: r.params, notes: r.notes },
    });
  }
  console.log(`  ${rules.length} pricing rules`);

  // ─── Sample Solicitations (today's batch) ─────────────────
  const solicitations = [
    { num: "SPE2D1-26-Q-0901", nsn: "6515-01-234-5678", fsc: "6515", qty: 2, uom: "EA", due: "2026-03-31", status: "NEW" as const, bread: true, fob: "DESTINATION" as const },
    { num: "SPE2D1-26-Q-0902", nsn: "6510-01-456-7890", fsc: "6510", qty: 7, uom: "TB", due: "2026-04-02", status: "NEW" as const, bread: true, fob: "DESTINATION" as const },
    { num: "SPE2D1-26-Q-0903", nsn: "5305-01-890-1234", fsc: "5305", qty: 3, uom: "PK", due: "2026-04-01", status: "NEW" as const, bread: false, fob: "ORIGIN" as const },
    { num: "SPE2D1-26-Q-0904", nsn: "6545-01-901-2345", fsc: "6545", qty: 1, uom: "EA", due: "2026-04-03", status: "REVIEWING" as const, bread: true, fob: "DESTINATION" as const },
    { num: "SPE2D1-26-Q-0905", nsn: "6515-01-567-8901", fsc: "6515", qty: 1, uom: "EA", due: "2026-04-05", status: "NEW" as const, bread: true, fob: "DESTINATION" as const },
    { num: "SPE2D1-26-Q-0906", nsn: "4240-01-678-9012", fsc: "4240", qty: 5, uom: "BX", due: "2026-04-02", status: "BID_SUBMITTED" as const, bread: false, fob: "DESTINATION" as const },
    { num: "SPE2D1-26-Q-0907", nsn: "8520-01-567-8902", fsc: "8520", qty: 3, uom: "EA", due: "2026-04-04", status: "NEW" as const, bread: false, fob: "DESTINATION" as const },
    { num: "SPE2D1-26-Q-0908", nsn: "6515-01-789-0123", fsc: "6515", qty: 1, uom: "EA", due: "2026-04-01", status: "NEW" as const, bread: true, fob: "DESTINATION" as const },
  ];

  for (const s of solicitations) {
    const nsn = nsns[s.nsn];
    const fsc = fscCodes[s.fsc];
    if (!nsn || !fsc) continue;
    await prisma.solicitation.create({
      data: {
        solicitationNumber: s.num, nsnId: nsn.id, fscCodeId: fsc.id,
        totalQuantity: s.qty, unitOfMeasure: s.uom, fobTerms: s.fob,
        dueDate: new Date(s.due), status: s.status, isBreadAndButter: s.bread,
      },
    });
  }
  console.log(`  ${solicitations.length} solicitations`);

  console.log("\nSeed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
