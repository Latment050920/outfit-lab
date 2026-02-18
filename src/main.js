import {
  loadWardrobe,
  saveEnabled,
  addCustomItem,
  removeCustomItem,
  loadFavorites,
  saveFavorite
} from './storage.js';
import { getAIRecommendation } from './recommender/aiAdapter.js';
import {
  compressImageToDataUrl,
  resolveItemImage,
  bindImageFallback,
  generatePlaceholderDataUrl
} from './utils/image.js';

let wardrobe = loadWardrobe();
let selectedCategory = 'All';
let currentRecommendation = null;
let rerollSeed = Date.now();
let uploadImageDataUrl = '';

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
  closeImageModal: document.querySelector('#close-image-modal')
};

function initTabs() {
  els.tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.tabs.forEach((b) => b.classList.toggle('is-active', b === btn));
      els.panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === btn.dataset.tab));
      if (btn.dataset.tab === 'favorites') renderFavorites();
    });
  });
}

function bindInteractions() {
  els.formality.addEventListener('input', () => (els.formalityValue.textContent = els.formality.value));

  els.tempSegment.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      els.tempSegment.querySelectorAll('button').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });
  });

  [...els.styleChips, ...els.colorChips].forEach((chip) => chip.addEventListener('click', () => chip.classList.toggle('is-active')));

  els.generate.addEventListener('click', () => generate());
  els.reroll.addEventListener('click', () => {
    rerollSeed += 13;
    generate(rerollSeed);
  });

  els.favorite.addEventListener('click', () => {
    if (!currentRecommendation) return;
    saveFavorite({ id: `fav-${Date.now()}`, createdAt: new Date().toISOString(), request: gatherRequest(), response: currentRecommendation });
    renderFavorites();
  });

  els.addItemBtn.addEventListener('click', () => els.addItemDialog.showModal());
  els.cancelAdd.addEventListener('click', () => closeAddDialog());
  els.closeImageModal.addEventListener('click', () => els.imageModal.close());

  els.addItemDialog.addEventListener('close', () => {
    uploadImageDataUrl = '';
    els.imageUpload.value = '';
    renderUploadPreview();
  });

  els.imageUpload.addEventListener('change', async () => {
    const file = els.imageUpload.files?.[0];
    if (!file) return;
    try {
      uploadImageDataUrl = await compressImageToDataUrl(file, 800, 0.8);
      renderUploadPreview();
    } catch {
      uploadImageDataUrl = '';
      renderUploadPreview();
      alert('图片处理失败，请重试其他图片。');
    }
  });

  els.clearImage.addEventListener('click', () => {
    uploadImageDataUrl = '';
    els.imageUpload.value = '';
    renderUploadPreview();
  });

  els.addItemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(els.addItemForm);
    const item = {
      id: `custom-${Date.now()}`,
      name: String(form.get('name') || '').trim(),
      category: form.get('category'),
      colors: toArray(form.get('colors')),
      styleTags: toArray(form.get('styleTags')),
      seasonTags: toArray(form.get('seasonTags')),
      formality: Number(form.get('formality') || 5),
      warmth: Number(form.get('warmth') || 5),
      fit: form.get('fit') || 'regular',
      imageDataUrl: uploadImageDataUrl || undefined,
      image: uploadImageDataUrl ? undefined : 'assets/placeholder.svg',
      enabled: true,
      isCustom: true
    };

    addCustomItem(item);
    wardrobe = loadWardrobe();
    renderWardrobe();
    closeAddDialog();
  });

  els.result.addEventListener('click', (e) => {
    const target = e.target;
    const card = target.closest('[data-item-id]');
    if (target.matches('[data-action="replace"]')) {
      const slot = target.dataset.slot;
      replaceByAlternative(slot);
      return;
    }
    if (card && !target.matches('button')) {
      const item = wardrobe.find((w) => w.id === card.dataset.itemId);
      openImageModal(item || { name: card.dataset.itemName, image: card.dataset.itemImage });
    }
  });
}

