/* ============================================================
   DODID — script.js с «гравитационным линзированием»
   — задача проезжает вниз/вверх,
   — у текстов, рядом с траекторией, мягко меняется масштаб/кернинг,
   — без рамок/теней у «призрака», плавно и аккуратно.
   ============================================================ */

/* ---------- Минимальный CSS под анимацию: без рамки/тени у ghost, подсказки браузеру ---------- */
(function injectStyles(){
  // сносим старые инжекты (если были)
  document.querySelectorAll('style[data-dodid-flip]').forEach(s=>s.remove());

  const css = `
  li.leaving{visibility:hidden}

  /* «Призрак» перемещаемого элемента: никакого фона/тени/рамки */
  .ghost-li{
    position:fixed; z-index:9999; margin:0; pointer-events:none; box-sizing:border-box;
    will-change:top,left,transform;
    background:transparent!important; box-shadow:none!important; filter:none!important;
    border:0!important; border-radius:0!important;
  }

  /* контент задачи, который будем «гнуть» как свет */
  #tasks .textwrap{
    will-change: transform, letter-spacing;
    transform-origin: center center;
  }

  /* помощь при FLIP */
  #tasks{ overflow-anchor:none; }
  #tasks li{ will-change: transform; }
  `.trim();

  const tag = document.createElement('style');
  tag.setAttribute('data-dodid-flip','true');
  tag.textContent = css;
  document.head.appendChild(tag);
})();

/* ===================== День недели ===================== */
const ruDays = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
function setDayHeader(d=new Date()){
  const el = document.getElementById("dayHeader");
  if (el) el.textContent = ruDays[d.getDay()];
}
setDayHeader();
setInterval(setDayHeader, 60_000);

/* ===================== Хранилище и перенос «на новый день» ===================== */
const KEY_TASKS='dodid_tasks_v1';
const KEY_LAST ='dodid_lastDate';
const START_TASKS=3;

let tasks=[];
try{ tasks=JSON.parse(localStorage.getItem(KEY_TASKS)||'[]')||[] }catch{ tasks=[] }
if(!tasks.length){ tasks = Array.from({length:START_TASKS},()=>({text:'',done:false})) }

function save(){ localStorage.setItem(KEY_TASKS, JSON.stringify(tasks)); }
function todayKey(d=new Date()){ return d.toDateString(); }

function rolloverIfNeeded(){
  const today=todayKey(); const last=localStorage.getItem(KEY_LAST);
  if(last===today) return;
  const carried = tasks
    .filter(t=>!t.done && (t.text||'').trim()!=='')
    .map(t=>({text:t.text,done:false}));
  tasks = carried.length
    ? [...carried,{text:'',done:false}]
    : Array.from({length:START_TASKS},()=>({text:'',done:false}));
  save(); localStorage.setItem(KEY_LAST, today); render();
}
rolloverIfNeeded();
setInterval(rolloverIfNeeded, 60_000);

/* ===================== DOM-ссылки ===================== */
const list = document.getElementById('tasks');
const addBtn = document.getElementById('addBtn');

/* Тонкий скроллбар только во время прокрутки */
let hideTimer=null;
list.addEventListener('scroll', ()=>{
  list.classList.add('scrolling');
  clearTimeout(hideTimer); hideTimer=setTimeout(()=>list.classList.remove('scrolling'), 800);
}, {passive:true});

/* ===================== Помощники UI ===================== */
function syncEmpty(el){ (el.textContent||'').trim()==='' ? el.classList.add('empty') : el.classList.remove('empty'); }
function makeTick(){
  const s='http://www.w3.org/2000/svg', svg=document.createElementNS(s,'svg');
  svg.setAttribute('viewBox','0 0 14 14'); svg.classList.add('tick');
  const p1=document.createElementNS(s,'path'); p1.setAttribute('d','M3 7 L6 10');
  const p2=document.createElementNS(s,'path'); p2.setAttribute('d','M6 10 L11 3');
  svg.appendChild(p1); svg.appendChild(p2); return svg;
}

