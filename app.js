/* =============================================================
   BrewMap — app.js  v2
   Leaflet.js + OpenStreetMap + Overpass API + Photon
   + Cafe Photos  + Live Open/Close  + Star Ratings  + In-App Routing
   100% Free — No API key required
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────── */
const CONFIG = {
  PHOTON_URL:        'https://photon.komoot.io/api',
  OVERPASS_PROXY:    '/api/overpass',
  DEFAULT_LAT:       20.5937,
  DEFAULT_LNG:       78.9629,
  DEFAULT_ZOOM:      5,
  SEARCH_ZOOM:       14,
  TILE_URL:          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  TILE_ATTR:         '\u00a9 <a href="https://carto.com/">CARTO</a> \u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  AUTOCOMPLETE_DELAY: 350,
  MAX_RESULTS:       50,
  // Mapillary — real street-level photos (free, no billing)
  MAPILLARY_TOKEN:   'YOUR_MAPILLARY_ACCESS_TOKEN',  // Get yours free at https://www.mapillary.com/dashboard/developers
  MAPILLARY_URL:     'https://graph.mapillary.com/images',
  // OSRM service URLs per mode
  OSRM: {
    driving: 'https://router.project-osrm.org/route/v1',
    cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1',
    walking: 'https://routing.openstreetmap.de/routed-foot/route/v1'
  }
};

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const state = {
  map:               null,
  userMarker:        null,
  userLatLng:        null,
  cafeMarkers:       [],
  cafes:             [],
  selectedId:        null,
  selectedCafe:      null,
  autocompleteTimeout: null,
  lastSearchLatLng:  null,
  isLoading:         false,
  routingControl:    null,
  routeMode:         'driving',
  directionsActive:  false
};

/* ─────────────────────────────────────────
   DOM REFS
───────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const dom = {
  sidebar:            $('sidebar'),
  locationInput:      $('location-input'),
  clearBtn:           $('clear-btn'),
  autocomplete:       $('autocomplete-list'),
  radiusSelect:       $('radius-select'),
  sortSelect:         $('sort-select'),
  locateBtn:          $('locate-btn'),
  searchBtn:          $('search-btn'),
  statusBar:          $('status-bar'),
  statusText:         $('status-text'),
  resultsHeader:      $('results-header'),
  resultsCount:       $('results-count'),
  refreshBtn:         $('refresh-btn'),
  cafeList:           $('cafe-list'),
  emptyState:         $('empty-state'),
  errorState:         $('error-state'),
  errorMsg:           $('error-msg'),
  retryBtn:           $('retry-btn'),
  toggleSidebarBtn:   $('toggle-sidebar-btn'),
  mapLocateBtn:       $('map-locate-btn'),
  // Detail card
  detailCard:         $('detail-card'),
  closeDetailBtn:     $('close-detail-btn'),
  detailPhotoWrap:    $('detail-photo-wrap'),
  detailPhotoSkeleton:$('detail-photo-skeleton'),
  detailPhoto:        $('detail-photo'),
  detailName:         $('detail-name'),
  detailOpenBadge:    $('detail-open-badge'),
  detailHoursInline:  $('detail-hours-inline'),
  detailRating:       $('detail-rating'),
  detailDistance:     $('detail-distance'),
  detailAddress:      $('detail-address'),
  detailAddressText:  $('detail-address-text'),
  detailPhone:        $('detail-phone'),
  detailPhoneLink:    $('detail-phone-link'),
  detailFullHours:    $('detail-full-hours'),
  detailHoursText:    $('detail-hours-text'),
  detailWebsite:      $('detail-website'),
  detailWebsiteLink:  $('detail-website-link'),
  detailCuisine:      $('detail-cuisine'),
  detailCuisineText:  $('detail-cuisine-text'),
  getDirectionsBtn:   $('get-directions-btn'),
  copyLinkBtn:        $('copy-link-btn'),
  // Directions panel
  directionsPanel:    $('directions-panel'),
  closeDirectionsBtn: $('close-directions-btn'),
  dirDestName:        $('dir-dest-name'),
  dirSummary:         $('dir-summary'),
  dirDistance:        $('dir-distance'),
  dirTime:            $('dir-time'),
  dirLoading:         $('dir-loading'),
  dirError:           $('dir-error'),
  dirErrorMsg:        $('dir-error-msg'),
  dirSteps:           $('dir-steps'),
  toast:              $('toast')
};

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function init() {
  initMap();
  bindEvents();
}

/* ─────────────────────────────────────────
   MAP INIT
───────────────────────────────────────── */
function initMap() {
  state.map = L.map('map', {
    center: [CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG],
    zoom:   CONFIG.DEFAULT_ZOOM,
    zoomControl: false
  });

  L.tileLayer(CONFIG.TILE_URL, {
    attribution: CONFIG.TILE_ATTR,
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(state.map);

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  state.map.on('click', () => {
    closeDetailCard();
    deselectAll();
  });
}

/* ─────────────────────────────────────────
   EVENT BINDING
───────────────────────────────────────── */
function bindEvents() {
  dom.locationInput.addEventListener('input', onInputChange);
  dom.locationInput.addEventListener('keydown', onInputKeydown);
  dom.locationInput.addEventListener('focus', () => {
    if (dom.locationInput.value.trim().length >= 2) showAutocomplete();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) closeAutocomplete();
  });

  dom.clearBtn.addEventListener('click', clearSearch);
  dom.searchBtn.addEventListener('click', handleSearch);
  dom.locateBtn.addEventListener('click', getUserLocation);
  dom.mapLocateBtn.addEventListener('click', getUserLocation);
  dom.toggleSidebarBtn.addEventListener('click', toggleSidebar);

  dom.refreshBtn.addEventListener('click', () => {
    if (state.lastSearchLatLng) searchCafes(state.lastSearchLatLng.lat, state.lastSearchLatLng.lng);
  });

  dom.retryBtn.addEventListener('click', () => {
    if (state.lastSearchLatLng) searchCafes(state.lastSearchLatLng.lat, state.lastSearchLatLng.lng);
  });

  dom.sortSelect.addEventListener('change', () => {
    if (state.cafes.length) renderCafeList(state.cafes);
  });

  dom.closeDetailBtn.addEventListener('click', () => {
    closeDetailCard();
    deselectAll();
  });

  dom.copyLinkBtn.addEventListener('click', copyCurrentLink);

  // Get Directions button
  dom.getDirectionsBtn.addEventListener('click', () => {
    if (state.selectedCafe) startDirections(state.selectedCafe);
  });

  // Close directions
  dom.closeDirectionsBtn.addEventListener('click', closeDirections);

  // Transport mode buttons
  document.querySelectorAll('.dir-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dir-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.routeMode = btn.dataset.mode;
      if (state.selectedCafe && state.directionsActive) {
        buildRoute(state.selectedCafe);
      }
    });
  });
}