function toArray(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function closeAddDialog() {
  els.addItemDialog.close();
  els.addItemForm.reset();
}

function renderUploadPreview() {
  const has = !!uploadImageDataUrl;
  els.imagePreviewWrap.classList.toggle('is-hidden', !has);
  if (has) {
    els.imagePreview.src = uploadImageDataUrl;
    bindImageFallback(els.imagePreview, { category: 'upload' });
  } else {
    els.imagePreview.removeAttribute('src');
  }
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
  const request = gatherRequest();
  request.seed = seed;
  const response = await getAIRecommendation(request, wardrobe);
  currentRecommendation = response;
  renderRecommendation(response);
}

function itemTagLine(item) {
  return [
    ...(item.colors || []).slice(0, 2),
    ...(item.styleTags || []).slice(0, 2),
    ...(item.seasonTags || []).slice(0, 1)
  ].join(' · ');
}

function renderRecommendation(res) {
  const order = [
    ['top', '上衣'],
    ['bottom', '下装'],
    ['outer', '外套'],
    ['shoes', '鞋子']
  ].filter(([slot]) => res.outfit[slot]);

  const accessories = (res.outfit.accessories || []).map((a) => cardRow('accessories', '配饰', a, false)).join('');

  const collage = order
    .map(([slot, label]) => {
      const item = res.outfit[slot];
      const src = resolveItemImage(item);
      return `<button class="outfit-tile" type="button" data-item-id="${item.id}" data-item-name="${item.name}" data-item-image="${src}"><img src="${src}" alt="${label}-${item.name}"/><span>${label}</span></button>`;
    })
    .join('');

  els.result.innerHTML = `
    <div class="outfit-collage">${collage}</div>
    <div class="outfit-list">
      ${order.map(([slot, label]) => cardRow(slot, label, res.outfit[slot], true)).join('')}
      ${accessories}
    </div>
    <small>搭配理由</small>
    <ul>${res.reasoning.map((r) => `<li>${r}</li>`).join('')}</ul>
    <small>注意事项</small>
    <ul>${res.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  `;

  els.result.querySelectorAll('img').forEach((img) => {
    const item = wardrobe.find((w) => w.id === img.closest('[data-item-id]')?.dataset.itemId) || {};
    bindImageFallback(img, item);
  });
}

function cardRow(slot, label, item, canReplace) {
  const src = resolveItemImage(item);
  return `
    <article class="result-item" data-item-id="${item.id}" data-item-name="${item.name}" data-item-image="${src}">
      <img src="${src}" alt="${item.name}" />
      <div>
        <div class="row-between"><strong>${label} · ${item.name}</strong>${canReplace ? `<button type="button" data-action="replace" data-slot="${slot}">替换</button>` : ''}</div>
        <p class="item-meta">${itemTagLine(item)}</p>
      </div>
    </article>
  `;
}

function replaceByAlternative(slot) {
  if (!currentRecommendation?.alternatives?.[slot]?.length) return;
  const next = currentRecommendation.alternatives[slot][0];
  currentRecommendation.outfit[slot] = next;
  renderRecommendation(currentRecommendation);
}

function renderWardrobe() {
  const categories = ['All', 'Top', 'Bottom', 'Outer', 'Shoes', 'Accessory'];
  els.categoryFilter.innerHTML = categories
    .map((c) => `<button type="button" class="chip ${c === selectedCategory ? 'is-active' : ''}" data-cat="${c}">${c}</button>`)
    .join('');

  els.categoryFilter.querySelectorAll('button').forEach((btn) =>
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.cat;
      renderWardrobe();
    })
  );

  const list = selectedCategory === 'All' ? wardrobe : wardrobe.filter((item) => item.category === selectedCategory);
  els.wardrobeList.innerHTML = list
    .map((item) => {
      const src = resolveItemImage(item);
      return `
      <article class="item-card" data-item-id="${item.id}">
        <img class="wardrobe-thumb" src="${src}" alt="${item.name}"/>
        <div class="row-between"><strong>${item.name}</strong>
        <label><input type="checkbox" data-id="${item.id}" ${item.enabled ? 'checked' : ''}/>启用</label></div>
        <p class="item-meta">${item.category} · ${item.fit} · 正式度${item.formality} · 保暖${item.warmth}</p>
        <p class="item-meta">${(item.styleTags || []).join(' / ')}</p>
        <div class="btn-row compact">
          <button type="button" data-action="preview" data-id="${item.id}">预览</button>
          ${item.isCustom ? `<button type="button" data-action="delete" data-id="${item.id}">删除</button>` : ''}
        </div>
      </article>`;
    })
    .join('');

  els.wardrobeList.querySelectorAll('img.wardrobe-thumb').forEach((img) => {
    const item = wardrobe.find((w) => w.id === img.closest('[data-item-id]').dataset.itemId);
    bindImageFallback(img, item);
  });

  els.wardrobeList.querySelectorAll('input[type="checkbox"]').forEach((cb) =>
    cb.addEventListener('change', () => {
      const item = wardrobe.find((x) => x.id === cb.dataset.id);
      if (!item) return;
      item.enabled = cb.checked;
      saveEnabled(item.id, item.enabled);
    })
  );

  els.wardrobeList.querySelectorAll('button[data-action]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const item = wardrobe.find((w) => w.id === btn.dataset.id);
      if (!item) return;
      if (btn.dataset.action === 'preview') openImageModal(item);
      if (btn.dataset.action === 'delete') {
        removeCustomItem(item.id);
        wardrobe = loadWardrobe();
        renderWardrobe();
      }
    })
  );
}

