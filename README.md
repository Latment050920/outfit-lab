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
- **Wardrobe 页**：按分类浏览单品，启用/停用，新增自定义衣物（持久化到 localStorage）。
- **收藏页**：保存穿搭方案，支持再次生成与复制清单。

## 4. 数据模型（与未来 AI 接口兼容）

### 衣物数据（`data/wardrobe.json`）
字段：
`id, category, name, colors[], styleTags[], seasonTags[], formality, warmth, fit, material?, image?, enabled`

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

## 5. 推荐算法（离线规则）

在 `src/recommender/ruleBased.js` 中实现：

- **规则评分**：风格/场景标签命中、颜色偏好、正式度差值、温度保暖差值。
- **组合约束**：强制 `top+bottom+shoes`，低温或高正式场景增加 outer 概率，配饰最多 2 个。
- **版型约束**：惩罚“全宽松/全紧身”，鼓励“上宽下窄/上窄下宽”。
- **随机扰动**：在评分中引入 seeded random，保证“换一套”可变化且可复现。

## 6. AI 接口预留

`src/recommender/aiAdapter.js`

```js
export async function getAIRecommendation(request, wardrobe) {
  return ruleBasedRecommend(request, wardrobe);
}
```

未来接入大模型时，仅替换该函数内部逻辑（HTTP 请求/API Key 管理），并保持返回结构为 `RecommendationResponse`。

## 7. 持久化策略

- `outfitlab.wardrobe.enabled`：单品启用状态
- `outfitlab.wardrobe.custom`：用户新增单品
- `outfitlab.favorites`：收藏穿搭

## 8. 说明

- 提供了 30+ 单品，覆盖通勤 / 休闲 / 约会 / 运动等风格场景。
- UI 移动端优先，同时兼容桌面端。
