const $=(s,r=document)=>r.querySelector(s);

/* NAVBAR */
const setMenu=o=>{$("#menu").classList.toggle("open",o);$("#burger").setAttribute("aria-expanded",o)};
$("#burger").onclick=()=>setMenu(!$("#menu").classList.contains("open"));
$("#menu").onclick=e=>{if(e.target.tagName==="A")setMenu(false)};
const reduceMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const UI=()=>window.MOE3D&&MOE3D.ui||null, ARCH=()=>window.MOE3D&&MOE3D.archive||null;
// the new visual layer is optional: if it throws, the site keeps working with the plain fallbacks below
const guard=(f,d)=>{try{return f()}catch(e){console.error(e);return d}};
guard(()=>{ARCH()&&ARCH().sync("load")});
// the Traveller's journal remembers every legend entered (and the Archivist's compass turns toward it)
const noteVisit=k=>guard(()=>{window.MOE3D&&MOE3D.traveller&&MOE3D.traveller.visit(k);dispatchEvent(new CustomEvent("moe:select",{detail:{legend:k}}))});   // old saves unlock their relics here (no fake animation)

/* ============ LEGENDS (collectible cards that open the branching stories / 3D adventures) ============ */
const cards=$("#cards");
const hasAdv=k=>!!(window.MOE3D&&MOE3D.adventures&&MOE3D.adventures[k]);
Object.entries(LEGENDS).forEach(([k,l])=>{
  let b=UI()?guard(()=>UI().legendCard(k,l,{hasAdv:hasAdv(k)}),null):null;
  if(!b){ // plain fallback card (also used if the 3D bundle did not load)
    b=document.createElement("button");b.className="card";b.style.setProperty("--c",l.color);b.dataset.legend=k;
    b.innerHTML=`<span class="art" aria-hidden="true">${l.emoji}</span><small>${l.mapLabel||l.place}</small><h3>${l.title}</h3><p>${l.desc}</p>`+(hasAdv(k)?'<span class="play">▶ Play the 3D adventure</span>':'');
  }
  b.onclick=()=>openLegend(k,b);cards.append(b);
});
guard(()=>UI()&&UI().staggerIn(cards));
const refreshCards=()=>guard(()=>{cards.querySelectorAll(".card.cf").forEach(c=>UI().refreshLegendCard(c));updatePins();dispatchEvent(new Event("moe:cards-refreshed"))});
// a legend with a 3D adventure opens the adventure; the others open the short branching text story.
// Entering a legend plays a short cinematic curtain (any key / click skips it).
let entering=false,NAV=null,navClosing=false,storyKey=null;
function openLegend(k,origin){
  if(NAV){NAV.go({type:"legend",id:k},{origin});return}   // the cinematic navigation opens it (portal, history, back button)
  if(entering||advCur)return;
  const L=LEGENDS[k],U=UI();guard(()=>ARCH()&&ARCH().markOpened(k));noteVisit(k);
  const go=()=>hasAdv(k)?openAdventure(k):openStory(k);
  if(!U||!L){go();return}
  entering=true;
  const meta=guard(()=>ARCH().LEGENDS[k],null);
  U.curtain({kicker:meta?meta.place:L.place,title:L.title,sub:meta?meta.era:"",color:meta?meta.color:L.color}).then(c=>{entering=false;go();c.release()},()=>{entering=false;go()});
}
const dlg=$("#story");
function openStory(k){const l=LEGENDS[k],U=UI();storyKey=k;$("#st-title").textContent=l.title;
  $("#st-art").innerHTML=U?guard(()=>U.sceneSVG(k),""):"";$("#st-kicker").textContent=l.mapLabel||l.place;$("#story .story-box").style.setProperty("--cc",l.color);
  guard(()=>U&&U.storyExtras(k,$("#story .story-box")));node(k,l.start);if(!dlg.open)dlg.showModal()}
