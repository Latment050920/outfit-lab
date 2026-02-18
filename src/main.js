import { loadWardrobe, saveEnabled, addCustomItem, removeCustomItem, loadFavorites, saveFavorite } from './storage.js';
import { loadProducts, upsertProduct, removeProduct } from './storage/productsStore.js';
import { getAIRecommendation } from './recommender/aiAdapter.js';
import { compressImageToDataUrl, resolveItemImage, bindImageFallback, generatePlaceholderDataUrl } from './utils/image.js';

let wardrobe = loadWardrobe();
let products = [];
let currentRecommendation = null;
let selectedCategory = 'All';
let rerollSeed = Date.now();
let uploadImageDataUrl = '';
let productImageDataUrl = '';

const els = {
  tabs: document.querySelectorAll('.tab-btn'),
  panels: document.querySelectorAll('.tab-panel'),
  tempSegment: document.querySelector('#temp-segment'),
  formality: document.querySelector('#formality'),
  formalityValue: document.querySelector('#formality-value'),
  styleChips: document.querySelectorAll('#style-chips .chip'),
  colorChips: document.querySelectorAll('#color-chips .chip'),
  generate: document.querySelector('#generate'),
  reroll: document.querySelector('#reroll'),
  favorite: document.querySelector('#favorite'),
  result: document.querySelector('#result-content'),
  categoryFilter: document.querySelector('#category-filter'),
  wardrobeList: document.querySelector('#wardrobe-list'),
  addItemBtn: document.querySelector('#add-item-btn'),
  addItemDialog: document.querySelector('#add-item-dialog'),
  addItemForm: document.querySelector('#add-item-form'),
  cancelAdd: document.querySelector('#cancel-add'),
  imageUpload: document.querySelector('#image-upload'),
  imagePreviewWrap: document.querySelector('#image-preview-wrap'),
  imagePreview: document.querySelector('#image-preview'),
  clearImage: document.querySelector('#clear-image'),
  favoritesList: document.querySelector('#favorites-list'),
  imageModal: document.querySelector('#image-modal'),
  imageModalImg: document.querySelector('#image-modal-img'),
  imageModalDetail: document.querySelector('#image-modal-detail'),
  closeImageModal: document.querySelector('#close-image-modal'),
  productForm: document.querySelector('#product-form'),
  productImageInput: document.querySelector('#product-image'),
  productImagePreviewWrap: document.querySelector('#product-image-preview-wrap'),
  productImagePreview: document.querySelector('#product-image-preview'),
  clearProductImage: document.querySelector('#clear-product-image'),
  dropZone: document.querySelector('#drop-zone'),
  productList: document.querySelector('#product-list'),
  productSearch: document.querySelector('#product-search'),
  productSort: document.querySelector('#product-sort'),
  productColorChips: document.querySelectorAll('#product-color-chips .chip'),
  productStyleChips: document.querySelectorAll('#product-style-chips .chip')
};

function initTabs() {
  els.tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.tabs.forEach((b) => b.classList.toggle('is-active', b === btn));
      els.panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === btn.dataset.tab));
      if (btn.dataset.tab === 'favorites') renderFavorites();
      if (btn.dataset.tab === 'product-links') renderProductList();
    });
  });
}

function bindInteractions() {
  els.formality.addEventListener('input', () => (els.formalityValue.textContent = els.formality.value));
  els.tempSegment.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    els.tempSegment.querySelectorAll('button').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
  }));
  [...els.styleChips, ...els.colorChips, ...els.productColorChips, ...els.productStyleChips].forEach((chip) => chip.addEventListener('click', () => chip.classList.toggle('is-active')));

  els.generate.addEventListener('click', () => generate());
  els.reroll.addEventListener('click', () => { rerollSeed += 19; generate(rerollSeed); });
  els.favorite.addEventListener('click', () => {
    if (!currentRecommendation) return;
    saveFavorite({ id: `fav-${Date.now()}`, createdAt: new Date().toISOString(), request: gatherRequest(), response: currentRecommendation });
    renderFavorites();
  });

  bindWardrobeDialog();
  bindImageModal();
  bindProductForm();

  els.result.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('[data-action="replace"]')) return replaceByAlternative(t.dataset.slot);
    if (t.matches('[data-action="open-link"]')) return window.open(t.dataset.url, '_blank', 'noopener');
    const card = t.closest('[data-item-id]');
    if (!card || t.matches('button')) return;
    const item = getItemById(card.dataset.itemId);
    openImageModal(item || { name: card.dataset.itemName, image: card.dataset.itemImage, note: card.dataset.note });
  });
}

