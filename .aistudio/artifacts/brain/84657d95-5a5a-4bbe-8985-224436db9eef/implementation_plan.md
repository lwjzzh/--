# 电商视觉工作台（E-Com Studio）五大高频体验升级方案

围绕真实电商设计师与运营人员「先定主图套图、再延展详情页、高频抽卡比稿、快速复用卖点公式、局部锁图精修」的作业习惯，对工作台导航流转、卡片多版本回滚、5列橱窗审稿视图、常用卖点快捷调用及锁成图微调重绘进行全方位体验升级。

## User Review & Critical Decisions

> [!IMPORTANT]
> 以下核心交互决策已根据第一阶段确认结果锁定，将在执行阶段完整落地：

- **Confirmed Decision 1（顶栏工作台顺序与状态记忆）**：将顶栏切换器顺序调整为 **「① 主图/SKU工作台」 → 「② 详情页工作台」 → 「③ 资产库」**，首次进入默认打开主图/SKU工作台，同时在本地自动记忆用户上次停留的工作台页面，刷新后无缝恢复。
- **Confirmed Decision 2（主图工作台 5 列橱窗总览视图交互深度）**：在主图工作台画布顶部提供 **「双栏精修视图 / 5列橱窗总览视图」** 切换；5列橱窗模式下不仅支持 5 张套图同屏大图审视，还保留直接修改主标题、切换历史成图版本（v1/v2/v3）、单张重绘、裂变与放大下载等核心高频操作。
- **Confirmed Decision 3（锁当前成图微调重绘覆盖范围）**：在 **「① 主图/SKU工作台」与「② 详情页工作台」** 的所有已出图卡片上均提供 **「🔒 锁当前成图微调」** 开关与微调指令输入能力，开启后将当前满意成图作为高权重视觉结构锚点传给生图管线，仅对指定局部细节或文字做定向重绘。

---

## 1. Overview & Core Concept

- **What It Does**：
  1. **顺应“先主图、后详情”的导航与记忆流转**：顶栏以 `① 主图/SKU工作台` 为起点，配合同源转详情按钮，形成从 5 张高点击主图到 3:4 / 9:16 详情页的自然单向流水线，并持久化记忆上次访问的标签页。
  2. **卡片级多版本历史时光机（v1 / v2 / v3 一键回滚）**：在主图卡片与详情页分屏卡片的成图区下方直接渲染历史生成缩略图条，点击任意历史版本即可将其恢复为当前采用成图（同步作用于后续的“拿此图裂变”、“转详情页”及“合成无缝长图”）。
  3. **主图画布「双栏精修 ⇄ 5列橱窗总览」双视图**：解决笔记本屏幕下卡片纵向过长、难以一眼把控全套 5 张主图视觉节奏的问题；5列橱窗视图下 5 张主图并排陈列，支持即改标题、切历史版本与单卡重绘。
  4. **「⚡ 常用卖点预设」随手贴胶囊菜单**：将全局防丢保护的 `defaultSellingPointPresets`（如声学高配版、潮玩印花款、豪华礼盒装及用户自定义方案）挂载到主图左侧全局卖点框、主图单卡卖点框以及详情页产品卖点框旁，一键填入或追加。
  5. **「🔒 锁当前成图微调」局部重绘模式**：当某张主图或详情屏整体构图与底座 95% 满意、仅需微调文案或局部小元素时，勾选「锁当前成图微调」并输入修改点，后端生图引擎将当前 `resultImageUrl` 作为画面基准锚点注入，避免重新抽卡破坏既有满意构图。
- **Target Audience / Persona**：高频产出电商主图套图、多花色 SKU 裂变图及模块化详情页的电商视觉设计师、店铺运营与品牌主理人。
- **Key Value**：消除“重绘怕丢好图、审稿需要反复上下滚屏、常用卖点反复手打、改一个字整张图重抽”四大操作摩擦，将单品全套视觉产出效率再提升 40% 以上。

---

## 2. User Experience & Visual Design

