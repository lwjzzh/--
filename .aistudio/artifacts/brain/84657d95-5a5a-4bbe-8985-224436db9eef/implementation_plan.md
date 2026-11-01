# 全局设置中心（Global Settings Center）深度优化方案

针对当前「全局设置中心」残留旧版递增编码公式、卖点预置字段冗余、缺少全局生图防变形护栏控制以及模型切换跨页签割裂的问题，本方案在**保留现有 5 个页签框架**的前提下，对各页签内部核心业务表单进行实质性升级，使其真正成为支撑「① 主图/SKU工作台」与「② 详情页工作台」高质量稳定出图的全局控制中枢。

---

## User Review & Critical Decisions

> [!IMPORTANT]
> 以下核心设计决策已根据您的确认选项锁定，确认后将立即按此方案实施代码落地：

- **Confirmed Decision 1（页签结构保留与内容提纯）**：保持现有 5 个顶层页签（`1. 预置与重置兜底`、`2. 端点与模型配置`、`3. 常用模型池`、`4. 云存储 OSS / R2`、`5. 桌面架构与本地数据`）结构不变，全面升级各页签内部的业务表单与交互闭环。
- **Confirmed Decision 2（清理旧版编码公式，升级双工作台真实兜底）**：移除已废弃的「默认递增编码前缀 (`TWS328-C`) / 调换主副标题顺序 / 序号规则」及卖点方案中的「绑定主副标题前缀」冗余输入框，改为**主图工作台（复刻程度 / 印花4维联动 / 语言 / 画幅）+ 详情页工作台（画幅 / 分辨率 / 文字模式）**的真实参数兜底，并让「常用卖点方案库」同时服务主图与详情页双工作台。
- **Confirmed Decision 3（新增生图质量与防变形全局护栏配置）**：新增「生图质量与防变形全局护栏」模块，支持自定义**全局负向禁用词（Negative Prompt）**及核心防变形开关（净网防印 `#Prod` 编号、反“胶囊”药丸词净化、单品最多 2 张互补视角收敛、锁图微调 95% 构图锚定）。
- **Confirmed Decision 4（端点、模型切换与常用池同屏闭环 + 本地缓存清理工具）**：在页签 2 中直接内嵌常用模型池胶囊快捷切换与增删操作，无需频繁跳页签；在页签 5 中新增**本地存储（LocalStorage & IndexedDB）实时占用统计与历史记录一键清理工具**。

---

## 1. Overview & Core Concept

- **What It Does**：将「全局设置中心」从静态配置面板升级为集**双工作台默认参数兜底、跨工作台卖点预置库、全局生图防变形护栏、API 通道与常用模型同屏切换、云存储双擎管理、本地数据库缓存清理**于一体的生产级配置中心。
- **Target Audience / Persona**：高频使用主图复刻、多花色裂变与详情页模块化生成的电商视觉设计师与运营人员。
- **Key Value**：
  1. **消除无效表单干扰**：彻底清除旧版 SKU 递增编码前缀等不再使用的历史遗留字段；
  2. **全局把控生图下限**：通过全局负向禁用词与防变形引擎开关，从源头锁定全站生图质量；
  3. **高频操作一页闭环**：在同一页签内完成网关通道、当前模型切换与常用模型池增删，并提供本地缓存与历史生成记录的一键清理能力。

---

## 2. User Experience & Visual Design

