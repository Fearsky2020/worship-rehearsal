# Worship Rehearsal V2.1

V2.1 是一次纯产品流程重构，不新增后台分析能力。

## 这版解决的问题
- 首页只突出一个主动作：粘贴 YouTube 链接 → 生成排练包
- 明确告诉用户：当前只会加载视频和标题
- Key / BPM / 拍号 / 和弦不会伪装成“正在后台分析”
- Music-AI JSON 导入被收进“高级工具”，默认折叠
- 排练区、A/B Loop、移调、歌曲库继续保留
- 手机端重新整理布局和按钮层级

## 当前真实能力
1. 粘贴 YouTube 链接
2. 加载 YouTube 官方播放器
3. 尝试通过 YouTube oEmbed 获取标题
4. 导入 Music-AI JSON：
   - title
   - key
   - bpm
   - meter
   - chords
5. 生成和弦时间轴
6. 一键移调
7. A/B Loop
8. 本地歌曲库

## 未来 V3
V3 才会接 Music-AI Worker，实现：
YouTube 链接 → 后台分析 → 自动回填 Key/BPM/拍号/和弦。
