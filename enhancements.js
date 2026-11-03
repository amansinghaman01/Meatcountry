(() => {
  'use strict';
  const style = document.createElement('style');
  style.id = 'freshcart-enhancements-style';
  style.textContent = [
    '.fc-search-suggestions{position:absolute;z-index:10050;top:calc(100% + 8px);left:0;right:0;max-height:min(420px,65vh);overflow:auto;background:#fff;border:1px solid #e7ebe7;border-radius:14px;box-shadow:0 16px 38px rgba(20,45,34,.17);padding:7px;display:none}',
    '.fc-search-suggestions.is-open{display:block}',
    '.fc-suggestion{display:flex;width:100%;align-items:center;gap:12px;border:0;background:#fff;text-align:left;padding:11px 12px;border-radius:10px;color:#173b2e;cursor:pointer}',
    '.fc-suggestion:hover,.fc-suggestion[aria-selected=true]{background:#f0f5f0}',
    '.fc-suggestion-mark{width:34px;height:34px;display:grid;place-items:center;flex:none;border-radius:10px;background:#f2f5ef;font-size:17px}',
    '.fc-suggestion-copy{min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.fc-suggestion-copy strong{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fc-suggestion-copy small{font-size:11px;color:#718078;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fc-suggestion-empty{padding:14px;color:#718078;font-size:13px}',
    '.fc-location-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin:0 0 16px;position:relative}',
    '.fc-location-search-wrap{position:relative;min-width:0}',
    '.fc-location-search{width:100%;min-height:48px;box-sizing:border-box;border:1px solid #dfe5df;border-radius:10px;padding:0 14px 0 42px;font:inherit;color:#173b2e;background:#fff;outline:none}',
    '.fc-location-search:focus{border-color:#638a70;box-shadow:0 0 0 3px rgba(99,138,112,.13)}',
    '.fc-location-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#63766b;pointer-events:none}',
    '.fc-current-location{min-height:48px;border:1px solid #dfe5df;background:#fff;color:#173b2e;border-radius:10px;padding:0 13px;font:600 13px system-ui;white-space:nowrap;cursor:pointer}',
    '.fc-current-location:hover{background:#f3f7f2;border-color:#a8bca9}',
    '.fc-current-location:disabled{opacity:.65;cursor:wait}',
    '.fc-location-hint{font-size:12px;line-height:1.45;color:#78847d;margin:-7px 0 14px}',
    '.fc-location-results{position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:10060;background:#fff;border:1px solid #e5eae5;border-radius:12px;box-shadow:0 14px 32px rgba(20,45,34,.16);padding:6px;display:none;max-height:280px;overflow:auto}',
    '.fc-location-results.is-open{display:block}',
    '.fc-location-result{width:100%;border:0;border-radius:8px;padding:11px 10px;background:#fff;text-align:left;display:flex;gap:10px;align-items:flex-start;color:#173b2e;cursor:pointer}',
    '.fc-location-result:hover{background:#f3f6f2}',
    '.fc-location-result-icon{font-size:16px;padding-top:1px}',
    '.fc-location-result span:last-child{font-size:13px;line-height:1.4}',
    '.fc-location-status{font-size:12px;line-height:1.45;color:#68796f;margin:8px 0 0;min-height:16px}',
    '.fc-location-status[data-kind=error]{color:#a33d35}',
    '.fc-location-status[data-kind=success]{color:#26734b}',
    '@media(max-width:560px){.fc-location-tools{grid-template-columns:1fr}.fc-current-location{width:100%}.fc-search-suggestions{max-height:55vh}}'
  ].join('');
  document.head.appendChild(style);

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const textNode = (tag, value, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  };

  function initProductSearch() {
    const input = document.querySelector('#searchInput, input.search, input[placeholder*="Search chicken"], input[placeholder*="Search products"]');
    if (!input || input.dataset.fcAutocomplete === '1') return;
    input.dataset.fcAutocomplete = '1';
    const host = input.parentElement || input;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const list = document.createElement('div');
    list.className = 'fc-search-suggestions';
    list.id = 'fcProductSuggestions';
    list.setAttribute('role', 'listbox');
    host.appendChild(list);
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    const cacheProducts = () => {
      const catalogue = Array.isArray(window.FRESHCART_CATALOG) ? window.FRESHCART_CATALOG : [];
      const cards = [...document.querySelectorAll('#productGrid .product-card')].map((card) => ({
        name: clean(card.querySelector('.product-name')?.textContent),
        category: clean(card.querySelector('.product-cut')?.textContent),
        desc: clean(card.querySelector('.product-desc')?.textContent),
        priceText: clean(card.querySelector('.price')?.textContent),
        card
      })).filter((item) => item.name);
      const fromCatalogue = catalogue.map((p) => ({
        name: clean(p.name), category: clean(p.category), desc: clean(p.desc || p.cut),
        priceText: p.price ? '₹' + p.price : '', card: null
      })).filter((item) => item.name);
      const merged = new Map();
      [...cards, ...fromCatalogue].forEach((item) => {
        const key = item.name.toLowerCase();
        if (!merged.has(key) || (!merged.get(key).card && item.card)) merged.set(key, item);
      });
      return [...merged.values()];
    };
    let items = cacheProducts();
    let matches = [];
    let activeIndex = -1;

    function close() {
      list.classList.remove('is-open');
      list.replaceChildren();
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
    }
    function choose(item) {
      if (!item) return;
      input.value = item.name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      close();
      window.setTimeout(() => {
        const card = [...document.querySelectorAll('#productGrid .product-card')].find((node) =>
          clean(node.querySelector('.product-name')?.textContent).toLowerCase() === item.name.toLowerCase()
        );
        (card || item.card)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    function render(query) {
      const q = clean(query).toLowerCase();
      close();
      if (!q) return;
      if (!items.length) items = cacheProducts();
      matches = items.filter((item) =>
        [item.name, item.category, item.desc].join(' ').toLowerCase().includes(q)
      ).slice(0, 7);
      list.replaceChildren();
      if (!matches.length) {
        list.appendChild(textNode('div', 'No matching products found', 'fc-suggestion-empty'));
      } else {
        matches.forEach((item, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'fc-suggestion';
          button.setAttribute('role', 'option');
          button.setAttribute('aria-selected', 'false');
          button.appendChild(textNode('span', '⌕', 'fc-suggestion-mark'));
          const copy = document.createElement('span');
          copy.className = 'fc-suggestion-copy';
          copy.appendChild(textNode('strong', item.name));
          copy.appendChild(textNode('small', [item.category, item.priceText].filter(Boolean).join(' · ')));
          button.appendChild(copy);
          button.addEventListener('mousedown', (event) => event.preventDefault());
          button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); choose(item); });
          list.appendChild(button);
        });
      }
      list.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('focus', () => { if (clean(input.value)) render(input.value); });
    input.addEventListener('keydown', (event) => {
      const options = [...list.querySelectorAll('.fc-suggestion')];
      if (event.key === 'Escape') { close(); return; }
      if (!options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options.forEach((option, index) => option.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false'));
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        choose(matches[activeIndex]);
      }
    });
    document.addEventListener('click', (event) => { if (!host.contains(event.target)) close(); });
    const grid = document.querySelector('#productGrid');
    if (grid && window.MutationObserver) {
      new MutationObserver(() => { if (items.length < 4) items = cacheProducts(); }).observe(grid, { childList: true, subtree: true });
    }
  }

  // Photon uses OpenStreetMap data. Only the user's typed query or GPS coordinates are sent for geocoding.
  function initLocationModal() {
    const overlay = [...document.querySelectorAll('.overlay.show')].find((node) =>
      node.querySelector('input[placeholder*="800001"], input[name*="pincode" i], input[id*="pincode" i]')
    );
    if (!overlay || overlay.dataset.fcLocationEnhanced === '1') return;
    const pinInput = overlay.querySelector('input[placeholder*="800001"], input[name*="pincode" i], input[id*="pincode" i]');
    if (!pinInput) return;
    const form = pinInput.closest('form') || overlay.querySelector('.locationForm') || pinInput.parentElement;
    if (!form) return;
    overlay.dataset.fcLocationEnhanced = '1';

    const tools = document.createElement('div');
    tools.className = 'fc-location-tools';
    const searchWrap = document.createElement('div');
    searchWrap.className = 'fc-location-search-wrap';
    searchWrap.appendChild(textNode('span', '⌕', 'fc-location-search-icon'));
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'fc-location-search';
    search.placeholder = 'Search for your location';
    search.setAttribute('aria-label', 'Search for your location');
    search.autocomplete = 'off';
    searchWrap.appendChild(search);

    const current = document.createElement('button');
    current.type = 'button';
    current.className = 'fc-current-location';
    current.textContent = '◎  Use current location';
    tools.append(searchWrap, current);

    const results = document.createElement('div');
    results.className = 'fc-location-results';
    results.setAttribute('role', 'listbox');
    searchWrap.appendChild(results);
    const hint = textNode('p', 'Search your area, landmark or PIN code. Suggestions use OpenStreetMap data.', 'fc-location-hint');
    const status = textNode('p', '', 'fc-location-status');
    status.setAttribute('aria-live', 'polite');
    const anchor = pinInput.closest('.form-group') || pinInput.parentElement;
    form.insertBefore(tools, anchor);
    form.insertBefore(hint, anchor);
    form.insertBefore(status, anchor);

    let timer = 0;
    let aborter = null;
    function setStatus(message, kind) {
      status.textContent = message || '';
      if (kind) status.dataset.kind = kind; else delete status.dataset.kind;
    }
    function closeResults() { results.classList.remove('is-open'); results.replaceChildren(); }
    function addressParts(properties) {
      const p = properties || {};
      return [...new Set([
        p.name, [p.housenumber, p.street].filter(Boolean).join(' '),
        p.suburb, p.district, p.city || p.town || p.village || p.county,
        p.state, p.postcode, p.country
      ].map(clean).filter(Boolean))];
    }
    function fillLocation(properties) {
      const parts = addressParts(properties);
      const label = parts.join(', ');
      const postcode = clean(properties?.postcode).replace(/\D/g, '');
      const validPin = /^\d{6}$/.test(postcode);
      if (validPin) {
        pinInput.value = postcode;
        pinInput.dispatchEvent(new Event('input', { bubbles: true }));
        pinInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      try {
        localStorage.setItem('freshcart:selectedLocation', JSON.stringify({
          label,
          pincode: validPin ? postcode : '',
          city: clean(properties?.city || properties?.town || properties?.village || properties?.county),
          selectedAt: new Date().toISOString()
        }));
      } catch (_) {}
      search.value = label || 'Location detected';
      closeResults();
      if (validPin) {
        setStatus('Location found. PIN ' + postcode + ' filled in — press “Set delivery location” to confirm availability.', 'success');
      } else {
        setStatus('Location found, but this address has no 6-digit PIN. Enter your PIN below to check delivery availability.', 'error');
      }
    }
    function addResult(feature) {
      const props = feature?.properties || {};
      const label = addressParts(props).join(', ');
      if (!label) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fc-location-result';
      button.setAttribute('role', 'option');
      button.appendChild(textNode('span', '⌖', 'fc-location-result-icon'));
      button.appendChild(textNode('span', label));
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => fillLocation(props));
      results.appendChild(button);
    }
    async function lookup(query) {
      if (aborter) aborter.abort();
      aborter = new AbortController();
      try {
        const response = await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=6&lang=en', {
          signal: aborter.signal, headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error('Location search is temporarily unavailable.');
        const data = await response.json();
        results.replaceChildren();
        const features = data.features || [];
        features.forEach(addResult);
        if (!features.length) results.appendChild(textNode('div', 'No matching locations. Try a nearby area or PIN code.', 'fc-suggestion-empty'));
        results.classList.add('is-open');
      } catch (error) {
        if (error.name !== 'AbortError') setStatus(error.message || 'Could not search locations. Enter your PIN code manually.', 'error');
      }
    }
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      const query = clean(search.value);
      closeResults();
      if (query.length < 3) return;
      timer = window.setTimeout(() => lookup(query), 280);
    });
    search.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeResults(); });
    current.addEventListener('click', () => {
      if (!window.isSecureContext || !navigator.geolocation) {
        setStatus('Current location needs HTTPS and browser geolocation support. Search your address or enter your PIN.', 'error');
        return;
      }
      current.disabled = true;
      current.textContent = 'Detecting location…';
      setStatus('Waiting for browser location permission…');
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const response = await fetch('https://photon.komoot.io/reverse?lat=' + encodeURIComponent(latitude) + '&lon=' + encodeURIComponent(longitude) + '&lang=en');
          if (!response.ok) throw new Error('Could not resolve your current address.');
          const data = await response.json();
          const feature = data.features?.[0];
          if (!feature) throw new Error('No nearby address was found. Search manually or enter your PIN.');
          fillLocation(feature.properties);
        } catch (error) {
          setStatus(error.message || 'Could not detect your address. Please search manually.', 'error');
        } finally {
          current.disabled = false;
          current.textContent = '◎  Use current location';
        }
      }, (error) => {
        const messages = {
          1: 'Location permission was denied. Allow location access in browser settings or search your address manually.',
          2: 'Your current location is unavailable. Search your address or enter your PIN.',
          3: 'Location detection timed out. Try again or search manually.'
        };
        setStatus(messages[error.code] || 'Could not access your location. Please search manually.', 'error');
        current.disabled = false;
        current.textContent = '◎  Use current location';
      }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
    });
    document.addEventListener('click', (event) => { if (!searchWrap.contains(event.target)) closeResults(); });
    try {
      const saved = JSON.parse(localStorage.getItem('freshcart:selectedLocation') || 'null');
      if (saved?.label) search.value = saved.label;
      if (saved?.pincode && /^\d{6}$/.test(saved.pincode) && !pinInput.value) pinInput.value = saved.pincode;
    } catch (_) {}
  }

  function init() {
    initProductSearch();
    initLocationModal();
  }
  init();
  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('pageshow', init);
})();