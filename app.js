
const $ = (id) => document.getElementById(id);

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_TO_SHARP = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};

const state = {
  title: '未命名歌曲',
  key: '--',
  bpm: '--',
  meter: '--',
  originalChordText: '',
  shift: 0,
  videoId: null,
  loopA: null,
  loopB: null,
  looping: false
};

let player = null;
let toastTimer = null;

function showToast(message){
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
}

function setStatus(type, title, text, icon){
  const card = $('statusCard');
  card.className = `status-card ${type}`;
  $('statusTitle').textContent = title;
  $('statusText').textContent = text;
  card.querySelector('.status-icon').textContent = icon || '•';
}

function extractVideoId(url){
  if(!url) return null;
  try{
    const u = new URL(url.trim());
    if(u.hostname.includes('youtu.be')) return u.pathname.replace('/','').split('/')[0];
    if(u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(shorts|embed)\/([^/?]+)/);
    if(m) return m[2];
  }catch(e){}
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function onYouTubeIframeAPIReady(){
  // player created lazily
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function ensurePlayer(videoId){
  $('playerMessage').style.display = 'none';
  if(player && typeof player.loadVideoById === 'function'){
    player.loadVideoById(videoId);
    return;
  }
  player = new YT.Player('player', {
    videoId,
    playerVars:{playsinline:1, rel:0},
    events:{
      onReady: ()=>{},
      onStateChange: ()=>{}
    }
  });
}

async function fetchTitle(videoId){
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try{
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const res = await fetch(endpoint);
    if(!res.ok) throw new Error(`oEmbed ${res.status}`);
    const data = await res.json();
    return data.title || '未命名歌曲';
  }catch(err){
    return 'YouTube 歌曲';
  }
}

async function generatePack(){
  const url = $('youtubeUrl').value.trim();
  const videoId = extractVideoId(url);
  if(!videoId){
    setStatus('error','链接无效','请粘贴一个有效的 YouTube 链接。','!');
    return;
  }

  state.videoId = videoId;
  setStatus('processing','正在生成基础排练包','正在读取 YouTube 视频和标题……','↻');

  try{
    ensurePlayer(videoId);
    const title = await fetchTitle(videoId);
    state.title = title;
    $('songTitle').textContent = title;

    if(state.key === '--' && state.bpm === '--'){
      setStatus(
        'done',
        '基础排练包已生成',
        '视频和标题已就绪。Key、BPM、拍号、和弦尚未分析；如已有 Music-AI JSON，请在“高级工具”中导入。',
        '✓'
      );
    }else{
      setStatus('done','排练包已生成','视频、标题和分析结果都已载入。','✓');
    }
  }catch(err){
    setStatus('error','生成失败',err.message || '无法加载 YouTube 视频。','!');
  }
}

function applyAnalysis(data){
  if(!data || typeof data !== 'object') throw new Error('JSON 格式不正确');

  if(data.title){
    state.title = String(data.title);
    $('songTitle').textContent = state.title;
  }
  if(data.key){
    state.key = String(data.key);
    $('keyValue').textContent = state.key;
  }
  if(data.bpm !== undefined && data.bpm !== null){
    state.bpm = String(data.bpm);
    $('bpmValue').textContent = state.bpm;
  }
  if(data.meter){
    state.meter = String(data.meter);
    $('meterValue').textContent = state.meter;
  }

  if(Array.isArray(data.chords)){
    const lines = data.chords.map(item=>{
      const start = Number(item.start ?? item.time ?? 0);
      const chord = item.chord ?? item.label ?? '';
      return `${formatTime(start)}  ${chord}`.trim();
    });
    state.originalChordText = lines.join('\n');
    state.shift = 0;
    $('chordText').value = state.originalChordText;
  } else if(typeof data.chords === 'string'){
    state.originalChordText = data.chords;
    state.shift = 0;
    $('chordText').value = data.chords;
  }

  updateTransposeUI();
  $('analysisNote').textContent = 'Music-AI 分析结果已导入。现在可以直接使用 Key / BPM / 拍号 / 和弦，以及移调和 A/B 循环。';
  setStatus('done','分析结果已导入','排练包信息已经补全。','✓');
  showToast('分析结果已应用');
}

function parseJsonText(){
  const text = $('jsonText').value.trim();
  if(!text) throw new Error('请先选择 JSON 文件或粘贴 JSON');
  return JSON.parse(text);
}

$('jsonFile').addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    $('jsonText').value = await file.text();
    showToast('JSON 已读取');
  }catch(err){
    showToast('读取 JSON 失败');
  }
});

$('applyJsonBtn').addEventListener('click', ()=>{
  try{
    applyAnalysis(parseJsonText());
  }catch(err){
    setStatus('error','JSON 导入失败',err.message || '请检查 JSON。','!');
  }
});

$('clearJsonBtn').addEventListener('click', ()=>{
  $('jsonText').value = '';
  $('jsonFile').value = '';
});

function normalizeRoot(root){
  return FLAT_TO_SHARP[root] || root;
}

function transposeRoot(root, semitones){
  const norm = normalizeRoot(root);
  const idx = NOTE_NAMES.indexOf(norm);
  if(idx < 0) return root;
  return NOTE_NAMES[(idx + semitones + 1200) % 12];
}

