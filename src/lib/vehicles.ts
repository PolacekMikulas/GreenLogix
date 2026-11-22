// Delivery vehicles common in Moldovan courier fleets. Figures are typical urban values.
export type Fuel = "diesel" | "petrol";
export interface Vehicle {
  id: string;
  name: string;
  kind: string;
  fuel: Fuel;
  fuelPer100km: number; // L/100 km, city
  fuelPrice: number; // MDL/L — replaced by live Bemol price via withPrice()
  co2PerLitre: number; // kg CO₂ per litre burned
  upkeepPerKm: number; // MDL/km: tyres, service, depreciation
  capacityParcels: number;
  payloadKg: number;
}

export const FALLBACK_PRICES = { diesel: 22.5, petrol: 23.5 };
const DIESEL_CO2 = 2.68;
const PETROL_CO2 = 2.31;
const D = { fuel: "diesel" as const, fuelPrice: FALLBACK_PRICES.diesel, co2PerLitre: DIESEL_CO2 };
const P = { fuel: "petrol" as const, fuelPrice: FALLBACK_PRICES.petrol, co2PerLitre: PETROL_CO2 };

export const VEHICLES: Vehicle[] = [
  { id: "dokker", name: "Dacia Dokker Van 1.5 dCi", kind: "Small van", ...D, fuelPer100km: 5.8, upkeepPerKm: 0.9, capacityParcels: 60, payloadKg: 750 },
  { id: "dokker-p", name: "Dacia Dokker Van 1.6 SCe", kind: "Small van", ...P, fuelPer100km: 7.6, upkeepPerKm: 0.85, capacityParcels: 60, payloadKg: 750 },
  { id: "kangoo", name: "Renault Kangoo 1.5 dCi", kind: "Small van", ...D, fuelPer100km: 6.2, upkeepPerKm: 1.0, capacityParcels: 65, payloadKg: 650 },
  { id: "kangoo-p", name: "Renault Kangoo 1.3 TCe", kind: "Small van", ...P, fuelPer100km: 7.4, upkeepPerKm: 0.95, capacityParcels: 65, payloadKg: 650 },
  { id: "express", name: "Renault Express Van 1.5 Blue dCi", kind: "Small van", ...D, fuelPer100km: 5.5, upkeepPerKm: 0.9, capacityParcels: 65, payloadKg: 650 },
  { id: "caddy", name: "Volkswagen Caddy 2.0 TDI", kind: "Small van", ...D, fuelPer100km: 6.8, upkeepPerKm: 1.2, capacityParcels: 75, payloadKg: 700 },
  { id: "caddy-p", name: "Volkswagen Caddy 1.5 TSI", kind: "Small van", ...P, fuelPer100km: 7.9, upkeepPerKm: 1.15, capacityParcels: 75, payloadKg: 700 },
  { id: "caddy-maxi", name: "Volkswagen Caddy Maxi 2.0 TDI", kind: "Small van", ...D, fuelPer100km: 7.1, upkeepPerKm: 1.25, capacityParcels: 90, payloadKg: 750 },
  { id: "partner", name: "Peugeot Partner 1.5 BlueHDi", kind: "Small van", ...D, fuelPer100km: 5.6, upkeepPerKm: 1.0, capacityParcels: 70, payloadKg: 1000 },
  { id: "partner-p", name: "Peugeot Partner 1.2 PureTech", kind: "Small van", ...P, fuelPer100km: 7.2, upkeepPerKm: 0.95, capacityParcels: 70, payloadKg: 1000 },
  { id: "berlingo", name: "Citroën Berlingo 1.5 BlueHDi", kind: "Small van", ...D, fuelPer100km: 5.7, upkeepPerKm: 1.0, capacityParcels: 70, payloadKg: 1000 },
  { id: "berlingo-16", name: "Citroën Berlingo 1.6 HDi", kind: "Small van", ...D, fuelPer100km: 6.1, upkeepPerKm: 1.0, capacityParcels: 65, payloadKg: 850 },
  { id: "combo", name: "Opel Combo Cargo 1.5 D", kind: "Small van", ...D, fuelPer100km: 5.8, upkeepPerKm: 1.0, capacityParcels: 70, payloadKg: 1000 },
  { id: "combo-p", name: "Opel Combo Cargo 1.2 Turbo", kind: "Small van", ...P, fuelPer100km: 7.3, upkeepPerKm: 0.95, capacityParcels: 70, payloadKg: 1000 },
  { id: "doblo", name: "Fiat Doblò Cargo 1.6 MultiJet", kind: "Small van", ...D, fuelPer100km: 6.0, upkeepPerKm: 1.0, capacityParcels: 70, payloadKg: 750 },
  { id: "doblo-p", name: "Fiat Doblò Cargo 1.4", kind: "Small van", ...P, fuelPer100km: 8.3, upkeepPerKm: 0.95, capacityParcels: 70, payloadKg: 750 },
  { id: "connect", name: "Ford Transit Connect 1.5 EcoBlue", kind: "Small van", ...D, fuelPer100km: 6.0, upkeepPerKm: 1.1, capacityParcels: 75, payloadKg: 900 },
  { id: "courier", name: "Ford Transit Courier 1.5 TDCi", kind: "Small van", ...D, fuelPer100km: 5.3, upkeepPerKm: 0.9, capacityParcels: 50, payloadKg: 600 },
  { id: "citan", name: "Mercedes-Benz Citan 1.5 CDI", kind: "Small van", ...D, fuelPer100km: 5.9, upkeepPerKm: 1.2, capacityParcels: 65, payloadKg: 700 },
  { id: "proace-city", name: "Toyota Proace City 1.5 D", kind: "Small van", ...D, fuelPer100km: 5.7, upkeepPerKm: 1.0, capacityParcels: 70, payloadKg: 1000 },
  { id: "nv200", name: "Nissan NV200 1.5 dCi", kind: "Small van", ...D, fuelPer100km: 6.0, upkeepPerKm: 1.0, capacityParcels: 65, payloadKg: 700 },
  { id: "trafic", name: "Renault Trafic 2.0 Blue dCi", kind: "Medium van", ...D, fuelPer100km: 8.0, upkeepPerKm: 1.4, capacityParcels: 130, payloadKg: 1200 },
  { id: "vivaro", name: "Opel Vivaro 2.0 D", kind: "Medium van", ...D, fuelPer100km: 7.8, upkeepPerKm: 1.4, capacityParcels: 130, payloadKg: 1200 },
  { id: "expert", name: "Peugeot Expert 2.0 BlueHDi", kind: "Medium van", ...D, fuelPer100km: 7.6, upkeepPerKm: 1.4, capacityParcels: 130, payloadKg: 1300 },
  { id: "jumpy", name: "Citroën Jumpy 2.0 BlueHDi", kind: "Medium van", ...D, fuelPer100km: 7.6, upkeepPerKm: 1.4, capacityParcels: 130, payloadKg: 1300 },
  { id: "transit", name: "Ford Transit Custom 2.0 EcoBlue", kind: "Medium van", ...D, fuelPer100km: 9.0, upkeepPerKm: 1.5, capacityParcels: 140, payloadKg: 1100 },
  { id: "transporter", name: "Volkswagen Transporter T6.1 2.0 TDI", kind: "Medium van", ...D, fuelPer100km: 8.4, upkeepPerKm: 1.6, capacityParcels: 140, payloadKg: 1200 },
  { id: "vito", name: "Mercedes-Benz Vito 2.0 CDI", kind: "Medium van", ...D, fuelPer100km: 8.2, upkeepPerKm: 1.7, capacityParcels: 140, payloadKg: 1100 },
  { id: "talento", name: "Fiat Talento 1.6 MultiJet", kind: "Medium van", ...D, fuelPer100km: 8.1, upkeepPerKm: 1.4, capacityParcels: 125, payloadKg: 1200 },
  { id: "proace", name: "Toyota Proace 2.0 D", kind: "Medium van", ...D, fuelPer100km: 7.7, upkeepPerKm: 1.4, capacityParcels: 130, payloadKg: 1300 },
  { id: "sprinter", name: "Mercedes-Benz Sprinter 2.2 CDI", kind: "Large van", ...D, fuelPer100km: 11.0, upkeepPerKm: 2.0, capacityParcels: 220, payloadKg: 1400 },
  { id: "sprinter-l3", name: "Mercedes-Benz Sprinter 3.0 CDI L3", kind: "Large van", ...D, fuelPer100km: 12.0, upkeepPerKm: 2.2, capacityParcels: 260, payloadKg: 1300 },
  { id: "transit-l3", name: "Ford Transit 2.0 EcoBlue L3", kind: "Large van", ...D, fuelPer100km: 10.4, upkeepPerKm: 1.8, capacityParcels: 220, payloadKg: 1400 },
  { id: "crafter", name: "Volkswagen Crafter 2.0 TDI", kind: "Large van", ...D, fuelPer100km: 10.0, upkeepPerKm: 1.9, capacityParcels: 220, payloadKg: 1400 },
  { id: "master", name: "Renault Master 2.3 dCi", kind: "Large van", ...D, fuelPer100km: 10.8, upkeepPerKm: 1.9, capacityParcels: 215, payloadKg: 1500 },
  { id: "movano", name: "Opel Movano 2.2 D", kind: "Large van", ...D, fuelPer100km: 10.2, upkeepPerKm: 1.9, capacityParcels: 215, payloadKg: 1500 },
  { id: "ducato", name: "Fiat Ducato 2.3 MultiJet", kind: "Large van", ...D, fuelPer100km: 10.5, upkeepPerKm: 1.9, capacityParcels: 210, payloadKg: 1500 },
  { id: "boxer", name: "Peugeot Boxer 2.2 BlueHDi", kind: "Large van", ...D, fuelPer100km: 10.0, upkeepPerKm: 1.8, capacityParcels: 210, payloadKg: 1500 },
  { id: "jumper", name: "Citroën Jumper 2.2 BlueHDi", kind: "Large van", ...D, fuelPer100km: 10.0, upkeepPerKm: 1.8, capacityParcels: 210, payloadKg: 1500 },
  { id: "daily", name: "Iveco Daily 35S 2.3", kind: "Large van", ...D, fuelPer100km: 11.5, upkeepPerKm: 2.1, capacityParcels: 240, payloadKg: 1600 },
  { id: "gazelle", name: "GAZ Gazelle Next 2.8 D", kind: "Large van", ...D, fuelPer100km: 12.5, upkeepPerKm: 1.7, capacityParcels: 200, payloadKg: 1500 },
  { id: "gazelle-p", name: "GAZ Gazelle Business 2.7 (petrol)", kind: "Large van", ...P, fuelPer100km: 15.5, upkeepPerKm: 1.6, capacityParcels: 180, payloadKg: 1500 },
  { id: "porter", name: "Hyundai H350 2.5 CRDi", kind: "Large van", ...D, fuelPer100km: 11.0, upkeepPerKm: 1.9, capacityParcels: 230, payloadKg: 1500 },
];

