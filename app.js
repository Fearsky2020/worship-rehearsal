
const $=id=>document.getElementById(id);
const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS={'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
let player=null, toastTimer=null;

const state={
 title:'尚未识别歌曲', videoId:null, youtubeUrl:'',
 candidates:[], adopted:null, shift:0, loopA:null, loopB:null, looping:false
};

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1700)}
function status(type,title,text,icon='•'){const c=$('statusCard');c.className=`status-card ${type}`;c.querySelector('.status-icon').textContent=icon;$('statusTitle').textContent=title;$('statusText').textContent=text}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

function videoId(url){
 try{
  const u=new URL(url.trim());
  if(u.hostname.includes('youtu.be')) return u.pathname.replace('/','').split('/')[0];
  if(u.searchParams.get('v')) return u.searchParams.get('v');
  const m=u.pathname.match(/\/(shorts|embed)\/([^/?]+)/); if(m)return m[2];
 }catch(e){}
 const m=url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
 return m?m[1]:null;
}
window.onYouTubeIframeAPIReady=()=>{};
function ensurePlayer(id){
 $('playerMessage').style.display='none';
 if(player&&typeof player.loadVideoById==='function'){player.loadVideoById(id);return}
 player=new YT.Player('player',{videoId:id,playerVars:{playsinline:1,rel:0}});
}
async function getTitle(id){
 const watch=`https://www.youtube.com/watch?v=${id}`;
 const res=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`);
 if(!res.ok) throw new Error(`YouTube 标题读取失败 (${res.status})`);
 const d=await res.json(); return d.title||'YouTube 歌曲';
}

function searchSources(title){
 const q=encodeURIComponent(title);
 const qChord=encodeURIComponent(`${title} chords`);
 // These are search URLs, not scraped content.
 return [
  {name:'Google · 全网',url:`https://www.google.com/search?q=${qChord}`,note:'搜索公开网页中的和弦谱'},
  {name:'PraiseCharts',url:`https://www.google.com/search?q=${encodeURIComponent('site:praisecharts.com '+title)}`,note:'搜索 PraiseCharts'},
  {name:'Chordify',url:`https://chordify.net/search/${q}`,note:'搜索 Chordify'},
  {name:'Ultimate Guitar',url:`https://www.google.com/search?q=${encodeURIComponent('site:tabs.ultimate-guitar.com '+title+' chords')}`,note:'搜索 Ultimate Guitar'},
  {name:'YouTube',url:`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' chords')}`,note:'搜索教学/和弦版本'},
  {name:'其他网页',url:`https://www.google.com/search?q=${encodeURIComponent('"'+title+'" chord chart')}`,note:'按歌名精确搜索'}
 ];
}
function renderSearch(){
 const g=$('searchGrid');
 if(!state.title||state.title==='尚未识别歌曲'){g.innerHTML='<div class="empty">先识别一首歌曲。</div>';return}
 g.innerHTML=searchSources(state.title).map(s=>`
  <a class="search-card" href="${s.url}" target="_blank" rel="noopener">
   <strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.note)}</small>
  </a>`).join('');
}

async function start(){
 const url=$('youtubeUrl').value.trim(), id=videoId(url);
 if(!id){status('error','链接无效','请粘贴有效 YouTube 链接。','!');return}
 state.youtubeUrl=url;state.videoId=id;
 status('idle','正在识别歌曲','读取 YouTube 标题并准备搜谱入口……','↻');
 try{
  ensurePlayer(id);
  state.title=await getTitle(id);
  $('songTitle').textContent=state.title;
  $('sourceHint').textContent='已识别歌曲。下面已经生成多个搜谱入口；找到合适版本后记录为候选。';
  renderSearch();
  status('done','已准备搜谱','歌曲已识别。优先从现成谱中选一个；找不到再用 Music-AI。','✓');
 }catch(e){status('error','识别失败',e.message||'无法读取歌曲。','!')}
}