- **Key User Flows**：
  1. **常用卖点与双工作台兜底配置（页签 1）**：用户编辑简洁的 3 字段卖点方案（方案名 + 核心卖点条 + 商品/配件补充），可一键推送至「① 主图工作台」或「② 详情页工作台」；修改主图默认复刻模式（如 `参考风格 + 印花4维联动 + 1:1 + 2K`）与详情页默认规格（`9:16 + 2K`），点击顶栏「重置」时自动按此兜底恢复。
  2. **全局生图防变形护栏配置（页签 1）**：用户可查看并编辑全局负向禁用词（如禁止黑棕死板底框、禁止 3D 医药胶囊颗粒、禁止多余重复充电仓、禁止乱码文字），并管理 4 项防变形底层护栏开关。
  3. **通道与常用模型同屏操控（页签 2 & 页签 3）**：在页签 2 的「Agent 策划模型」与「视觉生图模型」卡片内直接展示常用模型池快捷切换标签（支持一键点选、一键存入常用池、一键移除），同时页签 3 提供完整的模型池批量管理与推荐预设一键恢复。
  4. **本地缓存统计与清理（页签 5）**：直观查看当前工作台图片、资产库（IndexedDB）、生图历史记录及本地配置的条数与空间占用估算，支持一键清空历史生成记录、一键释放已上云素材的本地 Base64 缓存。
- **Visual Identity & Theme**：
  - *Aesthetic Direction*：延续全站高密度、清爽克制的专业电商 SaaS 工作台视觉风格。
  - *Color Palette & Mood*：以 `#F8FAFC` / `#FFFFFF` 纯净亮色表面为主（60%），`#E2E8F0` 1px 结构细线分隔（30%），主操作按钮与激活态采用 `#2563EB`（品牌蓝）与 `#10B981`（质量护栏绿）（10%）。
  - *Typography & Hierarchy*：标题采用紧凑粗体无衬线体，所有模型 ID、端点 URL、分辨率规格、缓存体积与计数统计严格采用 `font-mono-tabular` 等宽对齐数字。

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1：将旧版 SKU 标题公式兜底替换为「主图 + 详情页双工作台真实参数兜底」**
  - *Chosen Approach*：移除 `titlePrefix`、`subtitleText`、`swapTitleOrder`、`titleIndexMode` 四个旧版表单项，改为配置主图工作台默认参数（`replicaFidelity`、`styleLinkageMode`、`replicaLanguage`、`defaultAspectRatio`、`defaultImageSize`）与详情页默认参数（`detailAspectRatio`、`defaultImageSize`、`textMode`）。
  - *Why*：当前主图工作台已全面升级为「爆款参考图复刻 + 多花色套母版裂变 + 印花4维联动」工作流，旧版编码前缀表单已无实际业务作用，替换为真实工作台参数后可实现一键应用与重置防丢。
- **Decision 2：在全局设置中开放「生图质量与防变形护栏」配置并接入生图链路**
  - *Chosen Approach*：在 `StudioConfig` 中新增 `qualityGuardConfig`（包含 `autoSanitizePromptCodes`、`strictSingleSkuProdCap`、`enforceLightRoundedCards`、`lockRefineHighWeightAnchor` 以及可编辑的 `customNegativePrompt`），并在主图与详情页生图请求中实时生效。
  - *Why*：不仅让底层防变形逻辑透明可控，还允许针对特定品类（如 TWS 耳机、美妆个护、潮玩数码）追加专属负向禁令（如“严禁出现有线耳机线、严禁改变指示灯位置”），直接提升生图稳定性。
