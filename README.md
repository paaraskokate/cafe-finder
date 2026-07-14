# BrewMap ☕ — Find Your Perfect Café

> **Live**: [brewmap-taupe.vercel.app](https://brewmap-taupe.vercel.app)

A dark-themed, single-page web app that discovers nearby cafés using open-source map data. Search by location, use your current location, browse café details, and get turn-by-turn directions — all for free, no paid API keys required.

## Features

- **Search by city, address, or place** — Nominatim geocoding with autocomplete suggestions
- **My Location** — Uses browser geolocation to find cafés around you
- **Configurable radius** — 500 m to 10 km
- **Sort results** — By distance, name, or rating
- **Café detail card** — Photo, star rating, live open/close status, address, phone, website, cuisine, amenities (WiFi, outdoor seating, takeaway, wheelchair)
- **Mapillary street-level photos** — Real photos of cafés when available (fallback to random café stock photos)
- **Turn-by-turn directions** — Driving, cycling, and walking modes via OSRM routing
- **Custom map markers** — Distinctive café pins with active state highlighting
- **Copy café link** — Quick share to OpenStreetMap
- **Responsive** — Works on desktop and mobile
- **Dark theme** — Warm amber accents, smooth animations, glassmorphism details

## Tech Stack

| Technology | Purpose |
|---|---|
| [Leaflet.js](https://leafletjs.com/) | Interactive map rendering |
| [CARTO dark tiles](https://carto.com/basemaps) | Base map tile layer (free) |
| [Photon API](https://photon.komoot.io/) (komoot) | Geocoding & autocomplete (CORS-friendly) |
| [Overpass API](https://overpass-api.de/) | Query cafés from OSM data |
| [Mapillary API](https://www.mapillary.com/developer) | Street-level café photos |
| [OSRM](http://project-osrm.org/) | Route calculation (driving, cycling, walking) |
| [Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/) | Display routes on map |
| [loremflickr](https://loremflickr.com/) | Fallback café stock photos |

All APIs used are **free and open-source** — no billing setup required.

## How It Works

1. **User enters a location** (or clicks "My Location") → Photon API (komoot) geocodes it to lat/lng.
2. **Overpass API** queries OpenStreetMap for nodes/ways tagged `amenity=cafe` or `amenity=coffee_shop` within the chosen radius.
3. Results are parsed — address, phone, website, opening hours, cuisine, ratings, and amenity tags are extracted from OSM tags.
4. **Cafés are displayed** as a sidebar list and map markers with distance, rating, and open/close status.
5. Clicking a café opens a **detail card** with a photo (fetched from Mapillary, Wikimedia Commons, OSM image tags, or loremflickr fallback), live open/close badge, star rating, and full info.
6. **Get Directions** uses the browser's geolocation + OSRM routing + Leaflet Routing Machine to draw the route and show turn-by-turn steps for driving, cycling, or walking.

## Project Structure

```
cafe-finder/
├── index.html      # HTML structure (sidebar, map, detail card, directions panel)
├── style.css       # Dark-themed CSS with custom properties, animations, responsive
├── app.js          # All application logic (1237 lines)
└── logo.png        # BrewMap brand icon
```

## Getting Started

### 1. Clone or download the repo

```bash
git clone https://github.com/<your-username>/brewmap.git
cd brewmap
```

### 2. Get a Mapillary access token (optional but recommended)

Mapillary provides free street-level photos. Without a token, café photos will fall back to random stock images.

1. Sign up at https://www.mapillary.com/signup
2. Go to https://www.mapillary.com/dashboard/developers
3. Create a new application to get an access token
4. Open `app.js` and replace `YOUR_MAPILLARY_ACCESS_TOKEN` with your token:

```js
MAPILLARY_TOKEN: 'MLY|your_token_here',
```

### 3. Serve locally

Since the app uses ES modules and `fetch`, it needs to be served via HTTP. You can use any static server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using VS Code Live Server extension
```

Then open `http://localhost:8080` in your browser.

## Usage

1. Type a city or address in the search box, select an autocomplete suggestion, or click **My Location**.
2. Adjust the **Radius** and **Sort by** filters as needed.
3. Click **Find Cafés**.
4. Browse the list or click markers on the map.
5. Click a café to see its detail card with photo, hours, rating, and more.
6. Click **Get Directions** for turn-by-turn navigation.


## Configuration

All configurable constants are in the `CONFIG` object at the top of `app.js`:

| Key | Default | Description |
|---|---|---|
| `DEFAULT_LAT/LNG` | `20.5937, 78.9629` (India) | Center when no location is set |
| `DEFAULT_ZOOM` | `5` | Initial zoom level |
| `SEARCH_ZOOM` | `14` | Zoom after geocoding a location |
| `MAX_RESULTS` | `50` | Max cafés to display |
| `AUTOCOMPLETE_DELAY` | `350` | Debounce delay (ms) for autocomplete |
| `OSRM` | Driving/cycling/walking URLs | Routing service endpoints |


## License

This project is open-source and available for personal and educational use.

## Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) for the map data
- [Leaflet](https://leafletjs.com/) for the incredible mapping library
- [Mapillary](https://www.mapillary.com/) for street-level imagery
- [OSRM](http://project-osrm.org/) for routing
- [CARTO](https://carto.com/) for free dark map tiles
