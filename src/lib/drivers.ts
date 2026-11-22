export const DRIVER_COLORS = ["#1F6F4A", "#2F6FD0", "#E58A2B", "#7A4FC4", "#C2410C", "#0E8C8C", "#B83280", "#6B7A1F", "#8A5A2B", "#3B4A6B"];

export interface Driver {
  id: string;
  name: string;
  phone: string;
}

export interface ShiftSlot {
  driverId: string;
  vehicleId: string;
}

export const MIN_SHIFT = 0;
export const MAX_SHIFT = 10;

// Test fixture only — the app loads the real team from the database.
export const DEFAULT_ROSTER: Driver[] = [
  { id: "andrei", name: "Andrei Rusu", phone: "+373 691 11 201" },
  { id: "maria", name: "Maria Ciobanu", phone: "+373 692 22 302" },
  { id: "victor", name: "Victor Lungu", phone: "+373 693 33 403" },
  { id: "elena", name: "Elena Popa", phone: "+373 694 44 504" },
  { id: "ion", name: "Ion Munteanu", phone: "+373 695 55 605" },
  { id: "natalia", name: "Natalia Cebotari", phone: "+373 696 66 706" },
  { id: "sergiu", name: "Sergiu Rotaru", phone: "+373 697 77 807" },
  { id: "ana", name: "Ana Moraru", phone: "+373 698 88 908" },
  { id: "mihai", name: "Mihai Bivol", phone: "+373 699 99 109" },
  { id: "cristina", name: "Cristina Turcanu", phone: "+373 690 10 210" },
];

export const DEFAULT_SHIFT: ShiftSlot[] = [];

/** Add a slot with the first free driver; no-op at MAX_SHIFT or when nobody is free. */
export function addSlot(shift: ShiftSlot[], roster: Driver[], vehicleId = "kangoo"): ShiftSlot[] {
  if (shift.length >= MAX_SHIFT) return shift;
  const free = roster.find((d) => !shift.some((s) => s.driverId === d.id));
  return free ? [...shift, { driverId: free.id, vehicleId }] : shift;
}

/** Remove a slot; no-op at MIN_SHIFT. */
export function removeSlot(shift: ShiftSlot[], index: number): ShiftSlot[] {
  return shift.length <= MIN_SHIFT ? shift : shift.filter((_, i) => i !== index);
}

/** Change a slot's driver; if that driver is already in another slot, the two swap. */
export function setSlotDriver(shift: ShiftSlot[], index: number, driverId: string): ShiftSlot[] {
  const other = shift.findIndex((s, i) => i !== index && s.driverId === driverId);
  return shift.map((s, i) => {
    if (i === index) return { ...s, driverId };
    if (i === other) return { ...s, driverId: shift[index]!.driverId };
    return s;
  });
}
