const $ = (id) => document.getElementById(id);
const state = {
  originalText: '',
  shift: 0,
  loopA: null,
  loopB: null,
  looping: false,
  videoId: null,
};
let player = null;
let loopTimer = null;

const chromaticSharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const chromaticFlat  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteIndex = {C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1600);
}
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (m) return m[1];
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch (_) {}
  return null;
}
function formatTime(sec) {
  if (sec == null || Number.isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}
function currentTime() {
  try { return player && player.getCurrentTime ? player.getCurrentTime() : 0; }
  catch (_) { return 0; }
}
function chooseScale(note) {
  return note.includes('b') ? chromaticFlat : chromaticSharp;
}
function transposeRoot(root, semitones) {
  const idx = noteIndex[root];
  if (idx == null) return root;
  const scale = chooseScale(root);
  return scale[(idx + semitones + 120) % 12];
}
function transposeChordToken(token, semitones) {
  const m = token.match(/^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/);
  if (!m) return token;
  const [, root, suffix, bass] = m;
  return transposeRoot(root,semitones) + suffix + (bass ? '/' + transposeRoot(bass,semitones) : '');
}
function transposeText(text, semitones) {
  return text.replace(/(?<![\p{L}\p{N}])([A-G](?:#|b)?(?:maj|min|m|M|dim|aug|sus|add|no|\d|\+|°|ø|\(|\)|#|b)*(?:\/[A-G](?:#|b)?)?)(?![\p{L}\p{N}])/gu,
    (match) => transposeChordToken(match,semitones));
}
function normalizedKey(key) {
  const m = (key || '').trim().match(/^([A-G](?:#|b)?)(m)?$/);
  return m ? {root:m[1], minor:!!m[2]} : {root:'D',minor:false};
}
function displayKeyForShift() {
  const {root,minor} = normalizedKey($('songKey').value);
  return transposeRoot(root,state.shift) + (minor ? 'm' : '');
}
function renderTranspose() {
  if (!state.originalText) state.originalText = $('chords').value;
  $('chords').value = transposeText(state.originalText,state.shift);
  const dk = displayKeyForShift();
  $('displayKey').textContent = dk;
  $('statKey').textContent = dk;
  $('statShift').textContent = state.shift > 0 ? `+${state.shift}` : `${state.shift}`;
  $('shiftLabel').textContent = state.shift === 0 ? '原调' : (state.shift > 0 ? `+${state.shift}` : `${state.shift}`);
}
function syncMeta() {
  $('chartTitle').textContent = $('title').value.trim() || '未命名歌曲';
  $('statBpm').textContent = $('bpm').value || '--';
  renderTranspose();
}
function loadVideo() {
  const id = extractYouTubeId($('youtubeUrl').value.trim());
  if (!id) return toast('没识别出 YouTube 链接');
  state.videoId = id;
  $('emptyPlayer').style.display = 'none';
  if (player && player.loadVideoById) {
    player.loadVideoById(id);
  } else if (window.YT && YT.Player) {
    player = new YT.Player('player', { videoId:id, playerVars:{playsinline:1,rel:0}, events:{onReady:startLoopWatcher} });
  }
  toast('视频已载入');
}
window.onYouTubeIframeAPIReady = function() {
  if (state.videoId) loadVideo();
};
function startLoopWatcher() {
  clearInterval(loopTimer);
  loopTimer = setInterval(() => {
    if (!state.looping || state.loopA == null || state.loopB == null || !player) return;
    const t = currentTime();
    if (t >= state.loopB || t < state.loopA - 0.5) {
      player.seekTo(state.loopA,true);
      if (player.playVideo) player.playVideo();
    }
  }, 180);
}
function updateLoopUI() {
  $('aTime').textContent = formatTime(state.loopA);
  $('bTime').textContent = formatTime(state.loopB);
  $('toggleLoop').textContent = `循环：${state.looping ? '开' : '关'}`;
}
function save() {
  const data = {
    title:$('title').value, youtubeUrl:$('youtubeUrl').value, songKey:$('songKey').value,
    bpm:$('bpm').value, originalText:state.originalText || $('chords').value, shift:state.shift,
    loopA:state.loopA, loopB:state.loopB
  };
  localStorage.setItem('worship-rehearsal-song',JSON.stringify(data));
  toast('已保存在这台设备');
}
function restore() {
  const raw = localStorage.getItem('worship-rehearsal-song');
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    $('title').value=d.title||''; $('youtubeUrl').value=d.youtubeUrl||''; $('songKey').value=d.songKey||'D'; $('bpm').value=d.bpm||125;
    state.originalText=d.originalText||''; $('chords').value=state.originalText; state.shift=Number(d.shift||0);
    state.loopA=d.loopA ?? null; state.loopB=d.loopB ?? null; updateLoopUI(); syncMeta();
  } catch (_) {}
}

$('loadVideoBtn').addEventListener('click',loadVideo);
$('title').addEventListener('input',syncMeta);
$('bpm').addEventListener('input',syncMeta);
$('songKey').addEventListener('input',syncMeta);
$('chords').addEventListener('input',() => { if (state.shift===0) state.originalText=$('chords').value; });
$('up').addEventListener('click',() => { if(!state.originalText) state.originalText=$('chords').value; state.shift++; renderTranspose(); });
$('down').addEventListener('click',() => { if(!state.originalText) state.originalText=$('chords').value; state.shift--; renderTranspose(); });
$('resetTranspose').addEventListener('click',() => { state.shift=0; renderTranspose(); });
$('copyChords').addEventListener('click',async() => { try { await navigator.clipboard.writeText($('chords').value); toast('和弦谱已复制'); } catch (_) { toast('复制失败'); } });
$('setA').addEventListener('click',() => { state.loopA=currentTime(); if(state.loopB!=null && state.loopB<=state.loopA) state.loopB=null; updateLoopUI(); });
$('setB').addEventListener('click',() => { const t=currentTime(); if(state.loopA==null) return toast('先设置 A 点'); if(t<=state.loopA+.3) return toast('B 点要晚于 A 点'); state.loopB=t; updateLoopUI(); });
$('toggleLoop').addEventListener('click',() => { if(state.loopA==null||state.loopB==null) return toast('先设置 A 和 B'); state.looping=!state.looping; updateLoopUI(); startLoopWatcher(); });
$('clearLoop').addEventListener('click',() => { state.loopA=state.loopB=null; state.looping=false; updateLoopUI(); });
$('saveBtn').addEventListener('click',save);

restore();
syncMeta();
