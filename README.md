# Worship Rehearsal V3.1 — Source Fallback & AI Calibration

V3.1 实现新的找谱策略：

1. 优先自动展示可直接预览/使用的公开候选。
2. 来源不能直接使用时保留原始来源链接，不绕过限制重新发布整谱。
3. 候选不满意可点“这个不行，继续找”，Worker 排除当前来源继续寻找。
4. 用户可以上传自己的 PDF、图片、MusicXML 或文本谱。
5. 公开预览页可以作为 AI 校准参考。
6. AI 只从公开可见部分提取 Key、拍号、速度、可见结构/版式等校准事实。
7. 剩余排练内容必须根据音频独立分析生成，并标注“AI 根据音频分析生成”。
8. 不使用公开第一页去重建来源网站未公开的后续页面。

## Worker API

### POST /search
支持：
- requestedTypes
- excludeSources
- excludeUrls

### POST /analyze-audio
输入歌曲音频信息和有限 calibration 数据。
Worker 应独立从音频推导剩余音乐内容。

完整协议见 `search-worker-protocol.json`。