function bindWardrobeDialog() {
  els.addItemBtn.addEventListener('click', () => els.addItemDialog.showModal());
  els.cancelAdd.addEventListener('click', () => closeAddDialog());
  els.imageUpload.addEventListener('change', async () => {
    const file = els.imageUpload.files?.[0];
    if (!file) return;
    uploadImageDataUrl = await compressImageToDataUrl(file, 800, 0.8);
    renderUploadPreview();
  });
  els.clearImage.addEventListener('click', () => {
    uploadImageDataUrl = '';
    els.imageUpload.value = '';
    renderUploadPreview();
  });
  els.addItemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(els.addItemForm);
    addCustomItem({
      id: `custom-${Date.now()}`,
      name: String(form.get('name') || '').trim(),
      category: form.get('category'),
      colors: csvToArray(form.get('colors')),
      styleTags: csvToArray(form.get('styleTags')),
      seasonTags: csvToArray(form.get('seasonTags')),
      formality: Number(form.get('formality') || 5),
      warmth: Number(form.get('warmth') || 5),
      fit: form.get('fit') || 'regular',
      imageDataUrl: uploadImageDataUrl || undefined,
      image: uploadImageDataUrl ? undefined : 'assets/placeholder.svg',
      enabled: true,
      isCustom: true
    });
    wardrobe = loadWardrobe();
    renderWardrobe();
    closeAddDialog();
  });
}

function bindImageModal() {
  els.closeImageModal.addEventListener('click', () => els.imageModal.close());
}

function bindProductForm() {
  els.dropZone.addEventListener('click', () => els.productImageInput.click());
  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('is-dragover');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('is-dragover'));
  els.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    productImageDataUrl = await compressImageToDataUrl(file, 800, 0.8);
    renderProductUploadPreview();
  });

  els.productImageInput.addEventListener('change', async () => {
    const file = els.productImageInput.files?.[0];
    if (!file) return;
    productImageDataUrl = await compressImageToDataUrl(file, 800, 0.8);
    renderProductUploadPreview();
  });

  els.clearProductImage.addEventListener('click', () => {
    productImageDataUrl = '';
    els.productImageInput.value = '';
    renderProductUploadPreview();
  });

  els.productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(els.productForm);
    const url = String(data.get('url') || '').trim();
    if (!isValidUrl(url)) {
      alert('请输入合法 URL');
      return;
    }
    const id = data.get('id') || `p-${Date.now()}`;
    const old = products.find((i) => i.id === id) || {};
    const item = {
      id,
      category: data.get('category'),
      name: String(data.get('name') || '').trim() || inferNameByUrl(url),
      url,
      platform: data.get('platform') || inferPlatform(url),
      price: toNullableNumber(data.get('price')),
      colors: activeChipValues(els.productColorChips),
      styleTags: activeChipValues(els.productStyleChips),
      seasonTags: old.seasonTags || ['all'],
      formality: Number(data.get('formality') || 5),
      warmth: Number(data.get('warmth') || 5),
      fit: data.get('fit') || 'regular',
      note: String(data.get('note') || '').trim(),
      enabled: old.enabled ?? true,
      imageDataUrl: productImageDataUrl || old.imageDataUrl,
      createdAt: old.createdAt || Date.now(),
      updatedAt: Date.now(),
      source: 'product-link'
    };
    await upsertProduct(item);
    products = await loadProducts();
    resetProductForm();
    renderProductList();
  });

  els.productSearch.addEventListener('input', () => renderProductList());
  els.productSort.addEventListener('change', () => renderProductList());

  els.productList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    const card = e.target.closest('.product-card');
    const item = products.find((p) => p.id === (btn?.dataset.id || card?.dataset.id));
    if (!item) return;
    if (!btn) return openImageModal(item);
    if (btn.dataset.action === 'open') window.open(item.url, '_blank', 'noopener');
    if (btn.dataset.action === 'edit') fillProductForm(item);
    if (btn.dataset.action === 'toggle') {
      await upsertProduct({ ...item, enabled: !item.enabled, updatedAt: Date.now() });
      products = await loadProducts();
      renderProductList();
    }
    if (btn.dataset.action === 'delete') {
      await removeProduct(item.id);
      products = await loadProducts();
      renderProductList();
    }
  });

  document.querySelector('#reset-product-form').addEventListener('click', () => resetProductForm());
}