- **Key User Flows**：
  1. **主图优先与记忆流转**：打开应用默认进入 `① 主图/SKU工作台`（若此前停留在 `② 详情页工作台` 或 `③ 资产库` 则自动恢复）。完成 5 张主图后点击画布右上角「同源转详情页」，自动跳转至 `② 详情页工作台`。
  2. **5列橱窗审稿与版本优选**：在主图工作台点击顶部工具栏的 **「5列橱窗 (5卡同屏)」** 按钮，5 张主图以标准电商橱窗网格一字排开。用户可在任意卡片底部直接点击 `v1`、`v2`、`v3` 缩略图比对不同抽卡批次的效果，选定最满意的一版，或直接修改标题、点击单卡「重绘」。
  3. **一键套用常用卖点预设**：在左侧「4. 核心卖点与画幅规格」或单张卡片的「画面卖点文案」旁点击 **「⚡ 常用卖点」**，弹出预设方案列表，点击即可将预设的卖点角标与包装说明一键填入当前输入框（若预设带标题前缀还可同步应用）。
  4. **锁当前成图微调重绘**：在任意已生成成图的主图卡或详情页分屏卡上，点亮 **「🔒 锁图微调」** 按钮并输入微调要求（如：“保持画面构图与芝士底座不变，将顶部主标题改为‘蓝牙6.0旗舰版’，右上角增加1个小火箭”），点击「微调重绘」，新生成的图片自动追加为最新历史版本，原满意图依然保留在 `v1` 随时可退回。

- **Visual Identity & Theme**：
  - *Aesthetic Direction*：专业商业生产力工作台风格（Clean Studio Utilitarian），克制、高信噪比，将视觉焦点完全让位于商品摄影与潮玩配色。
  - *Color Palette & Mood*：
    - 60% 主画布：浅冷灰工作台底色（`#F4F5F7`）搭配纯白工作面板（`#FFFFFF`）。
    - 30% 结构层：精细分割线（`border-slate-200/80`）、次级配置底栏（`bg-slate-50/80`）与深灰正文层级（`text-slate-800` / `text-slate-500`）。
    - 10% 强调色：主操作黑曜石色（`#1F2329`）、品牌功能蓝（`#2563EB`）、锁图微调琥珀金状态色（`#D97706` / `bg-amber-50`）。
  - *Typography & Hierarchy*：标题与导航保持清晰紧凑的无衬线字重对比（`font-bold` 13px–14px），所有序号、分辨率、历史版本号（`v1`、`v2`）、耗时与统计数字严格采用等宽对齐数字（`font-mono-tabular`）。
  - *Component Styling & Layout*：遵循单层卡片海拔原则（Single-Elevation Depth），历史版本缩略图条与常用卖点下拉菜单采用紧凑的 28px–32px 行高设计，确保不额外挤占宝贵的纵向画布空间。

- **Interactive Feedback & Motion**：
  - 切换历史版本时，成图预览框即时切换并高亮当前激活版本的缩略图边框，同时弹出轻量级 Toast 提示当前已激活的版本号与生成时间。
  - 开启「🔒 锁图微调」时，卡片重绘按钮文案动态变为 **「🔒 锁图微调重绘」** 并呈现琥珀色高亮边框，明确告知用户当前处于锚定微调模式而非随机重抽模式。

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1：卡片内历史版本管理采用“非破坏性指针切换”而非“覆盖截断”**
  - *Chosen Approach*：当用户点击历史缩略图（如从最新的 `v3` 切回 `v1`）时，仅将卡片当前的 `resultImageUrl`（及对应的 `resultOssUrl`）指向所选历史项，**不删除** `historyImages` 列表中的任何记录；下次再生成新图时，新图继续排在历史记录最前面（最多保留最近 8 个版本）。
  - *Why*：设计师在比稿时经常需要在两三个版本之间反复横跳对比（A/B Test），非破坏性指针切换既保证了任何一次抽卡成果都不会丢失，又能让“打包下载”、“合成无缝长图”和“拿此图裂变”直接读取当前选中的 `resultImageUrl`。
  - *Alternatives Considered*：切回旧版本时回滚删除后续版本——会导致误点后丢失刚抽出来的新图，容错率低。