function node(k,id){
  const n=LEGENDS[k].nodes[id];$("#st-text").textContent=n.t;const box=$("#st-choices");box.innerHTML="";
  n.c.forEach(([lab,next])=>{const b=document.createElement("button");b.textContent=lab;b.onclick=()=>node(k,next);box.append(b)});
  if(!n.c.length){
    const r=document.createElement("button");r.textContent="Replay the story";r.onclick=()=>node(k,LEGENDS[k].start);box.append(r);
    // a real ending of a text story: record it in the Archive (only legends with relics tied to text endings are recorded)
    guard(()=>{const A=ARCH();if(!A)return;const fresh=A.recordTextEnding(k,id),card=A.cardForText(k,id);
      if(card&&A.isUnlocked(card.id)){const ab=document.createElement("button");ab.className="relic-btn";ab.textContent="Relic: "+card.name+" · view the Archive";ab.onclick=goArchive;box.append(ab)}
      if(fresh.length)setTimeout(()=>{if(dlg.open)UI().reveal(fresh,{openArchive:goArchive})},900)});
  }
}
// "View the Archive": close whatever is open and glide to the section
function goArchive(){
  if(NAV){NAV.go("#archivio");return}
  if(advCur)closeAdventure();if(dlg.open)dlg.close();
  setTimeout(()=>{const t=document.getElementById("archivio");if(t)t.scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"start"})},60);
}
addEventListener("moe:open-archive",goArchive);
$("#close").onclick=()=>dlg.close();
dlg.addEventListener("close",()=>{const k=storyKey;storyKey=null;if(NAV&&!navClosing&&NAV.overlay&&NAV.overlay.type==="legend"&&k)NAV.closeOverlay({already:true})});
dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close()});

/* ============ 2D MAP (SVG built from Natural Earth data in js/geo-data.js) ============ */
const NS="http://www.w3.org/2000/svg",W=GEO.view.w,H=GEO.view.h;
const svg=$("#map"),wrap=$("#mapwrap"),tip=$("#tip"),pv=$("#preview");
svg.removeAttribute("preserveAspectRatio");
const mk=(tag,at,parent)=>{const e=document.createElementNS(NS,tag);for(const k in at)e.setAttribute(k,at[k]);if(parent)parent.append(e);return e};
const flat=(rings)=>rings.map(r=>{let s="M"+r[0]+" "+r[1];for(let i=2;i<r.length;i+=2)s+="L"+r[i]+" "+r[i+1];return s+"Z"}).join("");
const ringArea=r=>{let a=0;for(let i=0,n=r.length/2;i<n;i++){const j=(i+1)%n;a+=r[2*i]*r[2*j+1]-r[2*j]*r[2*i+1]}return Math.abs(a/2)};
const byCode=Object.fromEntries(COUNTRIES.map(c=>[c[0],c]));
const extraBy=Object.fromEntries(GEO.extra.map(c=>[c.c,c]));
const legendOf=code=>(byCode[code]&&byCode[code][6])?byCode[code][6].split(","):(typeof EXTRA_LEGENDS!=="undefined"&&EXTRA_LEGENDS[code])?EXTRA_LEGENDS[code].legends.split(","):[];

mk("rect",{width:W,height:H,class:"sea"},svg);
const gGrat=mk("g",{class:"grat"},svg);
GEO.grat.forEach(l=>mk("path",{d:flat([l]).replace(/Z$/,"")},gGrat));
const gLand=mk("g",{class:"land"},svg),gLab=mk("g",{class:"labels"},svg),gPin=mk("g",{class:"pins"},svg);
const paths={},boxes={};
GEO.countries.forEach(c=>{
  const code=c.c,type=!code?"w":byCode[code]?"p":"x";
  const p=mk("path",{d:flat(c.polys.flat()),class:type+(legendOf(code).length?" leg":""),"fill-rule":"evenodd"},gLand);
  if(code){
    p.dataset.c=code;p.dataset.n=byCode[code]?byCode[code][1]:extraBy[code].n;
    p.setAttribute("tabindex","0");p.setAttribute("role","button");p.setAttribute("aria-label",p.dataset.n);
    paths[code]=p;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,big=0;
    c.polys.forEach(po=>{big=Math.max(big,ringArea(po[0]));for(let i=0;i<po[0].length;i+=2){x0=Math.min(x0,po[0][i]);x1=Math.max(x1,po[0][i]);y0=Math.min(y0,po[0][i+1]);y1=Math.max(y1,po[0][i+1])}});
    boxes[code]={x0,y0,x1,y1};
    const t=mk("text",{x:c.ctr[0],y:c.ctr[1],class:"lab "+type},gLab);t.textContent=code;t.dataset.a=big;
  }
});
// legend pins (clickable); a legend may carry a map label for its historical setting (Čachtice: Slovakia, then the Kingdom of Hungary)
const pinName=k=>LEGENDS[k].title+(LEGENDS[k].mapLabel?" — "+LEGENDS[k].mapLabel:"");
const pinEls={};
const updatePins=()=>guard(()=>{const A=ARCH();if(!A)return;for(const k in pinEls){const st=A.legendStatus(k);pinEls[k].classList.toggle("done",st.found>0);
  pinEls[k].setAttribute("aria-label","Legend: "+pinName(k)+(st.found>0?" (completed, "+st.found+" of "+st.total+" endings)":""))}});