- **Decision 3：页签 2 内联常用模型池快捷操作 + 页签 5 集成真实本地存储清理**
  - *Chosen Approach*：保持 5 个页签入口不变，在页签 2 的两个模型卡片内直接渲染常用模型池胶囊列表（点击即切换、支持行内删除与新增），并在页签 5 顶部新增「本地数据库与缓存管理面板」。
  - *Why*：既满足保留 5 个页签的习惯，又彻底消除了在页签 2 与页签 3 之间来回切换的繁琐操作，同时解决了长期大量生图后浏览器 IndexedDB / LocalStorage 体积膨胀的痛点。

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                   Global Settings Center Modal (5 Tabs)                       │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─ Tab 1: 预置与重置兜底 (Presets, Dual-Studio Defaults & Quality Guard) ──┐ │
│  │  • 双工作台通用卖点方案库 (精简3字段 + 一键应用至主图/详情页)            │ │
│  │  • 主图/SKU工作台默认兜底 (复刻程度 / 印花4维联动 / 语言 / 比例 / 2K)    │ │
│  │  • 详情页工作台默认兜底   (9:16或3:4画幅 / 分辨率 / 文字模式 / 重置保护) │ │
│  │  • 生图质量与防变形全局护栏 (4项防变形开关 + 全局自定义负向禁用词)       │ │
│  └─────────────────────────────────────┬────────────────────────────────────┘ │
│                                        │                                      │
│  ┌─ Tab 2: 端点与模型配置 ─────────────┼─ Tab 3: 常用模型池 ────────────────┐ │
│  │  • API网关通道卡片 & 宽泛端点清洗   │  • Agent / 生图模型全量矩阵管理    │ │
│  │  • Agent & 生图模型同屏快捷胶囊池   │  • 模型能力标签 & 一键恢复推荐池   │ │
│  └─────────────────────────────────────┼────────────────────────────────────┘ │
│                                        │                                      │
│  ┌─ Tab 4: 云存储 OSS / R2 ────────────┼─ Tab 5: 桌面架构与本地数据管理 ────┐ │
│  │  • 阿里云OSS / Cloudflare R2双擎切换│  • LocalStorage/IndexedDB体积统计  │ │
│  │  • 0-Base64直链传输与一键全量上云   │  • 历史生图记录/临时缓存一键清理   │ │
│  └─────────────────────────────────────┴────────────────────────────────────┘ │
└────────────────────────────────────────┬──────────────────────────────────────┘
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│        StudioConfig State + QualityGuardEngine + Server Render Pipeline       │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Extensions

1. **`QualityGuardGlobalConfig`（新增于 `StudioConfig.qualityGuardConfig`）**：
   - `autoSanitizePromptCodes: boolean`（默认 `true`：生图前自动剥离 `#Prod/#Case` 编号并将“胶囊”转化为“浅色圆角信息卡”）
   - `strictSingleSkuProdCap: boolean`（默认 `true`：单品画面严格限制最多 2 张互补视角，自动拦截异款正面花色混绑）
   - `enforceLightRoundedCards: boolean`（默认 `true`：强制浅色半透明圆角信息卡，严禁生硬黑棕底框与 3D 医药胶囊颗粒）
   - `lockRefineHighWeightAnchor: boolean`（默认 `true`：锁图微调模式下强制将当前满意成图作为第 1 顺位最高权重基准并屏蔽竞品图）
   - `customNegativePrompt: string`（用户自定义全局补充禁用词，生图时自动拼接至 `finalPrompt` 负向禁令区块）
2. **`SkuDefaultFallbackConfig`（扩展支持真实主图复刻参数）**：
   - 新增 `replicaFidelity?: ReplicaFidelity`（默认 `'style_reference'` 或 `'high_replica'`）
   - 新增 `styleLinkageMode?: StyleLinkageMode`（默认 `'print_4d'`）
   - 新增 `replicaLanguage?: ReplicaLanguage`（默认 `'zh'`）
   - 点击顶栏「重置」(`handleClearWorkspaceToBlank`) 时，自动读取上述兜底配置恢复 `skuBatchConfig` 与 `config.requirements`。

### Interactive Component & State Mapping

- **常用卖点方案行内「应用至主图 / 应用至详情页」**：点击后分别将卖点方案写入 `skuBatchConfig.referenceInfoText`（及当前主图卡片）或追加至 `productInfoText`（详情页产品卖点框），并弹出 Toast 反馈。
- **全局负向禁用词注入**：在 `generateSingleTaskImage`（详情页）与 `generateSingleSkuTaskImage`（主图）中读取 `config.qualityGuardConfig?.customNegativePrompt`，自动附加 `【全局负向禁令（严禁出现）】：...` 至生图指令。
- **本地缓存与历史记录清理（页签 5）**：
  - 实时计算当前工作台素材数、公共资产库（`commonAssets`）条数、生图历史记录（`generationRecords`）条数、母版库（`confirmedTemplates`）条数及本地存储估算大小（MB/KB）；
  - 提供「清理全部生图历史记录」、「清理运行日志」、「将已上云素材的本地 Base64 瘦身释放」三个实用清理按钮。