function openImageModal(item) {
  els.imageModalImg.src = resolveItemImage(item);
  bindImageFallback(els.imageModalImg, item || { category: 'modal' });
  els.imageModal.showModal();
}

function renderFavorites() {
  const list = loadFavorites();
  if (!list.length) {
    els.favoritesList.innerHTML = '<p class="item-meta">暂无收藏，先去生成一套吧。</p>';
    return;
  }
  els.favoritesList.innerHTML = list
    .map(
      (fav) => `
    <article class="favorite-card" data-id="${fav.id}">
      <strong>${new Date(fav.createdAt).toLocaleString()}</strong>
      <p>${fav.response.outfit.top.name} + ${fav.response.outfit.bottom.name} + ${fav.response.outfit.shoes.name}</p>
      <div class="btn-row">
        <button type="button" data-action="recreate">再次生成</button>
        <button type="button" data-action="copy">复制清单</button>
      </div>
    </article>
  `
    )
    .join('');

  els.favoritesList.querySelectorAll('button').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.favorite-card');
      const record = list.find((x) => x.id === card.dataset.id);
      if (!record) return;
      if (btn.dataset.action === 'recreate') {
        currentRecommendation = record.response;
        renderRecommendation(record.response);
        document.querySelector('[data-tab="recommend"]').click();
      }
      if (btn.dataset.action === 'copy') {
        const outfit = record.response.outfit;
        const text = `OutfitLab 清单：${outfit.top.name} / ${outfit.bottom.name} / ${outfit.outer?.name || '无外套'} / ${outfit.shoes.name}`;
        navigator.clipboard?.writeText(text);
        btn.textContent = '已复制';
        setTimeout(() => (btn.textContent = '复制清单'), 1000);
      }
    })
  );
}

if (!window.DEFAULT_WARDROBE?.length) {
  const warnItem = { name: '数据加载失败', category: 'error' };
  els.result.innerHTML = `<p>默认数据未加载，请检查 data/wardrobeData.js。</p><img src="${generatePlaceholderDataUrl(warnItem)}" alt="placeholder"/>`;
}

initTabs();
bindInteractions();
renderWardrobe();
renderFavorites();
generate(rerollSeed);
