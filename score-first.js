
(function(){
  if(typeof renderAutoResults!=='function' || typeof resultBoxFor!=='function') return;
  window.__scoreFirstNormalize=function(raw,type){
    return {
      scoreType:raw.scoreType||type,source:raw.source||'未标注来源',key:raw.key||'',
      bpm:raw.bpm||'',meter:raw.meter||'',sourcePageUrl:raw.sourcePageUrl||raw.url||'',
      imageUrl:raw.imageUrl||'',thumbnailUrl:raw.thumbnailUrl||raw.thumbnail||'',
      previewType:raw.previewType||'auto',chords:raw.text||raw.chords||'',
      title:raw.title||state.title,kind:raw.kind||'search'
    };
  };
  renderAutoResults=function(type,items){
    const box=resultBoxFor(type);
    if(!items||!items.length){box.innerHTML='<div class="empty">没有找到可直接展示的谱面。可以重新搜索或换来源。</div>';return}
    box.dataset.items=JSON.stringify(items);
    box.innerHTML=items.map((raw,i)=>{
      const c=window.__scoreFirstNormalize(raw,type),img=c.thumbnailUrl||c.imageUrl;
      return `<article class="auto-card">
        <div class="auto-score-preview">${img?`<img src="${escapeHtml(img)}" alt="${escapeHtml(c.title||'乐谱预览')}" loading="lazy" referrerpolicy="no-referrer">`:'<div class="no-preview">没有直接图片预览；此项仅作为备用来源</div>'}</div>
        <div class="auto-card-body">
          <div class="auto-card-title">${escapeHtml(c.title||'乐谱')}</div>
          <div class="auto-card-source">来源：${escapeHtml(c.source)}${c.key?` · Key ${escapeHtml(c.key)}`:''}</div>
          <div class="auto-card-actions">
            <button class="button primary" data-score-first-adopt="${type}:${i}">采用这份</button>
            ${c.sourcePageUrl?`<a class="button subtle" href="${escapeHtml(c.sourcePageUrl)}" target="_blank" rel="noopener">查看来源</a>`:''}
          </div>
        </div>
      </article>`;
    }).join('');
    box.querySelectorAll('[data-score-first-adopt]').forEach(btn=>{
      btn.onclick=()=>{
        const [t,idx]=btn.dataset.scoreFirstAdopt.split(':'),arr=JSON.parse(resultBoxFor(t).dataset.items||'[]');
        const raw=arr[Number(idx)],c=window.__scoreFirstNormalize(raw,t),img=c.thumbnailUrl||c.imageUrl;
        addCandidate({scoreType:c.scoreType,source:c.source,key:c.key,bpm:c.bpm,meter:c.meter,url:img||c.sourcePageUrl,sourcePageUrl:c.sourcePageUrl,previewType:img?'image':c.previewType,chords:c.chords,title:c.title,kind:c.kind});
        previewCandidate(state.candidates.length-1);
      };
    });
  };
})();
