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
    ├── utils/
    │   ├── image.js
    │   └── random.js
    └── recommender/
        ├── aiAdapter.js
        └── ruleBased.js
```

## 2. 运行方式

### 方式 A：直接双击打开（离线）
直接打开 `index.html` 即可使用（数据通过 `data/wardrobeData.js` 注入，避免 `file://` 下 fetch 限制）。

### 方式 B：本地静态服务（推荐开发）
```bash
python -m http.server 5173
```
访问 `http://localhost:5173`。

## 3. 核心功能

- **推荐页**：输入心情/场景/温度/风格/颜色/正式度，生成完整穿搭。
- **推荐结果图文化**：顶部 outfit 拼图 + 下方“单品图 + 名称 + 标签 + 替换按钮”。
- **图片预览 Modal**：点击推荐单品或衣橱卡片可查看大图。
- **Wardrobe 页**：按分类浏览单品，启用/停用，可新增（含截图上传）和删除自定义单品。
- **收藏页**：保存穿搭方案，支持再次生成与复制清单。

## 4. 截图单品上传（离线）

在「衣橱 > 新增单品」中：
1. 填写基础字段（category/name/colors/styleTags/seasonTags/formality/warmth/fit）。
2. 选择商品截图文件。
3. 前端会自动压缩图片（最长边 <= 800，JPEG 质量 0.8）。
4. 显示缩略图预览，可“删除重选”。
5. 保存后写入本地存储并立即可参与推荐。

## 5. 数据模型（与未来 AI 接口兼容）

### 衣物数据（`data/wardrobe.json`）
字段：
`id, category, name, colors[], styleTags[], seasonTags[], formality, warmth, fit, material?, image?, imageDataUrl?, enabled`

### RecommendationRequest
```ts
{
  mood: string,
  scene: string,
  temperature: number | "cold" | "mild" | "hot",
  stylePreference: string[],
  colorPreference: string[],
  formalityTarget: number,
  userWardrobeEnabledOnly: boolean,
  seed?: number
}
```

### RecommendationResponse
```ts
{
  outfit: {
    top: item,
    bottom: item,
    outer?: item,
    shoes: item,
    accessories: item[]
  },
  reasoning: string[],
  alternatives: {
    top?: item[],
    bottom?: item[],
    outer?: item[],
    shoes?: item[],
    accessories?: item[]
  },
  tips: string[]
}
```

## 6. 图片解析优先级

推荐和衣橱展示统一按以下顺序取图：
1. `item.imageDataUrl`
2. `item.image`
3. `generatePlaceholderDataUrl(item)`

如果图片加载失败（损坏/不可达），会自动回退占位图。

## 7. 推荐算法（离线规则）

在 `src/recommender/ruleBased.js` 中实现：

- **规则评分**：风格/场景标签命中、颜色偏好、正式度差值、温度保暖差值。
- **组合约束**：强制 `top+bottom+shoes`，低温或高正式场景增加 outer 概率，配饰最多 2 个。
- **版型约束**：惩罚“全宽松/全紧身”，鼓励“上宽下窄/上窄下宽”。
- **随机扰动**：在评分中引入 seeded random，保证“换一套”可变化且可复现。

## 8. AI 接口预留

`src/recommender/aiAdapter.js`

```js
export async function getAIRecommendation(request, wardrobe) {
  return ruleBasedRecommend(request, wardrobe);
}
```

未来接入大模型时，仅替换该函数内部逻辑（HTTP 请求/API Key 管理），并保持返回结构为 `RecommendationResponse`。

## 9. 本地存储位置与清理

### localStorage keys
- `outfitlab.wardrobe.enabled`：单品启用状态
- `outfitlab.wardrobe.custom`：用户新增单品（含 imageDataUrl）
- `outfitlab.favorites`：收藏穿搭

### 清空本地数据
浏览器控制台执行：
```js
localStorage.removeItem('outfitlab.wardrobe.enabled');
localStorage.removeItem('outfitlab.wardrobe.custom');
localStorage.removeItem('outfitlab.favorites');
```
或直接：
```js
localStorage.clear();
```

## 10. 说明

- 提供了 30+ 单品，覆盖通勤 / 休闲 / 约会 / 运动等风格场景。
- UI 移动端优先，同时兼容桌面端。
