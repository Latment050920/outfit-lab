# OutfitLab（离线 MVP）

OutfitLab 是一个无需后端、无需登录、可离线运行的穿搭推荐演示站。定位 18-25 岁用户，强调极简、留白与轻量动效。

## 1. 项目结构

```
.
├── index.html
├── assets/
│   └── placeholder.svg
├── data/
│   ├── wardrobe.json
│   └── wardrobeData.js
├── styles/
│   └── main.css
└── src/
    ├── main.js
    ├── storage.js
    ├── storage/
    │   └── productsStore.js
    ├── utils/
    │   ├── image.js
    │   └── random.js
    └── recommender/
        ├── aiAdapter.js
        └── ruleBased.js
```

## 2. 运行方式

### 方式 A：直接双击打开（离线）
直接打开 `index.html` 即可使用。

### 方式 B：本地静态服务（推荐开发）
```bash
python -m http.server 5173
```
访问 `http://localhost:5173`。

## 3. 新增模块：Product Links（产品链接录入）

### 表单字段
- URL（必填，合法性校验）
- 商品名 / 平台 / 价格（可选）
- 分类（必填）
- 颜色标签 / 风格标签（chip 多选）
- 备注（可选）
- 截图上传（拖拽或点击上传）

### 能力
- 编辑 / 删除 / 启用停用
- 搜索（名称/平台/标签）
- 排序（最近添加/价格/正式度）
- 卡片展示（缩略图 + 域名 + 平台 + 价格 + 标签）
- 打开链接（新标签页）

## 4. 推荐集成策略

推荐时按类别（Top/Bottom/Outer/Shoes/Accessory）优先使用**启用的 ProductItem**；
若某类别 ProductItem 不足，则回退到默认 wardrobe 数据。

推荐输出保持“文字 + 配图”：
- 顶部 outfit 拼图 grid
- 每个单品行：缩略图 + 标签 + 替换按钮 + 打开链接按钮（若有 URL）

## 5. ProductItem 结构

```ts
{
  id: string,
  category: "Top" | "Bottom" | "Outer" | "Shoes" | "Accessory",
  name: string,
  url: string,
  platform: string,
  price?: number | null,
  colors: string[],
  styleTags: string[],
  seasonTags: string[],
  formality: number,
  warmth: number,
  fit: "oversize" | "slim" | "regular",
  enabled: boolean,
  imageDataUrl?: string,
  note?: string,
  createdAt: number,
  updatedAt: number
}
```

## 6. 图片策略（离线）

- 上传后压缩：最长边 `<=800px`，JPEG `quality=0.8`
- 存储：`imageDataUrl`
- 渲染优先级：
  1. `imageDataUrl`
  2. `image`
  3. `generatePlaceholderDataUrl(item)`
- `<img>` 加载失败自动回退占位图

## 7. 存储策略

- `productsStore`：优先 IndexedDB（`outfitlab.db / productLinks`）
- fallback：`localStorage['outfitlab.productLinks']`
- 其余：
  - `outfitlab.wardrobe.enabled`
  - `outfitlab.wardrobe.custom`
  - `outfitlab.favorites`

## 8. 清空本地数据

```js
localStorage.removeItem('outfitlab.productLinks');
localStorage.removeItem('outfitlab.wardrobe.enabled');
localStorage.removeItem('outfitlab.wardrobe.custom');
localStorage.removeItem('outfitlab.favorites');
```

IndexedDB 清理（浏览器 DevTools -> Application -> IndexedDB -> `outfitlab.db` 删除）。

## 9. 点击失效问题（DevTools 排查与修复）

已按以下思路修复：
1. 检查覆盖层：新增纯装饰层 `.bg-decor`，并明确 `pointer-events:none`，确保不会挡住点击。
2. 修复层级：交互容器 `.app-shell` 设置 `position:relative; z-index:1`，装饰层 `z-index:0`。
3. 透明蒙层策略：`dialog:not([open]) { display:none; }`，避免仅 `opacity:0` 导致不可见层拦截点击。
4. 防止局部装饰抢事件：如 `.outfit-tile span` 增加 `pointer-events:none`。
5. 事件检查：仅在表单提交与拖拽事件使用 `preventDefault`，未使用全局 click `stopPropagation/preventDefault`。

## 10. 未来扩展

- AI 推荐：继续通过 `src/recommender/aiAdapter.js` 替换实现。
- 图床：将 `imageDataUrl` 替换为上传后 URL（保留 `resolveItemImage` 优先级策略即可）。
- 生成图：未来可在推荐输出里插入 AI 生成 look 图位（不影响当前离线结构）。
