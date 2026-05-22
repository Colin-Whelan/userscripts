// ==UserScript==
// @name         Indigo Stock Map v2
// @namespace    https://github.com/Colin-Whelan/userscripts/
// @version      2.0.0
// @description  Interactive Canada store stock map — search SKUs, see per-store inventory on a map with colored dots. Uses Constructor.io + Shopify GraphQL + Stockist APIs.
// @author       Colin Whelan
// @match        https://www.indigo.ca/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
// @resource     LEAFLET_CSS https://unpkg.com/leaflet@1.9.4/dist/leaflet.css
// @grant        GM_getResourceText
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // ── Constants ───────────────────────────────────────────
  const SCRIPT_NAME = 'IndigoStockMap';
  const SEARCH_URL = 'https://ac.cnstrc.com/search';
  const STOCKIST_URL = 'https://stockist.co/api/v1/map_83p8y8j3/locations/all';
  const GRAPHQL_URL = 'https://www.indigo.ca/api/2025-01/graphql.json';
  const STOREFRONT_TOKEN = '1043035995da62a53e5181ef22b1b733';
  const INDIGO_BASE = 'https://www.indigo.ca';
  const METAOBJECT_BATCH_SIZE = 20;
  const GRAPHQL_CONCURRENCY = 3;

  const DEFAULT_CONFIG = {
    apiKey: '',
    keybind: 'alt+shift+m',
    thresholdHigh: 10,
    thresholdMedium: 5,
    thresholdLow: 1,
    devMode: false,
  };

  // ── Config ──────────────────────────────────────────────
  function getConfig() {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(GM_getValue('stockmap_config', '{}')) }; }
    catch { return { ...DEFAULT_CONFIG }; }
  }
  function saveConfigToStorage(cfg) { GM_setValue('stockmap_config', JSON.stringify(cfg)); }
  let config = getConfig();

  // ── Debug ────────────────────────────────────────────────
  const dbg = (...args) => { if (config.devMode) console.log(`[${SCRIPT_NAME}:DBG]`, ...args); };
  let devLog = []; // structured log entries for raw data tab

  // ── Logging ─────────────────────────────────────────────
  const log = (msg, ...args) => console.log(`[${SCRIPT_NAME}]`, msg, ...args);
  const warn = (msg, ...args) => console.warn(`[${SCRIPT_NAME}]`, msg, ...args);

  // ── Utilities ───────────────────────────────────────────
  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatPrice(p) {
    return (p || p === 0) ? `$${Number(p).toFixed(2)}` : '';
  }

  function buildUrl(handle, variantId) {
    return variantId ? `${INDIGO_BASE}/products/${handle}?variant=${variantId}` : `${INDIGO_BASE}/products/${handle}`;
  }

  // ── Concurrent Pool ─────────────────────────────────────
  async function pool(tasks, limit, onResult) {
    let idx = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (idx < tasks.length) {
        const i = idx++;
        const result = await tasks[i]();
        if (onResult) onResult(result, i);
      }
    });
    await Promise.all(workers);
  }

  // ── State ───────────────────────────────────────────────
  let overlay = null;
  let leafletMap = null;
  let mapMarkers = [];

  // Cached store data
  let stockistStores = null;    // Map<storeId, {id, name, lat, lng, city, state, address, postalCode, handle}>
  let shopifyLocationMap = null; // Map<shopifyLocationId, {storeId, handle, title, ...}>
  let storeDataReady = false;
  let storeDataLoading = false;

  // Product data
  let products = [];
  let selectedIdx = 0;
  let selectedVariantIdx = {};
  let variantInventory = {};  // Map<shopifyVariantId, Map<shopifyLocationId, quantity>>

  // ── API: Stockist Stores ────────────────────────────────
  async function loadStockistStores() {
    if (stockistStores) return;
    const cached = GM_getValue('stockist_cache', '');
    const cacheTime = GM_getValue('stockist_cache_time', 0);
    const ONE_DAY = 86400000;

    if (cached && (Date.now() - cacheTime) < ONE_DAY) {
      try {
        stockistStores = new Map(JSON.parse(cached));
        log(`Loaded ${stockistStores.size} stores from cache`);
        return;
      } catch { /* fall through to fetch */ }
    }

    log('Fetching Stockist store locations...');
    const resp = await fetch(STOCKIST_URL);
    const data = await resp.json();

    stockistStores = new Map();
    for (const store of data) {
      const idField = store.custom_fields?.find(f => f.name === 'ID');
      const handleField = store.custom_fields?.find(f => f.name === 'Store MetaObject Handle');
      const storeId = idField?.value || '';
      const handle = handleField?.value || '';

      if (storeId && store.latitude && store.longitude) {
        const entry = {
          id: storeId,
          name: store.name,
          lat: parseFloat(store.latitude),
          lng: parseFloat(store.longitude),
          city: store.city,
          state: store.state,
          address: store.address_line_1 || '',
          postalCode: store.postal_code || '',
          handle,
        };
        stockistStores.set(storeId, entry);
        // Also map with zero-padding for Constructor.io matching
        const padded = storeId.padStart(4, '0');
        if (padded !== storeId) stockistStores.set(padded, entry);
      }
    }

    // Cache for 24h
    GM_setValue('stockist_cache', JSON.stringify([...stockistStores]));
    GM_setValue('stockist_cache_time', Date.now());
    log(`Loaded ${stockistStores.size} stores from API`);
  }

  // ── API: Shopify GraphQL Metaobjects (store handles → shopify_location_id) ──
  async function loadShopifyLocationMap() {
    if (shopifyLocationMap) return;
    const cached = GM_getValue('locationmap_cache', '');
    const cacheTime = GM_getValue('locationmap_cache_time', 0);
    const ONE_DAY = 86400000;

    if (cached && (Date.now() - cacheTime) < ONE_DAY) {
      try {
        shopifyLocationMap = new Map(JSON.parse(cached));
        log(`Loaded ${shopifyLocationMap.size} location mappings from cache`);
        return;
      } catch { /* fall through */ }
    }

    if (!stockistStores) await loadStockistStores();

    // Collect all handles
    const handles = [];
    const handleToStoreId = new Map();
    for (const [storeId, store] of stockistStores) {
      if (store.handle && !handleToStoreId.has(store.handle)) {
        handles.push(store.handle);
        handleToStoreId.set(store.handle, storeId);
      }
    }

    // Batch into groups of METAOBJECT_BATCH_SIZE
    const batches = [];
    for (let i = 0; i < handles.length; i += METAOBJECT_BATCH_SIZE) {
      batches.push(handles.slice(i, i + METAOBJECT_BATCH_SIZE));
    }

    log(`Fetching metaobjects: ${handles.length} handles in ${batches.length} batches...`);
    shopifyLocationMap = new Map();

    const tasks = batches.map((batch, batchIdx) => async () => {
      const aliases = batch.map((handle, i) =>
        `m${i}: metaobject(handle: {handle: "${handle}", type: "stores"}) { ...metaobjectFields }`
      ).join('\n');

      const query = `
        query getMetaobjectsByHandle {
          ${aliases}
        }
        fragment metaobjectFields on Metaobject {
          handle
          fields { key value }
        }
      `;

      try {
        const resp = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
          },
          body: JSON.stringify({ query }),
        });

        const result = await resp.json();
        if (result.data) {
          for (const [key, meta] of Object.entries(result.data)) {
            if (!meta) continue;
            const fields = {};
            for (const f of meta.fields) fields[f.key] = f.value;

            const shopifyLocId = fields.shopify_location_id;
            const storeId = fields.store_id || handleToStoreId.get(meta.handle) || '';

            if (shopifyLocId) {
              const fullId = `gid://shopify/Location/${shopifyLocId}`;
              shopifyLocationMap.set(fullId, {
                shopifyLocationId: shopifyLocId,
                storeId,
                handle: meta.handle,
                title: fields.title || '',
                banner: fields.banner || '',
              });
            }
          }
        }
      } catch (err) {
        warn(`Metaobject batch ${batchIdx} failed:`, err);
      }
    });

    await pool(tasks, GRAPHQL_CONCURRENCY);

    GM_setValue('locationmap_cache', JSON.stringify([...shopifyLocationMap]));
    GM_setValue('locationmap_cache_time', Date.now());
    log(`Loaded ${shopifyLocationMap.size} location mappings`);
  }

  // ── Load all store data ─────────────────────────────────
  async function ensureStoreData(updateStatus) {
    if (storeDataReady) return;
    if (storeDataLoading) {
      // Wait for existing load
      while (!storeDataReady) await new Promise(r => setTimeout(r, 200));
      return;
    }
    storeDataLoading = true;

    try {
      if (updateStatus) updateStatus('Loading store locations...');
      await loadStockistStores();

      if (updateStatus) updateStatus('Mapping Shopify location IDs...');
      await loadShopifyLocationMap();

      storeDataReady = true;
    } catch (err) {
      warn('Failed to load store data:', err);
    }
    storeDataLoading = false;
  }

  // ── API: Constructor.io SKU Search ──────────────────────
  async function searchSku(sku) {
    const key = config.apiKey;
    if (!key) return { sku, error: 'No API key' };
    try {
      const resp = await fetch(`${SEARCH_URL}/${encodeURIComponent(sku)}?key=${key}&section=Products&num_results_per_page=1`);
      if (!resp.ok) return { sku, error: `HTTP ${resp.status}` };
      const data = await resp.json();
      const result = data?.response?.results?.[0];
      return result ? { sku, item: result } : { sku, error: 'Not found' };
    } catch (err) {
      return { sku, error: err.message };
    }
  }

  // ── API: Shopify Variant Inventory ──────────────────────
  async function fetchVariantInventory(shopifyVariantId) {
    const vid = String(shopifyVariantId);
    const gid = vid.startsWith('gid://') ? vid : `gid://shopify/ProductVariant/${vid}`;

    // Check cache
    if (variantInventory[gid]) return variantInventory[gid];

    try {
      const query = `
        query VariantInventory($id: ID!) {
          node(id: $id) {
            ... on ProductVariant {
              availableForSale
              storeAvailability(first: 250) {
                edges {
                  node {
                    quantityAvailable
                    location { id }
                  }
                }
              }
            }
          }
        }
      `;

      const resp = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query, variables: { id: gid } }),
      });

      const data = await resp.json();
      const edges = data?.data?.node?.storeAvailability?.edges || [];

      // Build Map<shopifyLocationId, quantity>
      const inventory = new Map();
      for (const edge of edges) {
        const locId = edge.node?.location?.id;
        const qty = edge.node?.quantityAvailable ?? 0;
        if (locId) inventory.set(locId, qty);
      }

      variantInventory[gid] = inventory;
      return inventory;
    } catch (err) {
      warn(`Inventory fetch failed for ${gid}:`, err);
      return new Map();
    }
  }

  // ── Data Processing ─────────────────────────────────────
  function processProduct(item, querySku) {
    const d = item.data || {};
    const handle = d.handle || '';

    const variations = (item.variations || []).map(v => {
      const vd = v.data || {};
      return {
        title: vd.variation_title || vd.format || 'Default',
        sku: vd.sku || '',
        price: vd.price,
        comparePrice: vd.compare_at_price,
        inventoryATS: vd.InventoryATS.toLocaleString("en-US") || 0,
        inStock: (vd.InventoryATS || 0) > 0,
        stores: vd.availableInStores || [],
        shopifyVariantId: vd.__shopify_variant_id || '',
        imageUrl: vd.image_url || '',
      };
    });

    let defaultVarIdx = 0;
    const matchIdx = variations.findIndex(v => v.sku === querySku);
    if (matchIdx >= 0) defaultVarIdx = matchIdx;

    return {
      name: d.name || item.value || 'Unknown',
      sku: d.sku || querySku,
      handle,
      imageUrl: d.image_url || '',
      author: (d.ContAuthor || []).join(', '),
      isbn: d.ISBN13 || '',
      price: d.price,
      comparePrice: d.compare_at_price,
      format: d.variation_title || d.format || '',
      variations,
      defaultVarIdx,
    };
  }

  // ── Map Helpers ─────────────────────────────────────────
  function clearMarkers() {
    mapMarkers.forEach(m => leafletMap.removeLayer(m));
    mapMarkers = [];
  }

  // Color levels for class-based dot styling
  const COLOR_LEVELS = {
    high:    { cls: 'sm-dot-high',    color: '#a6e3a1' },
    medium:  { cls: 'sm-dot-medium',  color: '#f9e2af' },
    low:     { cls: 'sm-dot-low',     color: '#e79e71' },
    none:    { cls: 'sm-dot-none',    color: '#f38ba8' },
    dimmed:  { cls: 'sm-dot-dimmed',  color: '#585b70' },
    unknown: { cls: 'sm-dot-unknown', color: '#6c7086' },
  };

  function stockLevel(qty) {
    const c = config;
    if (qty >= c.thresholdHigh) return COLOR_LEVELS.high;
    if (qty >= c.thresholdMedium) return COLOR_LEVELS.medium;
    if (qty >= c.thresholdLow) return COLOR_LEVELS.low;
    if (qty >= 0) return COLOR_LEVELS.low;
    return COLOR_LEVELS.none;
  }

  function createGlowIcon(levelCls, size, extraCls) {
    const hitSize = Math.max(size * 2.5, 26);
    const center = hitSize / 2;
    const dotOffset = (hitSize - size) / 2;

    return L.divIcon({
      className: 'sm-dot-icon',
      html: `<span class="sm-dot-outer" style="width:${hitSize}px;height:${hitSize}px"><span class="sm-dot-inner ${levelCls} ${extraCls || ''}" style="left:${dotOffset}px;top:${dotOffset}px;width:${size}px;height:${size}px">&#8203;</span>&#8203;</span>`,
      iconSize: [hitSize, hitSize],
      iconAnchor: [center, center],
    });
  }

  async function updateMap() {
    clearMarkers();
    closeStorePanel();
    if (!storeDataReady || products.length === 0 || !leafletMap) return;

    dbg('=== UPDATE MAP START ===');
    dbg(`selectedIdx=${selectedIdx}, products=${products.length}, variantIdx=`, JSON.stringify(selectedVariantIdx));

    // Fetch inventory for the selected product's active variant
    const selProduct = products[selectedIdx];
    const selVarIdx = selectedVariantIdx[selectedIdx] ?? 0;
    const selVar = selProduct?.variations[selVarIdx];

    dbg(`Selected: product="${selProduct?.name}" varIdx=${selVarIdx} variant="${selVar?.title}" shopifyVarId=${selVar?.shopifyVariantId}`);

    if (selVar?.shopifyVariantId) {
      showMapStatus('Loading inventory...');
      const inv = await fetchVariantInventory(selVar.shopifyVariantId);
      dbg(`Inventory fetched: size=${inv?.size}, sample entries:`, inv?.size > 0 ? JSON.stringify([...inv].slice(0, 3)) : 'empty');
      hideMapStatus();
    }

    // Also pre-fetch other products' active variants
    const otherFetches = products.map(async (p, pIdx) => {
      if (pIdx === selectedIdx) return;
      const vIdx = selectedVariantIdx[pIdx] ?? 0;
      const v = p.variations[vIdx];
      if (v?.shopifyVariantId) await fetchVariantInventory(v.shopifyVariantId);
    });
    await Promise.all(otherFetches);

    // Render markers
    const bounds = [];
    const stats = { colored: 0, oos: 0, dimmed: 0, noStore: 0, noQty: 0, skipped: 0 };

    products.forEach((product, pIdx) => {
      const isSelected = pIdx === selectedIdx;
      const varIdx = selectedVariantIdx[pIdx] ?? 0;
      const activeVar = product.variations[varIdx];
      if (!activeVar) return;

      const gid = activeVar.shopifyVariantId
        ? `gid://shopify/ProductVariant/${activeVar.shopifyVariantId}`
        : null;
      const inventoryMap = gid ? variantInventory[gid] : null;

      if (isSelected) {
        dbg(`SELECTED product[${pIdx}]: gid=${gid}`);
        dbg(`  inventoryMap=${inventoryMap ? 'Map(' + inventoryMap.size + ')' : 'NULL'}`);
        dbg(`  shopifyLocationMap=${shopifyLocationMap ? 'Map(' + shopifyLocationMap.size + ')' : 'NULL'}`);
        dbg(`  stores to show: ${(activeVar.stores || []).length}`);
      }

      const storesToShow = activeVar.stores || [];
      let loggedFirst = false;

      if (isSelected) {
        dbg(`  Store IDs to show (${storesToShow.length}):`, storesToShow.slice(0, 10).join(', '), storesToShow.length > 10 ? '...' : '');
      }

      for (const storeId of storesToShow) {
        const store = stockistStores?.get(storeId);
        if (!store) {
          stats.noStore++;
          if (isSelected) dbg(`  MISS: storeId="${storeId}" not found in stockistStores`);
          continue;
        }

        // Resolve per-store quantity from GraphQL inventory
        let qty = null;
        let matchedLocId = null;
        if (inventoryMap && shopifyLocationMap) {
          for (const [locId, locInfo] of shopifyLocationMap) {
            if (locInfo.storeId === store.id || locInfo.storeId === storeId) {
              matchedLocId = locId;
              qty = inventoryMap.get(locId) ?? null;
              break;
            }
          }
        }

        if (isSelected && !loggedFirst) {
          dbg(`  First matched store: "${store.name}" id=${store.id} storeId=${storeId}`);
          dbg(`    matchedLocId=${matchedLocId}, qty=${qty}`);
          dbg(`    inventoryMap has key? ${matchedLocId ? inventoryMap?.has(matchedLocId) : 'no match'}`);
          loggedFirst = true;
        }

        const hasStock = qty === null ? true : qty > 0;
        const isOos = qty !== null && qty === 0;

        if (!isSelected && isOos) { stats.skipped++; continue; }

        let dotCls, size, zOffset, extraCls = '';

        if (isSelected) {
          if (isOos) {
            dotCls = COLOR_LEVELS.dimmed.cls;
            size = 8;
            zOffset = 500;
            extraCls = 'sm-dot-oos';
            stats.oos++;
          } else {
            const level = qty !== null ? stockLevel(qty) : COLOR_LEVELS.high;
            dotCls = level.cls;
            size = 13;
            zOffset = 1000;
            stats.colored++;
          }
        } else {
          dotCls = COLOR_LEVELS.dimmed.cls;
          size = 7;
          zOffset = 0;
          extraCls = 'sm-dot-other';
          stats.dimmed++;
        }

        if (isSelected && qty === null) stats.noQty++;

        const level = qty !== null ? stockLevel(qty) : COLOR_LEVELS.unknown;
        const icon = createGlowIcon(dotCls, size, extraCls);
        const marker = L.marker([store.lat, store.lng], { icon, zIndexOffset: zOffset });

        const qtyLabel = qty !== null
          ? (qty > 0 ? `<strong>${qty}</strong> in stock` : '<strong class="sm-tt-oos">Out of stock</strong>')
          : 'Stock data unavailable';

        marker.bindTooltip(`
          <strong>${escapeHtml(store.name)}</strong><br>
          ${escapeHtml(store.address)}<br>
          ${escapeHtml(store.city)}, ${escapeHtml(store.state)}<br>
          <span class="${level.cls}-text">● ${qtyLabel}</span><br>
          <em>${escapeHtml(product.name)} — ${escapeHtml(activeVar.title)}</em>
        `, {
          className: 'stock-tooltip',
          direction: 'top',
          offset: [0, -8],
        });

        ((s, q, p, v) => {
          marker.on('click', () => showStorePanel(s, q, p, v));
        })(store, qty, product, activeVar);

        marker.addTo(leafletMap);
        mapMarkers.push(marker);

        if (isSelected && hasStock) bounds.push([store.lat, store.lng]);
      }
    });

    dbg('Stats:', JSON.stringify(stats));
    dbg(`Markers placed: ${mapMarkers.length}, Bounds points: ${bounds.length}`);

    // Collect structured dev log for raw data tab
    if (config.devMode) {
      const selProduct = products[selectedIdx];
      const selVarIdx2 = selectedVariantIdx[selectedIdx] ?? 0;
      const selVar2 = selProduct?.variations[selVarIdx2];
      const gid2 = selVar2?.shopifyVariantId ? `gid://shopify/ProductVariant/${selVar2.shopifyVariantId}` : null;
      const invMap = gid2 ? variantInventory[gid2] : null;

      const storeRows = [];
      const storesToLog = selVar2?.stores || [];
      for (const storeId of storesToLog) {
        const store = stockistStores?.get(storeId);
        let qty = null;
        let locId = '—';
        if (invMap && shopifyLocationMap) {
          for (const [lid, locInfo] of shopifyLocationMap) {
            if (locInfo.storeId === (store?.id || '') || locInfo.storeId === storeId) {
              locId = lid.replace('gid://shopify/Location/', '');
              qty = invMap.get(lid) ?? null;
              break;
            }
          }
        }
        storeRows.push({
          storeId,
          name: store?.name || 'NOT FOUND',
          city: store?.city || '—',
          state: store?.state || '—',
          shopifyLocId: locId,
          qty: qty !== null ? qty : '—',
          level: qty !== null ? (qty >= config.thresholdHigh ? 'high' : qty >= config.thresholdMedium ? 'medium' : qty >= config.thresholdLow ? 'low' : 'none') : 'unknown',
          matched: !!store,
        });
      }

      devLog.push({
        timestamp: new Date().toISOString(),
        action: 'updateMap',
        selectedProduct: selProduct?.name || '—',
        selectedVariant: selVar2?.title || '—',
        shopifyVariantId: selVar2?.shopifyVariantId || '—',
        inventoryMapSize: invMap?.size ?? 0,
        locationMapSize: shopifyLocationMap?.size ?? 0,
        stats: { ...stats },
        storeRows,
        products: products.map((p, i) => ({
          idx: i,
          name: p.name,
          sku: p.sku,
          activeVariant: p.variations[selectedVariantIdx[i] ?? 0]?.title || '—',
          activeVariantId: p.variations[selectedVariantIdx[i] ?? 0]?.shopifyVariantId || '—',
          storeCount: (p.variations[selectedVariantIdx[i] ?? 0]?.stores || []).length,
          selected: i === selectedIdx,
        })),
      });

      renderDevTab();
    }

    if (bounds.length > 0) {
      leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }

    // Show/hide "no stores" notice
    let notice = overlay?.querySelector('#sm-no-stores');
    if (stats.colored === 0 && stats.oos === 0) {
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'sm-no-stores';
        notice.className = 'sm-no-stores';
        overlay?.querySelector('.sm-map-area')?.appendChild(notice);
      }
      const selVar = products[selectedIdx]?.variations[selectedVariantIdx[selectedIdx] ?? 0];
      notice.innerHTML = `<span class="sm-no-stores-icon">📦</span> No physical store availability for <strong>${escapeHtml(selVar?.title || 'this variant')}</strong>.<br>This variant may only be available online or from fulfillment centers.`;
      notice.style.display = 'block';
    } else if (notice) {
      notice.style.display = 'none';
    }

    updateLegend();
    dbg('=== UPDATE MAP COMPLETE ===');
  }

  function updateLegend() {
    const el = overlay?.querySelector('#sm-legend');
    if (!el) return;
    el.style.display = 'block';
    const dot = (color) => `<span class="sm-legend-dot" style="background:${color};box-shadow:0 0 4px ${color}">&#8203;</span>`;
    el.innerHTML = `
      <div class="sm-legend-title">Per-Store Quantity</div>
      <div class="sm-legend-item">${dot('#a6e3a1')} ${config.thresholdHigh}+</div>
      <div class="sm-legend-item">${dot('#f9e2af')} ${config.thresholdMedium}–${config.thresholdHigh - 1}</div>
      <div class="sm-legend-item">${dot('#e79e71')} ${config.thresholdLow}–${config.thresholdMedium - 1}</div>
      <div class="sm-legend-item">${dot('#f38ba8')} 0</div>
      <div class="sm-legend-item" style="opacity:0.35">${dot('#585b70')} Unavailable</div>
    `;
  }

  // ── Store Detail Panel ──────────────────────────────────
  function showStorePanel(store, qty, product, variant) {
    const panel = overlay?.querySelector('#sm-store-panel');
    if (!panel) return;

    const level = qty !== null ? stockLevel(qty) : COLOR_LEVELS.unknown;
    const storePageUrl = store.handle ? `${INDIGO_BASE}/pages/stores/${store.handle}` : '';
    const mapsQuery = encodeURIComponent(`${store.address}, ${store.city}, ${store.state} ${store.postalCode}, Canada`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
    const mapsEmbedUrl = `https://maps.google.com/maps?q=${store.lat},${store.lng}&z=15&output=embed`;

    panel.innerHTML = `
      <div class="sm-sp-header">
        <h3>${escapeHtml(store.name)}</h3>
        <button class="sm-sp-close" title="Close">✕</button>
      </div>
      <div class="sm-sp-body">
        <div class="sm-sp-map-embed">
          <iframe src="${mapsEmbedUrl}" width="100%" height="160" style="border:0;border-radius:6px;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
        <div class="sm-sp-address">
          <div>${escapeHtml(store.address)}</div>
          <div>${escapeHtml(store.city)}, ${escapeHtml(store.state)} ${escapeHtml(store.postalCode)}</div>
        </div>
        <div class="sm-sp-stock">
          <span class="sm-sp-dot ${level.cls}">&#8203;</span>
          <span>${qty !== null ? `<strong>${qty}</strong> in stock` : 'Quantity unavailable'}</span>
          <span class="sm-sp-stock-label">${level === COLOR_LEVELS.high ? 'High' : level === COLOR_LEVELS.medium ? 'Medium' : level === COLOR_LEVELS.low ? 'Low' : level === COLOR_LEVELS.none ? 'None' : 'Unknown'}</span>
        </div>
        <div class="sm-sp-product">
          <em>${escapeHtml(product.name)}</em>
          ${variant ? ` — ${escapeHtml(variant.title)}` : ''}
        </div>
        <div class="sm-sp-links">
          <a href="${mapsUrl}" target="_blank" class="sm-sp-link">
            <span>📍</span> Open in Google Maps
          </a>
          ${storePageUrl ? `<a href="${storePageUrl}" target="_blank" class="sm-sp-link">
            <span>🏪</span> View Store Page
          </a>` : ''}
        </div>
        <div class="sm-sp-details">
          <div class="sm-sp-detail"><span class="sm-sp-label">Store ID</span> <span>${escapeHtml(store.id)}</span></div>
          <div class="sm-sp-detail"><span class="sm-sp-label">Handle</span> <span class="sm-sp-mono">${escapeHtml(store.handle || '—')}</span></div>
        </div>
      </div>
    `;

    panel.style.display = 'block';
    panel.querySelector('.sm-sp-close').addEventListener('click', closeStorePanel);
  }

  function closeStorePanel() {
    const panel = overlay?.querySelector('#sm-store-panel');
    if (panel) panel.style.display = 'none';
  }

  // ── Sidebar ─────────────────────────────────────────────
  function renderSidebar() {
    const list = overlay?.querySelector('#sm-tab-products');
    if (!list) return;

    // Show/hide raw data tab based on dev mode
    const rawTab = overlay?.querySelector('#sm-tab-rawdata');
    if (rawTab) rawTab.style.display = config.devMode ? 'inline-block' : 'none';

    if (products.length === 0) {
      list.innerHTML = `<div class="sm-sidebar-empty"><div style="font-size:28px;opacity:0.3">📦</div><div>Enter SKU(s) above to see<br>store availability across Canada</div></div>`;
      return;
    }

    list.innerHTML = '';

    products.forEach((product, pIdx) => {
      const card = document.createElement('div');
      card.className = `sm-card${pIdx === selectedIdx ? ' sm-card-selected' : ''}`;

      const varIdx = selectedVariantIdx[pIdx] || 0;
      const activeVar = product.variations[varIdx] || {};
      const onSale = activeVar.comparePrice && activeVar.price && activeVar.comparePrice > activeVar.price;
      const storeCount = (activeVar.stores || []).length;

      const varsHtml = product.variations.map((v, vi) =>
        `<span class="sm-var${vi === varIdx ? ' sm-var-active' : ''}${!v.inStock ? ' sm-var-oos' : ''}" data-pidx="${pIdx}" data-vidx="${vi}">${escapeHtml(v.title)}</span>`
      ).join('');

      card.innerHTML = `
        <div class="sm-card-top">
          <div class="sm-card-img">
            ${(activeVar.imageUrl || product.imageUrl) ? `<img src="${activeVar.imageUrl || product.imageUrl}" alt="">` : '<span class="sm-no-img">—</span>'}
          </div>
          <div class="sm-card-info">
            <div class="sm-card-name">${escapeHtml(product.name)}</div>
            ${product.author ? `<div class="sm-card-author">${escapeHtml(product.author)}</div>` : ''}
            <div class="sm-card-ids">
              <span class="sm-tag">SKU: ${escapeHtml(activeVar.sku || product.sku)}</span>
            </div>
            <div class="sm-card-price">
              ${onSale
                ? `<span class="sm-price sm-price-sale">${formatPrice(activeVar.price)}</span><span class="sm-price-was">${formatPrice(activeVar.comparePrice)}</span>`
                : `<span class="sm-price">${formatPrice(activeVar.price || product.price)}</span>`}
            </div>
          </div>
        </div>
        ${product.variations.length > 1 ? `<div class="sm-variants">${varsHtml}</div>` : ''}
        <div class="sm-card-stock">
          <span>${storeCount} store${storeCount !== 1 ? 's' : ''} · In Stock: ${activeVar.inventoryATS || 0}</span>
        </div>
      `;

      card.addEventListener('click', async (e) => {
        if (e.target.classList.contains('sm-var')) return;
        selectedIdx = pIdx;
        renderSidebar();
        await updateMap();
      });

      list.appendChild(card);
    });

    // Variant clicks
    list.querySelectorAll('.sm-var').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pIdx = parseInt(el.dataset.pidx);
        const vIdx = parseInt(el.dataset.vidx);
        dbg('=== VARIANT CLICK ===');
        dbg(`pIdx=${pIdx}, vIdx=${vIdx}`);
        dbg(`BEFORE: selectedIdx=${selectedIdx}, selectedVariantIdx=`, JSON.stringify(selectedVariantIdx));
        selectedVariantIdx[pIdx] = vIdx;
        selectedIdx = pIdx;
        dbg(`AFTER: selectedIdx=${selectedIdx}, selectedVariantIdx=`, JSON.stringify(selectedVariantIdx));
        const activeVar = products[pIdx]?.variations[vIdx];
        dbg(`Active variant: title="${activeVar?.title}", shopifyVariantId=${activeVar?.shopifyVariantId}, stores=${activeVar?.stores?.length}`);
        renderSidebar();
        await updateMap();
        dbg('=== VARIANT CLICK COMPLETE ===');
      });
    });
  }

  // ── Raw Data Tab ────────────────────────────────────────
  function renderDevTab() {
    const container = overlay?.querySelector('#sm-tab-rawdata-content');
    if (!container || !config.devMode) return;

    if (devLog.length === 0) {
      container.innerHTML = '<div class="sm-dev-empty">No data yet. Search for SKUs to populate.</div>';
      return;
    }

    // Show the most recent entry with full detail, older entries collapsed
    const latest = devLog[devLog.length - 1];
    let html = '';

    // ── Summary table ──
    html += `<div class="sm-dev-section">
      <div class="sm-dev-title">Latest Update <span class="sm-dev-time">${latest.timestamp.split('T')[1].split('.')[0]}</span></div>
      <table class="sm-dev-table">
        <tr><td class="sm-dev-label">Product</td><td>${escapeHtml(latest.selectedProduct)}</td></tr>
        <tr><td class="sm-dev-label">Variant</td><td>${escapeHtml(latest.selectedVariant)}</td></tr>
        <tr><td class="sm-dev-label">Shopify Variant ID</td><td class="sm-dev-mono">${escapeHtml(String(latest.shopifyVariantId))}</td></tr>
        <tr><td class="sm-dev-label">Inventory Map Size</td><td>${latest.inventoryMapSize}</td></tr>
        <tr><td class="sm-dev-label">Location Map Size</td><td>${latest.locationMapSize}</td></tr>
      </table>
    </div>`;

    // ── Stats table ──
    html += `<div class="sm-dev-section">
      <div class="sm-dev-title">Marker Stats</div>
      <table class="sm-dev-table">
        <tr><td class="sm-dev-label">Colored (in stock)</td><td class="sm-dev-val-good">${latest.stats.colored}</td></tr>
        <tr><td class="sm-dev-label">OOS (zero stock)</td><td class="sm-dev-val-warn">${latest.stats.oos}</td></tr>
        <tr><td class="sm-dev-label">Dimmed (unavailable)</td><td>${latest.stats.dimmed}</td></tr>
        <tr><td class="sm-dev-label">No Store Match</td><td class="sm-dev-val-err">${latest.stats.noStore}</td></tr>
        <tr><td class="sm-dev-label">No Qty Data</td><td>${latest.stats.noQty}</td></tr>
        <tr><td class="sm-dev-label">Skipped (other OOS)</td><td>${latest.stats.skipped}</td></tr>
      </table>
    </div>`;

    // ── Products table ──
    html += `<div class="sm-dev-section">
      <div class="sm-dev-title">Products (${latest.products.length})</div>
      <table class="sm-dev-table sm-dev-table-full">
        <thead><tr>
          <th>#</th><th>Name</th><th>Variant</th><th>Variant ID</th><th>Stores</th><th>Sel</th>
        </tr></thead>
        <tbody>${latest.products.map(p => `
          <tr class="${p.selected ? 'sm-dev-row-sel' : ''}">
            <td>${p.idx}</td>
            <td class="sm-dev-cell-name">${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.activeVariant)}</td>
            <td class="sm-dev-mono">${escapeHtml(String(p.activeVariantId))}</td>
            <td>${p.storeCount}</td>
            <td>${p.selected ? '✓' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    // ── Store inventory table (selected product) ──
    if (latest.storeRows.length > 0) {
      const sorted = [...latest.storeRows].sort((a, b) => {
        if (a.qty === '—' && b.qty === '—') return 0;
        if (a.qty === '—') return 1;
        if (b.qty === '—') return -1;
        return b.qty - a.qty;
      });

      html += `<div class="sm-dev-section">
        <div class="sm-dev-title">Store Inventory — ${escapeHtml(latest.selectedVariant)} (${sorted.length} stores)</div>
        <table class="sm-dev-table sm-dev-table-full">
          <thead><tr>
            <th>Store ID</th><th>Name</th><th>City</th><th>Prov</th><th>Loc ID</th><th>Qty</th><th>Level</th><th>Match</th>
          </tr></thead>
          <tbody>${sorted.map(r => `
            <tr class="${!r.matched ? 'sm-dev-row-miss' : r.level === 'none' ? 'sm-dev-row-oos' : ''}">
              <td class="sm-dev-mono">${escapeHtml(r.storeId)}</td>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.city)}</td>
              <td>${escapeHtml(r.state)}</td>
              <td class="sm-dev-mono">${escapeHtml(String(r.shopifyLocId))}</td>
              <td class="sm-dev-qty sm-dev-qty-${r.level}">${r.qty}</td>
              <td><span class="sm-dev-level sm-dev-level-${r.level}">${r.level}</span></td>
              <td>${r.matched ? '✓' : '✗'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }

    // ── History (collapsed) ──
    if (devLog.length > 1) {
      html += `<div class="sm-dev-section">
        <div class="sm-dev-title">History (${devLog.length - 1} prior)</div>
        ${devLog.slice(0, -1).reverse().map((entry, i) => `
          <div class="sm-dev-history-row">
            <span class="sm-dev-time">${entry.timestamp.split('T')[1].split('.')[0]}</span>
            <span>${escapeHtml(entry.selectedProduct)}</span> →
            <span>${escapeHtml(entry.selectedVariant)}</span>
            <span class="sm-dev-hist-stats">C:${entry.stats.colored} O:${entry.stats.oos} D:${entry.stats.dimmed} M:${entry.stats.noStore}</span>
          </div>
        `).join('')}
      </div>`;
    }

    container.innerHTML = html;
  }

  function initTabSwitching() {
    overlay?.querySelectorAll('.sm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        overlay.querySelectorAll('.sm-tab').forEach(t => t.classList.remove('sm-tab-active'));
        tab.classList.add('sm-tab-active');
        overlay.querySelectorAll('.sm-tab-content').forEach(c => c.style.display = 'none');
        const panel = overlay.querySelector(`#sm-tab-${target === 'products' ? 'products' : 'rawdata-content'}`);
        if (panel) panel.style.display = 'block';
      });
    });
  }

  // ── Search ──────────────────────────────────────────────
  async function handleSearch() {
    const input = overlay?.querySelector('#sm-search-input');
    const btn = overlay?.querySelector('#sm-search-btn');
    if (!input) return;

    const raw = input.value.trim();
    if (!raw) return;
    if (!config.apiKey) { showSettings(); return; }

    const skuList = [...new Set(raw.split(/[\s,;\t]+/).map(s => s.trim()).filter(Boolean))];
    if (skuList.length === 0) return;

    btn.disabled = true;
    products = [];
    selectedVariantIdx = {};
    variantInventory = {};
    selectedIdx = 0;
    devLog = [];

    showMapStatus(`Loading stores & searching ${skuList.length} SKU${skuList.length > 1 ? 's' : ''}...`);
    renderSidebar();

    // Load store data + search in parallel
    const [, ...searchResults] = await Promise.all([
      ensureStoreData(showMapStatus),
      ...skuList.map(sku => searchSku(sku)),
    ]);

    for (const result of searchResults) {
      if (result.item) {
        const product = processProduct(result.item, result.sku);
        selectedVariantIdx[products.length] = product.defaultVarIdx;
        products.push(product);
      }
    }

    const countEl = overlay?.querySelector('#sm-sidebar-count');
    if (countEl) countEl.textContent = products.length > 0 ? `${products.length} found` : '';

    renderSidebar();

    if (products.length > 0) {
      await updateMap();
    } else {
      hideMapStatus();
    }

    btn.disabled = false;
  }

  // ── Map Status ──────────────────────────────────────────
  function showMapStatus(msg) {
    const el = overlay?.querySelector('#sm-map-status');
    if (el) { el.textContent = msg; el.style.display = 'flex'; }
  }
  function hideMapStatus() {
    const el = overlay?.querySelector('#sm-map-status');
    if (el) el.style.display = 'none';
  }

  // ── Settings ────────────────────────────────────────────
  function showSettings() {
    const view = overlay?.querySelector('#sm-settings');
    const main = overlay?.querySelector('#sm-main');
    if (!view || !main) return;

    const c = getConfig();
    overlay.querySelector('#sm-s-key').value = c.apiKey;
    overlay.querySelector('#sm-s-keybind').value = c.keybind;
    overlay.querySelector('#sm-s-high').value = c.thresholdHigh;
    overlay.querySelector('#sm-s-med').value = c.thresholdMedium;
    overlay.querySelector('#sm-s-low').value = c.thresholdLow;
    overlay.querySelector('#sm-s-dev').checked = c.devMode;

    view.style.display = 'block';
    main.style.display = 'none';
  }

  function hideSettings() {
    const view = overlay?.querySelector('#sm-settings');
    const main = overlay?.querySelector('#sm-main');
    if (view) view.style.display = 'none';
    if (main) main.style.display = 'flex';
  }

  function doSaveSettings() {
    config = {
      ...config,
      apiKey: overlay.querySelector('#sm-s-key')?.value.trim() || '',
      keybind: overlay.querySelector('#sm-s-keybind')?.value.trim().toLowerCase() || 'alt+shift+m',
      thresholdHigh: parseInt(overlay.querySelector('#sm-s-high')?.value, 10) || 10,
      thresholdMedium: parseInt(overlay.querySelector('#sm-s-med')?.value, 10) || 5,
      thresholdLow: parseInt(overlay.querySelector('#sm-s-low')?.value, 10) || 1,
      devMode: overlay.querySelector('#sm-s-dev')?.checked ?? false,
    };
    saveConfigToStorage(config);
    hideSettings();
    updateLegend();
    renderSidebar();
    log('Settings saved');
  }

  function clearStoreCache() {
    GM_setValue('stockist_cache', '');
    GM_setValue('stockist_cache_time', 0);
    GM_setValue('locationmap_cache', '');
    GM_setValue('locationmap_cache_time', 0);
    stockistStores = null;
    shopifyLocationMap = null;
    storeDataReady = false;
    log('Store cache cleared');
  }

  // ── Overlay UI ──────────────────────────────────────────
  function showOverlay() {
    if (overlay) { overlay.style.display = 'flex'; leafletMap?.invalidateSize(); return; }

    overlay = document.createElement('div');
    overlay.id = 'sm-overlay';

    overlay.innerHTML = `
      <div id="sm-container">
        <div class="sm-header">
          <div class="sm-logo">Indigo Stock Map</div>
          <div class="sm-search-area">
            <input type="text" id="sm-search-input" placeholder="Enter SKU(s) — comma or space separated" spellcheck="false" autocomplete="off">
            <button id="sm-search-btn">Search</button>
          </div>
          <div class="sm-header-actions">
            <button class="sm-icon-btn" id="sm-settings-btn" title="Settings">⚙</button>
            <button class="sm-icon-btn" id="sm-close-btn" title="Close">✕</button>
          </div>
        </div>

        <div id="sm-main" style="display:flex">
          <div class="sm-sidebar">
            <div class="sm-sidebar-tabs" id="sm-sidebar-tabs">
              <button class="sm-tab sm-tab-active" data-tab="products">Products <span id="sm-sidebar-count" class="sm-sidebar-count"></span></button>
              <button class="sm-tab" data-tab="rawdata" id="sm-tab-rawdata" style="display:none">Raw Data</button>
            </div>
            <div id="sm-tab-products" class="sm-sidebar-list sm-tab-content">
              <div class="sm-sidebar-empty">
                <div style="font-size:28px;opacity:0.3">📦</div>
                <div>Enter SKU(s) above to see<br>store availability across Canada</div>
              </div>
            </div>
            <div id="sm-tab-rawdata-content" class="sm-tab-content" style="display:none"></div>
          </div>
          <div class="sm-map-area">
            <div id="sm-map"></div>
            <div id="sm-map-status" class="sm-map-status" style="display:none">
              <div class="sm-spinner"></div>
              <span>Loading...</span>
            </div>
            <div id="sm-legend" class="sm-legend" style="display:none"></div>
            <div id="sm-store-panel" class="sm-store-panel" style="display:none"></div>
          </div>
        </div>

        <div id="sm-settings" style="display:none">
          <div class="sm-settings-inner">
            <h3>Settings</h3>
            <div class="sm-setting">
              <label>Constructor.io API Key</label>
              <input type="text" id="sm-s-key" placeholder="key_..." spellcheck="false">
            </div>
            <div class="sm-setting">
              <label>Keyboard shortcut</label>
              <input type="text" id="sm-s-keybind" placeholder="alt+shift+m" spellcheck="false">
            </div>
            <h4>Stock Dot Thresholds</h4>
            <div class="sm-threshold-row">
              <div class="sm-setting sm-setting-sm">
                <label><span class="sm-dot" style="background:#a6e3a1"></span> High ≥</label>
                <input type="number" id="sm-s-high" min="1">
              </div>
              <div class="sm-setting sm-setting-sm">
                <label><span class="sm-dot" style="background:#f9e2af"></span> Medium ≥</label>
                <input type="number" id="sm-s-med" min="1">
              </div>
              <div class="sm-setting sm-setting-sm">
                <label><span class="sm-dot" style="background:#e79e71"></span> Low ≥</label>
                <input type="number" id="sm-s-low" min="1">
              </div>
            </div>
            <div class="sm-setting-note">Below "Low" threshold = red (0 stock).</div>
            <hr class="sm-setting-divider">
            <div class="sm-setting">
              <label class="sm-setting-row">
                <span>Developer mode <span class="sm-dev-badge">DEV</span></span>
                <input type="checkbox" id="sm-s-dev">
              </label>
              <span class="sm-setting-hint">Shows "Raw Data" tab with store inventory tables, API response details, and debug history.</span>
            </div>
            <div class="sm-setting-actions">
              <button class="sm-btn-secondary" id="sm-s-clear-cache">Clear Store Cache</button>
              <div style="flex:1"></div>
              <button class="sm-btn-secondary" id="sm-s-cancel">Cancel</button>
              <button class="sm-btn-primary" id="sm-s-save">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Init Leaflet
    leafletMap = L.map('sm-map', {
      center: [56.1, -96.5],
      zoom: 4,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OSM &copy; CARTO',
    }).addTo(leafletMap);

    setTimeout(() => leafletMap.invalidateSize(), 100);

    // Events
    overlay.querySelector('#sm-close-btn').addEventListener('click', hideOverlay);
    overlay.querySelector('#sm-settings-btn').addEventListener('click', showSettings);
    overlay.querySelector('#sm-search-btn').addEventListener('click', handleSearch);
    overlay.querySelector('#sm-search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSearch();
    });
    overlay.querySelector('#sm-s-save').addEventListener('click', doSaveSettings);
    overlay.querySelector('#sm-s-cancel').addEventListener('click', hideSettings);
    initTabSwitching();
    overlay.querySelector('#sm-s-clear-cache').addEventListener('click', () => {
      clearStoreCache();
      const btn = overlay.querySelector('#sm-s-clear-cache');
      btn.textContent = 'Cleared!';
      setTimeout(() => btn.textContent = 'Clear Store Cache', 1200);
    });

    // Show settings if no API key
    if (!config.apiKey) setTimeout(showSettings, 300);

    setTimeout(() => overlay.querySelector('#sm-search-input')?.focus(), 200);
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  // ── Styles ──────────────────────────────────────────────
  GM_addStyle(GM_getResourceText('LEAFLET_CSS'));
  GM_addStyle(`
    #sm-overlay {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; background: #11111b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #cdd6f4;
    }
    #sm-container { display: flex; flex-direction: column; width: 100%; height: 100%; }

    /* Header */
    .sm-header {
      display: flex; align-items: center; gap: 16px;
      padding: 10px 16px; background: #1e1e2e;
      border-bottom: 1px solid #45475a; flex-shrink: 0;
    }
    .sm-logo {
      font: 700 15px -apple-system, sans-serif; letter-spacing: -0.02em;
      background: linear-gradient(135deg, #89b4fa, #cba6f7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      white-space: nowrap;
    }
    .sm-search-area { flex: 1; display: flex; gap: 8px; max-width: 600px; }
    #sm-search-input {
      flex: 1; height: 36px; padding: 0 12px;
      background: #28283d; color: #cdd6f4; border: 1px solid #45475a;
      border-radius: 8px; font: 13px 'Consolas', monospace; outline: none;
    }
    #sm-search-input:focus { border-color: #89b4fa; }
    #sm-search-input::placeholder { color: #6c7086; }
    #sm-search-btn {
      height: 36px; padding: 0 18px; border: none; border-radius: 8px;
      background: #89b4fa; color: #11111b; font: 600 13px sans-serif;
      cursor: pointer; white-space: nowrap;
    }
    #sm-search-btn:hover { background: #b4d0fb; }
    #sm-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sm-header-actions { display: flex; gap: 4px; }
    .sm-icon-btn {
      background: none; border: 1px solid transparent; color: #a6adc8;
      font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
    }
    .sm-icon-btn:hover { background: #313244; color: #cdd6f4; }

    /* Main layout */
    #sm-main { flex: 1; overflow: hidden; }

    /* Sidebar */
    .sm-sidebar {
      width: 340px; flex-shrink: 0; display: flex; flex-direction: column;
      background: #1e1e2e; border-right: 1px solid #45475a;
    }
    .sm-sidebar-header {
      padding: 10px 14px; border-bottom: 1px solid #45475a;
      font: 700 11px sans-serif; text-transform: uppercase;
      letter-spacing: 0.05em; color: #6c7086;
      display: flex; justify-content: space-between;
    }
    .sm-sidebar-count { font-weight: 400; }
    .sm-sidebar-list { flex: 1; overflow-y: auto; padding: 6px; }
    .sm-sidebar-list::-webkit-scrollbar { width: 5px; }
    .sm-sidebar-list::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
    .sm-sidebar-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; color: #6c7086; font-size: 12px; text-align: center; gap: 6px; padding: 20px;
    }

    /* Product Cards */
    .sm-card {
      padding: 8px; border-radius: 8px; margin-bottom: 4px;
      background: #28283d; cursor: pointer;
      border: 2px solid transparent; transition: all 0.12s;
    }
    .sm-card:hover { background: #313244; }
    .sm-card-selected { border-color: #89b4fa; background: #313244; }
    .sm-card-top { display: flex; gap: 8px; }
    .sm-card-img {
      width: 48px; height: 62px; border-radius: 4px; overflow: hidden;
      background: #313244; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    }
    .sm-card-img img { width: 100%; height: 100%; object-fit: contain; }
    .sm-no-img { color: #585b70; font-size: 10px; }
    .sm-card-info { flex: 1; min-width: 0; }
    .sm-card-name {
      font-size: 11px; font-weight: 600; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; line-height: 1.3; margin-bottom: 2px;
    }
    .sm-card-author { font-size: 10px; color: #a6adc8; margin-bottom: 2px; }
    .sm-card-ids { margin-bottom: 2px; }
    .sm-tag {
      font: 9px 'Consolas', monospace; background: #313244; padding: 1px 4px;
      border-radius: 2px; color: #a6e3a1;
    }
    .sm-card-price { display: flex; gap: 5px; align-items: center; }
    .sm-price { font-size: 11px; font-weight: 600; }
    .sm-price-sale { color: #f38ba8; }
    .sm-price-was { font-size: 9px; color: #6c7086; text-decoration: line-through; }

    .sm-variants { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 5px; }
    .sm-var {
      font-size: 9px; padding: 2px 7px; border-radius: 4px;
      background: #313244; color: #a6adc8; border: 1px solid #45475a;
      cursor: pointer; transition: all 0.1s;
    }
    .sm-var:hover { border-color: #a6adc8; }
    .sm-var-active { background: rgba(137,180,250,0.15); border-color: #89b4fa; color: #89b4fa; }
    .sm-var-oos { opacity: 0.4; }

    .sm-card-stock { margin-top: 4px; font-size: 9px; color: #6c7086; }

    /* Map area */
    .sm-map-area { flex: 1; position: relative; }
    #sm-map { width: 100%; height: 100%; background: #11111b; }

    .sm-map-status {
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 1000; background: #1e1e2e; border: 1px solid #45475a;
      border-radius: 8px; padding: 8px 16px; font-size: 12px; color: #a6adc8;
      display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .sm-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid #45475a; border-top-color: #89b4fa;
      animation: sm-spin 0.7s linear infinite;
    }
    @keyframes sm-spin { to { transform: rotate(360deg); } }

    /* Legend */
    .sm-legend {
      position: absolute; bottom: 16px; right: 16px; z-index: 1000;
      background: #1e1e2e; border: 1px solid #45475a;
      border-radius: 8px; padding: 10px 14px; font-size: 11px;
    }
    .sm-legend-title { font-weight: 600; margin-bottom: 6px; color: #a6adc8; }
    .sm-legend-item { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
    .sm-legend-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
      display: inline-block !important; font-size: 0; line-height: 0; overflow: hidden;
    }

    /* Tooltip */
    .stock-tooltip {
      background: #1e1e2e !important; color: #cdd6f4 !important;
      border: 1px solid #45475a !important; border-radius: 8px !important;
      padding: 8px 12px !important; font: 11px sans-serif !important;
      line-height: 1.5 !important; box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
    }
    .leaflet-tooltip-top::before { border-top-color: #45475a !important; }

    /* Settings */
    #sm-settings { padding: 24px; overflow-y: auto; }
    .sm-settings-inner { max-width: 500px; margin: 0 auto; }
    .sm-settings-inner h3 { font-size: 16px; margin-bottom: 16px; }
    .sm-settings-inner h4 { font-size: 13px; margin: 16px 0 8px; color: #a6adc8; }
    .sm-setting { margin-bottom: 12px; }
    .sm-setting label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: #a6adc8; }
    .sm-setting input[type="text"], .sm-setting input[type="number"] {
      width: 100%; box-sizing: border-box; padding: 8px 10px;
      background: #28283d; color: #cdd6f4; border: 1px solid #45475a;
      border-radius: 6px; font: 13px 'Consolas', monospace; outline: none;
    }
    .sm-setting input:focus { border-color: #89b4fa; }
    .sm-threshold-row { display: flex; gap: 12px; }
    .sm-setting-sm { flex: 1; }
    .sm-setting-sm input { width: 100%; }
    .sm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    .sm-setting-note { font-size: 10px; color: #6c7086; margin-bottom: 16px; }
    .sm-setting-actions { display: flex; gap: 8px; align-items: center; padding-top: 8px; }
    .sm-btn-primary {
      padding: 8px 20px; border: none; border-radius: 6px;
      background: #89b4fa; color: #11111b; font: 600 13px sans-serif; cursor: pointer;
    }
    .sm-btn-primary:hover { background: #b4d0fb; }
    .sm-btn-secondary {
      padding: 8px 16px; border: 1px solid #45475a; border-radius: 6px;
      background: transparent; color: #a6adc8; font: 500 13px sans-serif; cursor: pointer;
    }
    .sm-btn-secondary:hover { background: #313244; }

    /* Store detail panel */
    .sm-store-panel {
      position: absolute; top: 0; right: 0; bottom: 0; width: 340px;
      z-index: 1001; background: #1e1e2e; border-left: 1px solid #45475a;
      overflow-y: auto; box-shadow: -4px 0 20px rgba(0,0,0,0.3);
      animation: sm-slide-in 0.2s ease;
    }
    @keyframes sm-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .sm-sp-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 16px; border-bottom: 1px solid #45475a; background: #28283d;
    }
    .sm-sp-header h3 { margin: 0; font-size: 15px; }
    .sm-sp-close {
      background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;
      padding: 2px 6px; border-radius: 4px;
    }
    .sm-sp-close:hover { color: #f38ba8; background: rgba(243,139,168,0.1); }
    .sm-sp-body { padding: 14px 16px; }
    .sm-sp-map-embed { margin-bottom: 12px; border-radius: 6px; overflow: hidden; }
    .sm-sp-map-embed iframe { display: block; }
    .sm-sp-address { font-size: 13px; color: #a6adc8; margin-bottom: 12px; line-height: 1.5; }
    .sm-sp-stock {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: 13px;
    }
    .sm-sp-dot {
      width: 10px; height: 10px; border-radius: 50% !important; flex-shrink: 0;
      display: inline-block !important; font-size: 0; line-height: 0; overflow: hidden;
    }
    .sm-sp-stock-label {
      font-size: 11px; color: #6c7086; margin-left: auto;
      padding: 1px 8px; background: #313244; border-radius: 4px;
    }
    .sm-sp-product {
      font-size: 11px; color: #6c7086; margin-bottom: 14px;
      padding: 8px 10px; background: #28283d; border-radius: 6px;
    }
    .sm-sp-links { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .sm-sp-link {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-radius: 8px; background: #28283d;
      color: #89b4fa; text-decoration: none; font-size: 13px; font-weight: 500;
      border: 1px solid #45475a; transition: all 0.12s;
    }
    .sm-sp-link:hover { background: #313244; border-color: #89b4fa; }
    .sm-sp-link span { font-size: 16px; }
    .sm-sp-details { border-top: 1px solid #45475a; padding-top: 12px; }
    .sm-sp-detail {
      display: flex; justify-content: space-between; font-size: 11px;
      padding: 4px 0; color: #a6adc8;
    }
    .sm-sp-label { color: #6c7086; }
    .sm-sp-mono { font-family: 'Consolas', monospace; font-size: 10px; }
    .sm-store-panel::-webkit-scrollbar { width: 5px; }
    .sm-store-panel::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }

    /* Dot icons — class-based colors, override site :empty rules */
    .sm-dot-icon,
    .sm-dot-icon span,
    .sm-dot-outer,
    .sm-dot-inner {
      display: inline-block !important;
      visibility: visible !important;
    }
    .sm-dot-outer {
      position: relative !important;
      cursor: pointer !important;
    }
    .sm-dot-inner {
      position: absolute !important;
      border-radius: 50% !important;
    }
    /* Color classes */
    .sm-dot-high    { background: #a6e3a1 !important; box-shadow: 0 0 3px 1px #a6e3a188, 0 0 6px 2px #a6e3a133 !important; }
    .sm-dot-medium  { background: #f9e2af !important; box-shadow: 0 0 3px 1px #f9e2af88, 0 0 6px 2px #f9e2af33 !important; }
    .sm-dot-low     { background: #e79e71 !important; box-shadow: 0 0 3px 1px #e79e7188, 0 0 6px 2px #e79e7133 !important; }
    .sm-dot-none    { background: #f38ba8 !important; box-shadow: 0 0 3px 1px #f38ba888, 0 0 6px 2px #f38ba833 !important; }
    .sm-dot-dimmed  { background: #585b70 !important; box-shadow: 0 0 2px 1px #585b7044 !important; }
    .sm-dot-unknown { background: #6c7086 !important; box-shadow: 0 0 2px 1px #6c708644 !important; }
    /* State modifiers */
    .sm-dot-oos   { opacity: 0.4 !important; }
    .sm-dot-other { opacity: 0.2 !important; }
    /* Tooltip color helpers */
    .sm-dot-high-text    { color: #a6e3a1 !important; }
    .sm-dot-medium-text  { color: #f9e2af !important; }
    .sm-dot-low-text     { color: #e79e71 !important; }
    .sm-dot-none-text    { color: #f38ba8 !important; }
    .sm-dot-dimmed-text  { color: #585b70 !important; }
    .sm-dot-unknown-text { color: #6c7086 !important; }
    .sm-tt-oos { color: #f38ba8 !important; }

    /* No stores notice */
    .sm-no-stores {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 1000; background: #1e1e2eee; border: 1px solid #45475a;
      border-radius: 10px; padding: 16px 24px; font-size: 13px; color: #a6adc8;
      text-align: center; line-height: 1.6; max-width: 360px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .sm-no-stores-icon { font-size: 20px; display: block; margin-bottom: 4px; }

    /* Sidebar tabs */
    .sm-sidebar-tabs {
      display: flex; border-bottom: 1px solid #45475a; flex-shrink: 0; background: #1e1e2e;
    }
    .sm-tab {
      flex: 1; padding: 8px 12px; border: none; background: transparent;
      color: #6c7086; font: 600 11px sans-serif; text-transform: uppercase;
      letter-spacing: 0.04em; cursor: pointer; border-bottom: 2px solid transparent;
      transition: all 0.12s;
    }
    .sm-tab:hover { color: #a6adc8; }
    .sm-tab-active { color: #89b4fa; border-bottom-color: #89b4fa; }
    .sm-tab-content { flex: 1; overflow-y: auto; padding: 6px; }

    /* Settings extras */
    .sm-setting-divider { border: none; border-top: 1px solid #45475a; margin: 16px 0; }
    .sm-setting-hint { font-size: 10px; color: #585b70; margin-top: 2px; display: block; }
    .sm-dev-badge {
      font-size: 9px; background: #cba6f7; color: #1e1e2e; padding: 1px 5px;
      border-radius: 3px; font-weight: 700; margin-left: 4px; vertical-align: middle;
    }

    /* Raw Data tab */
    .sm-dev-empty { padding: 20px; text-align: center; color: #6c7086; font-size: 12px; }
    .sm-dev-section { margin-bottom: 12px; }
    .sm-dev-title {
      font: 600 11px sans-serif; text-transform: uppercase; letter-spacing: 0.04em;
      color: #6c7086; padding: 6px 0 4px; border-bottom: 1px solid #313244; margin-bottom: 4px;
    }
    .sm-dev-time { font: 10px 'Consolas', monospace; color: #585b70; margin-left: 6px; }
    .sm-dev-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .sm-dev-table td, .sm-dev-table th {
      padding: 3px 6px; text-align: left; border-bottom: 1px solid #28283d;
    }
    .sm-dev-table th {
      color: #6c7086; font-weight: 600; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.03em; position: sticky; top: 0; background: #1e1e2e;
    }
    .sm-dev-table-full { font-size: 10px; }
    .sm-dev-label { color: #6c7086; white-space: nowrap; width: 130px; }
    .sm-dev-mono { font-family: 'Consolas', monospace; font-size: 10px; }
    .sm-dev-cell-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sm-dev-val-good { color: #a6e3a1; }
    .sm-dev-val-warn { color: #f9e2af; }
    .sm-dev-val-err { color: #f38ba8; }
    .sm-dev-row-sel { background: rgba(137,180,250,0.08); }
    .sm-dev-row-miss { background: rgba(243,139,168,0.06); color: #f38ba8; }
    .sm-dev-row-oos { opacity: 0.5; }
    .sm-dev-qty { font-weight: 600; }
    .sm-dev-qty-high { color: #a6e3a1; }
    .sm-dev-qty-medium { color: #f9e2af; }
    .sm-dev-qty-low { color: #e79e71; }
    .sm-dev-qty-none { color: #f38ba8; }
    .sm-dev-qty-unknown { color: #585b70; }
    .sm-dev-level { font-size: 9px; padding: 1px 5px; border-radius: 3px; }
    .sm-dev-level-high { background: rgba(166,227,161,0.15); color: #a6e3a1; }
    .sm-dev-level-medium { background: rgba(249,226,175,0.15); color: #f9e2af; }
    .sm-dev-level-low { background: rgba(250,179,135,0.15); color: #e79e71; }
    .sm-dev-level-none { background: rgba(243,139,168,0.15); color: #f38ba8; }
    .sm-dev-level-unknown { background: rgba(108,112,134,0.15); color: #6c7086; }
    .sm-dev-history-row {
      display: flex; gap: 8px; align-items: center; padding: 3px 0;
      font-size: 10px; color: #a6adc8; border-bottom: 1px solid #28283d;
    }
    .sm-dev-hist-stats { font: 10px 'Consolas', monospace; color: #585b70; margin-left: auto; }

    /* Leaflet overrides */
    .leaflet-control-zoom a {
      background: #1e1e2e !important; color: #cdd6f4 !important;
      border-color: #45475a !important;
    }
    .leaflet-control-attribution { display: none; }
  `);

  // ── Keybind ─────────────────────────────────────────────
  function parseKeybind(str) {
    const parts = str.toLowerCase().split('+').map(s => s.trim());
    return {
      ctrl: parts.includes('ctrl'),
      alt: parts.includes('alt'),
      shift: parts.includes('shift'),
      meta: parts.includes('meta') || parts.includes('cmd'),
      key: parts.find(p => !['ctrl','alt','shift','meta','cmd'].includes(p)) || '',
    };
  }

  document.addEventListener('keydown', e => {
    const bind = parseKeybind(config.keybind);
    if (bind.key && e.ctrlKey === bind.ctrl && e.altKey === bind.alt &&
        e.shiftKey === bind.shift && e.metaKey === bind.meta &&
        e.key.toLowerCase() === bind.key) {
      e.preventDefault();
      if (overlay?.style.display !== 'none') hideOverlay();
      else showOverlay();
    }
    if (e.key === 'Escape' && overlay?.style.display !== 'none') hideOverlay();
  });

  // ── Menu Commands ───────────────────────────────────────
  GM_registerMenuCommand('Open Stock Map', showOverlay);
  GM_registerMenuCommand('Settings', () => { showOverlay(); setTimeout(showSettings, 200); });

  // ── Init ────────────────────────────────────────────────
  log(`Ready — ${config.keybind} or Tampermonkey menu to open`);
})();
