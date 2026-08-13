import { Converter } from "opencc-js";

const VERSION = "1.4.0";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const VISION_MAX_CHECKS_PER_TYPE = 3;
const VISION_TARGET_RESULTS_PER_TYPE = 2;
const toSimplified = Converter({ from: "tw", to: "cn" });
const toTraditional = Converter({ from: "cn", to: "tw" });
const VIDEO_HOSTS = ["youtube.com","youtu.be","bilibili.com","v.qq.com","youku.com","douyin.com","tiktok.com","ixigua.com"];
const VIDEO_WORDS = ["official video","music video","official mv"," mv "," live ","concert","karaoke","伴奏","现场","現場","演唱会","演唱會","视频","影片"];
const NOISE = /\b(?:official(?:\s+music)?\s+video|official\s+mv|official\s+audio|lyrics?|live|music\s+video|mv)\b|歌詞|歌词|敬拜現場|敬拜现场/gi;
const POSITIVE = {chord:["和弦谱","和弦譜","chord chart","chords","吉他谱","吉他譜"],staff:["五线谱","五線譜","sheet music","music score","乐谱","樂譜","钢琴谱","鋼琴譜"],numbered:["简谱","簡譜","数字谱","數字譜","歌谱","歌譜","numbered notation","jianpu"]};