function gatherRequest() {
  return {
    mood: document.querySelector('#mood').value,
    scene: document.querySelector('#scene').value,
    temperature: document.querySelector('#temp-segment .is-active').dataset.value,
    stylePreference: [...els.styleChips].filter((c) => c.classList.contains('is-active')).map((c) => c.textContent),
    colorPreference: [...els.colorChips].filter((c) => c.classList.contains('is-active')).map((c) => c.textContent),
    formalityTarget: Number(els.formality.value),
    userWardrobeEnabledOnly: true,
    seed: rerollSeed
  };
}

async function generate(seed = Date.now()) {
  rerollSeed = seed;
  els.result.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  const req = gatherRequest();
  req.seed = seed;
  const source = buildRecommendationPool();
  const res = await getAIRecommendation(req, source);
  currentRecommendation = res;
  renderRecommendation(res);
}

function buildRecommendationPool() {
  const enabledProducts = products.filter((p) => p.enabled);
  const enabledWardrobe = wardrobe.filter((w) => w.enabled);
  const categories = ['Top', 'Bottom', 'Outer', 'Shoes', 'Accessory'];
  return categories.flatMap((cat) => {
    const fromProducts = enabledProducts.filter((p) => p.category === cat);
    return fromProducts.length ? fromProducts : enabledWardrobe.filter((w) => w.category === cat);
  });
}

function renderRecommendation(res) {
  const slots = [['top', '上衣'], ['bottom', '下装'], ['outer', '外套'], ['shoes', '鞋子']].filter(([s]) => res.outfit[s]);
  const accessories = (res.outfit.accessories || []).map((x) => itemRow('accessories', '配饰', x, false)).join('');
  const collage = slots.map(([s, l]) => {
    const item = res.outfit[s];
    const src = resolveItemImage(item);
    return `<button type="button" class="outfit-tile" data-item-id="${item.id}" data-item-name="${item.name}" data-item-image="${src}"><img src="${src}" alt="${l}-${item.name}"><span>${l}</span></button>`;
  }).join('');
  els.result.innerHTML = `<div class="outfit-collage">${collage}</div><div class="outfit-list">${slots.map(([s, l]) => itemRow(s, l, res.outfit[s], true)).join('')}${accessories}</div><small>搭配理由</small><ul>${res.reasoning.map((r) => `<li>${r}</li>`).join('')}</ul><small>注意事项</small><ul>${res.tips.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  els.result.querySelectorAll('img').forEach((img) => bindImageFallback(img, getItemById(img.closest('[data-item-id]')?.dataset.itemId) || {}));
}

function itemRow(slot, label, item, canReplace) {
  const src = resolveItemImage(item);
  const tags = [ ...(item.colors || []).slice(0,2), ...(item.styleTags || []).slice(0,2)].join(' · ');
  const openLink = item.url ? `<button type="button" data-action="open-link" data-url="${item.url}">打开链接</button>` : '';
  return `<article class="result-item" data-item-id="${item.id}" data-item-name="${item.name}" data-item-image="${src}" data-note="${item.note || ''}"><img src="${src}" alt="${item.name}"><div><div class="row-between"><strong>${label} · ${item.name}</strong><div class="btn-inline">${canReplace ? `<button type="button" data-action="replace" data-slot="${slot}">替换</button>` : ''}${openLink}</div></div><p class="item-meta">${tags}</p></div></article>`;
}

function replaceByAlternative(slot) {
  if (!currentRecommendation?.alternatives?.[slot]?.length) return;
  currentRecommendation.outfit[slot] = currentRecommendation.alternatives[slot][0];
  renderRecommendation(currentRecommendation);
}

function renderWardrobe() {
  const cats = ['All', 'Top', 'Bottom', 'Outer', 'Shoes', 'Accessory'];
  els.categoryFilter.innerHTML = cats.map((c) => `<button type="button" class="chip ${c === selectedCategory ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('');
  els.categoryFilter.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { selectedCategory = b.dataset.cat; renderWardrobe(); }));

  const list = selectedCategory === 'All' ? wardrobe : wardrobe.filter((x) => x.category === selectedCategory);
  els.wardrobeList.innerHTML = list.map((item) => `<article class="item-card" data-item-id="${item.id}"><img class="wardrobe-thumb" src="${resolveItemImage(item)}" alt="${item.name}"><div class="row-between"><strong>${item.name}</strong><label><input type="checkbox" data-id="${item.id}" ${item.enabled ? 'checked' : ''}>启用</label></div><p class="item-meta">${item.category} · ${item.fit} · 正式度${item.formality}</p><div class="btn-row compact"><button type="button" data-action="preview" data-id="${item.id}">预览</button>${item.isCustom ? `<button type="button" data-action="delete" data-id="${item.id}">删除</button>` : ''}</div></article>`).join('');

  els.wardrobeList.querySelectorAll('img').forEach((img) => bindImageFallback(img, getItemById(img.closest('[data-item-id]')?.dataset.itemId) || {}));
  els.wardrobeList.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.addEventListener('change', () => {
    const item = wardrobe.find((x) => x.id === cb.dataset.id); if (!item) return; item.enabled = cb.checked; saveEnabled(item.id, item.enabled);
  }));
  els.wardrobeList.querySelectorAll('button[data-action]').forEach((btn) => btn.addEventListener('click', () => {
    const item = wardrobe.find((w) => w.id === btn.dataset.id); if (!item) return;
    if (btn.dataset.action === 'preview') openImageModal(item);
    if (btn.dataset.action === 'delete') { removeCustomItem(item.id); wardrobe = loadWardrobe(); renderWardrobe(); }
  }));
}

