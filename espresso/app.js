'use strict';
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const ns = 'http://www.w3.org/2000/svg';
const svgNode = (tag, attrs = {}, text) => { const n = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; };
const value = (n, digits = 1) => n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, {maximumFractionDigits:digits,minimumFractionDigits:digits});
const validPath = path => typeof path === 'string' && /^data\/shots\/[a-f0-9]{32}-[a-f0-9]{16}\.json$/.test(path);
let archive, selected, visible = 12, selectionVersion = 0;
const dateText = (stamp, options = {}) => new Intl.DateTimeFormat(undefined, {timeZone:archive.timezone, month:'short',day:'numeric',year:'numeric', ...options}).format(new Date(stamp*1000));

function metric(label, amount, unit, note) {
  const box = node('div', undefined, 'metric'); box.append(node('label', label));
  box.append(node('strong', value(amount)),node('span',unit,'unit'),node('small',note));
  return box;
}
function renderStats(stats) {
  $('total').textContent = stats.total_shots.toLocaleString();
  $('date-range').textContent = stats.first_date ? `${stats.first_date} → ${stats.as_of}` : 'Your first shot starts the story.';
  $('machine').textContent = archive.machine;
  $('daily-average').textContent = value(stats.shots_per_day,2) + ' / day';
  $('footer-date').textContent = `${archive.timezone} · Statistics through ${stats.as_of}`;
  const metrics = $('metrics'); metrics.replaceChildren();
  metrics.append(metric('Cups per calendar day',stats.shots_per_day,'cups',`${stats.calendar_days} days, including quiet days`));
  const fields = [
    ['temperature_c','Measured temperature','°C'],['duration_s','Brew time, incl. pre-infusion','s'],
    ['weight_g','Output weight','g'],['extraction_pressure_bar','Extraction pressure','bar'],
    ['preinfusion_pressure_bar','Pre-infusion pressure','bar'],['extraction_duration_s','Main extraction time','s'],
    ['target_temperature_c','Profile target temperature','°C']
  ];
  for (const [key,label,unit] of fields) { const item=stats.averages[key]; metrics.append(metric(label,item.value,unit,item.n ? `${item.n} shots with this measurement` : 'Not available in these records')); }
  const svg=svgNode('svg',{viewBox:'0 0 520 185',role:'img','aria-label':'Cumulative shots over time'});
  const days=stats.daily, max=Math.max(1,stats.total_shots), left=30,right=510,top=12,bottom=158;
  for(let i=0;i<=4;i++){const y=bottom-i*(bottom-top)/4;svg.append(svgNode('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#303741'}),svgNode('text',{x:left-8,y:y+3,'text-anchor':'end'},Math.round(max*i/4)));}
  const coords=days.map((d,i)=>[left+i*(right-left)/Math.max(1,days.length-1),bottom-d.total/max*(bottom-top)]);
  if(coords.length){const points=coords.map(p=>p.join(',')).join(' '); svg.append(svgNode('polygon',{points:`${left},${bottom} ${points} ${coords.at(-1)[0]},${bottom}`,fill:'#182e42'}),svgNode('polyline',{points,fill:'none',stroke:'#83c8ff','stroke-width':2})); for(const [i,d] of days.entries()){ const circle=svgNode('circle',{cx:coords[i][0],cy:coords[i][1],r:3,fill:'#83c8ff'});circle.append(svgNode('title',{},`${d.date}: ${d.count} shots · ${d.total} total`));svg.append(circle);}}
  svg.append(svgNode('text',{x:left,y:180},stats.first_date || 'No shots yet'),svgNode('text',{x:right,y:180,'text-anchor':'end'},stats.as_of));
  $('cumulative').replaceChildren(svg);
  const maxWeek=Math.max(1,...stats.weekday.map(d=>d.average || 0)); $('weekdays').replaceChildren();
  for(const d of stats.weekday){ const col=node('div',undefined,'weekday'),bar=node('div',undefined,'bar'+(d.average===Math.max(...stats.weekday.map(x=>x.average||0))?' peak':''));bar.style.height=(100*(d.average||0)/maxWeek)+'%';bar.append(node('span',d.average===null?'—':value(d.average,1)));col.append(bar,node('label',d.name));col.title=`${d.shots} shots across ${d.days} ${d.name} occurrences`;$('weekdays').append(col);}
  $('profiles').replaceChildren(); const maxProfile=Math.max(1,...stats.profiles.map(p=>p.count));
  for(const p of stats.profiles){const row=node('div',undefined,'profile-row'),track=node('div',undefined,'track'),fill=node('div');fill.style.width=(p.count/maxProfile*100)+'%';track.append(fill);row.append(node('span',p.name,'profile-name'),track,node('b',p.count));$('profiles').append(row);const option=node('option',p.name);option.value=p.name;$('profile-filter').append(option);}
  if(!stats.profiles.length)$('profiles').append(node('p','Profiles will appear after the first import.','empty'));
}
function renderList(){
  const filter=$('profile-filter').value; const shots=archive.shots.filter(s=>!filter||s.profile===filter);$('shot-list').replaceChildren();
  for(const shot of shots.slice(0,visible)){
    const b=node('button',undefined,'shot-row'+(selected===shot.asset?' active':'')); b.type='button';b.setAttribute('aria-pressed',String(selected===shot.asset));
    b.append(node('span',dateText(shot.timestamp,{hour:'numeric',minute:'2-digit'})),node('strong',shot.profile),node('small',`${value(shot.metrics.duration_s)} s · ${value(shot.metrics.weight_g)} g`));
    b.addEventListener('click',()=>selectShot(shot));$('shot-list').append(b);
  }
  $('more').hidden=shots.length<=visible;
}
// Dependency-free SVG: one time domain, independent physical-unit scales.
function drawOverlay(shot){
  const host=node('div',undefined,'overlay'), controls=node('div',undefined,'plot-controls');
  const channels=[
    {key:'pressure',label:'Pressure',unit:'bar',color:'#79deb3',side:'left',slot:0},
    {key:'flow',label:'Flow',unit:'mL/s',color:'#ffbc75',side:'left',slot:1},
    {key:'weight',label:'Weight',unit:'g',color:'#83c8ff',side:'right',slot:0},
    {key:'temperature',label:'Temperature',unit:'°C',color:'#ee9ecb',side:'right',slot:1}
  ];
  const points=shot.samples.filter(p=>Number.isFinite(p.time_s));
  const full=[0,Math.max(1,shot.metrics.duration_s,...points.map(p=>p.time_s))];
  let domain=[...full], inspected=0, drag=null;
  for(const c of channels){
    const vals=points.map(p=>p[c.key]).filter(Number.isFinite);
    c.available=vals.length>0;c.shown=c.available;
    c.min=c.key==='temperature'&&vals.length?Math.min(...vals)-1:Math.min(0,...vals);
    c.max=Math.max(c.min+1,...vals);c.max+=(c.max-c.min)*.08;
    const label=node('label'),check=node('input');check.type='checkbox';check.checked=c.shown;check.disabled=!c.available;
    label.style.color=c.color;label.append(check,document.createTextNode(`${c.label} (${c.unit})${c.available?'':' — not recorded'}`));
    check.addEventListener('change',()=>{c.shown=check.checked;render();});controls.append(label);
  }
  const reset=node('button','Reset zoom','button');reset.type='button';reset.addEventListener('click',()=>{domain=[...full];render();});controls.append(reset);
  host.append(controls,node('p','Drag across the chart to zoom. Tap or hover to inspect; focus the chart and use ← / → for samples.','caption'));
  const scroller=node('div',undefined,'plot-scroll');host.append(scroller);
  const width=760,height=360,left=112,right=648,top=40,bottom=314;
  let svg,cursor,selection,dots;
  const x=t=>left+(t-domain[0])/(domain[1]-domain[0])*(right-left);
  const y=(v,c)=>bottom-(v-c.min)/(c.max-c.min)*(bottom-top);
  const pointerTime=e=>{
    const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
    const local=pt.matrixTransform(svg.getScreenCTM().inverse());
    return domain[0]+Math.max(0,Math.min(1,(local.x-left)/(right-left)))*(domain[1]-domain[0]);
  };
  const nearest=t=>{let i=0;for(let j=1;j<points.length;j++)if(Math.abs(points[j].time_s-t)<Math.abs(points[i].time_s-t))i=j;return i;};
  function inspect(i){
    if(!points.length)return;
    inspected=Math.max(0,Math.min(points.length-1,i));const p=points[inspected];
    cursor.setAttribute('x1',x(p.time_s));cursor.setAttribute('x2',x(p.time_s));
    cursor.setAttribute('visibility',p.time_s>=domain[0]&&p.time_s<=domain[1]?'visible':'hidden');
    dots.replaceChildren();
    for(const c of channels)if(c.shown&&Number.isFinite(p[c.key])&&p.time_s>=domain[0]&&p.time_s<=domain[1])dots.append(svgNode('circle',{cx:x(p.time_s),cy:y(p[c.key],c),r:4,fill:c.color,stroke:'#14171c','stroke-width':1}));
    $('readout').textContent=`${value(p.time_s,2)} s · ${p.stage || 'Unknown stage'} · `+channels.filter(c=>c.shown).map(c=>`${c.label}: ${value(p[c.key],2)} ${c.unit}`).join(' · ');
  }
  function render(){
    reset.disabled=domain[0]===full[0]&&domain[1]===full[1];
    svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,tabindex:0,role:'img','aria-label':`${shot.profile}: overlaid extraction curves. Independent colored vertical scales. Arrow keys inspect samples; Escape resets zoom.`});
    scroller.replaceChildren(svg);
    const defs=svgNode('defs'),clip=svgNode('clipPath',{id:'shot-plot-clip'});clip.append(svgNode('rect',{x:left,y:top,width:right-left,height:bottom-top}));defs.append(clip);svg.append(defs);
    const curves=svgNode('g',{'clip-path':'url(#shot-plot-clip)'});
    for(const p of points)if(p.phase==='preinfusion')curves.append(svgNode('rect',{x:x(p.time_s),y:top,width:Math.max(0,x(p.time_s+p.interval_s)-x(p.time_s)),height:bottom-top,fill:'#41331e'}));
    for(let i=0;i<=4;i++){
      const yy=bottom-i*(bottom-top)/4,t=domain[0]+i*(domain[1]-domain[0])/4;
      svg.append(svgNode('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:'#303741'}),svgNode('text',{x:x(t),y:bottom+20,'text-anchor':'middle'},value(t,1)));
    }
    svg.append(curves,svgNode('text',{x:(left+right)/2,y:height-5,'text-anchor':'middle'},'Brew time · seconds'));
    for(const c of channels){
      if(!c.shown)continue;
      const axis=c.side==='left'?left-c.slot*60:right+c.slot*60;
      svg.append(svgNode('line',{x1:axis,x2:axis,y1:top,y2:bottom,stroke:c.color}));
      for(let i=0;i<=4;i++){
        const v=c.min+i*(c.max-c.min)/4;
        const tick=svgNode('text',{x:axis+(c.side==='left'?-7:7),y:y(v,c)+4,'text-anchor':c.side==='left'?'end':'start'},value(v,1));tick.style.fill=c.color;svg.append(tick);
      }
      const title=svgNode('text',{x:axis,y:22,'text-anchor':'middle'},c.unit);title.style.fill=c.color;svg.append(title);
      let d='',pen=false,last=null;
      for(const p of points){
        if(!Number.isFinite(p[c.key])){pen=false;last=null;continue;}
        if(last!==null&&p.time_s-last>10)pen=false;
        d+=(pen?'L':'M')+x(p.time_s)+','+y(p[c.key],c)+' ';pen=true;last=p.time_s;
      }
      curves.append(svgNode('path',{d,stroke:c.color,'stroke-width':2,fill:'none','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}));
    }
    cursor=svgNode('line',{y1:top,y2:bottom,stroke:'#c6d0dd','stroke-dasharray':'4 3',visibility:'hidden'});
    selection=svgNode('rect',{y:top,height:bottom-top,fill:'#83c8ff',opacity:.15,width:0});dots=svgNode('g');svg.append(cursor,dots,selection);
    svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=pointerTime(e);svg.setPointerCapture(e.pointerId);inspect(nearest(drag));});
    svg.addEventListener('pointermove',e=>{const t=pointerTime(e);inspect(nearest(t));if(drag!==null){selection.setAttribute('x',x(Math.min(t,drag)));selection.setAttribute('width',Math.abs(x(t)-x(drag)));}});
    svg.addEventListener('pointerup',e=>{if(drag===null)return;const t=pointerTime(e),start=drag;drag=null;if(Math.abs(x(t)-x(start))>8){domain=[Math.min(start,t),Math.max(start,t)];render();}else selection.setAttribute('width',0);});
    svg.addEventListener('pointercancel',()=>{drag=null;selection.setAttribute('width',0);});
    svg.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();domain=[...full];render();svg.focus();}
      else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const candidates=points.map((p,i)=>({p,i})).filter(({p})=>p.time_s>=domain[0]&&p.time_s<=domain[1]);const next=e.key==='ArrowRight'?candidates.find(({i})=>i>inspected):candidates.reverse().find(({i})=>i<inspected);if(next)inspect(next.i);}
    });
    if(points.length)inspect(nearest(domain[0]));
  }
  render();return host;
}

