(() => {
'use strict';
if (window.__freshCartEnhancementsLoaded) return;
window.__freshCartEnhancementsLoaded = true;

const css = '#fc-location-modal{position:fixed;inset:0;z-index:10000;background:rgba(16,24,20,.48);display:none;align-items:flex-start;justify-content:center;padding:8vh 16px 24px;box-sizing:border-box;font-family:inherit}#fc-location-modal.fc-open{display:flex}#fc-location-modal .fc-dialog{width:min(680px,100%);max-height:84vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 20px 70px rgba(0,0,0,.22);padding:24px;box-sizing:border-box;color:#202923}#fc-location-modal .fc-title{font-size:20px;font-weight:700;margin:0 0 16px}#fc-location-modal .fc-search-wrap{display:flex;align-items:center;gap:12px;border:1px solid #dfe5e1;border-radius:9px;padding:0 14px;min-height:54px}#fc-location-modal input{border:0;outline:0;flex:1;min-width:0;font:inherit;font-size:15px;color:#202923;background:transparent}#fc-location-modal .fc-close{border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#526158}#fc-location-modal .fc-current{width:100%;display:flex;align-items:center;gap:12px;margin:14px 0 20px;padding:15px 14px;border:0;border-radius:9px;background:#f1f6f3;color:#1b6547;font:600 15px inherit;text-align:left;cursor:pointer}#fc-location-modal .fc-current:disabled{opacity:.65;cursor:wait}#fc-location-modal .fc-section{font-size:13px;font-weight:700;color:#77837b;text-transform:uppercase;letter-spacing:.05em;margin:18px 0 8px}#fc-location-modal .fc-result{display:block;width:100%;border:0;border-radius:8px;background:#f7f8f7;color:#26332b;text-align:left;padding:13px 14px;margin:7px 0;cursor:pointer;font:inherit}#fc-location-modal .fc-result:hover,#fc-location-modal .fc-result:focus{background:#eaf3ed;outline:2px solid #b6d2c0}#fc-location-modal .fc-muted{color:#718078;font-size:13px;margin:9px 0}#fc-location-modal .fc-attribution{font-size:11px;color:#849087;margin-top:14px}#fc-product-suggestions{position:fixed;z-index:9998;display:none;max-height:min(65vh,480px);overflow:auto;background:#fff;border:1px solid #e5e9e6;border-radius:0 0 12px 12px;box-shadow:0 12px 32px rgba(0,0,0,.16);padding:6px}#fc-product-suggestions.fc-visible{display:block}#fc-product-suggestions .fc-product-row{width:100%;display:flex;gap:12px;align-items:center;border:0;border-radius:8px;background:#fff;padding:9px;text-align:left;cursor:pointer;color:#202923;font:inherit}#fc-product-suggestions .fc-product-row:hover,#fc-product-suggestions .fc-product-row:focus{background:#f3f7f4;outline:none}#fc-product-suggestions img{width:54px;height:54px;object-fit:cover;border-radius:8px;background:#f2f2ed;flex:none}#fc-product-suggestions .fc-product-name{font-size:14px;font-weight:650;display:block}#fc-product-suggestions .fc-product-meta{font-size:12px;color:#758078;display:block;margin-top:3px}#fc-product-suggestions .fc-product-price{margin-left:auto;font-weight:700;font-size:14px;white-space:nowrap}#fc-product-suggestions .fc-empty{padding:16px;color:#718078;font-size:13px}.fc-location-trigger{cursor:pointer}@media(max-width:600px){#fc-location-modal{padding:0;align-items:flex-end}#fc-location-modal .fc-dialog{border-radius:16px 16px 0 0;max-height:88vh;padding:20px 16px}#fc-product-suggestions{max-height:55vh}}';
const style=document.createElement('style');style.id='fc-location-search-styles';style.textContent=css;document.head.appendChild(style);

const modal=document.createElement('div');modal.id='fc-location-modal';
modal.innerHTML='<section class="fc-dialog" role="dialog" aria-modal="true" aria-labelledby="fc-location-title"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 class="fc-title" id="fc-location-title">Choose your location</h2><button class="fc-close" type="button" aria-label="Close location selector">×</button></div><label class="fc-search-wrap"><span aria-hidden="true">⌕</span><input id="fc-location-query" type="search" autocomplete="off" placeholder="Search for your location"></label><button class="fc-current" id="fc-use-current" type="button"><span aria-hidden="true">◎</span><span>Use current location</span></button><div id="fc-location-feedback" class="fc-muted" aria-live="polite"></div><div class="fc-section">Suggested locations</div><div id="fc-location-results" aria-live="polite"></div><div class="fc-section">Saved address</div><div id="fc-saved-location"></div><div class="fc-attribution">Address search powered by OpenStreetMap contributors. Your coordinates are used only after you choose current location.</div></section>';
document.body.appendChild(modal);
const q=modal.querySelector('#fc-location-query'),resultBox=modal.querySelector('#fc-location-results'),feedback=modal.querySelector('#fc-location-feedback'),currentButton=modal.querySelector('#fc-use-current');
const productBox=document.createElement('div');productBox.id='fc-product-suggestions';productBox.setAttribute('role','listbox');document.body.appendChild(productBox);

const getSaved=()=>{try{return JSON.parse(localStorage.getItem('freshcart_location')||'null')}catch{return null}};
const labelAddress=loc=>loc.display_name||'';
const getCity=loc=>{const a=loc.address||{};return a.city||a.town||a.village||a.county||a.state||'Selected location'};
const getShort=loc=>{const a=loc.address||{};return [a.suburb||a.neighbourhood||a.village||a.town,a.city||a.town||a.village,a.state,a.postcode].filter(Boolean).join(', ')};
const updateHeader=loc=>{
const trigger=document.querySelector('[data-fc-location-trigger]');if(!trigger)return;
trigger.textContent='';const strong=document.createElement('strong');strong.textContent='Deliver to '+getCity(loc);strong.style.display='block';
const small=document.createElement('small');small.textContent=labelAddress(loc)||getShort(loc);small.style.display='block';small.style.maxWidth='260px';small.style.overflow='hidden';small.style.textOverflow='ellipsis';small.style.whiteSpace='nowrap';
trigger.append(strong,small);trigger.title=small.textContent;trigger.setAttribute('aria-label','Delivery location: '+getCity(loc)+'. Change location.');
};
const chooseLocation=loc=>{
const a=loc.address||{};const value={display_name:labelAddress(loc)||getShort(loc),lat:Number(loc.lat),lon:Number(loc.lon),city:getCity(loc),postcode:a.postcode||'',address:a};
localStorage.setItem('freshcart_location',JSON.stringify(value));updateHeader(value);
document.dispatchEvent(new CustomEvent('freshcart:location-change',{detail:value}));modal.classList.remove('fc-open');
if(/^\\d{6}$/.test(value.postcode)){fetch('/api/delivery?pincode='+encodeURIComponent(value.postcode)).then(r=>r.json()).then(data=>document.dispatchEvent(new CustomEvent('freshcart:serviceability',{detail:data}))).catch(()=>{});}
};
const locationButton=(title,detail,callback)=>{
const b=document.createElement('button');b.type='button';b.className='fc-result';
const strong=document.createElement('strong');strong.textContent=title;
const sub=document.createElement('div');sub.className='fc-muted';sub.textContent=detail||'';
b.append(strong,sub);b.addEventListener('click',callback);return b;
};
const renderLocations=items=>{
resultBox.replaceChildren();if(!items.length){const p=document.createElement('p');p.className='fc-muted';p.textContent='No locations found. Try a nearby area or PIN code.';resultBox.append(p);return;}
items.forEach(item=>{const a=item.address||{};const primary=a.suburb||a.neighbourhood||a.city||a.town||a.village||item.name||item.display_name;resultBox.append(locationButton(primary,item.display_name,()=>chooseLocation(item)));});
};
let locTimer,locRequest=0;
q.addEventListener('input',()=>{
clearTimeout(locTimer);const term=q.value.trim();if(term.length<3){resultBox.replaceChildren();feedback.textContent=term?'Type at least 3 characters.':'';return;}
feedback.textContent='Searching nearby locations…';const token=++locRequest;
locTimer=setTimeout(async()=>{
try{const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&q='+encodeURIComponent(term);const r=await fetch(url,{headers:{'Accept-Language':'en-IN,en'}});if(!r.ok)throw new Error('Location search is temporarily unavailable.');const items=await r.json();if(token!==locRequest)return;feedback.textContent='';renderLocations(items);}
catch(e){if(token===locRequest)feedback.textContent=e.message||'Could not search locations. Please try again.';}
},1000);
});
const openModal=()=>{
modal.classList.add('fc-open');q.value='';resultBox.replaceChildren();feedback.textContent='';
const saved=getSaved(),box=modal.querySelector('#fc-saved-location');box.replaceChildren();
if(saved)box.append(locationButton(saved.city||'Saved location',saved.display_name,()=>chooseLocation(saved)));
else{const p=document.createElement('p');p.className='fc-muted';p.textContent='Your selected location will appear here.';box.append(p);}
q.focus();
};
const closeModal=()=>modal.classList.remove('fc-open');
modal.querySelector('.fc-close').addEventListener('click',closeModal);
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('fc-open'))closeModal()});
currentButton.addEventListener('click',()=>{
if(!navigator.geolocation){feedback.textContent='Location is not supported by this browser.';return;}
currentButton.disabled=true;feedback.textContent='Detecting your current location…';
navigator.geolocation.getCurrentPosition(async pos=>{
try{const lat=pos.coords.latitude,lon=pos.coords.longitude;const url='https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon);const r=await fetch(url,{headers:{'Accept-Language':'en-IN,en'}});if(!r.ok)throw new Error('Your location was detected, but address lookup failed.');const place=await r.json();place.lat=lat;place.lon=lon;chooseLocation(place);}
catch(e){feedback.textContent=e.message||'Could not resolve your address. Search manually instead.';}
finally{currentButton.disabled=false;}
},err=>{feedback.textContent=err.code===1?'Location permission was denied. Allow location access in your browser settings or search manually.':err.code===2?'Your current location is unavailable. Try searching manually.':'Location request timed out. Please try again.';currentButton.disabled=false;},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
});

const findSearch=()=>[...document.querySelectorAll('input')].find(el=>/search chicken|search.*fish|search.*mutton|search products/i.test(el.placeholder||''));
let products=[];
fetch('/api/products').then(r=>r.ok?r.json():Promise.reject()).then(d=>{products=Array.isArray(d.products)?d.products:[]}).catch(()=>{products=Array.isArray(window.FRESHCART_CATALOG)?window.FRESHCART_CATALOG:[]});
const hideProducts=()=>productBox.classList.remove('fc-visible');
const showProducts=(input,items,term)=>{
productBox.replaceChildren();const rect=input.getBoundingClientRect();
productBox.style.left=Math.max(8,rect.left)+'px';productBox.style.top=(rect.bottom+5)+'px';productBox.style.width=Math.min(Math.max(280,rect.width),window.innerWidth-16)+'px';
if(!items.length){const p=document.createElement('div');p.className='fc-empty';p.textContent='No products found for "'+term+'". Try chicken, mutton, fish or eggs.';productBox.append(p);}
items.forEach(item=>{
const row=document.createElement('button');row.type='button';row.className='fc-product-row';row.setAttribute('role','option');
const img=document.createElement('img');img.src=item.image||'';img.alt='';img.loading='lazy';
const detail=document.createElement('span');const name=document.createElement('span');name.className='fc-product-name';name.textContent=item.name||'Product';
const meta=document.createElement('span');meta.className='fc-product-meta';meta.textContent=[item.category,item.cut||item.weight].filter(Boolean).join(' · ');detail.append(name,meta);
const price=document.createElement('span');price.className='fc-product-price';price.textContent='₹'+Number(item.price||0).toLocaleString('en-IN');row.append(img,detail,price);
row.addEventListener('click',()=>{input.value=item.name||'';input.dispatchEvent(new Event('input',{bubbles:true}));hideProducts();input.focus();const cards=[...document.querySelectorAll('[data-product-id],[data-id],article,.product-card')];const card=cards.find(el=>el.getAttribute('data-product-id')===item.id||el.getAttribute('data-id')===item.id||el.textContent.includes(item.name||'__no_match__'));if(card)card.scrollIntoView({behavior:'smooth',block:'center'});});
productBox.append(row);
});
productBox.classList.add('fc-visible');
};
const bindSearch=()=>{
const input=findSearch();if(!input||input.dataset.fcAutocompleteBound)return;input.dataset.fcAutocompleteBound='1';input.setAttribute('autocomplete','off');let timer;
input.addEventListener('input',()=>{clearTimeout(timer);const term=input.value.trim().toLowerCase();if(!term){hideProducts();return;}timer=setTimeout(()=>{const matches=products.filter(p=>[p.name,p.category,p.cut,p.desc,p.weight].some(v=>String(v||'').toLowerCase().includes(term))).slice(0,7);showProducts(input,matches,term);},100);});
input.addEventListener('focus',()=>{if(input.value.trim())input.dispatchEvent(new Event('input',{bubbles:true}));});
input.addEventListener('keydown',e=>{if(e.key==='Escape')hideProducts();if(e.key==='ArrowDown'&&productBox.classList.contains('fc-visible')){e.preventDefault();productBox.querySelector('button')?.focus();}});
};
productBox.addEventListener('keydown',e=>{if(e.key==='Escape')hideProducts()});
document.addEventListener('click',e=>{if(!productBox.contains(e.target)&&!e.target.closest('input[placeholder*="Search"]'))hideProducts()});

const findLocationTrigger=()=>{
const candidates=[...document.querySelectorAll('button,[role="button"],a,[tabindex],div')];
return candidates.find(el=>{if(el.closest('#fc-location-modal')||el.closest('#fc-product-suggestions'))return false;const t=(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title')||'').trim();if(!t||t.length>100)return false;return /deliver to|delivery location|change location|select location|your location|pincode|pin code/i.test(t);});
};
const bindLocation=()=>{
let trigger=findLocationTrigger();
if(!trigger){const header=document.querySelector('header,nav,[role="banner"]');if(header){trigger=document.createElement('button');trigger.type='button';trigger.className='fc-location-trigger';trigger.textContent='Choose delivery location';trigger.style.cssText='border:0;background:transparent;padding:8px 12px;text-align:left;color:inherit;font:inherit';header.append(trigger);}}
if(trigger&&!trigger.dataset.fcLocationBound){trigger.dataset.fcLocationBound='1';trigger.dataset.fcLocationTrigger='1';trigger.classList.add('fc-location-trigger');trigger.addEventListener('click',e=>{e.preventDefault();openModal()});const loc=getSaved();if(loc)updateHeader(loc);}
};
bindSearch();bindLocation();
const observer=new MutationObserver(()=>{bindSearch();bindLocation()});observer.observe(document.documentElement,{childList:true,subtree:true});
const saved=getSaved();if(saved)document.dispatchEvent(new CustomEvent('freshcart:location-change',{detail:saved}));
})();