/* ─────────────────────────────────────────
   SEARCH INPUT HANDLERS
───────────────────────────────────────── */
function onInputChange() {
  const val = dom.locationInput.value.trim();
  dom.clearBtn.classList.toggle('hidden', val.length === 0);
  clearTimeout(state.autocompleteTimeout);
  if (val.length < 2) { closeAutocomplete(); return; }
  state.autocompleteTimeout = setTimeout(() => fetchAutocomplete(val), CONFIG.AUTOCOMPLETE_DELAY);
}

function onInputKeydown(e) {
  const items = dom.autocomplete.querySelectorAll('.autocomplete-item');
  const activeIdx = [...items].findIndex(i => i.classList.contains('active'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = (activeIdx + 1) % items.length;
    items.forEach(i => i.classList.remove('active'));
    if (items[next]) items[next].classList.add('active');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = (activeIdx - 1 + items.length) % items.length;
    items.forEach(i => i.classList.remove('active'));
    if (items[prev]) items[prev].classList.add('active');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIdx >= 0 && items[activeIdx]) items[activeIdx].click();
    else handleSearch();
  } else if (e.key === 'Escape') {
    closeAutocomplete();
  }
}

function clearSearch() {
  dom.locationInput.value = '';
  dom.clearBtn.classList.add('hidden');
  closeAutocomplete();
  dom.locationInput.focus();
}

/* ─────────────────────────────────────────
   AUTOCOMPLETE
───────────────────────────────────────── */
async function fetchAutocomplete(query) {
  try {
    const url = `${CONFIG.PHOTON_URL}/?q=${encodeURIComponent(query)}&limit=5&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    renderAutocomplete(data.features || []);
  } catch { /* silent */ }
}

function buildPhotonName(feature) {
  const p = feature.properties || {};
  const parts = [p.name, p.street, p.city, p.state, p.country].filter(Boolean);
  return parts.join(', ');
}

function renderAutocomplete(results) {
  dom.autocomplete.innerHTML = '';
  if (!results.length) { closeAutocomplete(); return; }
  results.forEach(feature => {
    const p = feature.properties || {};
    const coords = feature.geometry?.coordinates || [];
    const name = buildPhotonName(feature);
    const li = document.createElement('li');
    li.className = 'autocomplete-item';
    li.setAttribute('role', 'option');
    li.innerHTML = `<span class="ac-icon">📍</span><span>${escapeHtml(name)}</span>`;
    li.addEventListener('click', () => {
      dom.locationInput.value = name;
      dom.clearBtn.classList.remove('hidden');
      closeAutocomplete();
      flyToAndSearch(coords[1], coords[0]);
    });
    dom.autocomplete.appendChild(li);
  });
  showAutocomplete();
}

function showAutocomplete() { dom.autocomplete.classList.remove('hidden'); }
function closeAutocomplete() { dom.autocomplete.classList.add('hidden'); }

/* ─────────────────────────────────────────
   MAIN SEARCH
───────────────────────────────────────── */
async function handleSearch() {
  const query = dom.locationInput.value.trim();
  closeAutocomplete();

  if (!query) {
    showToast('Please enter a location to search', 'error');
    dom.locationInput.focus();
    return;
  }

  setStatus('Geocoding location...');
  try {
    const url = `${CONFIG.PHOTON_URL}/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    const features = data.features || [];
    if (!features.length) {
      clearStatus();
      showError('Location not found. Try a different search term.');
      return;
    }
    const coords = features[0].geometry.coordinates;
    flyToAndSearch(coords[1], coords[0]);
  } catch {
    clearStatus();
    showError('Could not geocode location. Check your internet connection.');
  }
}

