# Worship Rehearsal

Worship Rehearsal 是一个面向敬拜团队的轻量排练网页。

## V2

V2 把工作流改成“一个链接开始”：

- 粘贴 YouTube 链接并载入官方播放器
- 自动读取视频标题（通过 YouTube IFrame Player）
- 导入 Music-AI JSON，自动填入 Key / BPM / 拍号 / 和弦时间轴
- 和弦谱一键升降调
- A/B 段落循环
- 本机浏览器歌曲库，可保存并重新打开多首歌曲
- 手机 / 平板 / 桌面响应式

## Music-AI JSON

推荐字段示例：

```json
{
  "title": "示例歌曲",
  "key": "D",
  "bpm": 125,
  "meter": "4/4",
  "chords": [
    {"start": 0.74, "chord": "D"},
    {"start": 1.14, "chord": "A"}
  ]
}
```

也兼容部分常见别名，如 `tempo`、`time_signature`、`chord_timeline`、`segments`。

## 当前边界

GitHub Pages 本身不能在后台下载 YouTube 音频或运行 Music-AI。V2 先完成前端和 Music-AI 数据桥接；下一阶段再由本地 Music-AI worker 自动分析并把 JSON 结果喂给排练包。