export const vehicleById = (id: string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0]!;
export const DEFAULT_FLEET = ["kangoo", "dokker", "caddy", "transit", "sprinter"];

export const withPrice = (v: Vehicle, prices: { diesel: number; petrol: number }): Vehicle => ({ ...v, fuelPrice: prices[v.fuel] });

/** Running cost per km (fuel + upkeep), MDL. */
export const costPerKm = (v: Vehicle) => (v.fuelPer100km / 100) * v.fuelPrice + v.upkeepPerKm;
export const co2PerKm = (v: Vehicle) => (v.fuelPer100km / 100) * v.co2PerLitre;

/** Cheapest per km among vans that fit the load; CO₂ breaks near-ties (within 2%). */
export function recommendVehicle(vehicles: Vehicle[], parcels = 0): Vehicle | undefined {
  const fit = vehicles.filter((v) => v.capacityParcels >= parcels);
  const pool = fit.length ? fit : vehicles;
  return [...pool].sort((a, b) => {
    const ca = costPerKm(a), cb = costPerKm(b);
    if (Math.abs(ca - cb) / Math.min(ca, cb) > 0.02) return ca - cb;
    return co2PerKm(a) - co2PerKm(b);
  })[0];
}

/** Catalogue search: every typed word must appear in the name, kind or fuel. */
export function searchModels(q: string, list: Vehicle[] = VEHICLES): Vehicle[] {
  const words = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((v) => {
    const hay = `${v.name} ${v.kind} ${v.fuel}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return words.every((w) => hay.includes(w));
  });
}

/** Moldovan plates: uppercase, single spaces. */
export const normalizePlate = (p: string) => p.toUpperCase().replace(/\s+/g, " ").trim();

export interface CompanyVehicleRow {
  id: string;
  plate: string;
  model_id: string;
  model_name?: string | null;
  kind?: string | null;
  fuel?: string | null;
  fuel_per_100km?: number | null;
  upkeep_per_km?: number | null;
  capacity_parcels?: number | null;
  payload_kg?: number | null;
}

/** Specs for a company van: its own saved specs (any model) or the catalogue entry. */
export function vehicleFromRow(r: CompanyVehicleRow): Vehicle {
  if (r.fuel_per_100km != null) {
    const fuel: Fuel = r.fuel === "petrol" ? "petrol" : "diesel";
    return {
      id: r.model_id,
      name: r.model_name ?? "Custom vehicle",
      kind: r.kind ?? "Van",
      fuel,
      fuelPer100km: r.fuel_per_100km,
      fuelPrice: FALLBACK_PRICES[fuel],
      co2PerLitre: fuel === "diesel" ? DIESEL_CO2 : PETROL_CO2,
      upkeepPerKm: r.upkeep_per_km ?? 1.2,
      capacityParcels: r.capacity_parcels ?? 60,
      payloadKg: r.payload_kg ?? 700,
    };
  }
  return vehicleById(r.model_id);
}