Object.entries(GEO.pins.leg).forEach(([k,xy])=>{
  if(!xy||!LEGENDS[k])return;
  const g=mk("g",{class:"pin",transform:`translate(${xy[0]} ${xy[1]})`,tabindex:0,role:"button","aria-label":"Legend: "+pinName(k)},gPin);
  mk("circle",{r:16,class:"pulse"},g);mk("circle",{r:6,class:"dot"},g);
  pinEls[k]=g;g.dataset.legend=k;
  const go=()=>{openLegend(k,g);globe&&globe.legend(k)};
  g.addEventListener("click",e=>{if(!moved){e.stopPropagation();go()}});g.addEventListener("keydown",e=>{if(e.key==="Enter")go()});
  g.addEventListener("mouseenter",()=>showTip(pinName(k),g));g.addEventListener("mouseleave",hideTip);
});
const capDot=mk("circle",{r:6,class:"cap",visibility:"hidden"},gPin);
// the valley of the landing page is on the map too: the castle stands in the Harz (the reference place of its sky)
guard(()=>{const hp=MOE3D.nav.mapPoint(10.6156,51.7991),h=mk("g",{class:"home",transform:`translate(${hp[0]} ${hp[1]})`,tabindex:0,role:"button","aria-label":"The Archive's valley in the Harz Mountains: back to the castle"},gPin);
  mk("circle",{r:13,class:"halo"},h);mk("path",{d:"M-7 7V-2h-2.2v-5h2.6v2.2h2.4v-3.4h2.2v-3.2h4v3.2h2.2v3.4h2.4V-7h2.6v5H7v9z"},h);
  const goHome=()=>{NAV?NAV.go("#intro",{origin:h}):scrollTo(0,0)};
  h.addEventListener("click",e=>{if(!moved){e.stopPropagation();goHome()}});h.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();goHome()}});
  h.addEventListener("mouseenter",()=>showTip("The Archive's valley · Harz",h));h.addEventListener("mouseleave",hideTip)});

