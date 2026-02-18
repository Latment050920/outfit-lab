const FALLBACK_COLOR = '#e7e7ea';

export function generatePlaceholderDataUrl(item = {}) {
  const label = (item.name || item.category || 'Outfit').slice(0, 14);
  const color = ((item.colors && item.colors[0]) || '').toLowerCase();
  const tone = color.includes('black') ? '#2c2c2f' : color.includes('white') ? '#ededf0' : color.includes('gray') ? '#c3c4cc' : FALLBACK_COLOR;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="#f4f4f6"/>
    <rect x="120" y="120" width="560" height="560" rx="34" fill="${tone}"/>
    <text x="400" y="390" text-anchor="middle" fill="#5d5d67" font-size="34" font-family="-apple-system,Segoe UI,sans-serif">${escapeXml(label)}</text>
    <text x="400" y="438" text-anchor="middle" fill="#8b8b95" font-size="24" font-family="-apple-system,Segoe UI,sans-serif">OutfitLab</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function resolveItemImage(item) {
  if (item?.imageDataUrl) return item.imageDataUrl;
  if (item?.image) return item.image;
  return generatePlaceholderDataUrl(item);
}

export async function compressImageToDataUrl(file, maxSide = 800, quality = 0.8) {
  if (!file) return null;
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * ratio));
  const targetH = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', quality);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function bindImageFallback(imgEl, item) {
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = generatePlaceholderDataUrl(item);
  };
}
