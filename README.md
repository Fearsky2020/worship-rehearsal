# Worship Rehearsal

一个为敬拜团队准备的轻量排练工具。第一版完全静态，不需要后端、不需要 API Key，也不会产生 AI 调用费用。

## MVP 功能

- 粘贴 YouTube 链接并使用官方嵌入播放器播放
- 记录歌曲名称、Key、BPM
- 粘贴和弦谱
- ±1 半音自动移调，支持 slash chord 与常见扩展和弦
- A/B 循环排练
- 浏览器本地保存
- 手机、平板、电脑响应式界面

## 本地运行

直接打开 `index.html` 可以查看大部分功能。因为 YouTube IFrame API 在 `file://` 下可能受浏览器限制，推荐启动一个简单静态服务器：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## GitHub Pages 上线

仓库 Settings → Pages → Build and deployment → Source 选择 `Deploy from a branch`，Branch 选择 `main` / `(root)`。

## 下一阶段

- 多歌曲排练包/Setlist
- 段落结构（Intro / Verse / Chorus / Bridge）
- 每小节时间轴与谱面同步滚动
- 多轨 stems（人声/Bass/Drums/Other）
- 接入 Music-AI 的 Key/BPM/和弦分析结果
