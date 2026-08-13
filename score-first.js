
(function(){
  const FEEDBACK_KEY='worship-score-feedback-v1';
  function loadFeedback(){try{return Object.assign({rejectedUrls:[],sourceRejectCounts:{},preferredSources:[]},JSON.parse(localStorage.getItem(FEEDBACK_KEY)||'{}'))}catch{return{rejectedUrls:[],sourceRejectCounts:{},preferredSources:[]}}}
  function saveFeedback(v){localStorage.setItem(FEEDBACK_KEY,JSON.stringify(v))}
  function normalize(raw,type){return{scoreType:raw.scoreType||type,source:raw.source||'未标注来源',key:raw.key||'',bpm:raw.bpm||'',meter:raw.meter||'',sourcePageUrl:raw.sourcePageUrl||raw.url||'',imageUrl:raw.imageUrl||'',thumbnailUrl:raw.thumbnailUrl||raw.thumbnail||'',previewType:raw.previewType||'auto',chords:raw.text||raw.chords||'',title:raw.title||state.title,kind:raw.kind||'search',scoreConfidence:Number(raw.scoreConfidence||0)}}
  window.__scoreFirstNormalize=normalize;
  window.renderAutoResults=function(type,items){
    const box=resultBoxFor(type);
    if(!items||!items.length){box.innerHTML='<div class="empty">没有找到足够像乐谱的图片。可以重新搜索或换来源。</div>';return}
    box.dataset.items=JSON.stringify(items);
    box.innerHTML=items.map((raw,i)=>{
      const c=normalize(raw,type),img=c.thumbnailUrl||c.imageUrl,conf=c.scoreConfidence?` · 匹配 ${Math.round(c.scoreConfidence*100)}%`:'';
      return `<article class="auto-card">
        <div class="auto-score-preview">${img?`<img src="${escapeHtml(img)}" alt="${escapeHtml(c.title||'乐谱预览')}" loading="lazy" referrerpolicy="no-referrer">`:'<div class="no-preview">备用来源：没有直接图片预览</div>'}</div>
        <div class="auto-card-body">
          <div class="auto-card-title">${escapeHtml(c.title||'乐谱')}</div>
          <div class="auto-card-source">来源：${escapeHtml(c.source)}${conf}</div>
          <div class="auto-card-actions">
            <button class="button primary" data-adopt-score="${type}:${i}">采用这份</button>
            ${c.sourcePageUrl?`<a class="button subtle" href="${escapeHtml(c.sourcePageUrl)}" target="_blank" rel="noopener">查看来源</a>`:''}
          </div>
          <div class="score-feedback">
            <button class="feedback-btn good" data-score-good="${type}:${i}">✓ 是乐谱</button>
            <button class="feedback-btn bad" data-score-bad="${type}:${i}">✕ 不是乐谱</button>
          </div>
        </div>
      </article>`;
    }).join('');
    box.querySelectorAll('[data-adopt-score]').forEach(btn=>btn.onclick=()=>{
      const [t,idx]=btn.dataset.adoptScore.split(':'),raw=JSON.parse(resultBoxFor(t).dataset.items||'[]')[Number(idx)],c=normalize(raw,t),img=c.thumbnailUrl||c.imageUrl;
      addCandidate({scoreType:c.scoreType,source:c.source,key:c.key,bpm:c.bpm,meter:c.meter,url:img||c.sourcePageUrl,sourcePageUrl:c.sourcePageUrl,previewType:img?'image':c.previewType,chords:c.chords,title:c.title,kind:c.kind});
      previewCandidate(state.candidates.length-1);
    });
    box.querySelectorAll('[data-score-good]').forEach(btn=>btn.onclick=()=>{
      const [t,idx]=btn.dataset.scoreGood.split(':'),raw=JSON.parse(resultBoxFor(t).dataset.items||'[]')[Number(idx)],c=normalize(raw,t),fb=loadFeedback();
      if(c.source&&!fb.preferredSources.includes(c.source))fb.preferredSources.push(c.source);
      saveFeedback(fb);btn.textContent='✓ 已确认';toast('已记住：这是乐谱');
    });
    box.querySelectorAll('[data-score-bad]').forEach(btn=>btn.onclick=()=>{
      const [t,idx]=btn.dataset.scoreBad.split(':'),raw=JSON.parse(resultBoxFor(t).dataset.items||'[]')[Number(idx)],c=normalize(raw,t),fb=loadFeedback(),u=c.imageUrl||c.thumbnailUrl||c.sourcePageUrl;
      if(u&&!fb.rejectedUrls.includes(u))fb.rejectedUrls.push(u);
      if(c.source)fb.sourceRejectCounts[c.source]=(fb.sourceRejectCounts[c.source]||0)+1;
      saveFeedback(fb);btn.closest('.auto-card')?.remove();toast('已标记：不是乐谱');
    });
  };
  window.runWorkerSearch=async function(){
    if(!state.title||state.title==='尚未识别歌曲')return;
    const fb=loadFeedback();setAutoWaiting('正在筛选最像乐谱的结果…');
    try{
      const res=await fetch(WORKER_CONFIG.endpoint.replace(/\/$/,'')+'/search',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:'1.3',title:state.title,youtubeUrl:state.youtubeUrl,videoId:state.videoId,requestedTypes:['chord','staff','numbered'],excludeUrls:fb.rejectedUrls.slice(-100),sourceRejectCounts:fb.sourceRejectCounts,preferredSources:fb.preferredSources})});
      if(!res.ok)throw new Error(`Worker ${res.status}`);
      const data=await res.json();renderAutoResults('chord',data.results?.chord||[]);renderAutoResults('staff',data.results?.staff||[]);renderAutoResults('numbered',data.results?.numbered||[]);status('done','已筛出最像乐谱的结果','每类最多显示 3 份。','✓');
    }catch(e){console.error(e);setAutoWaiting('自动搜谱暂不可用。');status('error','自动搜索失败',e.message||'Worker 暂不可用','!')}
  };
  const refresh=$('refreshSearchBtn');if(refresh)refresh.onclick=window.runWorkerSearch;
})();