/* ===== Зачёркивание по реальным строкам (SVG) ===== */
let fontMetricsCache=null;
function computeFontMetricsFor(el){
  const cs=getComputedStyle(el);
  const style=cs.fontStyle||'normal'; const weight=cs.fontWeight||'400';
  const size=cs.fontSize||'18px'; const line=cs.lineHeight && cs.lineHeight!=='normal'? cs.lineHeight:size;
  const family=cs.fontFamily || 'Helvetica Neue, Arial, sans-serif';
  const font=`${style} ${weight} ${size}/${line} ${family}`;
  const c=document.createElement('canvas'), ctx=c.getContext('2d');
  ctx.font=font;
  const m=ctx.measureText('кенгшзхываполжэячсмитью');
  const a=m.actualBoundingBoxAscent||0, d=m.actualBoundingBoxDescent||0;
  return (a||d)? {a,d}:null;
}
function getFontMetrics(el){ if(!fontMetricsCache) fontMetricsCache=computeFontMetricsFor(el); return fontMetricsCache; }
function buildStrike(textWrap, animate=true){
  const old=textWrap.querySelector('.strike-svg'); if(old) old.remove();
  const textEl=textWrap.querySelector('.task-text'); if(!textEl) return;
  syncEmpty(textEl);

  const range=document.createRange(); range.selectNodeContents(textEl);
  const rects=Array.from(range.getClientRects());

  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg'); svg.classList.add('strike-svg');

  const parent=textWrap.getBoundingClientRect();
  svg.setAttribute('width',parent.width); svg.setAttribute('height',parent.height);
  svg.setAttribute('viewBox',`0 0 ${parent.width} ${parent.height}`);

  const fm=getFontMetrics(textEl); const ratio=0.56;

  rects.forEach(r=>{
    const x1=r.left-parent.left, x2=r.right-parent.left, len=Math.max(0,x2-x1);
    if(len<=0) return;
    let y;
    if(fm){ const baseline=(r.bottom-parent.top)-fm.d; const xh=fm.a; y=baseline-(xh/2); }
    else { y=(r.top-parent.top)+r.height*ratio; }

    const line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y);
    line.setAttribute('x2',x2); line.setAttribute('y2',y);
    line.classList.add('strike-line'); line.style.setProperty('--len', `${len}`);
    if(!animate){ line.style.strokeDashoffset=0; line.style.transition='none'; }
    svg.appendChild(line);
    if(animate){ requestAnimationFrame(()=>{ line.style.strokeDashoffset=0; }); }
  });

  textWrap.appendChild(svg);
}