- **Decision 2：5 列橱窗视图采用“轻量可交互卡片”而非“纯静态图片墙”**
  - *Chosen Approach*：在 `grid-cols-2 md:grid-cols-3 xl:grid-cols-5` 的 5 列橱窗布局中，隐藏冗长的多角度配图选择器与 4 维联动展开表单，但保留 **序号 + 可编辑标题框 + 大比例成图预览（含悬停放大/下载/锁图微调开关） + 历史版本缩略图条 + 底部卖点单行速改与立即重绘按钮**。
  - *Why*：兼顾了“一屏看全 5 张套图整体视觉协调性”与“发现某张标题或画面小瑕疵顺手就改”的高效体验，无需为了改两个字频繁在双视图之间来回切换。

- **Decision 3：「锁当前成图微调」复用并强化多模态基准锚点管线**
  - *Chosen Approach*：为 `SkuTask` 与 `ScreenTask` 增加 `lockResultAsRef?: boolean` 与 `refineNote?: string` 字段；当开启且存在 `resultImageUrl` 时，前端将该成图 URL 传给 `/api/image/generate` 的 `lockedResultImageUrl` 参数。后端将其作为最高优先级的【当前锁定成图基准（局部微调锚点）】注入多模态输入，同时保留 `#Prod` 产品原图防变形约束。
  - *Why*：在保持商品工业外形 100% 不跑偏的前提下，最大化锁死当前满意成图的相机机位、底座造型、背景光影与排版骨架，实现真正可控的局部迭代。

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          App.tsx (Root State & Persistence)                   │
│  • activeTopTab ('sku_studio' default + localStorage memory)                  │
│  • config.defaultSellingPointPresets (Global Reset-Proof Presets)             │
│  • skuTasks / tasks (with historyImages[], lockResultAsRef, refineNote)       │
└───────────────┬───────────────────────────────┬───────────────────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────────────────┐ ┌─────────────────────────────────────┐
│        StudioTopHeader.tsx            │ │        server.ts (/api/image/*)     │
│  • ① 主图/SKU工作台 (First Tab)        │ │  • lockedResultImageUrl Resolver    │
│  • ② 详情页工作台 (Second Tab)         │ │  • Multimodal Anchor Prompt Engine  │
│  • ③ 资产库 (Third Tab)                │ │    (Locks composition + applies     │
└───────────────┬───────────────────────┘ │     targeted refineNote + #Prod)    │
                │                         └─────────────────▲───────────────────┘
                ▼                                           │
┌───────────────────────────────────────────────────────────┴───────────────────┐
│                     Workspace Views & Interactive Controls                    │
├───────────────────────────────────────┬───────────────────────────────────────┤
│          SkuStudioView.tsx            │         DetailModularView.tsx         │
│  • View Switcher:                     │  • Per-Screen History Strip           │
│    [双栏精修视图] ⇄ [5列橱窗总览视图]    │    (v1/v2/v3 1-click active switch)   │
│  • Selling Point Preset Picker (⚡)   │  • Selling Point Preset Quick-Insert  │
│    (Global sidebar + Per-card input)  │  • Per-Screen "🔒 锁当前成图微调"      │
│  • Per-Card History Strip (v1/v2/v3)  │    Toggle & Targeted Refine Input     │
│  • Per-Card "🔒 锁图微调" Toggle       │                                       │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

### Data Model & State Extensions

1. **Workspace Navigation Memory (`WorkspaceTopTab`)**：
   - 默认初始值设为 `'sku_studio'`，启动时优先从 `localStorage.getItem('ecom_studio_last_active_tab_v1')` 读取上次停留的工作台；每次切换顶栏 Tab 时实时写入该键值。
2. **Task Level Refinement & History Selection (`SkuTask` & `ScreenTask`)**：
   - 新增可选属性 `lockResultAsRef?: boolean`（是否开启锁当前成图微调）与 `refineInstruction?: string`（针对当前成图的局部微调指令）。
   - `historyImages` 容量上限从 6 扩展至 8，每条记录包含 `url`、`ossUrl`、`timestamp`、`promptSnapshot`；当前正在使用的版本通过比对 `task.resultImageUrl === hist.url` 高亮标识，并按生成先后顺序编号为 `v1`（最早）至 `vN`（最新）。
3. **Image Generation Request Payload (`GenerateImageRequest`)**：
   - 在 `studioBridge.generateImage` 与后端 `/api/image/generate` 中新增可选字段 `lockedResultImageUrl?: string` 与 `refineInstruction?: string`。

### Interactive Component & State Mapping

- **顶栏工作台顺序切换 (`StudioTopHeader`)**：
  - 将导航按钮顺序调整为 `① 主图/SKU工作台` → `② 详情页工作台` → `③ 资产库`；同步更新详情页与主图台内部的跨台引导文案编号（如“流转至 ② 详情页工作台”）。
- **卡片内历史成图版本切换条 (`SkuStudioView` & `DetailModularView`)**：
  - 当 `task.historyImages.length > 0` 时，在成图预览框下方渲染横向版本条：展示每个版本的微缩图、`v1 / v2 / v3` 标签与当前激活蓝框。
  - 点击任意历史版本缩略图时，调用 `onUpdateSkuTask` / `onUpdateTask` 将 `resultImageUrl`、`resultOssUrl` 更新为所选历史项的 URL，无需重新请求接口即可立即生效。
- **主图工作台「双栏精修 ⇄ 5列橱窗」视图切换 (`SkuStudioView`)**：
  - 在画布顶部工具栏新增分段切换控件 `canvasViewMode: 'detailed_2col' | 'showcase_5col'`（自动持久化在组件或本地状态中）。
  - `showcase_5col` 视图采用响应式 5 列网格（`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5`），每张卡片紧凑呈现：顶部编号与可编辑主标题、自适应比例高清成图框（悬停放大/下载/转详情/裂变）、历史版本缩略图切换条、单行卖点速改框、以及底部的「🔒 锁图微调」开关与「立即复刻/微调重绘」按钮。
- **「⚡ 常用卖点预设」快捷点选菜单 (`SkuStudioView` & `DetailModularView`)**：
  - 将 `config.defaultSellingPointPresets` 传入 `SkuStudioView` 与 `DetailModularView`。
  - 在主图台左侧「4. 核心卖点与画幅规格」标题行右侧、每张主图卡片的「画面卖点文案」输入框旁、以及详情页左侧「产品卖点、规格参数与售后信息」旁，提供「⚡ 常用卖点」下拉选择器；点击任意预设项即可将 `sellingPointBadge` 与 `packageSpecNote` 一键填入（支持替换或追加），并带快捷入口打开全局设置弹窗管理预设库。
- **「🔒 锁当前成图微调」局部重绘 (`SkuStudioView`, `DetailModularView`, `App.tsx`, `server.ts`)**：
  - 当卡片已有 `resultImageUrl` 时，在成图操作区显示 `🔒 锁图微调` 切换按钮。
  - 开启后展开一行高亮的微调输入框（如：“输入局部修改点：如改文字、加减漂浮小元素、调亮背景光效...”）。
  - 点击生图按钮时，`App.tsx` 将当前 `task.resultImageUrl` 作为 `lockedResultImageUrl`、将微调要求作为 `refineInstruction` 发送至 `/api/image/generate`。
  - `server.ts` 接收到 `lockedResultImageUrl` 后，调用 `resolveReferenceInlineImage` 将该满意成图解析为多模态图像块，注入严格指令：`【🔒 当前已确认满意成图基准（局部微调锁死构图锚点）】：请保持此图的整体构图机位、产品摆放姿态、展台底座、背景色彩光影与未提及的文字版式 100% 不变，仅严格执行以下局部微调指令：${refineInstruction}`。
