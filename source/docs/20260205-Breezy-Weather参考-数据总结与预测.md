# 参考 Breezy Weather：数据总结与预测

参考仓库：[breezy-weather/breezy-weather](https://github.com/breezy-weather/breezy-weather)

---

## 1. Breezy Weather 的定位

- **数据来源**：预报、逐分钟降水、警报等**全部来自 50+ 天气 API**，不做本地气象预测算法。
- **本地只做**：多源数据聚合、**数据补全/插值**、体感温度等**派生量计算**、以及展示与缓存。

因此其“总结”和“预测”本质是：**如何展示与补全 API 数据**，而不是我们这种**纯本地分钟级温湿压的规则总结与临近预测**。下面是对我们有用的部分。

---

## 2. 数据补全（Data completion）

来自 [docs/UPDATES.md](https://github.com/breezy-weather/breezy-weather/blob/main/docs/UPDATES.md)：

- **历史回填**：缺过去数据时，回填到昨日 00:00，便于展示“昨天”信息。
- **插值/推算**：
  - 湿球温度（Stull 回归公式）
  - **湿度 ↔ 露点** 互推（有露点算湿度，有湿度算露点）
  - 天气现象码等从已有数据推断
- **纯计算**：日出日落、月升月落、月相等。

**可借鉴**：我们已有露点由 T+RH 计算；可考虑在缺气压时不做倾向判断、在缺某维时明确“数据不足”的展示，与 Breezy 的“补全 + 明确缺失”思路一致。

---

## 3. 体感温度（Feels like / Apparent temperature）

来自 [Discussion #1085](https://github.com/breezy-weather/breezy-weather/discussions/1085) 及澳大利亚气象局 [thermal stress](http://www.bom.gov.au/info/thermal_stress/#atapproximation)：

- **展示优先级**：数据源提供的体感 → **Steadman 体感温度** → 湿球温度（Stull）等。
- **Steadman 体感温度（无辐射版）**，适用于仅有 T、RH、风速时：
  - 公式：**AT = Ta + 0.33×e − 0.70×ws − 4.00**
  - 其中：
    - Ta = 气温（°C）
    - e = 水汽压（hPa）：**e = (rh/100) × 6.105 × exp(17.27×Ta / (237.7+Ta))**
    - ws = 风速（m/s）；**无风速时可用 0 或 1 m/s 作为默认**。

Breezy 认为用湿球温度当“体感”会低估热压力；Steadman 与 NWS 采用的 Heat Index 同源，更适合“人体感觉”。

**可借鉴**：在体感与舒适度卡片中，增加 **Steadman 体感温度**（我们无风速，用 ws=0 或 1），与现有露点、舒适分级、偏闷热/偏潮湿文案并存，使“体感”更有依据。

---

## 4. 主屏“总结”与块顺序

来自 [docs/HOMEPAGE.md](https://github.com/breezy-weather/breezy-weather/blob/main/docs/HOMEPAGE.md)：

- **Current weather**：最近一次刷新的天气；主屏头部是：
  - **一句天气描述**（来自数据源，如“Partly cloudy”）
  - 温度、体感温度（若不同）
  - 当前/下一“半日”的极值（如今日白天最高、今夜最低）
- **块顺序**：Alerts → **Precipitation nowcasting** → Daily forecast → Hourly forecast → 降水/风/空气质量/湿度/气压等。

不做长段落“数据总结”，而是**一句描述 + 关键数字 + 按块分模块展示**。

**可借鉴**：我们已有 24h 文字总结（overviewSummary）和多张洞察卡片；可保留，并可增加**一句“当前状况”**（例如由当前最高 severity 或舒适度等级生成），与 Breezy 的“一句描述 + 关键数”思路一致。

---

## 5. Nowcasting（短时降水）

- Breezy 的 **Precipitation nowcasting** = 某天气源提供的**逐分钟降水 API**，本地只做展示（含 5 分钟步长引导线）。
- 无本地雷达、无本地降水预测算法。

**与我们差异**：我们是**纯本地、无 API**，只能做基于分钟级温湿压的**规则型临近提示**（气压倾向、温露差趋近、雾/结露风险等），与 Breezy 的 API nowcast 不同，但“先数据补全/质量判断再展示”的思路可参考。

---

## 6. 小结：可落地的改进点

| 项目         | Breezy 做法               | 我们可做                         |
| ------------ | ------------------------- | -------------------------------- |
| 体感温度     | Steadman AT，无风速时默认 | 增加 Steadman 体感（ws=0 或 1）  |
| 总结形式     | 一句描述 + 温度 + 极值    | 保留 24h 总结 + 可选“当前一句”   |
| 数据补全     | 露点 ↔ 湿度、湿球等       | 已有露点；缺维时明确“数据不足”   |
| 预测/nowcast | 依赖 API 分钟降水         | 保持规则预测（气压/温露差/雾露） |

如需在 `WeatherInsightsEngine` 中实现 Steadman 体感或“当前一句”总结，可在本需求基础上再开小任务迭代。