function flyToAndSearch(lat, lng) {
  state.map.flyTo([lat, lng], CONFIG.SEARCH_ZOOM, { duration: 1.2 });
  setTimeout(() => searchCafes(lat, lng), 800);
}

/* ─────────────────────────────────────────
   OVERPASS CAFE SEARCH
───────────────────────────────────────── */
async function fetchOverpass(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${CONFIG.OVERPASS_PROXY}?data=${encodeURIComponent(query)}`, {
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Overpass proxy error ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchCafes(lat, lng) {
  if (state.isLoading) return;
  state.isLoading = true;
  state.lastSearchLatLng = { lat, lng };

  const radius = parseInt(dom.radiusSelect.value, 10);
  setStatus(`Finding cafés within ${radius >= 1000 ? radius / 1000 + ' km' : radius + ' m'}...`);
  hideError();
  hideEmpty();
  clearMarkers();
  closeDetailCard();
  closeDirections();

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="cafe"](around:${radius},${lat},${lng});
      way["amenity"="cafe"](around:${radius},${lat},${lng});
      node["amenity"="coffee_shop"](around:${radius},${lat},${lng});
    );
    out body center;
  `.trim();

  try {
    const data = await fetchOverpass(query);

    state.cafes = parseOverpassResults(data && data.elements ? data.elements : [], lat, lng);
    clearStatus();
    state.isLoading = false;

    if (!state.cafes.length) {
      showEmpty();
      dom.resultsHeader.classList.add('hidden');
      showToast('No cafés found. Try increasing the radius.', 'error');
      return;
    }

    renderCafeList(state.cafes);
    placeMarkers(state.cafes);
    showToast(`Found ${state.cafes.length} café${state.cafes.length !== 1 ? 's' : ''}! ☕`, 'success');
  } catch (err) {
    clearStatus();
    state.isLoading = false;
    showError('Failed to fetch café data. Check your internet and try again.');
    console.error(err);
  }
}

/* ─────────────────────────────────────────
   PARSE OVERPASS RESULTS
───────────────────────────────────────── */
function parseOverpassResults(elements, userLat, userLng) {
  return elements.map(el => {
    const tags = el.tags || {};
    const lat  = el.lat  ?? el.center?.lat;
    const lng  = el.lon  ?? el.center?.lon;
    if (!lat || !lng) return null;

    const dist = haversine(userLat, userLng, lat, lng);
    const stars = parseFloat(tags['stars'] || tags['rating'] || '0') || 0;
    const openingHours = tags.opening_hours || null;
    const hoursInfo = parseOpeningHours(openingHours);

    return {
      id: `${el.type}-${el.id}`,
      name: tags.name || tags['name:en'] || 'Unnamed Café',
      lat, lng, dist,
      address:      buildAddress(tags),
      phone:        tags.phone || tags['contact:phone'] || null,
      website:      tags.website || tags['contact:website'] || null,
      openingHours,
      hoursInfo,
      stars,
      cuisine:      tags.cuisine || null,
      wheelchair:   tags.wheelchair || null,
      wifi:         tags.internet_access || null,
      takeaway:     tags.takeaway || null,
      outdoor:      tags.outdoor_seating || null,
      imageUrl:     tags.image || tags['contact:photo'] || null,
      wikimedia:    tags.wikimedia_commons || null,
      tags
    };
  }).filter(Boolean);
}

function buildAddress(tags) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:suburb'],
    tags['addr:country']
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/* ─────────────────────────────────────────
   OPENING HOURS PARSER
   Handles the most common OSM formats:
   "Mo-Fr 09:00-18:00", "24/7",
   "Mo-Sa 08:00-20:00; Su off", etc.
───────────────────────────────────────── */
const DAY_ABBR  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_INDEX = { Su:0, Mo:1, Tu:2, We:3, Th:4, Fr:5, Sa:6 };

