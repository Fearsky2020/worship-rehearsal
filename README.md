# Worship Rehearsal V3.1.2 — Legacy DOM Safety Hotfix

This patch fixes the remaining V2 legacy candidate-form references after the V3 UI refactor.

## Fix
The old candidate form no longer exists in the V3 page, but V2 JavaScript still referenced:
- candidateType
- candidatePreviewType
- candidateSource
- candidateUrl
- candidateKey
- candidateChords

V3.1.2 now captures every legacy element first and only installs the old handler if **all** elements exist.

There are no remaining direct legacy expressions such as:

```js
$('candidateType').value
```

The V3.1 Search Worker, upload, AI calibration, editor, numbered-notation, PDF, A/B loop, and library behavior are otherwise unchanged.


# Worship Rehearsal V3.1.1 — Hotfix

修复 V3.0 / V3.1 重构后旧 DOM 依赖导致的启动失败。

## 修复
- V3 页面已移除旧 `addCandidateBtn`，旧 JS 仍直接绑定 `.onclick`，导致脚本启动即报错。
- 旧 `searchGrid` 在 V3 页面不存在，`renderSearch()` 现在安全退出。
- 旧 `candidateType` 不存在时不再报错。
- 主按钮 `startBtn` 增加最终安全绑定和错误状态显示。

不改变 V3.1 的搜索协议、上传、AI 校准、编辑、简谱和 PDF 功能。


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
