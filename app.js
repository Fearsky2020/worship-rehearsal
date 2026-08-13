
const $=id=>document.getElementById(id);
const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS={'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
let player=null, toastTimer=null;
const state={title:'尚未识别歌曲',videoId:null,youtubeUrl:'',candidates:[],adopted:null,original:null,shift:0,loopA:null,loopB:null,looping:false,scoreType:'chord',previewCandidate:null};

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
function status(type,title,text,icon='•'){const c=$('statusCard');c.className=`status-card ${type}`;c.querySelector('.status-icon').textContent=icon;$('statusTitle').textContent=title;$('statusText').textContent=text}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

function videoId(url){try{const u=new URL(url.trim());if(u.hostname.includes('youtu.be'))return u.pathname.replace('/','').split('/')[0];if(u.searchParams.get('v'))return u.searchParams.get('v');const m=u.pathname.match(/\/(shorts|embed)\/([^/?]+)/);if(m)return m[2]}catch(e){}const m=url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);return m?m[1]:null}
window.onYouTubeIframeAPIReady=()=>{};
function ensurePlayer(id){$('playerMessage').style.display='none';if(player&&typeof player.loadVideoById==='function'){player.loadVideoById(id);return}player=new YT.Player('player',{videoId:id,playerVars:{playsinline:1,rel:0}})}
async function getTitle(id){const watch=`https://www.youtube.com/watch?v=${id}`;const res=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`);if(!res.ok)throw new Error(`YouTube 标题读取失败 (${res.status})`);const d=await res.json();return d.title||'YouTube 歌曲'}

const SCORE_TYPES={
 chord:{label:'和弦谱',icon:'🎸'},
 staff:{label:'五线谱',icon:'🎼'},
 numbered:{label:'简谱',icon:'123'}
};

function searchSources(title,type){
 const google=q=>`https://www.google.com/search?q=${encodeURIComponent(q)}`;
 if(type==='staff') return [
  {name:'Google · 五线谱',url:google(`${title} 五线谱`),query:`${title} 五线谱`},
  {name:'Google · Sheet Music',url:google(`${title} sheet music`),query:`${title} sheet music`},
  {name:'Google · Score',url:google(`${title} score`),query:`${title} score`},
  {name:'PraiseCharts',url:google(`site:praisecharts.com ${title} sheet music`),query:`site:praisecharts.com ${title}`},
  {name:'MuseScore 搜索',url:google(`site:musescore.com ${title}`),query:`site:musescore.com ${title}`},
  {name:'图片搜索',url:`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(title+' 五线谱')}`,query:`${title} 五线谱 图片`}
 ];
 if(type==='numbered') return [
  {name:'Google · 简谱',url:google(`${title} 简谱`),query:`${title} 简谱`},
  {name:'Google · 歌谱',url:google(`${title} 歌谱`),query:`${title} 歌谱`},
  {name:'Google · 数字谱',url:google(`${title} 数字谱`),query:`${title} 数字谱`},
  {name:'赞美诗歌类网页',url:google(`${title} 敬拜 简谱`),query:`${title} 敬拜 简谱`},
  {name:'图片搜索',url:`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(title+' 简谱')}`,query:`${title} 简谱 图片`},
  {name:'YouTube 教学',url:`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' 简谱')}`,query:`${title} 简谱`}
 ];
 return [
  {name:'Google · 和弦谱',url:google(`${title} 和弦谱`),query:`${title} 和弦谱`},
  {name:'Google · Chords',url:google(`${title} chords`),query:`${title} chords`},
  {name:'PraiseCharts',url:google(`site:praisecharts.com ${title}`),query:`site:praisecharts.com ${title}`},
  {name:'Chordify',url:`https://chordify.net/search/${encodeURIComponent(title)}`,query:title},
  {name:'Ultimate Guitar',url:google(`site:tabs.ultimate-guitar.com ${title} chords`),query:`${title} chords`},
  {name:'YouTube 教学',url:`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' chords')}`,query:`${title} chords`}
 ];
}
function renderSearch(){
 const g=$('searchGrid');
 document.querySelectorAll('[data-score-tab]').forEach(b=>b.classList.toggle('active',b.dataset.scoreTab===state.scoreType));
 if(!state.title||state.title==='尚未识别歌曲'){g.innerHTML='<div class="empty">先识别一首歌曲。</div>';return}
 const meta=SCORE_TYPES[state.scoreType];
 g.innerHTML=searchSources(state.title,state.scoreType).map(s=>`<a class="search-card" href="${s.url}" target="_blank" rel="noopener"><strong>${meta.icon} ${escapeHtml(s.name)}</strong><small>搜索 ${escapeHtml(meta.label)}</small><div class="search-query">${escapeHtml(s.query)}</div></a>`).join('');
}
document.querySelectorAll('[data-score-tab]').forEach(btn=>btn.addEventListener('click',()=>{
 state.scoreType=btn.dataset.scoreTab;
 $('candidateType').value=state.scoreType;
 renderSearch();
}));