function parseOpeningHours(str) {
  if (!str) return { status: 'unknown', label: null, todayHours: null, raw: null };

  const s = str.trim();

  // 24/7 special case
  if (s === '24/7') return { status: 'open', label: 'Open 24/7', todayHours: '00:00 – 00:00', raw: s };

  const now      = new Date();
  const todayAbbr = DAY_ABBR[now.getDay()];
  const nowMins  = now.getHours() * 60 + now.getMinutes();

  // Split rules by ";"
  const rules = s.split(';').map(r => r.trim()).filter(Boolean);

  for (const rule of rules) {
    // Match "DAYS HH:MM-HH:MM" — e.g. "Mo-Fr 09:00-18:00"
    const m = rule.match(/^([\w,\-]+)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;

    const [, daysPart, openStr, closeStr] = m;

    // "off" means closed — skip
    if (closeStr === 'off') continue;

    if (!dayMatchesToday(daysPart, todayAbbr)) continue;

    const openMins  = toMins(openStr);
    const closeMins = toMins(closeStr);

    // Handle overnight (e.g. 22:00-02:00)
    const isOpen = closeMins > openMins
      ? nowMins >= openMins && nowMins < closeMins
      : nowMins >= openMins || nowMins < closeMins;

    const todayHours = `${openStr} – ${closeStr}`;

    if (isOpen) {
      return {
        status: 'open',
        label:  `Open · closes ${closeStr}`,
        todayHours,
        raw: s
      };
    } else {
      // Determine when it opens next
      const label = nowMins < openMins
        ? `Closed · opens ${openStr}`
        : `Closed today`;
      return { status: 'closed', label, todayHours, raw: s };
    }
  }

  // Check if any rule says today is "off"
  for (const rule of rules) {
    const m = rule.match(/^([\w,\-]+)\s+off$/i);
    if (m && dayMatchesToday(m[1], todayAbbr)) {
      return { status: 'closed', label: 'Closed today', todayHours: null, raw: s };
    }
  }

  // Has opening_hours string but couldn't parse today's rule
  return { status: 'unknown', label: 'Check opening hours', todayHours: null, raw: s };
}

function dayMatchesToday(daysPart, today) {
  // Comma list: "Mo,We,Fr"
  if (daysPart.includes(',')) {
    return daysPart.split(',').some(d => d.trim() === today);
  }
  // Range: "Mo-Fr"
  if (daysPart.includes('-')) {
    const [start, end] = daysPart.split('-').map(d => d.trim());
    const si = DAY_INDEX[start] ?? -1;
    const ei = DAY_INDEX[end]   ?? -1;
    const ti = DAY_INDEX[today] ?? -1;
    if (si === -1 || ei === -1 || ti === -1) return false;
    if (si <= ei) return ti >= si && ti <= ei;
    // Wraps Sunday (e.g. Fr-Mo)
    return ti >= si || ti <= ei;
  }
  // Single day
  return daysPart.trim() === today;
}

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/* ─────────────────────────────────────────
   CAFE PHOTO  (Mapillary → OSM → Wikimedia → fallback)
───────────────────────────────────────── */
async function fetchCafePhoto(cafe) {
  // 1. Direct OSM image tag (highest priority — exact photo)
  if (cafe.imageUrl && /^https?:\/\//.test(cafe.imageUrl)) {
    return cafe.imageUrl;
  }

  // 2. Wikimedia Commons file linked from OSM
  if (cafe.wikimedia) {
    try {
      const file = cafe.wikimedia.replace(/^(File:|Image:)/i, '');
      const url  = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(file)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
      const res  = await fetch(url);
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      const imgUrl = pages[0]?.imageinfo?.[0]?.url;
      if (imgUrl) return imgUrl;
    } catch { /* fallthrough */ }
  }

  // 3. Mapillary — real street-level photos near the cafe's coordinates
  //    API: closeto=lng,lat (longitude FIRST), radius in metres
  try {
    const url = [
      CONFIG.MAPILLARY_URL,
      `?access_token=${CONFIG.MAPILLARY_TOKEN}`,
      `&fields=thumb_1024_url,thumb_original_url`,
      `&closeto=${cafe.lng},${cafe.lat}`,  // Mapillary uses lng,lat order
      `&radius=150`,                        // search within 150 m of the cafe
      `&limit=10`
    ].join('');

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // Pick the first image that has a usable thumbnail
      const img = (data.data || []).find(i => i.thumb_1024_url || i.thumb_original_url);
      if (img) {
        return img.thumb_1024_url || img.thumb_original_url;
      }
    }
  } catch (err) {
    console.warn('[BrewMap] Mapillary fetch failed:', err);
  }

  // 4. loremflickr — generic cafe stock photo as last resort
  const hash = Math.abs(simpleHash(cafe.name)) % 1000;
  return `https://loremflickr.com/640/300/cafe,coffee,interior?lock=${hash}`;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

/* ─────────────────────────────────────────
   SORT CAFES
───────────────────────────────────────── */
function sortCafes(cafes) {
  const sort = dom.sortSelect.value;
  const arr  = [...cafes];
  if (sort === 'distance') arr.sort((a, b) => a.dist - b.dist);
  else if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'rating') arr.sort((a, b) => b.stars - a.stars);
  return arr;
}