async function selectShot(summary){
  const version=++selectionVersion;selected=summary.asset;history.replaceState(null,'','#'+selected);renderList();
  $('shot-name').textContent=summary.profile;$('shot-date').textContent=dateText(summary.timestamp,{hour:'numeric',minute:'2-digit'})+' · '+archive.timezone;
  $('json-link').hidden=true;$('curves').replaceChildren(node('p','Loading curves…','empty'));
  const m=summary.metrics;$('shot-metrics').replaceChildren();
  for(const [num,label] of [[m.duration_s,'s brew'],[m.extraction_duration_s,'s extraction'],[m.weight_g,'g output']]){const p=node('span');p.append(node('b',value(num)),document.createTextNode(label));$('shot-metrics').append(p);}
  try{
    if(!validPath(summary.json,'json'))throw Error('Invalid asset path');
    const response=await fetch(summary.json);if(!response.ok)throw Error('Curve file is not available yet');const shot=await response.json();if(version!==selectionVersion)return;
    $('curves').replaceChildren(drawOverlay(shot));
    $('json-link').href=summary.json;$('json-link').hidden=false;
  }catch(error){if(version===selectionVersion)$('curves').replaceChildren(node('p',error.message+' — reload after deployment completes.','error'));}
}
async function start(){
  try{
    const response=await fetch('data/index.json',{cache:'no-store'});if(!response.ok)throw Error('Shot data is not published yet');
    archive=await response.json();if(archive.schema_version!==1)throw Error('Unsupported archive format');
    renderStats(archive.statistics);$('notice').textContent=archive.machine.startsWith('DEMO')?'DEMO — these are synthetic shots, shown only to preview the dashboard.':'';
    $('more').addEventListener('click',()=>{visible+=12;renderList();});$('profile-filter').addEventListener('change',()=>{visible=12;renderList();});
    if(archive.shots.length){const initial=archive.shots.find(s=>s.asset===location.hash.slice(1))||archive.shots[0];await selectShot(initial);}else renderList();
  }catch(error){$('notice').textContent=error.message+'. The local collector publishes this file through a merged PR.';$('notice').classList.add('error');}
}
start();