function renderFavorites() {
  const list = loadFavorites();
  if (!list.length) return (els.favoritesList.innerHTML = '<p class="item-meta">暂无收藏，先去生成一套吧。</p>');
  els.favoritesList.innerHTML = list.map((fav) => `<article class="favorite-card" data-id="${fav.id}"><strong>${new Date(fav.createdAt).toLocaleString()}</strong><p>${fav.response.outfit.top.name} + ${fav.response.outfit.bottom.name} + ${fav.response.outfit.shoes.name}</p><div class="btn-row"><button type="button" data-action="recreate">再次生成</button><button type="button" data-action="copy">复制清单</button></div></article>`).join('');
  els.favoritesList.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', (e) => {
    const record = list.find((x) => x.id === e.target.closest('.favorite-card').dataset.id);
    if (!record) return;
    if (btn.dataset.action === 'recreate') { currentRecommendation = record.response; renderRecommendation(record.response); document.querySelector('[data-tab="recommend"]').click(); }
    if (btn.dataset.action === 'copy') {
      const o = record.response.outfit;
      navigator.clipboard?.writeText(`OutfitLab 清单：${o.top.name} / ${o.bottom.name} / ${o.outer?.name || '无外套'} / ${o.shoes.name}`);
      btn.textContent = '已复制'; setTimeout(() => (btn.textContent = '复制清单'), 1000);
    }
  }));
}

function renderUploadPreview() {
  els.imagePreviewWrap.classList.toggle('is-hidden', !uploadImageDataUrl);
  if (uploadImageDataUrl) {
    els.imagePreview.src = uploadImageDataUrl;
    bindImageFallback(els.imagePreview, { category: 'upload' });
  }
}

function renderProductUploadPreview() {
  els.productImagePreviewWrap.classList.toggle('is-hidden', !productImageDataUrl);
  if (productImageDataUrl) {
    els.productImagePreview.src = productImageDataUrl;
    bindImageFallback(els.productImagePreview, { category: 'product' });
  }
}

function renderProductList() {
  const q = (els.productSearch.value || '').trim().toLowerCase();
  const sorted = [...products]
    .filter((p) => [p.name, p.platform, ...(p.styleTags || []), ...(p.colors || [])].join(' ').toLowerCase().includes(q))
    .sort(sortProducts);
  if (!sorted.length) {
    els.productList.innerHTML = '<p class="item-meta">暂无产品链接，先添加一个。</p>';
    return;
  }
  els.productList.innerHTML = sorted.map((item) => `<article class="product-card ${item.enabled ? '' : 'is-disabled'}" data-id="${item.id}"><img src="${resolveItemImage(item)}" alt="${item.name}"><div><strong>${item.name}</strong><p class="item-meta">${item.platform || '未指定'} · ${item.price != null ? `¥${item.price}` : '价格未填'}</p><p class="item-meta">${domainFromUrl(item.url)} · ${item.category}</p><p class="item-meta">${[...(item.colors || []), ...(item.styleTags || [])].join(' / ')}</p><div class="btn-row compact"><button type="button" data-action="open" data-id="${item.id}">打开链接</button><button type="button" data-action="edit" data-id="${item.id}">编辑</button><button type="button" data-action="toggle" data-id="${item.id}">${item.enabled ? '停用' : '启用'}</button><button type="button" data-action="delete" data-id="${item.id}">删除</button></div></div></article>`).join('');
  els.productList.querySelectorAll('img').forEach((img) => bindImageFallback(img, getItemById(img.closest('.product-card').dataset.id) || {}));
}

