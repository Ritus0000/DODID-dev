/* ============================================================
   DODID — Black Hole per-letter warp (пер-буквенное искажение)
   — Задача-«чёрная дыра» едет вверх/вниз (FLIP)
   — КАЖДЫЙ СИМВОЛ соседних задач тянется, сжимается, искривляется
   — Хвост: пружинная релаксация, лёгкая дуга, мягкое размытие
   — Никаких рамок/теней у ghost; док не трогаем
   ============================================================ */

/* ---------- Инжект аккуратного CSS ---------- */
(function injectStyles(){
  document.querySelectorAll('style[data-dodid-flip]').forEach(s=>s.remove());
  const css = `
  li.leaving{visibility:hidden}
  .ghost-li{
    position:fixed; z-index:9999; margin:0; pointer-events:none; box-sizing:border-box;
    will-change:top,left,transform;
    background:transparent!important; box-shadow:none!important; filter:none!important; border:0!important;
  }
  /* кружок у ghost — как «чёрная дыра» */
  .ghost-li .circle{
    background: radial-gradient(closest-side, #000 0%, #050505 60%, #0b0b0b 100%) !important;
    border-color: transparent !important;
  }
  #tasks{ overflow-anchor:none; }
  #tasks li{ will-change: transform; }

  /* Пер-буквенный overlay на время линзы */
  .distort-layer{
    position:absolute; inset:0; pointer-events:none;
    font: inherit; line-height: inherit;
    white-space: pre-wrap; word-break: break-word;
  }
  .distort-layer .dch{
    display:inline-block; will-change: transform, filter;
    transform-origin: 50% 50%;
  }
  /* если пользователь просит меньше движения — выключим варп */
  @media (prefers-reduced-motion: reduce){
    .distort-layer .dch{ transform:none !important; filter:none !important; }
  }
  `.trim();
  const tag = document.createElement('style');
  tag.setAttribute('data-dodid-flip','true');
  tag.textContent = css;
  document.head.appendChild(tag);
})();

/* ===================== День недели ===================== */
const ruDays = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(d=new Date()){ const el=document.getElementById("dayHeader"); if(el) el.textContent=ruDays[d.getDay()]; }
setDayHeader(); setInterval(setDayHeader, 60_000);

/* ===================== Хранилище / перенос на новый день ===================== */
const KEY_TASKS='dodid_tasks_v1'; const KEY_LAST='dodid_lastDate'; const START_TASKS=3;
let tasks=[]; try{ tasks=JSON.parse(localStorage.getItem(KEY_TASKS)||'[]')||[] }catch{ tasks=[] }
if(!tasks.length){ tasks=Array.from({length:START_TASKS},()=>({text:'',done:false})) }
function save(){ localStorage.setItem(KEY_TASKS, JSON.stringify(tasks)); }
function todayKey(d=new Date()){ return d.toDateString(); }
function rolloverIfNeeded(){
  const today=todayKey(), last=localStorage.getItem(KEY_LAST); if(last===today) return;
  const carried=tasks.filter(t=>!t.done && (t.text||'').trim()!=='').map(t=>({text:t.text,done:false}));
  tasks = carried.length? [...carried,{text:'',done:false}] : Array.from({length:START_TASKS},()=>({text:'',done:false}));
  save(); localStorage.setItem(KEY_LAST,today); render();
}
rolloverIfNeeded(); setInterval(rolloverIfNeeded,60_000);

/* ===================== DOM ===================== */
const list = document.getElementById('tasks');
const addBtn = document.getElementById('addBtn');

/* Показ тонкой полоски только во время прокрутки */
let hideTimer=null;
list.addEventListener('scroll', ()=>{
  list.classList.add('scrolling');
  clearTimeout(hideTimer); hideTimer=setTimeout(()=>list.classList.remove('scrolling'), 800);
},{passive:true});