async function start(){const url=$('youtubeUrl').value.trim(),id=videoId(url);if(!id){status('error','链接无效','请粘贴有效 YouTube 链接。','!');return}state.youtubeUrl=url;state.videoId=id;status('idle','正在识别歌曲','读取 YouTube 标题并准备搜谱入口……','↻');try{ensurePlayer(id);state.title=await getTitle(id);$('songTitle').textContent=state.title;$('sourceHint').textContent='已识别歌曲。下面已经生成多个搜谱入口。';renderSearch();status('done','已准备搜谱','优先从现成谱中选一个；找不到再用 Music-AI。','✓')}catch(e){status('error','识别失败',e.message||'无法读取歌曲。','!')}}

function addCandidate(c){c.id=Date.now()+Math.random();state.candidates.push(c);renderCandidates();toast(`已加入候选：${c.source}`)}
function renderCandidates(){
 const box=$('candidateList');
 if(!state.candidates.length){box.innerHTML='<div class="empty">还没有候选谱。</div>';return}
 box.innerHTML=state.candidates.map((c,i)=>{
  const type=SCORE_TYPES[c.scoreType||'chord']||SCORE_TYPES.chord;
  return `<div class="candidate">
    <div class="candidate-head">
      <div>
        <strong><span class="type-badge">${type.label}</span>${escapeHtml(c.source)}</strong>
        <div class="candidate-meta">Key ${escapeHtml(c.key||'--')} · ${c.kind==='ai'?'Music-AI 分析':'现成谱'}</div>
      </div>
      <button class="button" data-adopt="${i}">采用</button>
    </div>
    ${c.url?`<div class="candidate-meta"><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">打开来源</a></div>`:''}
    <div class="candidate-actions">
      <button class="button" data-preview="${i}">预览</button>
      <button class="button subtle" data-remove="${i}">移除</button>
    </div>
  </div>`
 }).join('');
 box.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>adopt(Number(b.dataset.adopt)));
 box.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>previewCandidate(Number(b.dataset.preview)));
 box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.candidates.splice(Number(b.dataset.remove),1);renderCandidates()});
}

function adopt(i){
 const c=state.candidates[i];if(!c)return;
 state.adopted={...c};
 state.original={title:state.title,source:c.source,scoreType:c.scoreType||'chord',key:c.key||'',bpm:c.bpm||'',meter:c.meter||'',chords:c.chords||'',url:c.url||''};
 state.shift=0;
 $('editorSource').textContent=`${(SCORE_TYPES[c.scoreType||'chord']||SCORE_TYPES.chord).label} · ${c.source}`;
 $('editTitle').value=state.title||'';
 $('editKey').value=c.key||'';
 $('editBpm').value=c.bpm||'';
 $('editMeter').value=c.meter||'';
 $('chordText').value=c.chords||'';
 maybeLoadJianpuFromAdopted(c);
 if((c.scoreType||'chord')==='numbered'){const d=$('jianpuDetails');if(d)d.open=true;}
 $('editState').textContent='已建立排练版。原谱已保留，可以自由编辑。';
 updateShiftUI();
 $('editorPanel').scrollIntoView({behavior:'smooth',block:'start'});
 toast(`已采用：${c.source}`);
}

$('addCandidateBtn').onclick=()=>{const scoreType=$('candidateType').value,previewType=$('candidatePreviewType').value,source=$('candidateSource').value.trim(),url=$('candidateUrl').value.trim(),key=$('candidateKey').value.trim(),chords=$('candidateChords').value.trim();if(!source){toast('请填写来源');return}addCandidate({scoreType,previewType,source,url,key,chords,kind:'chart'});$('candidateSource').value='';$('candidateUrl').value='';$('candidateKey').value='';$('candidateChords').value='';$('candidatePreviewType').value='auto'};


function detectPreviewType(c){
 if(c.previewType && c.previewType!=='auto') return c.previewType;
 const url=(c.url||'').toLowerCase().split('?')[0];
 if(/\.(png|jpg|jpeg|webp|gif)$/.test(url)) return 'image';
 if(/\.pdf$/.test(url)) return 'pdf';
 if(c.chords && !c.url) return 'text';
 if(c.chords && c.scoreType==='numbered') return 'text';
 return 'page';
}
function previewCandidate(i){
 const c=state.candidates[i]; if(!c)return;
 state.previewCandidate={...c};
 const type=SCORE_TYPES[c.scoreType||'chord']||SCORE_TYPES.chord;
 $('previewMeta').textContent=`${type.label} · 来源：${c.source} · Key ${c.key||'--'}`;
 const open=$('openSourceBtn');
 if(c.url){open.href=c.url;open.style.pointerEvents='auto';open.style.opacity='1'}else{open.href='#';open.style.pointerEvents='none';open.style.opacity='.45'}
 const body=$('previewBody');
 const mode=detectPreviewType(c);
 if(mode==='image' && c.url){
   body.innerHTML=`<img src="${escapeHtml(c.url)}" alt="${escapeHtml(type.label)}预览" onerror="this.parentElement.innerHTML='<div class=&quot;preview-warning&quot;>图片无法直接加载。请点上方“打开来源”。</div>'">`;
 }else if(mode==='pdf' && c.url){
   body.innerHTML=`<iframe src="${escapeHtml(c.url)}" title="PDF 谱面预览"></iframe>`;
 }else if(mode==='text'){
   body.innerHTML=`<pre class="preview-text">${escapeHtml(c.chords||'暂无文字内容')}</pre>`;
 }else if(c.url){
   body.innerHTML=`<iframe src="${escapeHtml(c.url)}" title="谱面来源预览"></iframe>`;
 }else if(c.chords){
   body.innerHTML=`<pre class="preview-text">${escapeHtml(c.chords)}</pre>`;
 }else{
   body.innerHTML='<div class="preview-warning">这个候选只有来源信息，没有可直接预览的内容。</div>';
 }
 $('previewPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
$('clearPreviewBtn').onclick=()=>{
 state.previewCandidate=null;
 $('previewMeta').textContent='尚未选择候选。';
 $('openSourceBtn').href='#';
 $('previewBody').innerHTML='<div class="empty">点击候选中的“预览”。</div>';
};

$('jsonFile').onchange=async e=>{const f=e.target.files?.[0];if(f)$('jsonText').value=await f.text()};
$('clearJsonBtn').onclick=()=>{$('jsonText').value='';$('jsonFile').value=''};
$('applyJsonBtn').onclick=()=>{try{const d=JSON.parse($('jsonText').value.trim());let chords='';if(Array.isArray(d.chords))chords=d.chords.map(x=>`${fmt(x.start??x.time??0)}  ${x.chord??x.label??''}`).join('\n');else if(typeof d.chords==='string')chords=d.chords;addCandidate({scoreType:'chord',previewType:'text',source:'Music-AI',url:'',key:d.key||'',bpm:d.bpm||'',meter:d.meter||'',chords,kind:'ai'})}catch(e){toast('JSON 格式不正确')}};

function norm(n){return FLATS[n]||n}
function trRoot(root,s){const i=NOTES.indexOf(norm(root));return i<0?root:NOTES[(i+s+1200)%12]}
function transposeText(text,s){
 return text.split('\n').map(line=>line
  .replace(/\b([A-G](?:#|b)?)(?=[:/\s]|m|maj|min|sus|add|dim|aug|\d|$)/g,(m,r)=>trRoot(r,s))
  .replace(/\/([A-G](?:#|b)?)/g,(m,r)=>'/'+trRoot(r,s))
 ).join('\n');
}
function transposeEditor(delta){
 if(!state.original){toast('先采用一个候选谱');return}
 $('chordText').value=transposeText($('chordText').value,delta);
 const k=$('editKey').value.trim();
 if(k)$('editKey').value=trRoot(k,delta);
 state.shift+=delta;
 updateShiftUI();
 markEdited();
}
function updateShiftUI(){$('shiftLabel').textContent=state.shift===0?'原调':(state.shift>0?`+${state.shift}`:`${state.shift}`);$('currentKeyLabel').textContent=$('editKey').value.trim()||'--'}
$('downBtn').onclick=()=>transposeEditor(-1);
$('upBtn').onclick=()=>transposeEditor(1);
$('editKey').oninput=updateShiftUI;

function markEdited(){if(state.original)$('editState').textContent='排练版有未保存修改。'}
['editTitle','editKey','editBpm','editMeter','chordText'].forEach(id=>$(id).addEventListener('input',markEdited));

$('restoreBtn').onclick=()=>{
 if(!state.original){toast('还没有原谱');return}
 if(!confirm('恢复到最初采用的原谱？当前未保存修改会被覆盖。'))return;
 $('editTitle').value=state.original.title||'';
 $('editKey').value=state.original.key||'';
 $('editBpm').value=state.original.bpm||'';
 $('editMeter').value=state.original.meter||'';
 $('chordText').value=state.original.chords||'';
 state.shift=0;updateShiftUI();$('editState').textContent='已恢复原谱。';toast('已恢复原谱');
};

function rehearsalVersion(){return{
 title:$('editTitle').value.trim()||state.title||'未命名歌曲',
 source:`${(SCORE_TYPES[state.original?.scoreType||state.adopted?.scoreType||'chord']||SCORE_TYPES.chord).label} · ${state.original?.source||state.adopted?.source||'未标注'}`,
 key:$('editKey').value.trim(),bpm:$('editBpm').value.trim(),meter:$('editMeter').value.trim(),
 chords:$('chordText').value,shift:state.shift
}}
$('saveVersionBtn').onclick=()=>{if(!state.original){toast('先采用一个候选谱');return}state.adopted={...state.adopted,rehearsal:rehearsalVersion()};$('editState').textContent='排练版已保存到当前歌曲。';toast('排练版已保存')};
$('copyBtn').onclick=async()=>{const text=$('chordText').value;if(!text){toast('没有可复制内容');return}try{await navigator.clipboard.writeText(text);toast('已复制排练谱')}catch(e){toast('复制失败')}};

function safeFileName(s){return String(s||'worship-chart').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'worship-chart'}
async function exportPdf(){
 if(!state.original){toast('先采用一个候选谱');return}
 if(!window.html2canvas||!window.jspdf){toast('PDF 组件尚未加载，请稍后再试');return}
 const v=rehearsalVersion();
 $('pdfTitle').textContent=v.title;
 $('pdfKey').textContent=v.key||'--';
 $('pdfBpm').textContent=v.bpm||'--';
 $('pdfMeter').textContent=v.meter||'--';
 $('pdfSource').textContent=v.source||'--';
 $('pdfChart').textContent=v.chords||'';
 toast('正在生成 PDF…');
 try{
  const sheet=$('pdfSheet');
  const canvas=await html2canvas(sheet,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const pageW=210,pageH=297;
  const imgW=pageW;
  const imgH=canvas.height*imgW/canvas.width;
  const data=canvas.toDataURL('image/jpeg',0.94);
  if(imgH<=pageH){
   pdf.addImage(data,'JPEG',0,0,imgW,imgH);
  }else{
   let y=0,remaining=imgH,first=true;
   while(remaining>0){
    if(!first)pdf.addPage();
    pdf.addImage(data,'JPEG',0,-y,imgW,imgH);
    y+=pageH;remaining-=pageH;first=false;
   }
  }
  pdf.save(`${safeFileName(v.title)}-${safeFileName(v.key||'chart')}.pdf`);
  toast('PDF 已下载');
 }catch(e){console.error(e);toast('PDF 生成失败')}
}
$('pdfBtn').onclick=exportPdf;


function insertAtCursor(el,text){
 const start=el.selectionStart??el.value.length;
 const end=el.selectionEnd??el.value.length;
 el.value=el.value.slice(0,start)+text+el.value.slice(end);
 const pos=start+text.length;
 el.focus();el.setSelectionRange(pos,pos);
 el.dispatchEvent(new Event('input',{bubbles:true}));
}
document.querySelectorAll('[data-token]').forEach(btn=>{
 btn.addEventListener('click',()=>insertAtCursor($('jianpuText'),btn.dataset.token+' '));
});
document.querySelectorAll('[data-wrap-prefix]').forEach(btn=>{
 btn.addEventListener('click',()=>{
  const el=$('jianpuText'),start=el.selectionStart,end=el.selectionEnd;
  if(start!==end){
   const selected=el.value.slice(start,end);
   el.value=el.value.slice(0,start)+btn.dataset.wrapPrefix+selected+el.value.slice(end);
   el.dispatchEvent(new Event('input',{bubbles:true}));
  }else insertAtCursor(el,btn.dataset.wrapPrefix);
 });
});
document.querySelectorAll('[data-octave]').forEach(btn=>{
 btn.addEventListener('click',()=>insertAtCursor($('jianpuText'),btn.dataset.octave==='up'?"'":","));
});
$('insertChordBtn').onclick=()=>{
 const chord=prompt('输入和弦，例如 D / Bm / A/C#');
 if(chord) insertAtCursor($('jianpuText'),`[${chord}] `);
};
$('newLineBtn').onclick=()=>insertAtCursor($('jianpuText'),'\n');

function tokenizeJianpuLine(line){
 return line.trim().split(/\s+/).filter(Boolean);
}
function renderJianpuToken(tok){
 if(/^\[[^\]]+\]$/.test(tok)){
   return `<span class="jianpu-token chord">${escapeHtml(tok.slice(1,-1))}</span>`;
 }
 if(tok==='|'||tok==='||'||tok==='|:'||tok===':|'){
   return `<span class="jianpu-token bar">${escapeHtml(tok)}</span>`;
 }
 if(tok==='-'||tok==='_'||tok==='·'){
   return `<span class="jianpu-token rhythm">${escapeHtml(tok)}</span>`;
 }
 let m=tok.match(/^([#b]?)([0-7])([',]*)$/);
 if(m){
   const accidental=m[1],num=m[2],oct=m[3]||'';
   let cls='jianpu-token accidental';
   if(oct.includes("'")) cls+=' jianpu-dot-up';
   if(oct.includes(",")) cls+=' jianpu-dot-down';
   return `<span class="${cls}">${escapeHtml(accidental+num)}</span>`;
 }
 return `<span class="jianpu-token">${escapeHtml(tok)}</span>`;
}
function renderJianpuHtml(text,lyrics,key){
 const lines=String(text||'').split(/\r?\n/);
 const lyricLines=String(lyrics||'').split(/\r?\n/);
 let out=`<div class="jianpu-key-note">1 = <strong>${escapeHtml(key||'--')}</strong></div>`;
 let has=false;
 lines.forEach((line,i)=>{
  if(!line.trim() && !(lyricLines[i]||'').trim()) return;
  has=true;
  const tokens=tokenizeJianpuLine(line);
  out+=`<div class="jianpu-line"><div class="jianpu-music-row">${tokens.map(renderJianpuToken).join('')}</div>`;
  if(lyricLines[i]!==undefined && lyricLines[i].trim()) out+=`<div class="jianpu-lyric-row">${escapeHtml(lyricLines[i])}</div>`;
  out+='</div>';
 });
 if(!has) return '<div class="empty">输入简谱后，这里会实时预览。</div>';
 return out;
}
function currentJianpuKey(){
 return $('editKey').value.trim() || state.original?.key || state.adopted?.key || '';
}
function refreshJianpu(){
 const key=currentJianpuKey();
 $('jianpuKeyLabel').textContent=key||'--';
 $('jianpuPreview').innerHTML=renderJianpuHtml($('jianpuText').value,$('jianpuLyrics').value,key);
}
$('jianpuText').addEventListener('input',refreshJianpu);
$('jianpuLyrics').addEventListener('input',refreshJianpu);
$('editKey').addEventListener('input',refreshJianpu);

function transposeBracketChords(text,delta){
 return String(text||'').replace(/\[([^\]]+)\]/g,(m,ch)=>`[${transposeText(ch,delta)}]`);
}
function transposeJianpu(delta){
 if(!$('jianpuText').value.trim() && !currentJianpuKey()){toast('先载入或输入简谱');return}
 const key=currentJianpuKey();
 if(key){
   $('editKey').value=trRoot(key,delta);
   updateShiftUI();
 }
 $('jianpuText').value=transposeBracketChords($('jianpuText').value,delta);
 state.shift+=delta;
 refreshJianpu();
 markEdited();
 toast(`简谱已${delta>0?'升':'降'}半音：数字保持，1=调和和弦已调整`);
}
$('jianpuDownBtn').onclick=()=>transposeJianpu(-1);
$('jianpuUpBtn').onclick=()=>transposeJianpu(1);

$('syncFromChartBtn').onclick=()=>{
 $('jianpuText').value=$('chordText').value||'';
 refreshJianpu();
 toast('已从排练版复制');
};
$('syncToChartBtn').onclick=()=>{
 $('chordText').value=$('jianpuText').value||'';
 markEdited();
 toast('已同步到排练版');
};

function maybeLoadJianpuFromAdopted(c){
 if((c.scoreType||'chord')==='numbered'){
   $('jianpuText').value=c.chords||'';
   $('jianpuLyrics').value=c.lyrics||'';
   refreshJianpu();
 }
}


async function exportJianpuPdf(){
 if(!window.html2canvas||!window.jspdf){toast('PDF 组件尚未加载，请稍后再试');return}
 const title=$('editTitle').value.trim()||state.title||'简谱';
 const key=currentJianpuKey();
 const source=state.original?.source||state.adopted?.source||'未标注';
 $('jianpuPdfTitle').textContent=title;
 $('jianpuPdfKey').textContent=key||'--';
 $('jianpuPdfBpm').textContent=$('editBpm').value.trim()||'--';
 $('jianpuPdfMeter').textContent=$('editMeter').value.trim()||'--';
 $('jianpuPdfSource').textContent=source;
 $('jianpuPdfPreview').innerHTML=renderJianpuHtml($('jianpuText').value,$('jianpuLyrics').value,key);
 toast('正在生成简谱 PDF…');
 try{
   const canvas=await html2canvas($('jianpuPdfSheet'),{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
   const {jsPDF}=window.jspdf;
   const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
   const pageW=210,pageH=297,imgW=pageW,imgH=canvas.height*imgW/canvas.width;
   const data=canvas.toDataURL('image/jpeg',0.94);
   let y=0,remaining=imgH,first=true;
   while(remaining>0){
     if(!first)pdf.addPage();
     pdf.addImage(data,'JPEG',0,-y,imgW,imgH);
     y+=pageH;remaining-=pageH;first=false;
   }
   pdf.save(`${safeFileName(title)}-${safeFileName(key||'简谱')}-简谱.pdf`);
   toast('简谱 PDF 已下载');
 }catch(e){console.error(e);toast('简谱 PDF 生成失败')}
}
$('jianpuPdfBtn').onclick=exportJianpuPdf;
refreshJianpu();

function currentTime(){return player&&typeof player.getCurrentTime==='function'?player.getCurrentTime():null}
function fmt(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
$('setABtn').onclick=()=>{const t=currentTime();if(t===null){toast('先播放视频');return}state.loopA=t;$('loopAValue').textContent=fmt(t)}
$('setBBtn').onclick=()=>{const t=currentTime();if(t===null){toast('先播放视频');return}state.loopB=t;$('loopBValue').textContent=fmt(t)}
$('clearLoopBtn').onclick=()=>{state.loopA=state.loopB=null;state.looping=false;$('loopAValue').textContent=$('loopBValue').textContent='--:--';$('toggleLoopBtn').textContent='循环：关'}
$('toggleLoopBtn').onclick=()=>{if(state.loopA===null||state.loopB===null||state.loopB<=state.loopA){toast('请先正确设置 A/B');return}state.looping=!state.looping;$('toggleLoopBtn').textContent=`循环：${state.looping?'开':'关'}`}
setInterval(()=>{if(!state.looping||!player)return;const t=currentTime();if(t!==null&&t>=state.loopB){player.seekTo(state.loopA,true);player.playVideo()}},350);

const LIB='worship-rehearsal-v23';
function getLib(){try{return JSON.parse(localStorage.getItem(LIB)||'[]')}catch(e){return[]}}
function setLib(x){localStorage.setItem(LIB,JSON.stringify(x));renderLib()}
$('saveBtn').onclick=()=>{
 if(!state.videoId){toast('先识别一首歌曲');return}
 if(state.original) state.adopted={...state.adopted,rehearsal:rehearsalVersion()};
 const arr=getLib();arr.unshift({id:Date.now(),title:state.title,youtubeUrl:state.youtubeUrl,candidates:state.candidates,adopted:state.adopted,original:state.original});setLib(arr.slice(0,50));toast('歌曲已保存')
};
function renderLib(){const arr=getLib(),b=$('libraryList');if(!arr.length){b.innerHTML='<div class="empty">还没有保存歌曲。</div>';return}b.innerHTML=arr.map((x,i)=>`<div class="library-item"><div><strong>${escapeHtml(x.title)}</strong><div class="candidate-meta">${escapeHtml(x.adopted?.rehearsal?.source||x.adopted?.source||'未选谱')}</div></div><button class="button" data-open="${i}">打开</button></div>`).join('');b.querySelectorAll('[data-open]').forEach(btn=>btn.onclick=()=>loadSong(arr[Number(btn.dataset.open)]))}
function loadSong(x){
 state.title=x.title;state.youtubeUrl=x.youtubeUrl;state.videoId=videoId(x.youtubeUrl);state.candidates=x.candidates||[];state.adopted=x.adopted||null;state.original=x.original||null;state.shift=state.adopted?.rehearsal?.shift||0;
 $('youtubeUrl').value=state.youtubeUrl;$('songTitle').textContent=state.title;if(state.videoId)ensurePlayer(state.videoId);renderSearch();renderCandidates();
 if(state.original){
  const v=state.adopted?.rehearsal||{title:state.original.title,source:state.original.source,key:state.original.key,bpm:state.original.bpm,meter:state.original.meter,chords:state.original.chords,shift:0};
  $('editorSource').textContent=v.source||state.original.source;$('editTitle').value=v.title||'';$('editKey').value=v.key||'';$('editBpm').value=v.bpm||'';$('editMeter').value=v.meter||'';$('chordText').value=v.chords||'';updateShiftUI();$('editState').textContent='已从歌曲库恢复排练版。';
  if((state.original?.scoreType||state.adopted?.scoreType)==='numbered'){$('jianpuText').value=v.chords||'';refreshJianpu();}
 }
 status('done','已载入歌曲','已恢复歌曲、候选谱和排练版。','✓');window.scrollTo({top:0,behavior:'smooth'})
}
$('clearLibraryBtn').onclick=()=>{if(confirm('确定清空本机歌曲库吗？'))setLib([])};
$('startBtn').onclick=start;
renderCandidates();renderLib();renderSearch();updateShiftUI();
