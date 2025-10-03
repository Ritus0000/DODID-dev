/* ============================================================
   DODID — Black Hole (WebGL refraction) — FULL script.js
   — FLIP + ghost
   — WebGL оверлей с шейдером «гравитационной линзы»
   — Рендер текста в offscreen canvas → текстура → рефракция
   ============================================================ */

/* ---------- инжект необходимых стилей ---------- */
(function injectStyles(){
  document.querySelectorAll('style[data-dodid-bh]').forEach(s=>s.remove());
  const css = `
  li.leaving{visibility:hidden}
  .ghost-li{
    position:fixed; z-index:9998; margin:0; pointer-events:none; box-sizing:border-box;
    background:transparent!important; box-shadow:none!important; border:0!important; filter:none!important;
    will-change:top,left,transform;
  }
  .ghost-li .circle{
    background: radial-gradient(closest-side,#000 0%,#050505 60%,#0b0b0b 100%) !important;
    border-color: transparent !important;
  }
  .bhgl{
    position:fixed; left:0; top:0; width:100vw; height:100vh; z-index:9997; pointer-events:none;
  }
  /* исходный текст остаётся видимым; искажаем оверлеем сверху */
  #tasks{ overflow-anchor:none; }
  #tasks li{ will-change: transform; }
  @media (prefers-reduced-motion: reduce){
    .bhgl{ display:none !important; }
  }
  `.trim();
  const tag=document.createElement('style');
  tag.setAttribute('data-dodid-bh','true');
  tag.textContent=css;
  document.head.appendChild(tag);
})();

/* ===================== День недели ===================== */
const ruDays=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(d=new Date()){ const el=document.getElementById("dayHeader"); if(el) el.textContent=ruDays[d.getDay()]; }
setDayHeader(); setInterval(setDayHeader,60_000);

/* ===================== Хранилище/перенос ===================== */
const KEY_TASKS='dodid_tasks_v1', KEY_LAST='dodid_lastDate', START_TASKS=3;
let tasks=[]; try{ tasks=JSON.parse(localStorage.getItem(KEY_TASKS)||'[]')||[] }catch{ tasks=[] }
if(!tasks.length) tasks=Array.from({length:START_TASKS},()=>({text:'',done:false}));
function save(){ localStorage.setItem(KEY_TASKS, JSON.stringify(tasks)); }
function todayKey(d=new Date()){ return d.toDateString(); }
function rolloverIfNeeded(){
  const today=todayKey(), last=localStorage.getItem(KEY_LAST); if(last===today) return;
  const carried=tasks.filter(t=>!t.done && (t.text||'').trim()!=='').map(t=>({text:t.text,done:false}));
  tasks = carried.length ? [...carried,{text:'',done:false}] : Array.from({length:START_TASKS},()=>({text:'',done:false}));
  save(); localStorage.setItem(KEY_LAST,today); render();
}
rolloverIfNeeded(); setInterval(rolloverIfNeeded,60_000);

/* ===================== DOM ===================== */
const list=document.getElementById('tasks');
const addBtn=document.getElementById('addBtn');

/* тонкий скроллбар только при движении */
let hideTimer=null;
list.addEventListener('scroll',()=>{
  list.classList.add('scrolling');
  clearTimeout(hideTimer); hideTimer=setTimeout(()=>list.classList.remove('scrolling'),800);
},{passive:true});

/* ===== helpers ===== */
function syncEmpty(el){ (el.textContent||'').trim()===''?el.classList.add('empty'):el.classList.remove('empty'); }
function makeTick(){
  const s='http://www.w3.org/2000/svg', svg=document.createElementNS(s,'svg');
  svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
  const p1=document.createElementNS(s,'path'); p1.setAttribute('d','M3 7 L6 10');
  const p2=document.createElementNS(s,'path'); p2.setAttribute('d','M6 10 L11 3');
  svg.appendChild(p1); svg.appendChild(p2); return svg;
}