/* Фокус в конец */
function placeCaretAtEnd(el){
  const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function focusEditable(el){
  requestAnimationFrame(()=>{ el.focus({preventScroll:true}); placeCaretAtEnd(el); try{ el.click(); }catch{} });
}

/* ===================== Мягкая FLIP + «гравитационная линза» ===================== */
const MOVE_DURATION = 1000;           // длительность «проезда» призрака (мс) — плавнее
const LIST_EASE     = 'ease-in-out';  // плавность для FLIP остальных
const LENS_RADIUS   = 140;            // радиус влияния «линзы» (px) по вертикали
const LENS_SCALE    = 0.08;           // макс. прибавка масштаба (0.08 => 8%)
const LENS_KERN_PX  = 0.35;           // макс. прибавка letter-spacing (px)

function rectMap(ul){
  const m = new Map();
  ul.querySelectorAll(':scope > li').forEach(el => m.set(el, el.getBoundingClientRect()));
  return m;
}
function makeGhostFrom(li, r0){
  const ghost = li.cloneNode(true);
  ghost.classList.add('ghost-li');
  const s = ghost.style;
  s.left   = r0.left + 'px';
  s.top    = r0.top  + 'px';
  s.width  = r0.width  + 'px';
  s.height = r0.height + 'px';
  document.body.appendChild(ghost);
  return ghost;
}

/* «Линза»: в каждом кадре читаем положение призрака и искажаем ближайшие тексты */
function startLensLoop(ghost, ul, movedLi){
  let rafId = 0;
  const wraps = Array.from(ul.querySelectorAll(':scope > li .textwrap'))
                      .filter(w => !w.closest('li').isSameNode(movedLi));

  function frame(){
    // центр призрака по вертикали
    const gr = ghost.getBoundingClientRect();
    const gCenter = gr.top + gr.height/2;

    for(const wrap of wraps){
      const wr = wrap.getBoundingClientRect();
      const wCenter = wr.top + wr.height/2;
      const dist = Math.abs(wCenter - gCenter);

      // сила эффекта 0..1 с плавным спадом, чуть нелинейно (степень 1.3)
      let k = 1 - (dist / LENS_RADIUS);
      if (k < 0) k = 0; else k = Math.pow(k, 1.3);

      const scale = 1 + LENS_SCALE * k;
      const kern  = (LENS_KERN_PX * k).toFixed(3) + 'px';

      // чуть сильнее «высоту» чем «ширину» — ближе к «грав. линзе»
      wrap.style.transform = `translateZ(0) scale(${scale}, ${1 + (LENS_SCALE*1.15)*k})`;
      wrap.style.letterSpacing = kern;
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  // функция остановки и очистки
  return () => {
    cancelAnimationFrame(rafId);
    for(const wrap of wraps){
      wrap.style.transform = '';
      wrap.style.letterSpacing = '';
    }
  };
}

/**
 * Анимирует перестановку:
 * - измеряем позиции (до/после),
 * - делаем FLIP для остальных,
 * - двигаем «призрака» top'ом,
 * - параллельно применяем «линзу» на тексты вокруг траектории.
 */
function animateListReorder(movedLi, domChange){
  const ul = list;

  // 1) До
  const before = rectMap(ul);
  const r0 = before.get(movedLi);

  // 2) Призрак без рамок; реальный li скрыт
  const ghost = makeGhostFrom(movedLi, r0);
  movedLi.classList.add('leaving');

  // 3) Меняем DOM
  domChange();

  // 4) После
  const after = rectMap(ul);
  const r1 = after.get(movedLi);

  // 5) FLIP остальных (мягко)
  ul.querySelectorAll(':scope > li').forEach(el=>{
    const a = after.get(el), b = before.get(el);
    if(!a || !b || el === movedLi) return;
    const dx = b.left - a.left;
    const dy = b.top  - a.top;
    if (dx || dy){
      el.style.transform  = `translate(${dx}px, ${dy}px)`;
      el.offsetWidth; // reflow
      el.style.transition = `transform 520ms ${LIST_EASE}`;
      el.style.transform  = `translate(0,0)`;
      el.addEventListener('transitionend', function te(){
        el.style.transition=''; el.style.transform=''; el.removeEventListener('transitionend', te);
      });
    }
  });

  // 6) Запускаем «линзу»
  const stopLens = startLensLoop(ghost, ul, movedLi);

  // 7) Проезд призрака
  requestAnimationFrame(()=>{
    const s = ghost.style;
    s.transition = `top ${MOVE_DURATION}ms ${LIST_EASE}`;
    s.top = r1.top + 'px';

    ghost.addEventListener('transitionend', function done(){
      ghost.removeEventListener('transitionend', done);
      stopLens();            // очистка искажений
      ghost.remove();        // убираем призрак
      movedLi.classList.remove('leaving'); // показываем реальный элемент на новой позиции
    }, { once: true });
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
    const text=document.createElement('div');
    text.className='task-text'; text.contentEditable='true'; text.spellcheck=false;
    text.textContent=t.text||''; syncEmpty(text);

    wrap.appendChild(text);
    li.appendChild(circle); li.appendChild(wrap); list.appendChild(li);

    // Клик по кружку — отметка и анимация перемещения
    circle.addEventListener('click',()=>{
      if((text.textContent||'').trim()==='') return;

      t.done=!t.done; save();

      if(t.done){
        li.classList.add('done'); circle.innerHTML=''; circle.appendChild(makeTick());
        buildStrike(wrap,true);

        // протяжка вниз
        animateListReorder(li, ()=> { list.appendChild(li); });

      } else {
        li.classList.remove('done'); circle.innerHTML='';
        const s=wrap.querySelector('.strike-svg'); if(s) s.remove();

        // протяжка вверх (в начало)
        animateListReorder(li, ()=> { list.insertBefore(li, list.firstChild); });
      }
    });

    // Изменение текста
    text.addEventListener('input',()=>{
      tasks[i].text=text.textContent; save(); syncEmpty(text);
      if(t.done) buildStrike(wrap,false);
    });

    // Backspace/Delete на пустой строке — удалить задачу
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

/* ===================== Пересбор зачёркиваний при ресайзе ===================== */
window.addEventListener('resize', ()=>{
  document.querySelectorAll('#tasks li.done .textwrap').forEach(w=>buildStrike(w,false));
});

/* ===================== Анти-rubber-band для iOS ===================== */
(function lockIOSRubberBand(){
  const scroller = document.getElementById('tasks');
  if (!scroller) return;

  document.addEventListener('touchmove', (e)=>{
    if (!e.target.closest('#tasks')) e.preventDefault();
  }, { passive: false });

  scroller.addEventListener('touchstart', ()=>{
    const max = scroller.scrollHeight - scroller.clientHeight;
    if (max <= 0) return;
    if (scroller.scrollTop <= 0) scroller.scrollTop = 1;
    else if (scroller.scrollTop >= max) scroller.scrollTop = max - 1;
  }, { passive: true });

  scroller.addEventListener('touchmove', (e)=>{
    if (scroller.scrollHeight <= scroller.clientHeight) e.preventDefault();
  }, { passive: false });
})();

/* ===================== Первый рендер ===================== */
render();
