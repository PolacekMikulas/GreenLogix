import type { Delivery } from "./optimizer";

// Sample day: 20 real Chișinău deliveries (team dataset).
type Row = [string, string, Delivery["clientType"], string, string, number, number, Delivery["priority"], number, string];

const ROWS: Row[] = [
  ["D001", "Picoteo (Botanica)", "horeca", "Bulevardul Dacia 20, Chișinău", "Botanica", 46.9879826, 28.8539124, "normal", 5, "09:00-11:00"],
  ["D002", "Mari&Mar Rîșcani", "retail", "Strada Alecu Russo 1, Chișinău", "Rîșcani", 47.0448777, 28.8623697, "normal", 3, "09:00-12:00"],
  ["D003", "Trattoria Della Nonna", "horeca", "Bulevardul Dacia 42/1, Chișinău", "Botanica", 46.9782812, 28.8675437, "normal", 7, "08:00-12:00"],
  ["D004", "two guys coffee.", "horeca", "Strada Vasile Alecsandri 66, Chișinău", "Centru", 47.0185246, 28.835776, "high", 2, "07:00-08:00"],
  ["D005", "Linella (Vasile Alecsandri)", "retail", "Strada Vasile Alecsandri 143, Chișinău", "Centru", 47.0271989, 28.8469112, "high", 10, "06:30-08:00"],
  ["D006", "Velmart", "retail", "Piața Dimitrie Cantemir 1, Chișinău", "Buiucani", 47.038607, 28.809536, "normal", 14, "07:00-10:00"],
  ["D007", "Granier", "horeca", "Bulevardul Ștefan cel Mare și Sfânt 69, Chișinău", "Centru", 47.0173534, 28.8427497, "high", 6, "06:30-07:30"],
  ["D008", "Café Central", "horeca", "Bulevardul Ștefan cel Mare și Sfânt 103, Chișinău", "Centru", 47.0266547, 28.8285467, "high", 4, "07:30-09:00"],
  ["D009", "Online order · office delivery (National Business Center)", "ecommerce", "Bulevardul Ștefan cel Mare și Sfânt 73/1, Chișinău", "Centru", 47.0190191, 28.8393838, "normal", 2, "09:00-17:00"],
  ["D010", "Little Napoli", "horeca", "Strada Sucevița 27/1, Chișinău", "Buiucani", 47.0334418, 28.7790892, "normal", 4, "09:00-11:00"],
  ["D011", "Linella (Decebal)", "retail", "Bulevardul Decebal 59, Chișinău", "Botanica", 47.0005557, 28.8604223, "high", 12, "06:30-08:00"],
  ["D012", "Mile Coffee", "horeca", "Strada Meșterul Manole 1, Chișinău", "Ciocana", 47.0330649, 28.8900293, "high", 2, "06:00-06:30"],
  ["D013", "Trattoria Buiucani", "horeca", "Strada Ion Pelivan 15/1, Chișinău", "Buiucani", 47.0294105, 28.7892625, "normal", 6, "08:00-10:00"],
  ["D014", "Nr. 1 Supermarket", "retail", "Bulevardul Ștefan cel Mare și Sfânt 135, Chișinău", "Centru", 47.0308625, 28.8225041, "normal", 9, "07:00-10:00"],
  ["D015", "Pasio Coffee", "horeca", "Strada Vasile Alecsandri 115, Chișinău", "Centru", 47.0205809, 28.8375815, "high", 3, "07:00-08:00"],
  ["D016", "Baf Bulvar", "horeca", "Bulevardul Traian 25, Chișinău", "Botanica", 46.9780181, 28.8454671, "normal", 4, "08:00-10:00"],
  ["D017", "Online order · office delivery (Community Business Center)", "ecommerce", "Bulevardul Iuri Gagarin 10, Chișinău", "Centru", 47.0105629, 28.8563227, "normal", 1, "09:00-17:00"],
  ["D018", "Online order · office delivery (Panorama Business Center)", "ecommerce", "Strada Ismail 81/1, Chișinău", "Centru", 47.0218163, 28.8531565, "normal", 2, "09:00-17:00"],
  ["D019", "Online order · office delivery (V Continental)", "ecommerce", "Bulevardul Dimitrie Cantemir 5/4, Chișinău", "Centru", 47.0176556, 28.8527601, "normal", 1, "09:00-17:00"],
  ["D020", "SPORTOUTLET Rîșcani", "retail", "Bulevardul Moscova 16, Chișinău", "Rîșcani", 47.053741, 28.8655424, "normal", 5, "09:00-12:00"],
];

export function sampleDeliveries(): Delivery[] {
  return ROWS.map(([id, clientName, clientType, address, district, lat, lng, priority, parcels, timeWindow]) => ({
    id,
    clientName,
    clientType,
    address,
    district,
    lat,
    lng,
    priority,
    parcels,
    timeWindow,
  }));
}