function transposeChord(chord, semitones){
  if(!semitones) return chord;
  return chord.replace(/\b([A-G](?:#|b)?)(?=[:/\s]|m|maj|min|sus|add|dim|aug|\d|$)/g, (m, root)=>{
    return transposeRoot(root, semitones);
  }).replace(/\/([A-G](?:#|b)?)/g, (m, root)=>`/${transposeRoot(root,semitones)}`);
}

function renderChordText(){
  const source = state.originalChordText || $('chordText').value;
  if(!state.originalChordText) state.originalChordText = source;
  $('chordText').value = source.split('\n').map(line=>{
    return line.replace(/\b([A-G](?:#|b)?(?:m|maj|min|sus|add|dim|aug)?\d*(?:\/[A-G](?:#|b)?)?)/g,
      chord=>transposeChord(chord,state.shift));
  }).join('\n');
}

function updateTransposeUI(){
  $('shiftLabel').textContent = state.shift === 0 ? '原调' : (state.shift > 0 ? `+${state.shift}` : `${state.shift}`);
  if(state.key && state.key !== '--'){
    $('currentKeyLabel').textContent = transposeRoot(state.key, state.shift);
  } else {
    $('currentKeyLabel').textContent = '--';
  }
  renderChordText();
}

$('downBtn').addEventListener('click', ()=>{ state.shift--; updateTransposeUI(); });
$('upBtn').addEventListener('click', ()=>{ state.shift++; updateTransposeUI(); });

$('chordText').addEventListener('input', ()=>{
  if(state.shift === 0) state.originalChordText = $('chordText').value;
});

function formatTime(sec){
  if(sec === null || sec === undefined || Number.isNaN(Number(sec))) return '--:--';
  sec = Math.max(0, Math.floor(Number(sec)));
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function getCurrentTime(){
  if(player && typeof player.getCurrentTime === 'function') return player.getCurrentTime();
  return null;
}

$('setABtn').addEventListener('click', ()=>{
  const t = getCurrentTime();
  if(t === null){ showToast('请先播放视频'); return; }
  state.loopA = t; $('loopAValue').textContent = formatTime(t);
});
$('setBBtn').addEventListener('click', ()=>{
  const t = getCurrentTime();
  if(t === null){ showToast('请先播放视频'); return; }
  state.loopB = t; $('loopBValue').textContent = formatTime(t);
});
$('clearLoopBtn').addEventListener('click', ()=>{
  state.loopA = state.loopB = null; state.looping = false;
  $('loopAValue').textContent = '--:--'; $('loopBValue').textContent = '--:--';
  $('toggleLoopBtn').textContent = '循环：关';
});
$('toggleLoopBtn').addEventListener('click', ()=>{
  if(state.loopA === null || state.loopB === null || state.loopB <= state.loopA){
    showToast('请先正确设置 A 和 B');
    return;
  }
  state.looping = !state.looping;
  $('toggleLoopBtn').textContent = `循环：${state.looping ? '开' : '关'}`;
});

setInterval(()=>{
  if(!state.looping || !player || state.loopA === null || state.loopB === null) return;
  const t = getCurrentTime();
  if(t !== null && t >= state.loopB){
    player.seekTo(state.loopA,true);
    player.playVideo();
  }
},350);

const LIB_KEY = 'worship-rehearsal-library-v2';

function getLibrary(){
  try{return JSON.parse(localStorage.getItem(LIB_KEY) || '[]')}catch(e){return []}
}
function setLibrary(items){ localStorage.setItem(LIB_KEY, JSON.stringify(items)); renderLibrary(); }

function currentSnapshot(){
  return {
    id: Date.now(),
    title: state.title,
    youtubeUrl: $('youtubeUrl').value.trim(),
    key: state.key,
    bpm: state.bpm,
    meter: state.meter,
    chords: state.originalChordText || $('chordText').value,
    savedAt: new Date().toISOString()
  };
}

$('saveBtn').addEventListener('click', ()=>{
  if(!$('youtubeUrl').value.trim() && state.title === '未命名歌曲'){
    showToast('先生成一个排练包');
    return;
  }
  const items = getLibrary();
  items.unshift(currentSnapshot());
  setLibrary(items.slice(0,50));
  showToast('已保存到歌曲库');
});

function loadSnapshot(item){
  $('youtubeUrl').value = item.youtubeUrl || '';
  state.title = item.title || '未命名歌曲';
  state.key = item.key || '--';
  state.bpm = item.bpm || '--';
  state.meter = item.meter || '--';
  state.originalChordText = item.chords || '';
  state.shift = 0;
  $('songTitle').textContent = state.title;
  $('keyValue').textContent = state.key;
  $('bpmValue').textContent = state.bpm;
  $('meterValue').textContent = state.meter;
  $('chordText').value = state.originalChordText;
  if(item.youtubeUrl){
    state.videoId = extractVideoId(item.youtubeUrl);
    if(state.videoId) ensurePlayer(state.videoId);
  }
  updateTransposeUI();
  setStatus('done','已载入歌曲','已从本地歌曲库恢复排练包。','✓');
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderLibrary(){
  const box = $('libraryList');
  const items = getLibrary();
  if(!items.length){
    box.innerHTML = '<div class="empty">还没有保存歌曲。生成排练包后点右上角“保存到歌曲库”。</div>';
    return;
  }
  box.innerHTML = '';
  items.forEach((item,index)=>{
    const div = document.createElement('div');
    div.className = 'library-item';
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(item.title || '未命名歌曲')}</strong>
        <div class="muted">${escapeHtml(item.key || '--')} · ${escapeHtml(String(item.bpm || '--'))} BPM</div>
      </div>
      <button class="button" data-load="${index}">打开</button>`;
    box.appendChild(div);
  });
  box.querySelectorAll('[data-load]').forEach(btn=>{
    btn.addEventListener('click', ()=>loadSnapshot(items[Number(btn.dataset.load)]));
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

$('clearLibraryBtn').addEventListener('click', ()=>{
  if(confirm('确定清空本机歌曲库吗？')) setLibrary([]);
});

$('generateBtn').addEventListener('click', generatePack);

renderLibrary();
updateTransposeUI();