/* ===== зачёркивание ==== */
let fontMetricsCache=null;
function computeFontMetricsFor(el){
  const cs=getComputedStyle(el);
  const style=cs.fontStyle||'normal', weight=cs.fontWeight||'400';
  const size=cs.fontSize||'18px';
  const line=cs.lineHeight && cs.lineHeight!=='normal' ? cs.lineHeight : size;
  const family=cs.fontFamily || 'Helvetica Neue, Arial, sans-serif';
  const font=`${style} ${weight} ${size}/${line} ${family}`;
  const c=document.createElement('canvas'), ctx=c.getContext('2d'); ctx.font=font;
  const m=ctx.measureText('кенгшзхываполжэячсмитью'); const a=m.actualBoundingBoxAscent||0, d=m.actualBoundingBoxDescent||0;
  return (a||d)?{a,d}:null;
}
function getFontMetrics(el){ if(!fontMetricsCache) fontMetricsCache=computeFontMetricsFor(el); return fontMetricsCache; }
function buildStrike(textWrap, animate=true){
  const old=textWrap.querySelector('.strike-svg'); if(old) old.remove();
  const textEl=textWrap.querySelector('.task-text'); if(!textEl) return; syncEmpty(textEl);
  const range=document.createRange(); range.selectNodeContents(textEl);
  const rects=Array.from(range.getClientRects());
  const svgNS='http://www.w3.org/2000/svg', svg=document.createElementNS(svgNS,'svg'); svg.classList.add('strike-svg');
  const parent=textWrap.getBoundingClientRect();
  svg.setAttribute('width',parent.width); svg.setAttribute('height',parent.height);
  svg.setAttribute('viewBox',`0 0 ${parent.width} ${parent.height}`);
  const fm=getFontMetrics(textEl); const ratio=0.56;
  rects.forEach(r=>{
    const x1=r.left-parent.left, x2=r.right-parent.left, len=Math.max(0,x2-x1); if(len<=0) return;
    let y; if(fm){ const baseline=(r.bottom-parent.top)-fm.d; const xh=fm.a; y=baseline-(xh/2); }
    else{ y=(r.top-parent.top)+r.height*ratio; }
    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y);
    line.setAttribute('x2',x2); line.setAttribute('y2',y);
    line.classList.add('strike-line'); line.style.setProperty('--len',`${len}`);
    if(!animate){ line.style.strokeDashoffset=0; line.style.transition='none'; }
    svg.appendChild(line);
    if(animate){ requestAnimationFrame(()=>{ line.style.strokeDashoffset=0; }); }
  });
  textWrap.appendChild(svg);
}

/* ===== фокус ===== */
function placeCaretAtEnd(el){ const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }
function focusEditable(el){ requestAnimationFrame(()=>{ el.focus({preventScroll:true}); placeCaretAtEnd(el); try{ el.click(); }catch{} }); }

/* ===================== Параметры движения/линзы ===================== */
const MOVE_DURATION=1150;              // длительность проезда ghost
const LIST_EASE='ease-in-out';
const LENS_RADIUS=220;                 // радиус влияния (px)
const LENS_STRENGTH=0.22;              // сила смещения (чем больше — тем сильнее тянет)
const CHROMA=0.65;                     // лёгкая хром. аберрация (0..1)
const TRAIL=0.22;                      // хвост за дырой (0..1)

/* ============================================================
   WebGL ОВЕРЛЕЙ: текст → offscreen → текстура → шейдер-линза
   ============================================================ */
