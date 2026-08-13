import { Converter } from "opencc-js";

const VERSION = "1.5.0";
const VISION_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const VISION_MAX_CHECKS_PER_TYPE = 2;
const VISION_TARGET_RESULTS_PER_TYPE = 2;
const SEARCH_DEADLINE_MS = 60000;
const toSimplified = Converter({ from: "tw", to: "cn" });
const toTraditional = Converter({ from: "cn", to: "tw" });
const VIDEO_HOSTS = ["youtube.com","youtu.be","ytimg.com","googlevideo.com","bilibili.com","v.qq.com","youku.com","douyin.com","tiktok.com","ixigua.com"];
const COVER_HOSTS = ["listennotes.com"];
const MUSIC_COVER_HOSTS = ["kkbox.com","spotify.com","music.apple.com","deezer.com","tidal.com","soundcloud.com"];
const COVER_WORDS = ["podcast","album","album art","cover art","demo cover","episode","listen notes","listennotes"];
const SCORE_EVIDENCE_WORDS = ["简谱","簡譜","五线谱","五線譜","和弦谱","和弦譜","歌谱","樂譜","乐谱","sheet music","chord chart","chords","score","numbered notation","jianpu"];
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
 const english=original.match(/[A-Za-z][A-Za-z'’,\- ]{2,60}/g)||[];let core=(chinese[0]||focus).trim().replace(/\s+/g,"");
 core=core.replace(/(?:赞美之泉|讚美之泉|敬拜现场|敬拜現場).*$/u,"").trim()||core;
 const artists=unique([original.match(/讚美之泉|赞美之泉/u)?.[0],original.match(/Stream\s+Of\s+Praise(?:\s+Music\s+Ministries)?/i)?.[0]]);
 if(!bracket&&chinese.length>1&&!artists.length)artists.push(chinese[1].trim());
 const simplified=toSimplified(core),traditional=toTraditional(core),artistVariants=unique(artists.flatMap(a=>[a,toSimplified(a),toTraditional(a)]));
 return{originalTitle:String(raw||"").trim(),coreTitle:core,simplifiedTitle:simplified,traditionalTitle:traditional,englishTitle:(english[0]||"").trim(),artist:artistVariants[0]||"",titleVariants:unique([core,simplified,traditional]),artistVariants};
}
function imageQuery(meta,type){const titles=meta.titleVariants.slice(0,3).map(x=>`"${x}"`).join(" OR "),english=meta.englishTitle?` "${meta.englishTitle}"`:"",artist=meta.artistVariants.slice(0,2).map(x=>`"${x}"`).join(" OR "),terms=type==="staff"?"五线谱 五線譜 乐谱 sheet music":type==="numbered"?"简谱 簡譜 歌谱":"和弦谱 和弦譜 chord chart chords";return`${titles}${english}${artist?` (${artist})`:""} ${terms}`.slice(0,450)}
function timeLeft(deadline,limit){return Math.max(1,Math.min(limit,deadline-Date.now()))}
async function timedFetch(input,init,limit,deadline,label){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeLeft(deadline,limit));try{return await fetch(input,{...init,signal:controller.signal})}catch(error){if(error.name==="AbortError")throw new Error(`${label} timeout`);throw error}finally{clearTimeout(timer)}}
async function withTimeout(promise,limit,deadline,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timeout`)),timeLeft(deadline,limit))})])}finally{clearTimeout(timer)}}
async function imageSearch(env,q,count=30,deadline=Date.now()+10000){if(!env.BRAVE_API_KEY)throw new Error("BRAVE_API_KEY is not configured");const u=new URL("https://api.search.brave.com/res/v1/images/search");u.searchParams.set("q",q);u.searchParams.set("count",String(Math.min(count,50)));u.searchParams.set("country","ALL");u.searchParams.set("safesearch","strict");const r=await timedFetch(u,{headers:{"Accept":"application/json","Accept-Encoding":"gzip","X-Subscription-Token":env.BRAVE_API_KEY}},10000,deadline,"Brave Image Search");if(!r.ok)throw new Error(`Brave Image Search ${r.status}: ${(await withTimeout(r.text(),10000,deadline,"Brave response body")).slice(0,180)}`);return withTimeout(r.json(),10000,deadline,"Brave response body")}
function normalizeImage(x,type){const page=x.url||x.source||"",image=x.properties?.url||"",thumbnail=x.thumbnail?.src||x.thumbnail||x.properties?.placeholder||"";return{scoreType:type,source:host(page),title:x.title||"",sourcePageUrl:page,url:page,imageUrl:image,thumbnailUrl:thumbnail,previewType:"image",description:x.description||"",kind:"image-search",width:Number(x.properties?.width||0),height:Number(x.properties?.height||0)}}
function isVideoHost(value){const h=host(value);return VIDEO_HOSTS.some(x=>h===x||h.endsWith(`.${x}`))}
function isCoverHost(value){const h=host(value);return COVER_HOSTS.some(x=>h===x||h.endsWith(`.${x}`))}
function isMusicCoverHost(value){const h=host(value);return MUSIC_COVER_HOSTS.some(x=>h===x||h.endsWith(`.${x}`))}
function isHardCover(c,text){const ratio=c.width&&c.height?c.width/c.height:0,square=ratio>=.88&&ratio<=1.12,small=Boolean(c.width&&c.height&&c.width<=400&&c.height<=400),medium=Boolean(c.width&&c.height&&Math.max(c.width,c.height)<=600),words=COVER_WORDS.some(w=>text.includes(w)),urls=[c.sourcePageUrl,c.imageUrl,c.thumbnailUrl],coverHost=urls.some(isCoverHost),musicHost=urls.some(isMusicCoverHost),scoreEvidence=SCORE_EVIDENCE_WORDS.some(w=>text.includes(w));return(square&&medium&&words)||(coverHost&&square&&medium)||(square&&small&&musicHost&&!scoreEvidence)}
function scoreCandidate(c,type,meta,rejects={},preferred=[]){const text=` ${c.title||""} ${c.description||""} `.toLowerCase(),source=c.source.toLowerCase(),searchable=toSimplified(text);let score=0,reasons=[];if([c.sourcePageUrl,c.imageUrl,c.thumbnailUrl].some(isVideoHost)){score-=20;reasons.push("hard-video-host")}if(isHardCover(c,text)){score-=20;reasons.push("hard-cover")}if(VIDEO_WORDS.some(w=>text.includes(w))){score-=6;reasons.push("video-title")}if(meta.titleVariants.some(v=>v.length>1&&searchable.includes(toSimplified(v).toLowerCase()))){score+=6;reasons.push("title-match")}if(meta.englishTitle&&text.includes(meta.englishTitle.toLowerCase())){score+=4;reasons.push("english-title")}if(meta.artistVariants.some(v=>searchable.includes(toSimplified(v).toLowerCase()))){score+=2;reasons.push("artist-match")}for(const w of POSITIVE[type])if(searchable.includes(toSimplified(w).toLowerCase())){score+=3;reasons.push("score-term");break}if(/musescore|praisecharts|musicnotes|gangqinpu|poppiano|everyonepiano|jianpu|score|music|piano/.test(source)){score+=2;reasons.push("music-source")}if(c.width&&c.height){const ratio=c.width/c.height;if(ratio>=.5&&ratio<=1.6){score+=3;reasons.push("document-aspect")}if(ratio>1.9)score-=2;if(c.height>=600||c.width>=800)score+=2}score-=Math.min(Number(rejects[c.source]||0)*2,6);if(preferred.includes(c.source))score+=3;return{...c,_score:score,scoreConfidence:Math.max(0,Math.min(1,(score+7)/20)),scoreReasons:reasons}}
function dedupe(items,exclude=[]){const blocked=new Set(exclude),seen=new Set();return items.filter(x=>{const id=x.imageUrl||x.thumbnailUrl||x.sourcePageUrl;if(!id||seen.has(id)||blocked.has(id)||blocked.has(x.sourcePageUrl))return false;seen.add(id);return true})}

function parseVisionJson(raw){
 const choice=raw?.choices?.[0];
 if(choice?.finish_reason!=="stop"||typeof choice?.message?.content!=="string"||!choice.message.content.trim())return null;
 try{
   const value=JSON.parse(choice.message.content);
   if(typeof value.isScore!=="boolean"||!["chord","staff","numbered","unknown"].includes(value.scoreType)||typeof value.confidence!=="number"||value.confidence<0||value.confidence>1||(value.rejectionReason!==null&&typeof value.rejectionReason!=="string"))return null;
   if(value.visibleSongTitle!==null&&typeof value.visibleSongTitle!=="string")return null;
   if(value.titleMatch!==null&&typeof value.titleMatch!=="boolean")return null;
   if(typeof value.titleMatchConfidence!=="number"||value.titleMatchConfidence<0||value.titleMatchConfidence>1)return null;
   return value;
 }catch{return null}
}
function normalizeVision(v,requestedType){
 if(!v)return null;
 const detected=v.scoreType;
 return{
   is_score:v.isScore,
   score_type:detected,
   type_match:detected===requestedType||detected==="unknown",
   confidence:v.confidence,
   reason:String(v.rejectionReason||"").slice(0,180),
   visible_title:v.visibleSongTitle?String(v.visibleSongTitle).slice(0,120):null,
   title_match:v.titleMatch===true?"yes":v.titleMatch===false?"no":"uncertain",
   title_match_confidence:v.titleMatchConfidence
 };
}
function bytesToBase64(bytes){
 let binary="";
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+8192,bytes.length)));
 return btoa(binary);
}
function validateExternalImageUrl(value){
 let url;try{url=new URL(value)}catch{throw new Error("invalid image URL")}
 if(url.protocol!=="https:")throw new Error("image URL must use HTTPS");
 if(url.username||url.password)throw new Error("image URL credentials are not allowed");
 if(url.port&&url.port!=="443")throw new Error("non-standard image URL port");
 const h=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
 if(h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal")||h==="metadata.google.internal")throw new Error("local image host is not allowed");
 if(/^\d+\.\d+\.\d+\.\d+$/.test(h)){
   const p=h.split(".").map(Number),a=p[0],b=p[1];
   if(p.some(x=>x<0||x>255)||a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===198&&(b===18||b===19)))throw new Error("private or reserved image host is not allowed");
 }
 if(h==="::1"||h==="::"||h.startsWith("fc")||h.startsWith("fd")||/^fe[89ab]/.test(h)||h.startsWith("::ffff:"))throw new Error("private or reserved image host is not allowed");
 return url;
}
function validImageMagic(bytes,type){
 if(type==="image/jpeg")return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(type==="image/png")return bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
 if(type==="image/webp")return bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50;
 return false;
}
async function readValidatedImage(response,type,deadline){
 const declared=Number(response.headers.get("content-length")||0);if(declared>5_000_000)throw new Error("image too large");
 if(!response.body)throw new Error("image response has no body");
 const reader=response.body.getReader(),chunks=[];let total=0;
 for(;;){const {done,value:chunk}=await withTimeout(reader.read(),5000,deadline,"image body");if(done)break;total+=chunk.byteLength;if(total>5_000_000){await reader.cancel();throw new Error("image too large")}chunks.push(chunk)}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 if(!validImageMagic(bytes,type))throw new Error("image signature does not match Content-Type");
 return bytes;
}
async function fetchImageDataUrl(value,deadline){
 let url=validateExternalImageUrl(value);
 for(let redirects=0;redirects<=2;redirects++){
   {
     const r=await timedFetch(url,{redirect:"manual",headers:{"Accept":"image/jpeg,image/png,image/webp,image/gif","User-Agent":"WorshipRehearsal/1.0"}},5000,deadline,"image fetch");
     if([301,302,303,307,308].includes(r.status)){
       if(redirects===2)throw new Error("too many image redirects");
       const location=r.headers.get("location");if(!location)throw new Error("image redirect has no location");
       url=validateExternalImageUrl(new URL(location,url).href);continue;
     }
     if(!r.ok)throw new Error(`image fetch ${r.status}`);
     let type=(r.headers.get("content-type")||"").split(";",1)[0].trim().toLowerCase(),bytes,gifConverted=false;
     if(type==="image/gif"){
       const converted=await timedFetch(url,{cf:{image:{anim:false,format:"jpeg",fit:"scale-down"}}},8000,deadline,"GIF conversion");
       if(!converted.ok)throw new Error(`GIF conversion ${converted.status}`);
       type=(converted.headers.get("content-type")||"").split(";",1)[0].trim().toLowerCase();
       if(type!=="image/jpeg")throw new Error(`GIF conversion returned ${type||"missing type"}`);
       bytes=await readValidatedImage(converted,type,deadline);gifConverted=true;
     }else{
       if(!["image/jpeg","image/png","image/webp"].includes(type))throw new Error(`unsupported image type: ${type||"missing"}`);
       bytes=await readValidatedImage(r,type,deadline);
     }
     return{dataUrl:`data:${type};base64,${bytesToBase64(bytes)}`,gifConverted};
   }
 }
 throw new Error("image fetch failed");
}
async function verifyWithVision(env,candidate,type,meta,deadline=Date.now()+SEARCH_DEADLINE_MS){
 if(!env.AI)return{ok:false,error:"AI binding unavailable",vision:null};
 const imageUrls=unique([candidate.imageUrl,candidate.thumbnailUrl]);
 if(!imageUrls.length)return{ok:false,error:"no image",vision:null,fetchFailed:true};
 try{
   let imageData,fetchError;
   for(const imageUrl of imageUrls){if(Date.now()>=deadline)break;try{imageData=await fetchImageDataUrl(imageUrl,deadline);break}catch(error){fetchError=error}}
   if(!imageData)return{ok:false,error:`image unavailable: ${fetchError?.message||"fetch failed"}`,vision:null,fetchFailed:true,gifConverted:false};
   const titles=unique([meta.coreTitle,meta.simplifiedTitle,meta.traditionalTitle,meta.englishTitle]).join(" / ");
   const artists=unique(meta.artistVariants||[]).join(" / ")||"unknown";
   const prompt=`You are verifying a music score search result. Examine the image itself, not only metadata.
Target song titles: ${titles}
Target artist or ministry: ${artists}
Requested score type: ${type}
Rules:
- isScore=true only if the image visibly contains musical notation, numbered notation, or a real chord/lyric chart.
- Reject video thumbnails, singer photos, album art, posters, lyric-only images, advertisements, app screenshots, and unrelated documents.
- staff means conventional staff notation with staves/notes.
- numbered means jianpu / numbered musical notation.
- chord means a readable chord chart or lyrics with chord symbols.
- visibleSongTitle must be the song title actually readable in the image, or null when it cannot be read.
- titleMatch=true only when the visible song title matches a target title (including simplified/traditional variants or the English title).
- titleMatch=false when the image clearly shows a different song title. Shared generic words alone are not a match.
- titleMatch=null when the title is absent, cropped, blurred, or otherwise unreadable. Do not guess invisible text from metadata.
- Use the artist only as supporting evidence, never as a substitute for the song title.
Keep rejectionReason null when accepted.`;
   const out=await withTimeout(env.AI.run(VISION_MODEL,{
     messages:[{role:"user",content:[
       {type:"text",text:prompt},
       {type:"image_url",image_url:{url:imageData.dataUrl}}
     ]}],
     temperature:0,
     max_completion_tokens:160,
     chat_template_kwargs:{enable_thinking:false},
     response_format:{type:"json_schema",json_schema:{name:"score_verification",strict:true,schema:{type:"object",additionalProperties:false,properties:{isScore:{type:"boolean"},scoreType:{type:"string",enum:["chord","staff","numbered","unknown"]},confidence:{type:"number",minimum:0,maximum:1},rejectionReason:{type:["string","null"]},visibleSongTitle:{type:["string","null"]},titleMatch:{type:["boolean","null"]},titleMatchConfidence:{type:"number",minimum:0,maximum:1}},required:["isScore","scoreType","confidence","rejectionReason","visibleSongTitle","titleMatch","titleMatchConfidence"]}}}
   }),12000,deadline,"Vision");
   const vision=normalizeVision(parseVisionJson(out),type);
   if(!vision)return{ok:false,error:"vision JSON parse failed",vision:null};
   return{ok:true,vision,gifConverted:imageData.gifConverted};
 }catch(error){return{ok:false,error:error.message||"vision failed",vision:null}}
}
function metadataTitleStrong(c,meta){
 const compact=value=>toSimplified(String(value||"")).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"");
 const text=compact(`${c.title||""} ${c.description||""}`),targets=unique(meta.titleVariants).map(compact).filter(x=>x.length>=4);
 if(targets.some(target=>text.includes(target)))return true;
 const english=compact(meta.englishTitle);
 return english.length>=5&&text.includes(english);
}
function acceptVision(candidate,vision,type,meta){
 if(!vision)return false;
 if(vision.title_match==="no"&&vision.title_match_confidence>=0.75)return false;
 if(!vision.is_score)return false;
 if(vision.score_type!=="unknown"&&vision.score_type!==type)return vision.confidence<0.75&&metadataTitleStrong(candidate,meta);
 return true;
}
async function searchType(env,meta,type,exclude,rejects,preferred,visionVerify=true,deadline=Date.now()+SEARCH_DEADLINE_MS){
 const query=imageQuery(meta,type),data=await imageSearch(env,query,30,deadline);
 let rows=dedupe((data.results||[]).map(x=>normalizeImage(x,type)),exclude).map(x=>scoreCandidate(x,type,meta,rejects,preferred));
 const hardRejected=x=>x.scoreReasons.includes("hard-video-host")||x.scoreReasons.includes("hard-cover");
 let clean=rows.filter(x=>x._score>=2&&!hardRejected(x)&&!x.scoreReasons.includes("video-title"));
 if(clean.length<4)clean=rows.filter(x=>x._score>=0&&!hardRejected(x));
 clean.sort((a,b)=>b._score-a._score);
 if(!visionVerify||!env.AI)return{query,results:clean.slice(0,3).map(({_score,...x})=>({...x,verificationStatus:"heuristic-only"})),visionChecks:0,visionPassed:0,visionErrors:env.AI?[]:["AI binding unavailable"]};

 const accepted=[],errors=[],seen=new Set();let checks=0,passed=0,gifConversions=0,visionTimeouts=0,imageFetchTimeouts=0;
 for(const row of clean.slice(0,VISION_MAX_CHECKS_PER_TYPE)){
   if(accepted.length>=VISION_TARGET_RESULTS_PER_TYPE||Date.now()>=deadline-1000)break;
   checks++;
   const check=await verifyWithVision(env,row,type,meta,deadline);
   if(check.gifConverted)gifConversions++;
   seen.add(row);
   if(!check.ok){errors.push(check.error);if(/Vision timeout/.test(check.error))visionTimeouts++;if(/(?:image|GIF conversion).*timeout/i.test(check.error))imageFetchTimeouts++;accepted.push({...row,verificationStatus:check.fetchFailed?"vision-fetch-failed":"vision-unavailable"});continue}
   const candidate={...row,vision:check.vision,verificationStatus:"vision-checked"};
   if(acceptVision(candidate,check.vision,type,meta)){accepted.push(candidate);passed++}
   else if(!check.vision.is_score)errors.push(`hard-not-score: ${check.vision.reason||"not a score"}`)
   else if(check.vision.title_match==="no"&&check.vision.title_match_confidence>=0.75)errors.push(`hard-song-mismatch: ${check.vision.visible_title||"different visible title"}`)
 }
 for(const row of clean)if(accepted.length<3&&!seen.has(row)&&metadataTitleStrong(row,meta))accepted.push({...row,verificationStatus:"heuristic-only"});
 return{query,results:accepted.slice(0,3).map(({_score,...x})=>x),visionChecks:checks,visionPassed:passed,gifConversions,visionTimeouts,imageFetchTimeouts,hardVideoRejects:rows.filter(x=>x.scoreReasons.includes("hard-video-host")).length,visionErrors:errors};
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
   const startedAt=Date.now(),deadline=startedAt+SEARCH_DEADLINE_MS,results={chord:[],staff:[],numbered:[]},queries={},visionErrors=[];let visionChecks=0,visionPassed=0,gifConversions=0,visionTimeouts=0,imageFetchTimeouts=0,hardVideoRejects=0,requestsUsed=0;
   for(const type of types){
     if(Date.now()>=deadline)break;
     const found=await searchType(env,meta,type,exclude,rejects,preferred,body.visionVerify!==false,deadline);requestsUsed++;
     results[type]=found.results;queries[type]=found.query;visionChecks+=found.visionChecks;visionPassed+=found.visionPassed;
     gifConversions+=found.gifConversions||0;
     visionTimeouts+=found.visionTimeouts||0;imageFetchTimeouts+=found.imageFetchTimeouts||0;hardVideoRejects+=found.hardVideoRejects||0;
     visionErrors.push(...found.visionErrors.map(e=>`${type}: ${e}`));
   }
   return json({schemaVersion:"1.6",title:meta.coreTitle,titleMeta:meta,results,queries,provider:"Brave Image Search + Workers AI Vision",requestsUsed,elapsedMs:Date.now()-startedAt,deadlineReached:Date.now()>=deadline,visionChecks,visionPassed,visionTimeouts,imageFetchTimeouts,gifConversions,hardVideoRejects,visionErrors:visionErrors.slice(0,6),visionModel:VISION_MODEL,filter:"visual-score-and-song-verification-v2"},200,origin)
 }catch(error){return json({error:error.message||"search failed"},500,origin)}
 if(request.method==="POST"&&url.pathname==="/analyze-audio")return json({error:"NOT_IMPLEMENTED",message:"Audio analysis is not implemented in Worker V1.4."},501,origin);
 return json({error:"Not found"},404,origin)
}};
