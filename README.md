# Worship Rehearsal V2.2 — Search First

V2.2 把默认逻辑改为：

YouTube → 识别歌曲 → 优先搜现成谱 → 记录候选来源 → 选择采用 → Music-AI 仅作为后备候选。

## 来源原则

只标注来源，不对来源做价值判断。

候选可以来自：
- PraiseCharts
- Chordify
- Ultimate Guitar
- YouTube
- 普通网页
- Music-AI

## 重要限制

这是纯 GitHub Pages 静态前端。

浏览器端无法可靠地跨站抓取、解析各家谱站的完整内容，因此 V2.2 会自动生成针对已识别歌曲的多个搜谱入口，但不会伪装成“已经自动抓取了谱”。

下一阶段需要一个 Worker/后端来完成：
1. 搜索候选
2. 抽取允许处理的谱信息
3. 和原视频版本比对
4. 回传候选列表及匹配结果

## 当前能力
- YouTube 标题识别
- 自动生成多来源搜谱入口
- 候选谱记录
- 来源标注
- 一键采用候选
- Music-AI JSON 作为后备候选
- 移调
- A/B Loop
- 本地歌曲库