function addCandidate(c){
 c.id=Date.now()+Math.random();
 state.candidates.push(c);renderCandidates();toast(`已加入候选：${c.source}`)
}
function renderCandidates(){
 const box=$('candidateList');
 if(!state.candidates.length){box.innerHTML='<div class="empty">还没有候选谱。</div>';return}
 box.innerHTML=state.candidates.map((c,i)=>`
 <div class="candidate">
  <div class="candidate-head">
   <div><strong>${escapeHtml(c.source)}</strong><div class="candidate-meta">Key ${escapeHtml(c.key||'--')} · ${c.kind==='ai'?'Music-AI 分析':'现成谱'}</div></div>
   <button class="button" data-adopt="${i}">采用</button>
  </div>
  ${c.url?`<div class="candidate-meta"><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">打开来源</a></div>`:''}
  <div class="candidate-actions"><button class="button subtle" data-remove="${i}">移除</button></div>
 </div>`).join('');
 box.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>adopt(Number(b.dataset.adopt)));
 box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.candidates.splice(Number(b.dataset.remove),1);renderCandidates()});
}
function adopt(i){
 const c=state.candidates[i];if(!c)return;
 state.adopted={...c};state.shift=0;
 $('adoptedSource').textContent=c.source;
 $('keyValue').textContent=c.key||'--';
 $('bpmValue').textContent=c.bpm||'--';
 $('meterValue').textContent=c.meter||'--';
 $('chordText').value=c.chords||'';
 updateTranspose();
 toast(`当前采用：${c.source}`);
}

$('addCandidateBtn').onclick=()=>{
 const source=$('candidateSource').value.trim(),url=$('candidateUrl').value.trim(),key=$('candidateKey').value.trim(),chords=$('candidateChords').value.trim();
 if(!source){toast('请填写来源');return}
 addCandidate({source,url,key,chords,kind:'chart'});
 $('candidateSource').value='';$('candidateUrl').value='';$('candidateKey').value='';$('candidateChords').value='';
};

$('jsonFile').onchange=async e=>{const f=e.target.files?.[0];if(f)$('jsonText').value=await f.text()};
$('clearJsonBtn').onclick=()=>{$('jsonText').value='';$('jsonFile').value=''};
$('applyJsonBtn').onclick=()=>{
 try{
  const d=JSON.parse($('jsonText').value.trim());
  let chords='';
  if(Array.isArray(d.chords)) chords=d.chords.map(x=>`${fmt(x.start??x.time??0)}  ${x.chord??x.label??''}`).join('\n');
  else if(typeof d.chords==='string') chords=d.chords;
  addCandidate({source:'Music-AI',url:'',key:d.key||'',bpm:d.bpm||'',meter:d.meter||'',chords,kind:'ai'});
 }catch(e){toast('JSON 格式不正确')}
};

function norm(n){return FLATS[n]||n}
function trRoot(root,s){const i=NOTES.indexOf(norm(root));return i<0?root:NOTES[(i+s+1200)%12]}
function trChord(ch,s){
 return ch.replace(/\b([A-G](?:#|b)?)(?=[:/\s]|m|maj|min|sus|add|dim|aug|\d|$)/g,(m,r)=>trRoot(r,s))
          .replace(/\/([A-G](?:#|b)?)/g,(m,r)=>'/'+trRoot(r,s));
}
function updateTranspose(){
 $('shiftLabel').textContent=state.shift===0?'原调':(state.shift>0?`+${state.shift}`:`${state.shift}`);
 const base=state.adopted?.key||'';
 $('currentKeyLabel').textContent=base?trRoot(base,state.shift):'--';
 const src=state.adopted?.chords||$('chordText').value;
 if(state.adopted)$('chordText').value=src.split('\n').map(l=>l.replace(/\b([A-G](?:#|b)?(?:m|maj|min|sus|add|dim|aug)?\d*(?:\/[A-G](?:#|b)?)?)/g,c=>trChord(c,state.shift))).join('\n');
}
$('downBtn').onclick=()=>{state.shift--;updateTranspose()};
$('upBtn').onclick=()=>{state.shift++;updateTranspose()};

function currentTime(){return player&&typeof player.getCurrentTime==='function'?player.getCurrentTime():null}
function fmt(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
$('setABtn').onclick=()=>{const t=currentTime();if(t===null){toast('先播放视频');return}state.loopA=t;$('loopAValue').textContent=fmt(t)}
$('setBBtn').onclick=()=>{const t=currentTime();if(t===null){toast('先播放视频');return}state.loopB=t;$('loopBValue').textContent=fmt(t)}
$('clearLoopBtn').onclick=()=>{state.loopA=state.loopB=null;state.looping=false;$('loopAValue').textContent=$('loopBValue').textContent='--:--';$('toggleLoopBtn').textContent='循环：关'}
$('toggleLoopBtn').onclick=()=>{if(state.loopA===null||state.loopB===null||state.loopB<=state.loopA){toast('请先正确设置 A/B');return}state.looping=!state.looping;$('toggleLoopBtn').textContent=`循环：${state.looping?'开':'关'}`}
setInterval(()=>{if(!state.looping||!player)return;const t=currentTime();if(t!==null&&t>=state.loopB){player.seekTo(state.loopA,true);player.playVideo()}},350);

const LIB='worship-rehearsal-v22';
function getLib(){try{return JSON.parse(localStorage.getItem(LIB)||'[]')}catch(e){return[]}}
function setLib(x){localStorage.setItem(LIB,JSON.stringify(x));renderLib()}
$('saveBtn').onclick=()=>{
 if(!state.videoId){toast('先识别一首歌曲');return}
 const arr=getLib();arr.unshift({id:Date.now(),title:state.title,youtubeUrl:state.youtubeUrl,candidates:state.candidates,adopted:state.adopted});setLib(arr.slice(0,50));toast('已保存')
};
function renderLib(){
 const arr=getLib(),b=$('libraryList');
 if(!arr.length){b.innerHTML='<div class="empty">还没有保存歌曲。</div>';return}
 b.innerHTML=arr.map((x,i)=>`<div class="library-item"><div><strong>${escapeHtml(x.title)}</strong><div class="candidate-meta">${escapeHtml(x.adopted?.source||'未选谱')}</div></div><button class="button" data-open="${i}">打开</button></div>`).join('');
 b.querySelectorAll('[data-open]').forEach(btn=>btn.onclick=()=>loadSong(arr[Number(btn.dataset.open)]));
}
function loadSong(x){
 state.title=x.title;state.youtubeUrl=x.youtubeUrl;state.videoId=videoId(x.youtubeUrl);state.candidates=x.candidates||[];state.adopted=x.adopted||null;state.shift=0;
 $('youtubeUrl').value=state.youtubeUrl;$('songTitle').textContent=state.title;ensurePlayer(state.videoId);renderSearch();renderCandidates();
 if(state.adopted){$('adoptedSource').textContent=state.adopted.source;$('keyValue').textContent=state.adopted.key||'--';$('bpmValue').textContent=state.adopted.bpm||'--';$('meterValue').textContent=state.adopted.meter||'--';$('chordText').value=state.adopted.chords||''}
 status('done','已载入歌曲','已恢复歌曲和候选谱。','✓');window.scrollTo({top:0,behavior:'smooth'})
}
$('clearLibraryBtn').onclick=()=>{if(confirm('确定清空本机歌曲库吗？'))setLib([])};
$('startBtn').onclick=start;
renderCandidates();renderLib();renderSearch();
