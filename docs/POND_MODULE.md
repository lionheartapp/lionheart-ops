# Pond Maintenance Module

## Thresholds (Aquaculture & Reptile Care)

| Parameter   | Ideal       | Warning              | Danger                        |
|------------|-------------|----------------------|-------------------------------|
| pH         | 7.0–8.0     | &lt;6.5 or &gt;8.5   | &lt;5.5 (acidosis) or &gt;9.5 |
| Temp       | 65–78°F     | &lt;50 or &gt;85°F   | &gt;90°F (Koi stress)         |
| DO         | 6–9 ppm     | &lt;5 ppm            | &lt;3 ppm (fish kill risk)    |
| Turbidity  | 0–10 NTU    | &gt;25 NTU           | &gt;50 NTU                    |
| Alkalinity | 90–120 ppm  | &lt;50 ppm           | &lt;20 ppm (copper toxicity)  |

**Copper Sulfate Safety Filter:** If Alkalinity &lt; 50 ppm → disable Copper entirely. Max safe dose (ppm) = Alkalinity ÷ 100.  
**Turtle sensitivity:** Max 0.2 ppm Copper when turtles present.

---

## Implemented

### 1. Sensor & Manual Entry
- **POST /api/pond-sensor** – Receives JSON from IoT probe or manual entry:
  ```json
  { "pH": 7.2, "turbidity": 15, "temperature": 20, "source": "sensor"|"manual", "notes": "optional" }
  ```
- **GET /api/pond-sensor** – Latest reading
- **GET /api/pond/readings?limit=10** – Recent logs

### 2. Pond Health Widget (Facilities Dashboard)
- Shows pH, Turbidity (NTU), Temperature
- **SafeZone** highlighting: Red when pH &lt; 6.5 or &gt; 8.5, or Turbidity &gt; 20 NTU
- Alert banner when out of range → links to Dosage Calculator
- **Log** button – Manual entry when no IoT equipment

### 3. Dosage Calculator (Manual Path)
- **GET /api/pond/dosage?volume=5000&treatment=copper|dye**
- Calculates safe ounces for:
  - **Copper Sulfate** – algae control (fish-safe levels)
  - **Aquatic Dye** – weed/light control
- Volume in gallons (default 5000)
- **Add to Maintenance Ticket** – Creates Facilities ticket with dosage instructions

### 4. Constants (`platform/src/lib/pondConstants.ts`)
- SafeZone: pH 6.5–8.5, Turbidity max 20 NTU
- Dosing formulas (adjust for your pond/animal safety)

---

## Not Yet Implemented

### Aeration Trigger (Smart Plug)
- When DO &lt; 5 ppm: call Smart Plug API to turn on aerator
- Push notification: "Oxygen low (X ppm). Aerator engaged. Check for algae die-off."

### Price Scraper / School Value Pick (Grainger & Zoro)
- Search Grainger and Zoro for "Copper Sulfate Pentahydrate"
- Calculate **Price per Pound** from container size (5lb tub vs 50lb bag)
- If 50lb bag is 40%+ cheaper per lb than 5lb tub → highlight as **School Value Pick**
- Show 6-month total savings based on typical usage

### Bulk-Buying Windows / Price History
- Track chemical usage over time
- AI: "Price Trend Alert: Dye typically 15% cheaper in March"
- Needs usage log + price history DB

### Unit-Cost Analysis
- Price per ounce across 1gal vs 5gal
- Highlight cheapest per-dose option

### Auto-Generate Ticket (Full Flow)
- When reading out of SafeZone → auto-suggest ticket
- Include: chemical, dosage, buy link, room availability for keys
- Room 204 schedule check for "grab pond keys" suggestion

---

## IoT Probe Integration

When you have sensor hardware, configure it to POST to:
```
POST https://your-domain.com/api/pond-sensor
Content-Type: application/json

{"pH": 7.1, "turbidity": 18, "temperature": 19.5, "source": "sensor"}
```

For local dev: `http://localhost:3001/api/pond-sensor`

Add auth (e.g. API key header) before exposing publicly.