/* ─────────────────────────────────────────
   RENDER CAFE LIST
───────────────────────────────────────── */
function renderCafeList(cafes) {
  const sorted = sortCafes(cafes).slice(0, CONFIG.MAX_RESULTS);
  dom.cafeList.innerHTML = '';
  hideEmpty();
  hideError();

  dom.resultsHeader.classList.remove('hidden');
  dom.resultsCount.textContent = `${cafes.length} café${cafes.length !== 1 ? 's' : ''} found`;

  sorted.forEach((cafe, idx) => {
    const li   = document.createElement('li');
    li.className = 'cafe-item';
    li.setAttribute('role', 'listitem');
    li.setAttribute('data-id', cafe.id);
    li.style.animationDelay = `${idx * 0.03}s`;

    const hi = cafe.hoursInfo;
    const statusClass = hi.status === 'open' ? 'status-open'
      : hi.status === 'closed' ? 'status-closed'
      : 'status-unknown';
    const statusLabel = hi.label || '';

    const tags = buildTagBadges(cafe);

    // Only render stars if the cafe has actual rating data
    const ratingHtml = cafe.stars > 0
      ? `<span class="cafe-item-rating">
           ${renderStars(cafe.stars)}
           <span style="color:var(--text-muted);font-size:0.72rem;margin-left:2px">${cafe.stars.toFixed(1)}</span>
         </span>`
      : `<span style="font-size:0.72rem;color:var(--text-muted)">No rating</span>`;

    li.innerHTML = `
      <div class="cafe-item-top">
        <span class="cafe-item-name">${escapeHtml(cafe.name)}</span>
        <span class="cafe-item-dist">${formatDist(cafe.dist)}</span>
      </div>
      <div class="cafe-item-bottom">
        ${ratingHtml}
        ${statusLabel ? `<span class="cafe-item-status ${statusClass}">${escapeHtml(statusLabel)}</span>` : ''}
      </div>
      ${tags ? `<div class="cafe-item-tags">${tags}</div>` : ''}
    `;

    li.addEventListener('click', () => selectCafe(cafe));
    dom.cafeList.appendChild(li);
  });
}

function buildTagBadges(cafe) {
  const badges = [];
  if (cafe.wifi === 'yes' || cafe.wifi === 'wlan') badges.push('📶 WiFi');
  if (cafe.outdoor === 'yes') badges.push('🌿 Outdoor');
  if (cafe.takeaway === 'yes') badges.push('🥡 Takeaway');
  if (cafe.wheelchair === 'yes') badges.push('♿ Accessible');
  return badges.map(b => `<span class="tag">${b}</span>`).join('');
}

/* ─────────────────────────────────────────
   PLACE MARKERS
───────────────────────────────────────── */
function placeMarkers(cafes) {
  cafes.forEach(cafe => {
    const icon   = createCafeIcon(false);
    const marker = L.marker([cafe.lat, cafe.lng], { icon }).addTo(state.map);

    const ratingLine = cafe.stars > 0
      ? `${renderStarsText(cafe.stars)} (${cafe.stars.toFixed(1)}) · ${formatDist(cafe.dist)}`
      : `No rating · ${formatDist(cafe.dist)}`;

    const popupHtml = `
      <div class="map-popup">
        <div class="map-popup-name">${escapeHtml(cafe.name)}</div>
        <div class="map-popup-rating">${ratingLine}</div>
        <button class="map-popup-btn" onclick="window._selectCafeById('${cafe.id}')">View Details</button>
      </div>`;

    marker.bindPopup(popupHtml, { maxWidth: 210 });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      selectCafe(cafe);
    });

    marker._cafeId = cafe.id;
    state.cafeMarkers.push(marker);
  });

  window._selectCafeById = (id) => {
    const cafe = state.cafes.find(c => c.id === id);
    if (cafe) selectCafe(cafe);
  };

  if (cafes.length > 0) {
    const group = L.featureGroup(state.cafeMarkers);
    state.map.fitBounds(group.getBounds().pad(0.15));
  }
}

