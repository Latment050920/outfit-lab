import { loadWardrobe, saveEnabled, addCustomItem, loadFavorites, saveFavorite } from './storage.js';
import { getAIRecommendation } from './recommender/aiAdapter.js';

let wardrobe = loadWardrobe();
let selectedCategory = 'All';
let currentRecommendation = null;
let rerollSeed = Date.now();

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
  favoritesList: document.querySelector('#favorites-list')
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
  els.tempSegment.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    els.tempSegment.querySelectorAll('button').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
  }));
  [...els.styleChips, ...els.colorChips].forEach((chip) => {
    chip.addEventListener('click', () => chip.classList.toggle('is-active'));
  });
  els.generate.addEventListener('click', () => generate());
  els.reroll.addEventListener('click', () => {
    rerollSeed += 7;
    generate(rerollSeed);
  });
  els.favorite.addEventListener('click', () => {
    if (!currentRecommendation) return;
    saveFavorite({ id: `fav-${Date.now()}`, createdAt: new Date().toISOString(), request: gatherRequest(), response: currentRecommendation });
    renderFavorites();
  });
  els.addItemBtn.addEventListener('click', () => els.addItemDialog.showModal());
  els.addItemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(els.addItemForm);
    const item = {
      id: `custom-${Date.now()}`,
      name: form.get('name'),
      category: form.get('category'),
      colors: String(form.get('colors') || '').split(',').map((s) => s.trim()).filter(Boolean),
      styleTags: String(form.get('styleTags') || '').split(',').map((s) => s.trim()).filter(Boolean),
      seasonTags: String(form.get('seasonTags') || '').split(',').map((s) => s.trim()).filter(Boolean),
      formality: Number(form.get('formality') || 5),
      warmth: Number(form.get('warmth') || 5),
      fit: form.get('fit') || 'regular',
      image: 'assets/placeholder.svg',
      enabled: true
    };
    addCustomItem(item);
    wardrobe = loadWardrobe();
    renderWardrobe();
    els.addItemDialog.close();
    els.addItemForm.reset();
  });
}

function gatherRequest() {
  const mood = document.querySelector('#mood').value;
  const scene = document.querySelector('#scene').value;
  const temperature = document.querySelector('#temp-segment .is-active').dataset.value;
  const stylePreference = [...els.styleChips].filter((c) => c.classList.contains('is-active')).map((c) => c.textContent);
  const colorPreference = [...els.colorChips].filter((c) => c.classList.contains('is-active')).map((c) => c.textContent);
  return {
    mood,
    scene,
    temperature,
    stylePreference,
    colorPreference,
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

function renderRecommendation(res) {
  const piece = (label, item) => `<div class="item-line"><span>${label}</span><strong>${item?.name || '-'}</strong></div>`;
  const alt = Object.entries(res.alternatives)
    .map(([key, list]) => `${key}: ${(list || []).map((i) => i.name).join(' / ')}`)
    .join('<br/>');
  els.result.innerHTML = `
    <div class="outfit-grid">
      ${piece('上衣', res.outfit.top)}
      ${piece('下装', res.outfit.bottom)}
      ${piece('外套', res.outfit.outer)}
      ${piece('鞋子', res.outfit.shoes)}
      ${piece('配饰', (res.outfit.accessories || []).map((a) => a.name).join(' + '))}
    </div>
    <small>搭配理由</small>
    <ul>${res.reasoning.map((r) => `<li>${r}</li>`).join('')}</ul>
    <small>替换建议</small>
    <p>${alt}</p>
    <small>注意事项</small>
    <ul>${res.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  `;
}

function renderWardrobe() {
  const categories = ['All', 'Top', 'Bottom', 'Outer', 'Shoes', 'Accessory'];
  els.categoryFilter.innerHTML = categories.map((c) => `<button class="chip ${c === selectedCategory ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('');
  els.categoryFilter.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => { selectedCategory = btn.dataset.cat; renderWardrobe(); }));

  const list = selectedCategory === 'All' ? wardrobe : wardrobe.filter((item) => item.category === selectedCategory);
  els.wardrobeList.innerHTML = list.map((item) => `
    <article class="item-card">
      <div class="row-between"><strong>${item.name}</strong>
      <label><input type="checkbox" data-id="${item.id}" ${item.enabled ? 'checked' : ''}/>启用</label></div>
      <p class="item-meta">${item.category} · ${item.fit} · 正式度${item.formality} · 保暖${item.warmth}</p>
      <p class="item-meta">${item.styleTags.join(' / ')}</p>
    </article>`).join('');

  els.wardrobeList.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.addEventListener('change', () => {
    const item = wardrobe.find((x) => x.id === cb.dataset.id);
    if (!item) return;
    item.enabled = cb.checked;
    saveEnabled(item.id, item.enabled);
  }));
}

function renderFavorites() {
  const list = loadFavorites();
  if (!list.length) {
    els.favoritesList.innerHTML = '<p class="item-meta">暂无收藏，先去生成一套吧。</p>';
    return;
  }
  els.favoritesList.innerHTML = list.map((fav) => `
    <article class="favorite-card" data-id="${fav.id}">
      <strong>${new Date(fav.createdAt).toLocaleString()}</strong>
      <p>${fav.response.outfit.top.name} + ${fav.response.outfit.bottom.name} + ${fav.response.outfit.shoes.name}</p>
      <div class="btn-row">
        <button data-action="recreate">再次生成</button>
        <button data-action="copy">复制清单</button>
      </div>
    </article>
  `).join('');

  els.favoritesList.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', (e) => {
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
  }));
}

initTabs();
bindInteractions();
renderWardrobe();
renderFavorites();
generate(rerollSeed);