/* ===================== Помощники ===================== */
function syncEmpty(el){ (el.textContent||'').trim()===''? el.classList.add('empty') : el.classList.remove('empty'); }
function makeTick(){
  const s='http://www.w3.org/2000/svg', svg=document.createElementNS(s,'svg');
  svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
  const p1=document.createElementNS(s,'path'); p1.setAttribute('d','M3 7 L6 10');
  const p2=document.createElementNS(s,'path'); p2.setAttribute('d','M6 10 L11 3');
  svg.appendChild(p1); svg.appendChild(p2); return svg;
}

/* ---- Зачёркивание по реальным строкам (SVG) ---- */
let fontMetricsCache=null;
function computeFontMetricsFor(el){
  const cs=getComputedStyle(el);
  const font=`${cs.fontStyle||'normal'} ${cs.fontWeight||'400'} ${cs.fontSize||'18px'}/${(cs.lineHeight&&cs.lineHeight!=='normal')?cs.lineHeight:cs.fontSize||'18px'} ${cs.fontFamily||'Helvetica Neue, Arial, sans-serif'}`;
  const c=document.createElement('canvas'), ctx=c.getContext('2d'); ctx.font=font;
  const m=ctx.measureText('кенгшзхываполжэячсмитью'); const a=m.actualBoundingBoxAscent||0, d=m.actualBoundingBoxDescent||0;
  return (a||d)? {a,d}:null;
}
function getFontMetrics(el){ if(!fontMetricsCache) fontMetricsCache=computeFontMetricsFor(el); return fontMetricsCache; }
function buildStrike(textWrap, animate=true){
  const old=textWrap.querySelector('.strike-svg'); if(old) old.remove();
  const textEl=textWrap.querySelector('.task-text'); if(!textEl) return; syncEmpty(textEl);
  const range=document.createRange(); range.selectNodeContents(textEl);
  const rects=Array.from(range.getClientRects());
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg'); svg.classList.add('strike-svg');
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

/* Фокус в конец */
function placeCaretAtEnd(el){ const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }
function focusEditable(el){ requestAnimationFrame(()=>{ el.focus({preventScroll:true}); placeCaretAtEnd(el); try{ el.click(); }catch{} }); }

/* ===================== Параметры «чёрной дыры» (пер-буквенно) ===================== */
const MOVE_DURATION = 1150;        // длительность проезда ghost (мс)
const LIST_EASE     = 'ease-in-out';
const FIELD_RADIUS  = 220;         // радиус влияния по вертикали (px)
const STRETCH_MAX   = 0.22;        // макс. вертикальная растяжка символа
const SQUEEZE_MAX   = 0.12;        // макс. горизонтальное сжатие
const SKEW_MAX_DEG  = 6.0;         // макс. дуга (скошенность)
const BLUR_MAX_PX   = 0.35;        // размытие у сингулярности
const LIFT_PX       = 6;           // максимум локального подъёма/просадки символа (дуга)
const SPRING_K      = 22;          // жёсткость хвоста (чем больше — быстрее)
const SPRING_DAMP   = 0.82;        // демпфирование 0..1

const clamp=(v,min,max)=>v<min?min:(v>max?max:v);

/* ====== Пер-буквенный overlay ====== */
function makeDistortLayer(wrap){
  // уже есть слой? — переиспользуем
  let layer = wrap.querySelector(':scope > .distort-layer');
  if(layer) return layer;
  layer = document.createElement('div');
  layer.className = 'distort-layer';
  const src = wrap.querySelector('.task-text');
  // важный трюк: заменяем пробелы на NBSP, чтобы спаны не «схлопывались»
  const txt = (src.textContent||'').replace(/ /g, '\u00A0');
  for(const ch of txt){
    const span = document.createElement('span');
    span.className='dch';
    span.textContent=ch;
    layer.appendChild(span);
  }
  wrap.appendChild(layer);
  // прячем оригинал только по оптической части (сохраняем layout/высоту)
  src.style.opacity='0';
  return layer;
}
function removeDistortLayer(wrap){
  const src = wrap.querySelector('.task-text');
  const layer = wrap.querySelector(':scope > .distort-layer');
  if(layer) layer.remove();
  if(src) src.style.opacity='';
}

/* Состояние пружин по символам: WeakMap(layer -> [{val, vel} per char]) */
const charSpring = new WeakMap();

/* Главный «пер-буквенный» луп */
function startCharLensLoop(ghost, ul, movedLi){
  let rafId=0, prevTime=performance.now(), prevGY=null;

  // Готовим слои для всех текстов, кроме перемещаемого
  const entries = [];
  ul.querySelectorAll(':scope > li .textwrap').forEach(wrap=>{
    if(wrap.closest('li')===movedLi) return;
    const layer = makeDistortLayer(wrap);
    const chars = Array.from(layer.querySelectorAll('.dch'));
    if(!charSpring.has(layer)){
      charSpring.set(layer, chars.map(()=>({val:0, vel:0})));
    }else{
      const arr=charSpring.get(layer);
      if(arr.length!==chars.length) charSpring.set(layer, chars.map(()=>({val:0, vel:0})));
    }
    entries.push({wrap, layer, chars});
  });

  function frame(now){
    const dt = now - prevTime; prevTime = now;
    const gr = ghost.getBoundingClientRect();
    const gCenter = gr.top + gr.height/2;

    let vGhost=0;
    if(prevGY!=null){ vGhost=(gCenter - prevGY) / (dt||1); }
    prevGY = gCenter;

    for(const {wrap, layer, chars} of entries){
      const springs = charSpring.get(layer);
      if(!springs) continue;

      for(let i=0;i<chars.length;i++){
        const ch = chars[i];
        // Геометрия символа
        const cr = ch.getBoundingClientRect();
        const cCenter = cr.top + cr.height/2;
        const dist = Math.abs(cCenter - gCenter);
        const dir = (gCenter < cCenter ? -1 : 1); // знак дуги (вверх/вниз)

        // Сила притяжения (плавно затухает с расстоянием; r^-2 с плинтусом)
        const n = clamp(1 - (dist / FIELD_RADIUS), 0, 1);
        let target = (Math.pow(n, 1.35)) / (1 + (dist*dist)/(FIELD_RADIUS*FIELD_RADIUS));

        // Быстрый ghost даёт «хвост»
        const tailBoost = clamp(Math.abs(vGhost)*0.004, 0, 0.25);
        target = clamp(target + tailBoost*target, 0, 1);

        // Пружина
        const st = springs[i];
        const k = SPRING_K, c = SPRING_DAMP;
        const force = (dir*target - st.val) * k;
        st.vel = (st.vel + force * (dt/1000)) * c;
        st.val = st.val + st.vel * (dt/1000);

        // Амплитуда (0..1) и знак
        const amt = clamp(Math.abs(st.val),0,1);
        const sgn = Math.sign(st.val)||1;

        // Параметры деформации символа
        const scaleY = 1 + STRETCH_MAX * amt;
        const scaleX = 1 - SQUEEZE_MAX * amt;
        const skew   = sgn * SKEW_MAX_DEG * amt;
        const blur   = (BLUR_MAX_PX * amt).toFixed(3)+'px';
        const lift   = sgn * LIFT_PX * amt; // локальная дуга

        ch.style.transform = `translate3d(0, ${lift}px, 0) skewY(${skew}deg) scale(${scaleX}, ${scaleY})`;
        ch.style.filter    = `blur(${blur})`;
      }
    }

    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  // Стоп и очистка
  return ()=>{
    cancelAnimationFrame(rafId);
    for(const {wrap} of entries) removeDistortLayer(wrap);
  };
}

/* ===== FLIP-перестановка с ghost ===== */
function rectMap(ul){ const m=new Map(); ul.querySelectorAll(':scope > li').forEach(el=>m.set(el,el.getBoundingClientRect())); return m; }
function makeGhostFrom(li, r0){
  const ghost=li.cloneNode(true);
  ghost.classList.add('ghost-li');
  const s=ghost.style; s.left=r0.left+'px'; s.top=r0.top+'px'; s.width=r0.width+'px'; s.height=r0.height+'px';
  document.body.appendChild(ghost); return ghost;
}

function animateListReorder(movedLi, domChange){
  const ul = list;

  // 1) До
  const before = rectMap(ul);
  const r0 = before.get(movedLi);

  // 2) Ghost
  const ghost = makeGhostFrom(movedLi, r0);
  movedLi.classList.add('leaving');

  // 3) Меняем DOM
  domChange();

  // 4) После
  const after = rectMap(ul);
  const r1 = after.get(movedLi);

  // 5) FLIP остальных
  ul.querySelectorAll(':scope > li').forEach(el=>{
    const a=after.get(el), b=before.get(el);
    if(!a || !b || el===movedLi) return;
    const dx=b.left - a.left, dy=b.top - a.top;
    if(dx || dy){
      el.style.transform=`translate(${dx}px, ${dy}px)`;
      el.offsetWidth;
      el.style.transition=`transform 520ms ${LIST_EASE}`;
      el.style.transform=`translate(0,0)`;
      el.addEventListener('transitionend', function te(){
        el.style.transition=''; el.style.transform=''; el.removeEventListener('transitionend', te);
      });
    }
  });

  // 6) Запускаем пер-буквенную линзу
  const stopLens = startCharLensLoop(ghost, ul, movedLi);

  // 7) Двигаем ghost
  requestAnimationFrame(()=>{
    const s=ghost.style;
    s.transition=`top ${MOVE_DURATION}ms ${LIST_EASE}`;
    s.top = r1.top + 'px';
    ghost.addEventListener('transitionend', function done(){
      ghost.removeEventListener('transitionend', done);
      stopLens();                 // очистка слоёв/стилей
      ghost.remove();             // убрать призрак
      movedLi.classList.remove('leaving');
    }, { once:true });
  });
}

/* ===================== Рендер ===================== */
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

    /* Клик: done и «чёрная дыра» */
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
        // вверх (в начало)
        animateListReorder(li, ()=>{ list.insertBefore(li, list.firstChild); });
      }
    });

    /* Изменение текста */
    text.addEventListener('input',()=>{
      tasks[i].text=text.textContent; save(); syncEmpty(text);
      if(t.done) buildStrike(wrap,false);
    });

    /* Backspace/Delete на пустой строке — удалить */
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
    if(c){ c.classList.add('born'); setTimeout(()=>c.classList.remove('born'), 750); }
    if(tx){ tx.classList.add('empty'); focusEditable(tx); }
  }
}
addBtn.addEventListener('pointerdown',()=>addBtn.classList.add('pressed'));
addBtn.addEventListener('pointerup',()=>addBtn.classList.remove('pressed'));
addBtn.addEventListener('pointercancel',()=>addBtn.classList.remove('pressed'));
addBtn.addEventListener('pointerleave',()=>addBtn.classList.remove('pressed'));
addBtn.addEventListener('click', addTask);

/* ===================== Снятие фокуса по тапу снаружи ===================== */
document.addEventListener('pointerdown',(e)=>{
  if(!e.target.closest('.task-text')){
    const a=document.activeElement; if(a && a.blur) a.blur();
  }
},{passive:true});

/* ===================== Пересбор зачёркивания при ресайзе ===================== */
window.addEventListener('resize', ()=>{
  document.querySelectorAll('#tasks li.done .textwrap').forEach(w=>buildStrike(w,false));
});

/* ===================== Анти-rubber-band для iOS ===================== */
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

/* ===================== Первый рендер ===================== */
render();