function createCafeIcon(active) {
  return L.divIcon({
    className: `custom-marker${active ? ' marker-active' : ''}`,
    html: `<div class="marker-pin"><span class="marker-icon">☕</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
  });
}

function clearMarkers() {
  state.cafeMarkers.forEach(m => state.map.removeLayer(m));
  state.cafeMarkers = [];
}

/* ─────────────────────────────────────────
   SELECT CAFE
───────────────────────────────────────── */
function selectCafe(cafe) {
  state.selectedId   = cafe.id;
  state.selectedCafe = cafe;

  document.querySelectorAll('.cafe-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === cafe.id);
  });

  const listItem = document.querySelector(`.cafe-item[data-id="${cafe.id}"]`);
  if (listItem) listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  state.cafeMarkers.forEach(m => {
    const isActive = m._cafeId === cafe.id;
    m.setIcon(createCafeIcon(isActive));
    if (isActive) m.openPopup();
  });

  state.map.panTo([cafe.lat, cafe.lng], { animate: true, duration: 0.5 });
  showDetailCard(cafe);
}

function deselectAll() {
  state.selectedId   = null;
  state.selectedCafe = null;
  document.querySelectorAll('.cafe-item').forEach(el => el.classList.remove('active'));
  state.cafeMarkers.forEach(m => m.setIcon(createCafeIcon(false)));
}

/* ─────────────────────────────────────────
   DETAIL CARD  (photo + hours + stars)
───────────────────────────────────────── */
function showDetailCard(cafe) {
  // ── Name
  dom.detailName.textContent = cafe.name;

  // ── Distance
  dom.detailDistance.textContent = `${formatDist(cafe.dist)} away`;

  // ── Star Rating
  const starsHtml = cafe.stars > 0
    ? `<div class="rating-stars">${renderStars(cafe.stars)}</div>
       <span class="rating-label">${cafe.stars.toFixed(1)} / 5</span>`
    : `<span class="rating-label" style="color:var(--text-muted)">No rating available</span>`;
  dom.detailRating.innerHTML = starsHtml;

  // ── Open / Closed badge
  const hi = cafe.hoursInfo;
  if (hi.status === 'open') {
    dom.detailOpenBadge.className = 'open-badge is-open';
    dom.detailOpenBadge.textContent = 'Open now';
    dom.detailHoursInline.textContent = hi.todayHours ? `· ${hi.todayHours}` : '';
  } else if (hi.status === 'closed') {
    dom.detailOpenBadge.className = 'open-badge is-closed';
    dom.detailOpenBadge.textContent = 'Closed';
    dom.detailHoursInline.textContent = hi.label ? `· ${hi.label.replace('Closed · ', '')}` : '';
  } else if (hi.raw) {
    dom.detailOpenBadge.className = 'open-badge is-unknown';
    dom.detailOpenBadge.textContent = 'Hours vary';
    dom.detailHoursInline.textContent = '';
  } else {
    dom.detailOpenBadge.className = 'open-badge is-unknown';
    dom.detailOpenBadge.textContent = 'Hours unknown';
    dom.detailHoursInline.textContent = '';
  }

  // ── Full opening hours row
  if (hi.raw) {
    dom.detailHoursText.textContent = hi.raw;
    dom.detailFullHours.classList.remove('hidden');
  } else {
    dom.detailFullHours.classList.add('hidden');
  }

  // ── Address
  if (cafe.address) {
    dom.detailAddressText.textContent = cafe.address;
    dom.detailAddress.classList.remove('hidden');
  } else {
    dom.detailAddress.classList.add('hidden');
  }

  // ── Phone
  if (cafe.phone) {
    dom.detailPhoneLink.textContent = cafe.phone;
    dom.detailPhoneLink.href = `tel:${cafe.phone}`;
    dom.detailPhone.classList.remove('hidden');
  } else {
    dom.detailPhone.classList.add('hidden');
  }

  // ── Website
  if (cafe.website) {
    const url = cafe.website.startsWith('http') ? cafe.website : 'https://' + cafe.website;
    dom.detailWebsiteLink.href = url;
    try { dom.detailWebsiteLink.textContent = new URL(url).hostname; }
    catch { dom.detailWebsiteLink.textContent = cafe.website; }
    dom.detailWebsite.classList.remove('hidden');
  } else {
    dom.detailWebsite.classList.add('hidden');
  }

  // ── Cuisine
  if (cafe.cuisine) {
    dom.detailCuisineText.textContent = cafe.cuisine.replace(/_/g, ' ');
    dom.detailCuisine.classList.remove('hidden');
  } else {
    dom.detailCuisine.classList.add('hidden');
  }

  // ── Show card first, then load photo
  dom.detailCard.classList.remove('hidden');
  loadCafePhoto(cafe);
}

function closeDetailCard() {
  dom.detailCard.classList.add('hidden');
  // Reset photo
  dom.detailPhoto.src = '';
  dom.detailPhoto.classList.remove('loaded');
  dom.detailPhotoSkeleton.style.display = 'flex';
}

/* ─────────────────────────────────────────
   LOAD CAFE PHOTO
───────────────────────────────────────── */
async function loadCafePhoto(cafe) {
  dom.detailPhoto.src = '';
  dom.detailPhoto.classList.remove('loaded');
  dom.detailPhotoSkeleton.style.display = 'flex';

  try {
    const url = await fetchCafePhoto(cafe);

    const img  = new Image();
    img.onload = () => {
      dom.detailPhoto.src = url;
      dom.detailPhotoSkeleton.style.display = 'none';
      // Small RAF delay for smooth transition
      requestAnimationFrame(() => dom.detailPhoto.classList.add('loaded'));
    };
    img.onerror = () => {
      // Fallback — generic photo
      const fallback = `https://loremflickr.com/640/300/coffee,cafe?lock=${Math.floor(Math.random()*500)}`;
      dom.detailPhoto.src = fallback;
      dom.detailPhotoSkeleton.style.display = 'none';
      requestAnimationFrame(() => dom.detailPhoto.classList.add('loaded'));
    };
    img.src = url;
  } catch {
    dom.detailPhotoSkeleton.style.display = 'flex';
  }
}

