const $ = (id) => document.getElementById(id);
const state = {
  originalText: '', shift: 0, loopA: null, loopB: null, looping: false,
  videoId: null, title: '', songKey: '', bpm: '', meter: '', analysis: null,
};
let player = null;
let loopTimer = null;

const chromaticSharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const chromaticFlat  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteIndex = {C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (m) return m[1];
  try { const u = new URL(url); if (u.hostname.includes('youtube.com')) return u.searchParams.get('v'); } catch (_) {}
  return null;
}
function formatTime(sec) {
  if (sec == null || Number.isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60); const s = Math.floor(sec % 60).toString().padStart(2,'0'); return `${m}:${s}`;
}
function currentTime() { try { return player?.getCurrentTime ? player.getCurrentTime() : 0; } catch (_) { return 0; } }
function chooseScale(note) { return note.includes('b') ? chromaticFlat : chromaticSharp; }
function transposeRoot(root, semitones) {
  const idx = noteIndex[root]; if (idx == null) return root;
  return chooseScale(root)[(idx + semitones + 120) % 12];
}
function transposeChordToken(token, semitones) {
  const m = token.match(/^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/); if (!m) return token;
  const [, root, suffix, bass] = m;
  return transposeRoot(root,semitones) + suffix + (bass ? '/' + transposeRoot(bass,semitones) : '');
}
function transposeText(text, semitones) {
  return text.replace(/(?<![\p{L}\p{N}])([A-G](?:#|b)?(?:maj|min|m|M|dim|aug|sus|add|no|\d|\+|°|ø|\(|\)|#|b)*(?:\/[A-G](?:#|b)?)?)(?![\p{L}\p{N}])/gu,
    (match) => transposeChordToken(match,semitones));
}
function normalizedKey(key) {
  const m = (key || '').trim().match(/^([A-G](?:#|b)?)(m)?$/); return m ? {root:m[1],minor:!!m[2]} : null;
}
function displayKeyForShift() {
  const k = normalizedKey(state.songKey); if (!k) return '--';
  return transposeRoot(k.root,state.shift) + (k.minor ? 'm' : '');
}
function renderTranspose() {
  $('chords').value = transposeText(state.originalText || '',state.shift);
  const dk = displayKeyForShift(); $('displayKey').textContent = dk; $('metaKey').textContent = dk;
  $('shiftLabel').textContent = state.shift === 0 ? '原调' : (state.shift > 0 ? `+${state.shift}` : `${state.shift}`);
}
function syncMeta() {
  $('chartTitle').textContent = state.title || '未命名歌曲';
  $('metaKey').textContent = displayKeyForShift(); $('metaBpm').textContent = state.bpm || '--'; $('meterBadge').textContent = state.meter || '--';
  renderTranspose();
}
function readVideoTitle() {
  try {
    const data = player?.getVideoData?.();
    if (data?.title) {
      state.title = data.title;
      $('statusTitle').textContent = '已自动读取';
      syncMeta(); renderLibrary();
    }
  } catch (_) {}
}
function loadVideo() {
  const id = extractYouTubeId($('youtubeUrl').value.trim());
  if (!id) return toast('没识别出 YouTube 链接');
  state.videoId = id; $('emptyPlayer').style.display = 'none'; $('statusTitle').textContent = '正在读取…';
  if (player?.loadVideoById) { player.loadVideoById(id); setTimeout(readVideoTitle, 900); }
  else if (window.YT?.Player) {
    player = new YT.Player('player', { videoId:id, playerVars:{playsinline:1,rel:0}, events:{
      onReady:() => { startLoopWatcher(); setTimeout(readVideoTitle, 500); },
      onStateChange:() => readVideoTitle()
    }});
  }
  toast('正在生成排练包');
}
window.onYouTubeIframeAPIReady = () => { if (state.videoId) loadVideo(); };
function startLoopWatcher() {
  clearInterval(loopTimer); loopTimer = setInterval(() => {
    if (!state.looping || state.loopA == null || state.loopB == null || !player) return;
    const t = currentTime(); if (t >= state.loopB || t < state.loopA - 0.5) { player.seekTo(state.loopA,true); player.playVideo?.(); }
  }, 180);
}
function updateLoopUI() {
  $('aTime').textContent = formatTime(state.loopA); $('bTime').textContent = formatTime(state.loopB);
  $('toggleLoop').textContent = `循环：${state.looping ? '开' : '关'}`;
}
function chordName(item) { return item?.chord || item?.label || item?.name || item?.value || ''; }
function chordStart(item) {
  const v = item?.start ?? item?.time ?? item?.timestamp ?? item?.start_time ?? item?.startTime; return Number(v);
}
function buildChordText(chords) {
  if (typeof chords === 'string') return chords;
  if (!Array.isArray(chords)) return '';
  if (chords.length && typeof chords[0] === 'string') return chords.join(' | ');
  return chords.map((c) => {
    const name = chordName(c); const t = chordStart(c);
    if (!name) return '';
    return Number.isFinite(t) ? `${formatTime(t)}  ${name}` : name;
  }).filter(Boolean).join('\n');
}
function pick(obj, keys) {
  for (const k of keys) if (obj?.[k] != null && obj[k] !== '') return obj[k]; return null;
}
function applyAnalysisObject(raw) {
  const data = raw?.analysis || raw?.result || raw?.song || raw;
  const key = pick(data,['key','tonic','song_key','detected_key']);
  const bpm = pick(data,['bpm','tempo','BPM']);
  const meter = pick(data,['meter','time_signature','timeSignature','signature']);
  const title = pick(data,['title','song_title','name']);
  const chords = pick(data,['chords','chord_timeline','chordTimeline','segments']);
  if (title && !state.title) state.title = String(title);
  if (key) state.songKey = String(key).trim();
  if (bpm) state.bpm = Math.round(Number(bpm) * 100) / 100;
  if (meter) state.meter = String(meter);
  const chordText = buildChordText(chords);
  if (chordText) { state.originalText = chordText; state.shift = 0; $('statusChords').textContent = '已导入'; }
  if (key || bpm || meter) $('statusAnalysis').textContent = '已导入';
  state.analysis = raw; syncMeta();
  if (!key && !bpm && !chordText) toast('JSON 读到了，但没找到可识别的分析字段'); else toast('Music-AI 分析已应用');
}
function parseAndApplyAnalysis(text) {
  try { applyAnalysisObject(JSON.parse(text)); } catch (e) { toast('JSON 格式有问题'); }
}
function snapshot() {
  return { id:state.videoId || Date.now().toString(), youtubeUrl:$('youtubeUrl').value.trim(), title:state.title, songKey:state.songKey,
    bpm:state.bpm, meter:state.meter, originalText:state.originalText, loopA:state.loopA, loopB:state.loopB, savedAt:Date.now() };
}
function getLibrary() { try { return JSON.parse(localStorage.getItem('worship-rehearsal-library') || '[]'); } catch (_) { return []; } }
function setLibrary(items) { localStorage.setItem('worship-rehearsal-library',JSON.stringify(items)); }
function save() {
  if (!state.videoId && !state.title) return toast('先生成一首歌曲');
  const item = snapshot(); const lib = getLibrary(); const idx = lib.findIndex(x => x.id === item.id);
  if (idx >= 0) lib[idx] = item; else lib.unshift(item); setLibrary(lib.slice(0,50)); renderLibrary(); toast('已保存到歌曲库');
}
function loadLibraryItem(item) {
  state.videoId=item.id; state.title=item.title||''; state.songKey=item.songKey||''; state.bpm=item.bpm||''; state.meter=item.meter||'';
  state.originalText=item.originalText||''; state.shift=0; state.loopA=item.loopA??null; state.loopB=item.loopB??null;
  $('youtubeUrl').value=item.youtubeUrl||''; $('statusTitle').textContent=state.title?'已保存':'等待链接';
  $('statusAnalysis').textContent=(state.songKey||state.bpm)?'已保存':'等待分析'; $('statusChords').textContent=state.originalText?'已保存':'等待分析';
  updateLoopUI(); syncMeta(); loadVideo(); window.scrollTo({top:0,behavior:'smooth'});
}
function renderLibrary() {
  const lib=getLibrary(); const box=$('library'); box.innerHTML=''; $('emptyLibrary').style.display=lib.length?'none':'block';
  lib.forEach(item => {
    const row=document.createElement('button'); row.className='library-item';
    row.innerHTML=`<span><strong>${escapeHtml(item.title||'未命名歌曲')}</strong><small>${escapeHtml(item.songKey||'--')} · ${escapeHtml(String(item.bpm||'--'))} BPM</small></span><span>打开 →</span>`;
    row.addEventListener('click',()=>loadLibraryItem(item)); box.appendChild(row);
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$('generateBtn').addEventListener('click',loadVideo);
$('youtubeUrl').addEventListener('paste',() => setTimeout(() => { if (extractYouTubeId($('youtubeUrl').value)) $('statusTitle').textContent='链接已识别'; },0));
$('analysisFile').addEventListener('change',async(e)=>{ const f=e.target.files?.[0]; if(!f)return; const text=await f.text(); $('analysisJson').value=text; parseAndApplyAnalysis(text); });
$('applyAnalysis').addEventListener('click',()=>parseAndApplyAnalysis($('analysisJson').value));
$('clearAnalysis').addEventListener('click',()=>{ $('analysisJson').value=''; state.analysis=null; toast('分析输入已清空'); });
$('chords').addEventListener('input',()=>{ if(state.shift===0){state.originalText=$('chords').value; $('statusChords').textContent=state.originalText?'已编辑':'等待分析';} });
$('up').addEventListener('click',()=>{ if(!state.originalText)return toast('还没有和弦谱'); state.shift++; renderTranspose(); });
$('down').addEventListener('click',()=>{ if(!state.originalText)return toast('还没有和弦谱'); state.shift--; renderTranspose(); });
$('resetTranspose').addEventListener('click',()=>{ state.shift=0; renderTranspose(); });
$('copyChords').addEventListener('click',async()=>{ try{await navigator.clipboard.writeText($('chords').value);toast('和弦谱已复制');}catch(_){toast('复制失败');} });
$('setA').addEventListener('click',()=>{ state.loopA=currentTime(); if(state.loopB!=null&&state.loopB<=state.loopA)state.loopB=null; updateLoopUI(); });
$('setB').addEventListener('click',()=>{ const t=currentTime(); if(state.loopA==null)return toast('先设置 A 点'); if(t<=state.loopA+.3)return toast('B 点要晚于 A 点'); state.loopB=t; updateLoopUI(); });
$('toggleLoop').addEventListener('click',()=>{ if(state.loopA==null||state.loopB==null)return toast('先设置 A 和 B'); state.looping=!state.looping; updateLoopUI(); startLoopWatcher(); });
$('clearLoop').addEventListener('click',()=>{ state.loopA=state.loopB=null; state.looping=false; updateLoopUI(); });
$('saveBtn').addEventListener('click',save);
$('clearLibrary').addEventListener('click',()=>{ if(!getLibrary().length)return; if(confirm('清空这台设备上的歌曲库？')){setLibrary([]);renderLibrary();toast('歌曲库已清空');} });

renderLibrary(); updateLoopUI(); syncMeta();
