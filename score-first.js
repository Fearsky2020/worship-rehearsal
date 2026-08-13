
(function(){
 const FEEDBACK_KEY='worship-score-feedback-v1',labels={chord:'和弦谱',staff:'五线谱',numbered:'简谱'};let titleMeta=null;
 function loadFeedback(){try{return Object.assign({rejectedUrls:[],sourceRejectCounts:{},preferredSources:[]},JSON.parse(localStorage.getItem(FEEDBACK_KEY)||'{}'))}catch{return{rejectedUrls:[],sourceRejectCounts:{},preferredSources:[]}}}
 function saveFeedback(v){localStorage.setItem(FEEDBACK_KEY,JSON.stringify(v))}
 function normalize(raw,type){return{
  scoreType:raw.scoreType||type,source:raw.source||'未标注来源',key:raw.key||'',bpm:raw.bpm||'',meter:raw.meter||'',
  sourcePageUrl:raw.sourcePageUrl||raw.url||'',imageUrl:raw.imageUrl||'',thumbnailUrl:raw.thumbnailUrl||raw.thumbnail||'',
  previewType:raw.previewType||'auto',chords:raw.text||raw.chords||'',title:raw.title||state.title,kind:raw.kind||'search',
  scoreConfidence:Number(raw.scoreConfidence||0),vision:raw.vision||null,verificationStatus:raw.verificationStatus||''
 }}
 function currentUrls(type){try{return JSON.parse(resultBoxFor(type).dataset.items||'[]').flatMap(x=>[x.imageUrl,x.thumbnailUrl,x.sourcePageUrl]).filter(Boolean)}catch{return[]}}
 function renderMeta(meta){titleMeta=meta||titleMeta;if(!titleMeta)return;const el=document.getElementById('searchCompatibility');if(!el)return;const variants=[titleMeta.simplifiedTitle,titleMeta.traditionalTitle].filter((x,i,a)=>x&&a.indexOf(x)===i);el.innerHTML=`<strong>正在搜索：${escapeHtml(titleMeta.simplifiedTitle||titleMeta.coreTitle)}</strong><small>识别标题：${escapeHtml(titleMeta.coreTitle)} · 搜索兼容：${escapeHtml(variants.join(' / '))}${titleMeta.artist?` · 艺术家/来源辅助：${escapeHtml(titleMeta.artist)}`:''}</small>`}
 function visionBadges(c){
   const v=c.vision;
   if(!v)return '<div class="vision-badges"><span class="vision-badge warn">视觉核验不可用</span></div>';
   const title=v.title_match==='yes'
     ? '<span class="vision-badge ok">✓ 歌曲确认</span>'
     : '<span class="vision-badge warn">△ 歌名未完全可见</span>';
   const type=v.type_match===true
     ? '<span class="vision-badge ok">✓ 谱型正确</span>'
     : '<span class="vision-badge warn">谱型不确定</span>';
   return `<div class="vision-badges"><span class="vision-badge ok">✓ AI 确认是乐谱</span>${type}${title}<span class="vision-badge info">视觉 ${Math.round(Number(v.confidence||0)*100)}%</span></div>${v.visible_title?`<div class="vision-reason">图中标题：${escapeHtml(v.visible_title)}</div>`:''}`;
 }
 window.__scoreFirstNormalize=normalize;
 window.renderAutoResults=function(type,items){
   const box=resultBoxFor(type);box.dataset.items=JSON.stringify(items||[]);
   if(!items||!items.length){box.innerHTML='<div class="empty">AI 没有找到同时满足“像乐谱 + 谱型正确 + 歌名可信”的候选，可点“换一批”。</div>';return}
   box.innerHTML=items.map((raw,i)=>{
     const c=normalize(raw,type),img=c.thumbnailUrl||c.imageUrl,conf=c.scoreConfidence?` · 搜索匹配 ${Math.round(c.scoreConfidence*100)}%`:'';
     return `<article class="auto-card">
       <div class="auto-score-preview">${img?`<img src="${escapeHtml(img)}" alt="${escapeHtml(c.title||'乐谱预览')}" loading="lazy" referrerpolicy="no-referrer">`:'<div class="no-preview">没有图片预览</div>'}</div>
       <div class="auto-card-body">
         <div class="auto-card-title">${escapeHtml(c.title||'乐谱')}</div>
         <div class="auto-card-source">来源：${escapeHtml(c.source)}${conf}</div>
         ${visionBadges(c)}
         <div class="auto-card-actions"><button class="button primary" data-adopt-score="${type}:${i}">采用这份</button>${c.sourcePageUrl?`<a class="button subtle" href="${escapeHtml(c.sourcePageUrl)}" target="_blank" rel="noopener">查看来源</a>`:''}</div>
         <div class="score-feedback"><button class="feedback-btn good" data-score-good="${type}:${i}">✓ 是乐谱</button><button class="feedback-btn bad" data-score-bad="${type}:${i}">✕ 不是乐谱</button></div>
       </div>
     </article>`
   }).join('');
   box.querySelectorAll('[data-adopt-score]').forEach(btn=>btn.onclick=()=>{const[t,idx]=btn.dataset.adoptScore.split(':'),raw=JSON.parse(resultBoxFor(t).dataset.items||'[]')[Number(idx)],c=normalize(raw,t),img=c.thumbnailUrl||c.imageUrl;addCandidate({scoreType:c.scoreType,source:c.source,key:c.key,bpm:c.bpm,meter:c.meter,url:img||c.sourcePageUrl,sourcePageUrl:c.sourcePageUrl,previewType:img?'image':c.previewType,chords:c.chords,title:c.title,kind:c.kind});previewCandidate(state.candidates.length-1)});
   box.querySelectorAll('[data-score-good]').forEach(btn=>btn.onclick=()=>{const[t,idx]=btn.dataset.scoreGood.split(':'),c=normalize(JSON.parse(resultBoxFor(t).dataset.items||'[]')[Number(idx)],t),fb=loadFeedback();if(c.source&&!fb.preferredSources.includes(c.source))fb.preferredSources.push(c.source);saveFeedback(fb);btn.textContent='✓ 已确认';toast('已记住：这是乐谱')});
   box.querySelectorAll('[data-score-bad]').forEach(btn=>btn.onclick=()=>{const[t,idx]=btn.dataset.scoreBad.split(':'),c=normalize(JSON.parse(resultBoxFor(t).dataset.items||'[]')[Number(idx)],t),fb=loadFeedback(),u=c.imageUrl||c.thumbnailUrl||c.sourcePageUrl;if(u&&!fb.rejectedUrls.includes(u))fb.rejectedUrls.push(u);if(c.source)fb.sourceRejectCounts[c.source]=(fb.sourceRejectCounts[c.source]||0)+1;saveFeedback(fb);btn.closest('.auto-card')?.remove();toast('已标记：不是乐谱')});
 };
 async function searchTypes(types,extraExclude=[]){
   if(!state.title||state.title==='尚未识别歌曲')return;
   const fb=loadFeedback();status('working','正在搜索并视觉验谱',state.title,'…');
   try{
     const res=await fetch(WORKER_CONFIG.endpoint.replace(/\/$/,'')+'/search',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({
       schemaVersion:'1.6',title:state.title,youtubeUrl:state.youtubeUrl,videoId:state.videoId,requestedTypes:types,
       excludeUrls:[...new Set([...fb.rejectedUrls.slice(-100),...extraExclude])],
       sourceRejectCounts:fb.sourceRejectCounts,preferredSources:fb.preferredSources,visionVerify:true
     })});
     if(!res.ok)throw new Error(`Worker ${res.status}`);
     const data=await res.json();renderMeta(data.titleMeta);types.forEach(type=>renderAutoResults(type,data.results?.[type]||[]));
     const checked=Number(data.visionChecks||0),passed=Number(data.visionPassed||0);
     status('done','搜索和视觉验谱完成',`${types.map(t=>labels[t]).join('、')}已更新 · Brave ${data.requestsUsed} 次 · AI 验图 ${checked} 张，通过 ${passed} 张`,'✓');
     return data;
   }catch(e){console.error(e);status('error','自动搜索失败',e.message||'Worker 暂不可用','!');throw e}
 }
 window.runWorkerSearch=()=>searchTypes(['chord','staff','numbered']);
 document.querySelectorAll('[data-refresh-score]').forEach(btn=>btn.onclick=()=>searchTypes([btn.dataset.refreshScore],currentUrls(btn.dataset.refreshScore)));
 const refresh=$('refreshSearchBtn');if(refresh)refresh.onclick=window.runWorkerSearch;
})();
