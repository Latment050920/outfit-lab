import { createSeededRandom, pickWeighted } from '../utils/random.js';

const sceneTags = {
  '通勤上班': ['通勤', '极简', '学院'],
  '约会': ['约会', '韩系', '日系'],
  '休闲娱乐': ['休闲', '美式复古', '韩系'],
  '运动': ['运动', '机能'],
  '聚会': ['约会', '气场', '美式复古'],
  '旅行': ['休闲', '机能', '日系']
};

const colorMap = {
  '黑白灰': ['black', 'white', 'gray', 'silver'],
  '低饱和': ['gray', 'navy', 'beige', 'khaki', 'brown'],
  '亮色点缀': ['blue', 'green'],
  '大地色': ['khaki', 'brown', 'beige']
};

function tempTarget(temperature) {
  if (temperature === 'cold') return 7;
  if (temperature === 'hot') return 2;
  if (typeof temperature === 'number') return Math.max(1, Math.min(9, Math.round((30 - temperature) / 4)));
  return 5;
}

function styleScore(item, request) {
  const styleHits = request.stylePreference.reduce((acc, style) => acc + (item.styleTags.includes(style) ? 1 : 0), 0);
  const sceneHints = sceneTags[request.scene] || [];
  const sceneHits = sceneHints.reduce((acc, tag) => acc + (item.styleTags.includes(tag) ? 1 : 0), 0);
  return styleHits * 2 + sceneHits * 1.4;
}

function colorScore(item, request) {
  const desiredColors = request.colorPreference.flatMap((pref) => colorMap[pref] || []);
  return item.colors.reduce((acc, c) => acc + (desiredColors.includes(c) ? 1.2 : 0), 0);
}

function formalityScore(item, request) {
  return 2 - Math.abs(item.formality - request.formalityTarget) * 0.35;
}

function warmthScore(item, request) {
  return 2.5 - Math.abs(item.warmth - tempTarget(request.temperature)) * 0.3;
}

function totalScore(item, request) {
  return styleScore(item, request) + colorScore(item, request) + formalityScore(item, request) + warmthScore(item, request) + (item.enabled ? 0.4 : -6);
}

function compatibleFit(top, bottom) {
  if (!top || !bottom) return 0;
  if (top.fit === bottom.fit && top.fit !== 'regular') return -1.2;
  if ((top.fit === 'oversize' && bottom.fit === 'slim') || (top.fit === 'slim' && bottom.fit === 'oversize')) return 1.5;
  return 0.6;
}

function byCategory(items, category) {
  return items.filter((i) => i.category === category);
}

function topAlternatives(pool, chosen, request, count = 2) {
  return pool
    .filter((item) => item.id !== chosen.id)
    .map((item) => ({ item, score: totalScore(item, request) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.item);
}

export function ruleBasedRecommend(request, wardrobe) {
  const rand = createSeededRandom(request.seed || Date.now());
  const source = request.userWardrobeEnabledOnly ? wardrobe.filter((i) => i.enabled) : wardrobe;
  const topPool = byCategory(source, 'Top');
  const bottomPool = byCategory(source, 'Bottom');
  const shoesPool = byCategory(source, 'Shoes');
  const outerPool = byCategory(source, 'Outer');
  const accessoryPool = byCategory(source, 'Accessory');

  const scorePool = (pool) => pool.map((item) => ({ item, score: totalScore(item, request) + rand() * 1.1 }));
  const top = pickWeighted(scorePool(topPool), rand);
  const bottom = pickWeighted(scorePool(bottomPool).map((e) => ({ ...e, score: e.score + compatibleFit(top, e.item) })), rand);
  const shoes = pickWeighted(scorePool(shoesPool), rand);

  const preferOuter = request.temperature === 'cold' || request.formalityTarget >= 7 || rand() > 0.62;
  const outer = preferOuter ? pickWeighted(scorePool(outerPool), rand) : undefined;
  const accessoryCount = request.scene === '聚会' || request.scene === '约会' ? 2 : 1;
  const accessories = scorePool(accessoryPool)
    .sort((a, b) => b.score - a.score + rand() * 0.2)
    .slice(0, accessoryCount)
    .map((entry) => entry.item);

  const reasoning = [
    `${request.scene}场景优先匹配了${(sceneTags[request.scene] || []).slice(0, 2).join(' / ')}标签，整体气质更贴合。`,
    `主色以${request.colorPreference.join('、')}为基调，降低出错率并保持高级感。`,
    `上装与下装采用${top.fit} + ${bottom.fit}版型，避免比例失衡。`,
    `正式度控制在 ${request.formalityTarget}/10 附近，适配你当前需求。`
  ];

  const tips = [
    '建议把亮点控制在 20% 以内，配饰与鞋子二选一做强调。',
    request.temperature === 'cold' ? '天气偏冷，优先叠穿并露出领口层次。' : '可通过卷袖或露脚踝增加轻盈感。',
    '如需拍照更上镜，可用同色系包袋拉齐整体色相。'
  ];

  return {
    outfit: { top, bottom, ...(outer ? { outer } : {}), shoes, accessories },
    reasoning,
    alternatives: {
      top: topAlternatives(topPool, top, request, 2),
      bottom: topAlternatives(bottomPool, bottom, request, 2),
      ...(outer ? { outer: topAlternatives(outerPool, outer, request, 1) } : {}),
      shoes: topAlternatives(shoesPool, shoes, request, 1),
      accessories: topAlternatives(accessoryPool, accessories[0], request, 2)
    },
    tips
  };
}