/* ─────────────────────────────────────────
   IN-APP DIRECTIONS (Leaflet Routing Machine)
───────────────────────────────────────── */
function startDirections(cafe) {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported by your browser', 'error');
    return;
  }

  // Switch sidebar to directions panel
  dom.cafeList.style.display = 'none';
  dom.resultsHeader.classList.add('hidden');
  dom.emptyState.classList.add('hidden');
  dom.directionsPanel.classList.remove('hidden');
  state.directionsActive = true;

  dom.dirDestName.textContent = cafe.name;

  // Reset directions UI
  dom.dirSummary.classList.add('hidden');
  dom.dirError.classList.add('hidden');
  dom.dirLoading.style.display = 'flex';
  dom.dirSteps.innerHTML = '';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      state.userLatLng = { lat, lng };

      // Place / update user marker
      if (state.userMarker) state.map.removeLayer(state.userMarker);
      const userIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="user-marker-dot"></div>',
        iconSize: [18, 18], iconAnchor: [9, 9]
      });
      state.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(state.map)
        .bindPopup('<div style="font-size:0.85rem;color:var(--text-primary)">📍 You are here</div>');

      buildRoute(cafe);
    },
    (err) => {
      dom.dirLoading.style.display = 'none';
      dom.dirError.classList.remove('hidden');
      const msgs = {
        1: 'Location permission denied.',
        2: 'Location unavailable.',
        3: 'Location request timed out.'
      };
      dom.dirErrorMsg.textContent = msgs[err.code] || 'Could not get your location.';
    },
    { timeout: 12000, enableHighAccuracy: true }
  );
}

function buildRoute(cafe) {
  if (!state.userLatLng) return;

  dom.dirLoading.style.display = 'flex';
  dom.dirSummary.classList.add('hidden');
  dom.dirError.classList.add('hidden');
  dom.dirSteps.innerHTML = '';

  // Remove old routing control
  if (state.routingControl) {
    state.map.removeControl(state.routingControl);
    state.routingControl = null;
  }

  const from = L.latLng(state.userLatLng.lat, state.userLatLng.lng);
  const to   = L.latLng(cafe.lat, cafe.lng);

  // Choose router service URL based on mode
  const serviceUrl = CONFIG.OSRM[state.routeMode] || CONFIG.OSRM.driving;

  state.routingControl = L.Routing.control({
    waypoints: [from, to],
    routeWhileDragging: false,
    addWaypoints: false,
    show: false,                    // hide built-in panel
    router: L.Routing.osrmv1({
      serviceUrl,
      profile: state.routeMode === 'driving' ? 'driving'
             : state.routeMode === 'cycling' ? 'bike'
             : 'foot'
    }),
    lineOptions: {
      styles: [
        { color: '#f59e0b', weight: 6, opacity: 0.85 },
        { color: '#fcd34d', weight: 2, opacity: 0.6, dashArray: '8 6' }
      ],
      extendToWaypoints: true,
      missingRouteTolerance: 0
    },
    createMarker: () => null   // use our own markers
  }).addTo(state.map);

  state.routingControl.on('routesfound', (e) => {
    const route = e.routes[0];
    renderDirectionSteps(route, cafe);
    // Fit bounds to route
    if (route.bounds) state.map.fitBounds(route.bounds, { padding: [40, 40] });
  });

  state.routingControl.on('routingerror', () => {
    dom.dirLoading.style.display = 'none';
    dom.dirError.classList.remove('hidden');
    dom.dirErrorMsg.textContent = 'Could not calculate route. Try a different transport mode.';
  });
}

function renderDirectionSteps(route, cafe) {
  dom.dirLoading.style.display = 'none';

  const rawDist = route.summary?.totalDistance ?? 0;

  // Always calculate time from distance using real-world speeds
  // OSRM's free demo server often returns unrealistic times, so we rely on our own estimate.
  const estTime = estimateTravelTime(rawDist, state.routeMode);

  // Summary
  dom.dirDistance.textContent = formatDist(rawDist);
  dom.dirTime.textContent     = formatDuration(estTime) + ' (est.)';
  dom.dirSummary.classList.remove('hidden');

  // Steps
  dom.dirSteps.innerHTML = '';
  const steps = route.instructions || [];

  steps.forEach((step, idx) => {
    const li = document.createElement('li');
    li.className = 'dir-step';
    li.style.animationDelay = `${idx * 0.03}s`;

    const icon = directionIcon(step.type);
    const dist = step.distance > 0 ? formatDist(step.distance) : '';

    li.innerHTML = `
      <div class="dir-step-num">${idx === steps.length - 1 ? '🏁' : idx + 1}</div>
      <div class="dir-step-body">
        <div class="dir-step-instruction">${icon} ${escapeHtml(step.text || '')}</div>
        ${dist ? `<div class="dir-step-dist">${dist}</div>` : ''}
      </div>`;

    dom.dirSteps.appendChild(li);
  });
}