/* --- view (zoom/pan) --- */
let vb={x:0,y:0,w:W};const vh=()=>vb.w*H/W;
function clampVB(){vb.w=Math.max(W/10,Math.min(W,vb.w));vb.x=Math.max(0,Math.min(W-vb.w,vb.x));vb.y=Math.max(0,Math.min(H-vh(),vb.y))}
function applyVB(){clampVB();svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vh()}`);const z=W/vb.w;svg.style.setProperty("--z",z);svg.style.setProperty("--u",vb.w/(svg.clientWidth||W));
  wrap.classList.toggle("zoomed",vb.w<W*.98);gLab.querySelectorAll("text").forEach(t=>t.classList.toggle("off",t.dataset.a*z*z<2600))}
function zoomAt(f,cx,cy){ // cx,cy in svg units
  const nw=Math.max(W/10,Math.min(W,vb.w/f)),k=nw/vb.w;vb.x=cx-(cx-vb.x)*k;vb.y=cy-(cy-vb.y)*k;vb.w=nw;applyVB()}
const toUnits=e=>{const r=svg.getBoundingClientRect();return[vb.x+(e.clientX-r.left)/r.width*vb.w,vb.y+(e.clientY-r.top)/r.height*vh()]};
let anim=0;
function animateTo(t,ms=550){cancelAnimationFrame(anim);const a={...vb},t0=performance.now();
  const step=n=>{const k=Math.min(1,(n-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;vb.x=a.x+(t.x-a.x)*e;vb.y=a.y+(t.y-a.y)*e;vb.w=a.w+(t.w-a.w)*e;applyVB();if(k<1)anim=requestAnimationFrame(step)};
  matchMedia("(prefers-reduced-motion: reduce)").matches?(Object.assign(vb,t),applyVB()):anim=requestAnimationFrame(step)}
function focusOn(code){const b=boxes[code];if(!b)return;const bw=b.x1-b.x0,bh=b.y1-b.y0;
  let w=Math.max(bw*1.9,(bh*1.9)*W/H,W/4.5);w=Math.min(w,W);const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  animateTo({w,x:Math.max(0,Math.min(W-w,cx-w/2)),y:Math.max(0,Math.min(H-w*H/W,cy-w*H/W/2))})}
$("#zin").onclick=()=>zoomAt(1.6,vb.x+vb.w/2,vb.y+vh()/2);$("#zout").onclick=()=>zoomAt(1/1.6,vb.x+vb.w/2,vb.y+vh()/2);$("#zrst").onclick=()=>animateTo({x:0,y:0,w:W});
let engaged=false;svg.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse")engaged=false});
svg.addEventListener("wheel",e=>{if(!(engaged||e.ctrlKey||e.metaKey))return; // otherwise let the page scroll
  e.preventDefault();const[cx,cy]=toUnits(e);zoomAt(Math.exp(-e.deltaY*.0016),cx,cy)},{passive:false});
const ptrs=new Map();let moved=false,startPt=null,pinch=0;
svg.addEventListener("pointerdown",e=>{engaged=true;ptrs.set(e.pointerId,[e.clientX,e.clientY]);moved=false;startPt=[e.clientX,e.clientY];cancelAnimationFrame(anim);if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1])}});
svg.addEventListener("pointermove",e=>{
  if(!ptrs.has(e.pointerId))return;const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(!moved&&Math.hypot(e.clientX-startPt[0],e.clientY-startPt[1])>6){moved=true;try{svg.setPointerCapture(e.pointerId)}catch(_){}hideTip()}
  if(!moved)return;const r=svg.getBoundingClientRect();
  if(ptrs.size===2){const[a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch){const[cx,cy]=toUnits({clientX:(a[0]+b[0])/2,clientY:(a[1]+b[1])/2});zoomAt(d/pinch,cx,cy)}pinch=d}
  else{vb.x-=(e.clientX-prev[0])/r.width*vb.w;vb.y-=(e.clientY-prev[1])/r.height*vh();applyVB()}});
const up=e=>{ptrs.delete(e.pointerId);pinch=0;setTimeout(()=>{if(!ptrs.size)moved=false},0)};svg.addEventListener("pointerup",up);svg.addEventListener("pointercancel",up);

/* --- tooltip --- */
function showTip(txt,target){const r=wrap.getBoundingClientRect(),t=target.getBoundingClientRect();tip.textContent=txt;tip.style.left=(t.left+t.width/2-r.left)+"px";tip.style.top=(t.top-r.top-8)+"px";tip.classList.add("on")}
function hideTip(){tip.classList.remove("on")}
gLand.addEventListener("pointermove",e=>{if(e.pointerType==="touch"||moved)return;const p=e.target.closest("path");if(!p||!p.dataset.c){hideTip();return}
  const r=wrap.getBoundingClientRect();tip.textContent=p.dataset.n;tip.style.left=(e.clientX-r.left)+"px";tip.style.top=(e.clientY-r.top-14)+"px";tip.classList.add("on")});
gLand.addEventListener("pointerleave",hideTip);

/* --- selection --- */
let current=null,globe=null,globePending=null;
function select(code,{focus=true}={}){
  if(current&&paths[current])paths[current].classList.remove("on");current=code;const p=paths[code];if(!p)return;
  p.classList.add("on");gLand.append(p); // bring to front so the outline is not hidden
  const cap=GEO.pins.cap[code];if(cap){capDot.setAttribute("cx",cap[0]);capDot.setAttribute("cy",cap[1]);capDot.setAttribute("visibility","visible")}else capDot.setAttribute("visibility","hidden");
  const c=byCode[code];pv.textContent="";
  const h=document.createElement("b");h.textContent=p.dataset.n;pv.append(h,document.createElement("br"));
  const info=document.createElement("span");
  if(c){info.textContent=`Capital: ${c[2]}. ${c[5]}`}else{const x=extraBy[code],xl=typeof EXTRA_LEGENDS!=="undefined"&&EXTRA_LEGENDS[code];info.textContent=xl?`Capital: ${x.cap}. ${xl.note}`:`Capital: ${x.cap}. Not part of our project yet: a legend could be added here!`}
  pv.append(info,document.createElement("br"));
  legendOf(code).forEach(k=>{const bt=document.createElement("button"),U=UI();
    if(U){bt.className="mini";bt.style.setProperty("--cc",LEGENDS[k].color);
      const art=document.createElement("span");art.className="mini-art";art.setAttribute("aria-hidden","true");art.innerHTML=guard(()=>U.sceneSVG(k),"");
      const tx=document.createElement("span"),b2=document.createElement("b"),sm=document.createElement("small");b2.textContent=LEGENDS[k].title;sm.textContent=hasAdv(k)?"Play the 3D adventure":"Read the short story";tx.append(b2,sm);bt.append(art,tx);
    }else bt.textContent=(hasAdv(k)?"Play: ":"Legend: ")+LEGENDS[k].title;
    bt.onclick=()=>{const pin=pinEls[k];openLegend(k,pin||bt);globe&&globe.legend(k)};pv.append(bt)});
  guard(()=>{window.MOE3D&&MOE3D.traveller&&MOE3D.traveller.explore(code,p.dataset.n);dispatchEvent(new CustomEvent("moe:select",{detail:{country:code,name:p.dataset.n,legends:legendOf(code)}}))});
  if(focus)focusOn(code);
  if(globe)globe.select(code);else globePending=code;
}
gLand.addEventListener("click",e=>{if(moved)return;const p=e.target.closest("path");if(p&&p.dataset.c)select(p.dataset.c)});
gLand.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){const p=e.target.closest("path");if(p&&p.dataset.c){e.preventDefault();select(p.dataset.c)}}});
applyVB();addEventListener("resize",applyVB);

/* ============ lazy 3D (globe + games start only when scrolled into view) ============ */
const onView=(el,cb,margin="200px")=>{const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){io.disconnect();cb()}},{rootMargin:margin});io.observe(el)};
const have3D=()=>window.MOE3D;
onView($("#globe"),()=>{if(!have3D())return;globe=MOE3D.createGlobe($("#globe"),GEO);if(globe&&globePending)globe.select(globePending)});

/* ============ 3D GAMES ============ */
const stage=$("#stage3d"),HELP={
  runner:"Run through the gate with the right answer. ← → / A D, swipe or tap the sides.",
  letters:"Click the floating rune cubes in the right order to spell the word. Click a placed rune to take it back.",
  map3d:"Drag to rotate, scroll or pinch to zoom, then click the country that has the capital shown.",
  forest:"W A S D to walk, Shift to run, drag or ← → to look. Follow the green beams, avoid the wraiths."};
let cur=null,curName=null,started=false;
function launch(name){
  if(!have3D()){stage.textContent="3D engine not loaded.";return}
  if(cur){cur.dispose();cur=null}stage.innerHTML="";curName=name;$("#ghelp").textContent=HELP[name];
  cur=MOE3D.games[name](stage,{QUIZ,WORDS,COUNTRIES,GEO,restart:()=>launch(name)});
}
$("#tabs").onclick=e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll("#tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));launch(b.dataset.g)};
onView($("#stage3d"),()=>{started=true;launch("runner")},"100px");
let muted=false;$("#gmute").onclick=e=>{muted=!muted;if(have3D())MOE3D.setMuted(muted);e.currentTarget.textContent=muted?"🔇 Sound off":"🔊 Sound on";e.currentTarget.setAttribute("aria-pressed",muted)};
$("#gfull").onclick=()=>{const t=$(".arcade3d");(document.fullscreenElement?document.exitFullscreen():(t.requestFullscreen||t.webkitRequestFullscreen||(()=>{})).call(t))};

/* ============ 3D NARRATIVE ADVENTURES (full-screen overlay, own WebGL context) ============ */
const advEl=$("#adv"),pageParts=[$("#nav"),$("main"),$("footer")];
let advCur=null,advScroll=0,advKey=null,advRelaunch=false;
function openAdventure(k){
  if(advCur||!hasAdv(k)){if(!hasAdv(k))openStory(k);return}
  if(dlg.open)dlg.close();
  advScroll=scrollY;advKey=k;advRelaunch=!!(started&&cur);
  if(cur){cur.dispose();cur=null;stage.innerHTML=""}   // free the GPU: only one 3D scene at a time besides the globe
  pageParts.forEach(e=>e.style.display="none");        // the page behind pauses (hidden elements are not rendered)
  document.body.classList.add("adv-open");advEl.hidden=false;advEl.innerHTML="";guard(()=>UI()&&UI().pauseAmbient(true));
  const finish=()=>{if(NAV&&NAV.overlay&&NAV.overlay.type==="legend")NAV.closeOverlay();else closeAdventure()};
  try{
    advCur=MOE3D.adventures[k](advEl,{onExit:finish,onText:()=>{closeAdventure();openStory(k)}});
  }catch(err){console.error(err);advEl.innerHTML='<div class="adv-overlay"><div class="adv-card small"><h3>Could not start the adventure</h3><p></p><div class="actions"><button class="primary" id="adv-bail">Back</button></div></div></div>';advEl.querySelector(".adv-card p").textContent=String(err&&err.message||err);$("#adv-bail").onclick=finish}
}
function closeAdventure(){
  if(advEl.hidden&&!advCur)return;
  try{advCur&&advCur.dispose()}catch(e){console.error(e)}advCur=null;
  advEl.hidden=true;advEl.innerHTML="";document.body.classList.remove("adv-open");guard(()=>UI()&&UI().pauseAmbient(false));
  pageParts.forEach(e=>e.style.display="");
  document.documentElement.style.scrollBehavior="auto";scrollTo(0,advScroll);document.documentElement.style.scrollBehavior="";
  applyVB();if(advRelaunch&&curName)launch(curName);
  const c=advKey&&document.querySelector('.card[data-legend="'+advKey+'"]');if(c)c.focus({preventScroll:true});advKey=null;
  refreshCards();   // endings reached while playing are shown at once (card states, pins, Archive)
  document.body.classList.add("returning");setTimeout(()=>document.body.classList.remove("returning"),900);   // short fade back to the site
}
// deep link: index.html?play=woolpit, ?play=skye, ?play=hoia, ?play=babayaga, ?play=sibilla or ?play=bathory (also #legend/woolpit, handled by the navigation below)
{const p=new URLSearchParams(location.search).get("play");if(p&&LEGENDS[p])addEventListener("load",()=>setTimeout(()=>openLegend(p),50))}


/* ============ CINEMATIC LAYER: hero, header, reveal-on-scroll, sound controls, the Archive ============ */
guard(()=>{
  const U=UI();if(!U)return;
  U.initHero($("#intro"));U.initNav();U.initSound();
  U.initArchive($("#archivio"),{openLegend:k=>{if(NAV)openLegend(k,document.querySelector('.card[data-legend="'+k+'"]'));else{dlgCloseAll();openLegend(k)}globe&&globe.legend(k)},openArchive:goArchive});
  guard(()=>U.initJournal($("#journal")));   // the Archivist's journal of sightings in the valley
  // the Archivist's desk: bookmarks, seals, the shelf (Traveller's Journal, Bestiary), compasses, candles, dust, quotes
  guard(()=>U.initExtras({hero:$("#intro"),legends:$("#leggende"),cards,map:$("#mappe"),archive:$("#archivio"),
    openLegend:k=>{if(NAV)openLegend(k,document.querySelector('.card[data-legend="'+k+'"]'));else{dlgCloseAll();openLegend(k)}globe&&globe.legend(k)},
    go:h=>{const r=NAV&&MOE3D.nav.parseHash(h);if(r)NAV.go(r);else location.hash=h}}));
  U.initReveal();updatePins();
  guard(()=>U.initPageSky({hero:$("#intro"),cards}));   // the night sky behind every section, and the legends' constellations
  window.MOE3D.archive.onChange(()=>refreshCards());
});
function dlgCloseAll(){document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch(e){}})}


/* ============ CINEMATIC NAVIGATION: every move between sections and overlays is a journey (src/nav/) ============ */
guard(()=>{
  if(!window.MOE3D||!MOE3D.nav||/[?&]nav=0/.test(location.search))return;   // ?nav=0: plain navigation (development aid)
  const N=MOE3D.nav,SEC=N.SECTIONS,secEl=id=>document.getElementById(id);
  const sectionY=id=>{const e=secEl(id);if(!e||id==="intro")return 0;return Math.max(0,Math.round(e.getBoundingClientRect().top+scrollY-64))};
  const instantScroll=y=>{const r=document.documentElement;r.style.scrollBehavior="auto";scrollTo(0,y);r.style.scrollBehavior=""};
  const host={
    sectionY, scrollTo:instantScroll,
    currentSection(){let cur="intro";for(const id of SEC){const e=secEl(id);if(e&&e.getBoundingClientRect().top<=innerHeight*.42)cur=id}return cur},
    heroReady(){const h=MOE3D.hero;return !!(h&&h.isReady&&h.isReady()&&!reduceMotion())},
    lowPower(){const h=MOE3D.hero,s=h&&h.stats&&h.stats();return !!(s&&s.tier===0)},
    async openLegend(k){guard(()=>ARCH()&&ARCH().markOpened(k));noteVisit(k);if(hasAdv(k))openAdventure(k);else openStory(k)},
    closeLegend(){navClosing=true;try{if(advCur||!advEl.hidden)closeAdventure();if(dlg.open)dlg.close()}finally{navClosing=false}},
    legendOrigin:k=>document.querySelector('.card[data-legend="'+k+'"]'),
    mapFocusLegend(k){const xy=GEO.pins.leg[k];if(!xy)return Promise.resolve();const w=W/3.2;animateTo({w,x:Math.max(0,Math.min(W-w,xy[0]-w/2)),y:Math.max(0,Math.min(H-w*H/W,xy[1]-w*H/W/2))},560);return new Promise(r=>setTimeout(r,580))},
    mapView:()=>({x:vb.x,y:vb.y,w:vb.w,h:vh()}),
    cardElement:id=>document.querySelector('#archive-grid [data-card="'+id+'"]'),
    openCard(id,origin){const U=UI();U&&U.inspectCard(id,origin)},
    closeCard(){const U=UI();if(U){navClosing=true;try{U.closeInspector()}finally{navClosing=false}}},
  };
  NAV=N.createNavigator(host);window.MOE3D.navigator=NAV;
  // in-page links become journeys (the skip link stays an instant jump, for keyboard users)
  document.addEventListener("click",e=>{
    if(e.defaultPrevented||e.button>0||e.metaKey||e.ctrlKey||e.shiftKey)return;
    const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||a.classList.contains("skip-link"))return;
    const r=N.parseHash(a.getAttribute("href"));if(!r)return;
    e.preventDefault();NAV.go(r,{origin:a});
  });
  // the Archive inspector belongs to the navigation too (#card/<id>; Back closes it)
  addEventListener("moe:inspector-closed",()=>{if(!navClosing&&NAV.overlay&&NAV.overlay.type==="card")NAV.closeOverlay({already:true})});
  // deep links to an overlay: #legend/woolpit, #card/hoia-time
  const r0=N.parseHash(location.hash);
  if(r0&&r0.type!=="section")addEventListener("load",()=>setTimeout(()=>{if(r0.type==="legend"&&!LEGENDS[r0.id])return;NAV.go(r0,{fromHistory:true})},60));
});

/* graphics quality (landing valley, page sky): auto / high / medium / low, saved in this browser */
guard(()=>{const sel=$("#gfx");if(!sel)return;let v="auto";try{v=JSON.parse(localStorage.getItem("moe.quality.v1"))||"auto"}catch(e){}sel.value=v;
  sel.onchange=()=>{try{localStorage.setItem("moe.quality.v1",JSON.stringify(sel.value))}catch(e){}location.reload()}});

/* v11: short tales, random legend, special nights, keyboard help, progress tools, sources, the Sibyl’s Oracle (src/ui/more.js) */
guard(()=>UI()&&UI().initMore&&UI().initMore());