function createBHGLayer(){
  const c=document.createElement('canvas');
  c.className='bhgl';
  document.body.appendChild(c);
  const gl=c.getContext('webgl',{alpha:true, antialias:true, premultipliedAlpha:true});
  if(!gl) return null;

  // шейдеры
  const vsSource=`
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main(){
      v_uv = (a_pos + 1.0) * 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;
  const fsSource=`
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec2  u_center;     // центр дыры (в uv)
    uniform float u_radius;     // радиус (в uv)
    uniform float u_strength;   // сила смещения
    uniform float u_time;       // время/прогресс
    uniform float u_chroma;     // сила цвет. аберрации
    uniform float u_trail;      // хвост за дырой (0..1)

    // смещение луча (рефракция) — художественная аппроксимация r^-2
    vec2 refractDir(vec2 p){
      float r = length(p);
      float k = smoothstep(u_radius, 0.0, r); // 1 в центре → 0 за радиусом
      // хвост: усиливаем ближе к краю радиуса
      float tail = mix(1.0, 1.0 + u_trail, k);
      float mag = u_strength * k * tail / (r + 1e-4);
      return normalize(p) * mag;
    }

    vec4 sampleLens(vec2 uv, float shift){
      // цветовые каналы чуть по-разному смещаем (хром. аберрация)
      vec2 p = uv - u_center;
      vec2 d = refractDir(p) * (1.0 + shift);
      vec2 uv2 = uv - d;
      return texture2D(u_tex, uv2);
    }

    void main(){
      vec4 col;
      // база
      col = sampleLens(v_uv, 0.0);
      // RGB split
      float s = u_chroma * 0.002; // константа масштаба
      vec4 r = sampleLens(v_uv, +s);
      vec4 b = sampleLens(v_uv, -s);
      col.r = r.r; col.b = b.b;
      gl_FragColor = col;
    }
  `;
  function compile(type,src){
    const sh=gl.createShader(type); gl.shaderSource(sh,src); gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  function program(vs,fs){
    const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const prog=program(compile(gl.VERTEX_SHADER,vsSource), compile(gl.FRAGMENT_SHADER,fsSource));
  gl.useProgram(prog);

  // полноэкранный треугольник (квад)
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const verts=new Float32Array([ -1,-1,  1,-1,  -1,1,   -1,1,  1,-1,  1,1 ]);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,'a_pos');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);

  // униформы
  const u_tex=gl.getUniformLocation(prog,'u_tex');
  const u_center=gl.getUniformLocation(prog,'u_center');
  const u_radius=gl.getUniformLocation(prog,'u_radius');
  const u_strength=gl.getUniformLocation(prog,'u_strength');
  const u_time=gl.getUniformLocation(prog,'u_time');
  const u_chroma=gl.getUniformLocation(prog,'u_chroma');
  const u_trail=gl.getUniformLocation(prog,'u_trail');

  // текстура
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // offscreen canvas для текста
  const off=document.createElement('canvas'), octx=off.getContext('2d');

  function resize(){
    const dpr=window.devicePixelRatio||1;
    const w=Math.round(window.innerWidth*dpr), h=Math.round(window.innerHeight*dpr);
    c.width=w; c.height=h; c.style.width=window.innerWidth+'px'; c.style.height=window.innerHeight+'px';
    gl.viewport(0,0,w,h);
    off.width=w; off.height=h;
  }
  resize(); window.addEventListener('resize',resize);

  function drawTextSnapshot(){
    // очищаем и рисуем все .task-text (кроме перемещаемого — необязательно, но быстрее)
    octx.clearRect(0,0,off.width,off.height);
    octx.save(); octx.scale(window.devicePixelRatio||1, window.devicePixelRatio||1);

    const wraps=document.querySelectorAll('#tasks .textwrap');
    wraps.forEach(w=>{
      const textEl=w.querySelector('.task-text'); if(!textEl) return;
      // берем стили
      const cs=getComputedStyle(textEl);
      const font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      octx.font=font;
      octx.fillStyle=cs.color;
      octx.textBaseline='top';
      // положение
      const r=textEl.getBoundingClientRect();
      // Реальное разбиение по строкам: возьмём client rects
      const range=document.createRange(); range.selectNodeContents(textEl);
      const rects=Array.from(range.getClientRects());
      if(rects.length===0){
        octx.fillText(textEl.textContent||'', r.left, r.top);
      }else{
        // грубое: рисуем всю строку целиком по её top/left (оптическое совпадение ок)
        const txt=(textEl.textContent||'').replace(/\s+/g,' ').trim();
        // пытаемся распределить текст по строкам приблизительно
        let start=0;
        rects.forEach(rr=>{
          // оценим сколько символов помещается
          let n=1, acc='';
          while(start+n<=txt.length && octx.measureText(txt.slice(start,start+n)).width < (rr.width+2)) n++;
          const lineStr=txt.slice(start, start+Math.max(1,n-1));
          start += Math.max(1,n-1);
          octx.fillText(lineStr, rr.left, rr.top);
        });
        // хвост, если остался
        const rest=txt.slice(start);
        if(rest) octx.fillText(rest, r.left, r.bottom - parseFloat(cs.fontSize));
      }
    });
    octx.restore();

    // загрузить в текстуру
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,off);
  }

  function render(centerPx, radiusPx, strength){
    drawTextSnapshot();

    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u_tex,0);

    const dpr=window.devicePixelRatio||1;
    const uvCenter=[ centerPx[0]*dpr / (c.width), centerPx[1]*dpr / (c.height) ];
    const uvRadius=(radiusPx*dpr) / Math.max(c.width,c.height);

    gl.uniform2fv(u_center, new Float32Array(uvCenter));
    gl.uniform1f(u_radius, uvRadius);
    gl.uniform1f(u_strength, strength);
    gl.uniform1f(u_time, performance.now()/1000);
    gl.uniform1f(u_chroma, CHROMA);
    gl.uniform1f(u_trail, TRAIL);

    gl.drawArrays(gl.TRIANGLES,0,6);
  }

  return {
    canvas:c,
    render,
    destroy(){
      window.removeEventListener('resize',resize);
      c.remove();
      // WebGL ресурсы можно оставить GC — оверлей короткоживущий
    }
  };
}

/* ============================================================
   FLIP + «чёрная дыра»
   ============================================================ */
function rectMap(ul){ const m=new Map(); ul.querySelectorAll(':scope > li').forEach(el=>m.set(el, el.getBoundingClientRect())); return m; }
function makeGhostFrom(li, r0){
  const ghost=li.cloneNode(true);
  ghost.classList.add('ghost-li');
  const s=ghost.style;
  s.left=r0.left+'px'; s.top=r0.top+'px'; s.width=r0.width+'px'; s.height=r0.height+'px';
  document.body.appendChild(ghost);
  return ghost;
}

function animateListReorder(movedLi, domChange){
  const ul=list;

  const before=rectMap(ul);
  const r0=before.get(movedLi);
  const ghost=makeGhostFrom(movedLi, r0);
  movedLi.classList.add('leaving');

  domChange();

  const after=rectMap(ul);
  const r1=after.get(movedLi);

  // FLIP остальных
  ul.querySelectorAll(':scope > li').forEach(el=>{
    const a=after.get(el), b=before.get(el);
    if(!a||!b||el===movedLi) return;
    const dx=b.left-a.left, dy=b.top-a.top;
    if(dx||dy){
      el.style.transform=`translate(${dx}px,${dy}px)`;
      el.offsetWidth;
      el.style.transition=`transform 520ms ${LIST_EASE}`;
      el.style.transform=`translate(0,0)`;
      el.addEventListener('transitionend',function te(){
        el.style.transition=''; el.style.transform=''; el.removeEventListener('transitionend',te);
      });
    }
  });

  // WebGL оверлей
  const layer=createBHGLayer();
  let rafId=0;
  const start=performance.now();

  function frame(){
    const now=performance.now();
    const t=Math.min(1, (now-start)/MOVE_DURATION);

    // центр «дыры» = центр ghost
    const gr=ghost.getBoundingClientRect();
    const center=[ gr.left + gr.width/2, gr.top + gr.height/2 ];
    // радиус и сила — плавно
    const radius=LENS_RADIUS;
    const strength=LENS_STRENGTH;

    layer.render(center, radius, strength);

    rafId=requestAnimationFrame(frame);
  }
  rafId=requestAnimationFrame(frame);

  // сам проезд ghost
  requestAnimationFrame(()=>{
    const s=ghost.style;
    s.transition=`top ${MOVE_DURATION}ms ${LIST_EASE}`;
    s.top=r1.top+'px';
    ghost.addEventListener('transitionend', function done(){
      ghost.removeEventListener('transitionend',done);
      cancelAnimationFrame(rafId);
      layer.destroy();
      ghost.remove();
      movedLi.classList.remove('leaving');
    }, {once:true});
  });
}

/* ===================== Рендер списка ===================== */
function render(){
  list.innerHTML='';
  tasks.forEach((t,i)=>{
    const li=document.createElement('li'); if(t.done) li.classList.add('done');

    const circle=document.createElement('div'); circle.className='circle';
    if(t.done) circle.appendChild(makeTick());
    circle.addEventListener('pointerdown',()=>circle.classList.add('touch'));
    circle.addEventListener('pointerup',()=>circle.classList.remove('touch'));
    circle.addEventListener('pointercancel',()=>circle.classList.remove('touch'));
    circle.addEventListener('pointerleave',()=>circle.classList.remove('touch'));

    const wrap=document.createElement('div'); wrap.className='textwrap';
    const text=document.createElement('div'); text.className='task-text';
    text.contentEditable='true'; text.spellcheck=false;
    text.textContent=t.text||''; syncEmpty(text);

    wrap.appendChild(text);
    li.appendChild(circle); li.appendChild(wrap); list.appendChild(li);

    circle.addEventListener('click',()=>{
      if((text.textContent||'').trim()==='') return;
      t.done=!t.done; save();

      if(t.done){
        li.classList.add('done'); circle.innerHTML=''; circle.appendChild(makeTick());
        buildStrike(wrap,true);
        // вниз
        animateListReorder(li, ()=>{ list.appendChild(li); });
      }else{
        li.classList.remove('done'); circle.innerHTML='';
        const s=wrap.querySelector('.strike-svg'); if(s) s.remove();
        // вверх
        animateListReorder(li, ()=>{ list.insertBefore(li, list.firstChild); });
      }
    });

    text.addEventListener('input',()=>{
      tasks[i].text=text.textContent; save(); syncEmpty(text);
      if(t.done) buildStrike(wrap,false);
    });

    text.addEventListener('keydown',(e)=>{
      const val=(text.textContent||'').trim();
      if((e.key==='Backspace'||e.key==='Delete') && val===''){
        e.preventDefault();
        tasks.splice(i,1); if(tasks.length===0) tasks.push({text:'',done:false});
        save(); render();
      }
    });

    if(t.done) buildStrike(wrap,false);
  });
}

/* ===================== Добавление задачи ===================== */
function addTask(){
  tasks.push({text:'',done:false}); save(); render();
  const last=list.querySelector('li:last-child');
  if(last){
    const c=last.querySelector('.circle'); const tx=last.querySelector('.task-text');
    if(c){ c.classList.add('born'); setTimeout(()=>c.classList.remove('born'),750); }
    if(tx){ tx.classList.add('empty'); focusEditable(tx); }
  }
}
addBtn.addEventListener('pointerdown',()=>addBtn.classList.add('pressed'));
addBtn.addEventListener('pointerup',()=>addBtn.classList.remove('pressed'));
addBtn.addEventListener('pointercancel',()=>addBtn.classList.remove('pressed'));
addBtn.addEventListener('pointerleave',()=>addBtn.classList.remove('pressed'));
addBtn.addEventListener('click', addTask);

/* ===================== снятие фокуса ===================== */
document.addEventListener('pointerdown',(e)=>{
  if(!e.target.closest('.task-text')){
    const a=document.activeElement; if(a && a.blur) a.blur();
  }
},{passive:true});

/* ===================== пересбор strike при ресайзе ===================== */
window.addEventListener('resize',()=>{
  document.querySelectorAll('#tasks li.done .textwrap').forEach(w=>buildStrike(w,false));
});

/* ===================== анти-rubber-band iOS ===================== */
(function lockIOSRubberBand(){
  const scroller=document.getElementById('tasks'); if(!scroller) return;
  document.addEventListener('touchmove',(e)=>{ if(!e.target.closest('#tasks')) e.preventDefault(); },{passive:false});
  scroller.addEventListener('touchstart',()=>{
    const max=scroller.scrollHeight - scroller.clientHeight;
    if(max<=0) return;
    if(scroller.scrollTop<=0) scroller.scrollTop=1;
    else if(scroller.scrollTop>=max) scroller.scrollTop=max-1;
  },{passive:true});
  scroller.addEventListener('touchmove',(e)=>{
    if(scroller.scrollHeight<=scroller.clientHeight) e.preventDefault();
  },{passive:false});
})();

/* ===================== первый рендер ===================== */
render();