function directionIcon(type) {
  const icons = {
    'Left':            '↰',
    'SlightLeft':      '↖',
    'SharpLeft':       '↺',
    'Right':           '↱',
    'SlightRight':     '↗',
    'SharpRight':      '↻',
    'Straight':        '↑',
    'WaypointReached': '📍',
    'Roundabout':      '🔄',
    'DestinationReached': '🏁',
    'Head':            '🚀',
    'EndOfRoad':       '⛔'
  };
  return icons[type] || '→';
}

/**
 * Travel time estimate based on distance and real-world average speeds.
 * OSRM's free demo server returns unreliable times, so this is used as the primary source.
 */
function estimateTravelTime(distanceMeters, mode) {
  const avgSpeedKmh = {
    driving: 24,   // ~2.5 min per km — realistic urban driving
    cycling: 14,   // ~4.3 min per km
    walking:  5    // ~12 min per km
  };
  const kmh = avgSpeedKmh[mode] || 24;
  return Math.round((distanceMeters / 1000 / kmh) * 3600);
}

function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  if (s <= 0) return 'N/A';
  // Sanity check: if value is suspiciously large it might be milliseconds
  const effectiveSeconds = s > 86400 * 2 ? Math.round(s / 1000) : s;
  const h = Math.floor(effectiveSeconds / 3600);
  const m = Math.floor((effectiveSeconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m > 0 ? m + ' min' : ''}`;
  if (m === 0) return '< 1 min';
  return `${m} min`;
}

function closeDirections() {
  state.directionsActive = false;
  dom.directionsPanel.classList.add('hidden');
  dom.cafeList.style.display = '';

  if (state.cafes.length) {
    dom.resultsHeader.classList.remove('hidden');
  } else {
    dom.emptyState.classList.remove('hidden');
  }

  // Remove route from map
  if (state.routingControl) {
    state.map.removeControl(state.routingControl);
    state.routingControl = null;
  }
}

/* ─────────────────────────────────────────
   COPY LINK
───────────────────────────────────────── */
function copyCurrentLink() {
  if (!state.selectedId) return;
  const cafe = state.cafes.find(c => c.id === state.selectedId);
  if (!cafe) return;
  const url = `https://www.openstreetmap.org/?mlat=${cafe.lat}&mlon=${cafe.lng}&zoom=17`;
  navigator.clipboard.writeText(url)
    .then(()  => showToast('Link copied to clipboard! 🔗', 'success'))
    .catch(()  => showToast('Could not copy link', 'error'));
}

/* ─────────────────────────────────────────
   USER GEOLOCATION
───────────────────────────────────────── */
function getUserLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  setStatus('Getting your location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      state.userLatLng = { lat, lng };
      clearStatus();

      if (state.userMarker) state.map.removeLayer(state.userMarker);
      const userIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="user-marker-dot"></div>',
        iconSize: [18, 18], iconAnchor: [9, 9]
      });
      state.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(state.map)
        .bindPopup('<div style="font-size:0.85rem;color:var(--text-primary)">📍 You are here</div>');

      dom.locationInput.value = 'My Current Location';
      dom.clearBtn.classList.remove('hidden');

      flyToAndSearch(lat, lng);
      showToast('Location found! Searching nearby cafés...', 'success');
    },
    (err) => {
      clearStatus();
      const msgs = {
        1: 'Location permission denied.',
        2: 'Location unavailable.',
        3: 'Location request timed out.'
      };
      showToast(msgs[err.code] || 'Could not get location', 'error');
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

/* ─────────────────────────────────────────
   SIDEBAR TOGGLE
───────────────────────────────────────── */
function toggleSidebar() {
  dom.sidebar.classList.toggle('collapsed');
  dom.toggleSidebarBtn.textContent = dom.sidebar.classList.contains('collapsed') ? '▷' : '☰';
  setTimeout(() => state.map.invalidateSize(), 420);
}

/* ─────────────────────────────────────────
   STATUS / ERROR / EMPTY HELPERS
───────────────────────────────────────── */
function setStatus(text) {
  dom.statusText.textContent = text;
  dom.statusBar.classList.remove('hidden');
}
function clearStatus() { dom.statusBar.classList.add('hidden'); }

function showError(msg) {
  dom.errorMsg.textContent = msg;
  dom.errorState.style.display = 'flex';
  dom.emptyState.classList.add('hidden');
  dom.resultsHeader.classList.add('hidden');
  dom.cafeList.innerHTML = '';
}
function hideError() { dom.errorState.style.display = 'none'; }

function showEmpty() {
  dom.emptyState.classList.remove('hidden');
  dom.cafeList.innerHTML = '';
}
function hideEmpty() { dom.emptyState.classList.add('hidden'); }

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
let toastTimer = null;
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  dom.toast.textContent = msg;
  dom.toast.className = `toast${type ? ' ' + type : ''}`;
  dom.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), 3500);
}

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDist(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function renderStars(stars) {
  const n = Math.round(stars);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= n ? 'star-filled' : 'star-empty'}">★</span>`;
  }
  return html;
}

function renderStarsText(stars) {
  const n = Math.round(stars);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────
   START
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