function sortProducts(a, b) {
  const mode = els.productSort.value;
  if (mode === 'priceAsc') return (a.price ?? Infinity) - (b.price ?? Infinity);
  if (mode === 'formalityDesc') return (b.formality ?? 0) - (a.formality ?? 0);
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

function fillProductForm(item) {
  els.productForm.elements.id.value = item.id;
  els.productForm.elements.url.value = item.url || '';
  els.productForm.elements.name.value = item.name || '';
  els.productForm.elements.platform.value = item.platform || '';
  els.productForm.elements.price.value = item.price ?? '';
  els.productForm.elements.category.value = item.category || 'Top';
  els.productForm.elements.fit.value = item.fit || 'regular';
  els.productForm.elements.formality.value = item.formality ?? 5;
  els.productForm.elements.warmth.value = item.warmth ?? 5;
  els.productForm.elements.note.value = item.note || '';
  setChipState(els.productColorChips, item.colors || []);
  setChipState(els.productStyleChips, item.styleTags || []);
  productImageDataUrl = item.imageDataUrl || '';
  renderProductUploadPreview();
}

function resetProductForm() {
  els.productForm.reset();
  els.productForm.elements.id.value = '';
  setChipState(els.productColorChips, []);
  setChipState(els.productStyleChips, []);
  productImageDataUrl = '';
  els.productImageInput.value = '';
  renderProductUploadPreview();
}

function openImageModal(item) {
  const src = resolveItemImage(item);
  els.imageModalImg.src = src;
  bindImageFallback(els.imageModalImg, item || {});
  els.imageModalDetail.innerHTML = `<p><strong>${item.name || '未命名单品'}</strong></p><p class="item-meta">${item.platform || ''} ${item.price != null ? `· ¥${item.price}` : ''}</p>${item.url ? `<p><a href="${item.url}" target="_blank" rel="noopener">打开链接</a></p>` : ''}${item.note ? `<p class="item-meta">${item.note}</p>` : ''}`;
  els.imageModal.showModal();
}

function isValidUrl(url) {
  try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol); } catch { return false; }
}
function inferPlatform(url) {
  const d = domainFromUrl(url);
  if (d.includes('taobao')) return '淘宝';
  if (d.includes('tmall')) return '天猫';
  if (d.includes('jd.com')) return '京东';
  if (d.includes('poizon')) return '得物';
  if (d.includes('xiaohongshu')) return '小红书';
  if (d.includes('douyin')) return '抖音';
  return '其它';
}
function inferNameByUrl(url) { return `${inferPlatform(url)}商品`; }
function domainFromUrl(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return 'invalid-url'; } }
function toNullableNumber(v) { return v === '' || v == null ? null : Number(v); }
function csvToArray(v) { return String(v || '').split(',').map((s) => s.trim()).filter(Boolean); }
function activeChipValues(nodeList) { return [...nodeList].filter((x) => x.classList.contains('is-active')).map((x) => x.textContent.trim()); }
function setChipState(nodeList, values) { [...nodeList].forEach((chip) => chip.classList.toggle('is-active', values.includes(chip.textContent.trim()))); }
function getItemById(id) { return wardrobe.find((i) => i.id === id) || products.find((i) => i.id === id); }

function closeAddDialog() {
  els.addItemDialog.close();
  els.addItemForm.reset();
  uploadImageDataUrl = '';
  els.imageUpload.value = '';
  renderUploadPreview();
}

async function start() {
  products = await loadProducts();
  if (!window.DEFAULT_WARDROBE?.length) {
    els.result.innerHTML = `<p>默认数据未加载，请检查 data/wardrobeData.js。</p><img src="${generatePlaceholderDataUrl({ name: '数据加载失败' })}" alt="placeholder">`;
  }
  initTabs();
  bindInteractions();
  renderWardrobe();
  renderProductList();
  renderFavorites();
  generate(rerollSeed);
}

start();