function corsHeaders(origin){const allowed=["https://fearsky2020.github.io","http://localhost:8000","http://127.0.0.1:8000"];return{"Access-Control-Allow-Origin":allowed.includes(origin)?origin:allowed[0],"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}}
function json(data,status=200,origin=""){return new Response(JSON.stringify(data,null,2),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...corsHeaders(origin)}})}
function unique(values){return[...new Set(values.map(v=>String(v||"").trim()).filter(Boolean))]}
function host(url=""){try{return new URL(url).hostname.replace(/^www\./,"").toLowerCase()}catch{return"网页"}}
function normalizeTitle(raw){
 const original=String(raw||"").replace(NOISE," ").replace(/\s+/g," ").trim();
 const bracket=original.match(/[【\[]\s*([^】\]]+)[】\]]/);let focus=bracket?bracket[1].trim():original.split(/\s+[|｜]\s+|\s+[–—]\s+/)[0].trim();
 const chinese=focus.match(/[\p{Script=Han}][\p{Script=Han}\s·・]{1,30}/gu)||original.match(/[\p{Script=Han}][\p{Script=Han}\s·・]{1,30}/gu)||[];
 const english=focus.match(/[A-Za-z][A-Za-z'’\- ]{2,50}/g)||[];let core=(chinese[0]||focus).trim().replace(/\s+/g,"");
 core=core.replace(/(?:赞美之泉|讚美之泉|敬拜现场|敬拜現場).*$/u,"").trim()||core;
 const artists=unique([original.match(/讚美之泉|赞美之泉/u)?.[0],original.match(/Stream\s+Of\s+Praise(?:\s+Music\s+Ministries)?/i)?.[0]]);
 if(!bracket&&chinese.length>1&&!artists.length)artists.push(chinese[1].trim());
 const simplified=toSimplified(core),traditional=toTraditional(core),artistVariants=unique(artists.flatMap(a=>[a,toSimplified(a),toTraditional(a)]));
 return{originalTitle:String(raw||"").trim(),coreTitle:core,simplifiedTitle:simplified,traditionalTitle:traditional,englishTitle:(english[0]||"").trim(),artist:artistVariants[0]||"",titleVariants:unique([core,simplified,traditional]),artistVariants};
}
function imageQuery(meta,type){const titles=meta.titleVariants.slice(0,3).map(x=>`"${x}"`).join(" OR "),english=meta.englishTitle?` "${meta.englishTitle}"`:"",artist=meta.artistVariants.slice(0,2).map(x=>`"${x}"`).join(" OR "),terms=type==="staff"?"五线谱 五線譜 乐谱 sheet music":type==="numbered"?"简谱 簡譜 歌谱":"和弦谱 和弦譜 chord chart chords";return`${titles}${english}${artist?` (${artist})`:""} ${terms}`.slice(0,450)}
async function imageSearch(env,q,count=30){if(!env.BRAVE_API_KEY)throw new Error("BRAVE_API_KEY is not configured");const u=new URL("https://api.search.brave.com/res/v1/images/search");u.searchParams.set("q",q);u.searchParams.set("count",String(Math.min(count,50)));u.searchParams.set("country","ALL");u.searchParams.set("safesearch","strict");const r=await fetch(u,{headers:{"Accept":"application/json","Accept-Encoding":"gzip","X-Subscription-Token":env.BRAVE_API_KEY}});if(!r.ok)throw new Error(`Brave Image Search ${r.status}: ${(await r.text()).slice(0,180)}`);return r.json()}
function normalizeImage(x,type){const page=x.url||x.source||"",image=x.properties?.url||"",thumbnail=x.thumbnail?.src||x.thumbnail||x.properties?.placeholder||"";return{scoreType:type,source:host(page),title:x.title||"",sourcePageUrl:page,url:page,imageUrl:image,thumbnailUrl:thumbnail,previewType:"image",description:x.description||"",kind:"image-search",width:Number(x.properties?.width||0),height:Number(x.properties?.height||0)}}
function scoreCandidate(c,type,meta,rejects={},preferred=[]){const text=` ${c.title||""} ${c.description||""} `.toLowerCase(),source=c.source.toLowerCase(),searchable=toSimplified(text);let score=0,reasons=[];if(VIDEO_HOSTS.some(x=>source===x||source.endsWith(`.${x}`))){score-=10;reasons.push("video-host")}if(VIDEO_WORDS.some(w=>text.includes(w))){score-=6;reasons.push("video-title")}if(meta.titleVariants.some(v=>v.length>1&&searchable.includes(toSimplified(v).toLowerCase()))){score+=6;reasons.push("title-match")}if(meta.englishTitle&&text.includes(meta.englishTitle.toLowerCase())){score+=4;reasons.push("english-title")}if(meta.artistVariants.some(v=>searchable.includes(toSimplified(v).toLowerCase()))){score+=2;reasons.push("artist-match")}for(const w of POSITIVE[type])if(searchable.includes(toSimplified(w).toLowerCase())){score+=3;reasons.push("score-term");break}if(/musescore|praisecharts|musicnotes|gangqinpu|poppiano|everyonepiano|jianpu|score|music|piano/.test(source)){score+=2;reasons.push("music-source")}if(c.width&&c.height){const ratio=c.width/c.height;if(ratio>=.5&&ratio<=1.6){score+=3;reasons.push("document-aspect")}if(ratio>1.9)score-=2;if(c.height>=600||c.width>=800)score+=2}score-=Math.min(Number(rejects[c.source]||0)*2,6);if(preferred.includes(c.source))score+=3;return{...c,_score:score,scoreConfidence:Math.max(0,Math.min(1,(score+7)/20)),scoreReasons:reasons}}
function dedupe(items,exclude=[]){const blocked=new Set(exclude),seen=new Set();return items.filter(x=>{const id=x.imageUrl||x.thumbnailUrl||x.sourcePageUrl;if(!id||seen.has(id)||blocked.has(id)||blocked.has(x.sourcePageUrl))return false;seen.add(id);return true})}

function parseVisionJson(raw){
 const text=typeof raw==="string"?raw:(raw?.response||raw?.result||raw?.text||JSON.stringify(raw||{}));
 const block=String(text).match(/\{[\s\S]*\}/);
 if(!block)return null;
 try{return JSON.parse(block[0])}catch{return null}
}
function normalizeVision(v,requestedType){
 if(!v)return null;
 const tm=String(v.title_match||"uncertain").toLowerCase();
 const detected=String(v.score_type||"unknown").toLowerCase();
 const isScore=v.is_score===true||String(v.is_score).toLowerCase()==="true";
 const confidence=Math.max(0,Math.min(1,Number(v.confidence||v.score_confidence||0)));
 const titleConfidence=Math.max(0,Math.min(1,Number(v.title_confidence||0)));
 return{
   is_score:isScore,
   score_type:["chord","staff","numbered","unknown"].includes(detected)?detected:"unknown",
   type_match:detected===requestedType||detected==="unknown",
   visible_title:String(v.visible_title||v.song_title_visible||"").trim(),
   title_match:["yes","no","uncertain"].includes(tm)?tm:"uncertain",
   confidence,title_confidence,
   reason:String(v.reason||"").slice(0,180)
 };
}
async function fetchImageBytes(url){
 const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 WorshipRehearsal/1.0"}});
 if(!r.ok)throw new Error(`image fetch ${r.status}`);
 const ct=r.headers.get("content-type")||"";
 if(!ct.startsWith("image/"))throw new Error("candidate is not an image");
 const buf=await r.arrayBuffer();
 if(buf.byteLength>5_000_000)throw new Error("image too large");
 return [...new Uint8Array(buf)];
}
async function verifyWithVision(env,candidate,type,meta){
 if(!env.AI)return{ok:false,error:"AI binding unavailable",vision:null};
 const imageUrl=candidate.thumbnailUrl||candidate.imageUrl;
 if(!imageUrl)return{ok:false,error:"no image",vision:null};
 try{
   const image=await fetchImageBytes(imageUrl);
   const titles=unique([meta.coreTitle,meta.simplifiedTitle,meta.traditionalTitle,meta.englishTitle]).join(" / ");
   const prompt=`You are verifying a music score search result. Examine the image itself, not only metadata.
Target song titles: ${titles}
Requested score type: ${type}
Return ONLY valid JSON with:
{"is_score":true|false,"score_type":"chord|staff|numbered|unknown","visible_title":"title visible in image or empty","title_match":"yes|no|uncertain","confidence":0.0,"title_confidence":0.0,"reason":"short reason"}
Rules:
- is_score=true only if the image visibly contains musical notation, numbered notation, or a real chord/lyric chart.
- Reject video thumbnails, singer photos, album art, posters, lyric-only images, advertisements, app screenshots, and unrelated documents.
- staff means conventional staff notation with staves/notes.
- numbered means jianpu / numbered musical notation.
- chord means a readable chord chart or lyrics with chord symbols.
- title_match=yes only when visible image text clearly matches one of the target titles (simplified/traditional/English differences are acceptable).
- title_match=no when a different song title is clearly visible.
- title_match=uncertain when no reliable title can be read.
Do not invent invisible text.`;
   const out=await env.AI.run(VISION_MODEL,{image,prompt,max_tokens:256});
   const vision=normalizeVision(parseVisionJson(out),type);
   if(!vision)return{ok:false,error:"vision JSON parse failed",vision:null};
   return{ok:true,vision};
 }catch(error){return{ok:false,error:error.message||"vision failed",vision:null}}
}
function metadataTitleStrong(c,meta){
 const text=toSimplified(` ${c.title||""} ${c.description||""} `).toLowerCase();
 return meta.titleVariants.some(v=>v&&text.includes(toSimplified(v).toLowerCase())) ||
        (meta.englishTitle&&text.includes(meta.englishTitle.toLowerCase()));
}
function acceptVision(candidate,vision,type,meta){
 if(!vision||!vision.is_score)return false;
 if(vision.score_type!=="unknown"&&vision.score_type!==type)return false;
 if(vision.title_match==="no")return false;
 if(vision.title_match==="yes")return vision.confidence>=0.55;
 // If title is unreadable, require strong metadata title match and stronger visual certainty.
 return vision.title_match==="uncertain"&&metadataTitleStrong(candidate,meta)&&vision.confidence>=0.72;
}
async function searchType(env,meta,type,exclude,rejects,preferred,visionVerify=true){
 const query=imageQuery(meta,type),data=await imageSearch(env,query,30);
 let rows=dedupe((data.results||[]).map(x=>normalizeImage(x,type)),exclude).map(x=>scoreCandidate(x,type,meta,rejects,preferred));
 let clean=rows.filter(x=>x._score>=2&&!x.scoreReasons.includes("video-host")&&!x.scoreReasons.includes("video-title"));
 if(clean.length<4)clean=rows.filter(x=>x._score>=0&&!x.scoreReasons.includes("video-host"));
 clean.sort((a,b)=>b._score-a._score);
 if(!visionVerify||!env.AI)return{query,results:clean.slice(0,3).map(({_score,...x})=>({...x,verificationStatus:"heuristic-only"})),visionChecks:0,visionPassed:0,visionErrors:env.AI?[]:["AI binding unavailable"]};

 const accepted=[],errors=[];let checks=0;
 for(const row of clean.slice(0,VISION_MAX_CHECKS_PER_TYPE)){
   if(accepted.length>=VISION_TARGET_RESULTS_PER_TYPE)break;
   checks++;
   const check=await verifyWithVision(env,row,type,meta);
   if(!check.ok){errors.push(check.error);continue}
   const candidate={...row,vision:check.vision,verificationStatus:"vision-checked"};
   if(acceptVision(candidate,check.vision,type,meta))accepted.push(candidate);
 }
 return{query,results:accepted.map(({_score,...x})=>x),visionChecks:checks,visionPassed:accepted.length,visionErrors:errors};
}

export { normalizeTitle, imageQuery };
export default{async fetch(request,env){
 const origin=request.headers.get("Origin")||"";
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
 const url=new URL(request.url);
 if(request.method==="GET"&&url.pathname==="/health")return json({
   ok:true,service:"Worship Search Worker",version:VERSION,
   searchProvider:"Brave Image Search + Workers AI Vision",
   braveConfigured:Boolean(env.BRAVE_API_KEY),visionConfigured:Boolean(env.AI),
   visionModel:VISION_MODEL
 },200,origin);
 if(request.method==="POST"&&url.pathname==="/vision-test"){
   try{
     const body=await request.json();
     if(!body.imageUrl)return json({error:"imageUrl is required"},400,origin);
     const meta=normalizeTitle(body.title||"Amazing Grace");
     const result=await verifyWithVision(env,{thumbnailUrl:body.imageUrl,imageUrl:body.imageUrl},body.scoreType||"staff",meta);
     return json(result,result.ok?200:502,origin);
   }catch(error){return json({error:error.message||"vision test failed"},500,origin)}
 }
 if(request.method==="POST"&&url.pathname==="/search")try{
   const body=await request.json(),meta=normalizeTitle(body.title);
   if(!meta.coreTitle)return json({error:"title is required"},400,origin);
   const types=Array.isArray(body.requestedTypes)&&body.requestedTypes.length?body.requestedTypes.filter(x=>["chord","staff","numbered"].includes(x)):["chord","staff","numbered"];
   const exclude=Array.isArray(body.excludeUrls)?body.excludeUrls:[],rejects=body.sourceRejectCounts&&typeof body.sourceRejectCounts==="object"?body.sourceRejectCounts:{},preferred=Array.isArray(body.preferredSources)?body.preferredSources:[];
   const results={chord:[],staff:[],numbered:[]},queries={},visionErrors=[];let visionChecks=0,visionPassed=0;
   for(const type of types){
     const found=await searchType(env,meta,type,exclude,rejects,preferred,body.visionVerify!==false);
     results[type]=found.results;queries[type]=found.query;visionChecks+=found.visionChecks;visionPassed+=found.visionPassed;
     visionErrors.push(...found.visionErrors.map(e=>`${type}: ${e}`));
   }
   return json({schemaVersion:"1.5",title:meta.coreTitle,titleMeta:meta,results,queries,provider:"Brave Image Search + Workers AI Vision",requestsUsed:types.length,visionChecks,visionPassed,visionErrors:visionErrors.slice(0,6),visionModel:VISION_MODEL,filter:"visual-score-verification-v1"},200,origin)
 }catch(error){return json({error:error.message||"search failed"},500,origin)}
 if(request.method==="POST"&&url.pathname==="/analyze-audio")return json({error:"NOT_IMPLEMENTED",message:"Audio analysis is not implemented in Worker V1.4."},501,origin);
 return json({error:"Not found"},404,origin)
}};