'use strict';
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const ns = 'http://www.w3.org/2000/svg';
const svgNode = (tag, attrs = {}, text) => { const n = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; };
const value = (n, digits = 1) => n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, {maximumFractionDigits:digits,minimumFractionDigits:digits});
const validPath = (path, kind) => typeof path === 'string' && (kind === 'png' ? /^plots\/[a-f0-9]{32}-[a-f0-9]{16}\.png$/ : /^data\/shots\/[a-f0-9]{32}-[a-f0-9]{16}\.json$/).test(path);
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
  for(let i=0;i<=4;i++){const y=bottom-i*(bottom-top)/4;svg.append(svgNode('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#e4e5da'}),svgNode('text',{x:left-8,y:y+3,'text-anchor':'end'},Math.round(max*i/4)));}
  const coords=days.map((d,i)=>[left+i*(right-left)/Math.max(1,days.length-1),bottom-d.total/max*(bottom-top)]);
  if(coords.length){const points=coords.map(p=>p.join(',')).join(' '); svg.append(svgNode('polygon',{points:`${left},${bottom} ${points} ${coords.at(-1)[0]},${bottom}`,fill:'#dce6d5'}),svgNode('polyline',{points,fill:'none',stroke:'#315e49','stroke-width':2})); for(const [i,d] of days.entries()){ const circle=svgNode('circle',{cx:coords[i][0],cy:coords[i][1],r:3,fill:'#315e49'});circle.append(svgNode('title',{},`${d.date}: ${d.count} shots · ${d.total} total`));svg.append(circle);}}
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
function drawCurve(shot,field,label,color){
  const card=node('div',undefined,'curve');card.append(node('h3',label));
  const points=shot.samples, present=points.filter(p=>p[field]!==null&&Number.isFinite(p[field]));
  const svg=svgNode('svg',{viewBox:'0 0 330 175',role:'img','aria-label':`${shot.profile}: ${label}`});
  if(!present.length){svg.append(svgNode('text',{x:165,y:90,'text-anchor':'middle'},'Not recorded'));card.append(svg);return card;}
  let ymin=field==='temperature'?Math.min(...present.map(p=>p[field]))-1:Math.min(0,...present.map(p=>p[field]));
  let ymax=Math.max(...present.map(p=>p[field])); if(ymax<=ymin)ymax=ymin+1; else ymax+=(ymax-ymin)*.08;
  const x0=36,x1=320,y0=12,y1=147,tmax=Math.max(1,shot.metrics.duration_s),x=t=>x0+t/tmax*(x1-x0),y=v=>y1-(v-ymin)/(ymax-ymin)*(y1-y0);
  for(const p of points)if(p.phase==='preinfusion')svg.append(svgNode('rect',{x:x(p.time_s),y:y0,width:Math.max(0,x(p.time_s+p.interval_s)-x(p.time_s)),height:y1-y0,fill:'#f2e2c1'}));
  for(let i=0;i<=3;i++){const v=ymin+i*(ymax-ymin)/3;svg.append(svgNode('line',{x1:x0,x2:x1,y1:y(v),y2:y(v),stroke:'#e6e6dc'}),svgNode('text',{x:x0-5,y:y(v)+3,'text-anchor':'end'},value(v,field==='temperature'?1:0)));}
  for(let i=0;i<=4;i++){const t=tmax*i/4;svg.append(svgNode('text',{x:x(t),y:165,'text-anchor':'middle'},value(t,0)+'s'));}
  let commands='',pen=false;
  for(const p of points){if(p[field]===null||!Number.isFinite(p[field])){pen=false;continue;} commands+=(pen?'L':'M')+x(p.time_s)+','+y(p[field])+' ';pen=true;}
  svg.append(svgNode('path',{d:commands,stroke:color,'stroke-width':1.7,fill:'none','stroke-linejoin':'round'}));
  const cross=svgNode('line',{x1:x0,x2:x0,y1:y0,y2:y1,stroke:color,'stroke-dasharray':'3 3',visibility:'hidden'});svg.append(cross);
  svg.addEventListener('pointermove',e=>{const rect=svg.getBoundingClientRect(),t=((e.clientX-rect.left)*330/rect.width-x0)/(x1-x0)*tmax;let nearest=points[0];for(const p of points)if(Math.abs(p.time_s-t)<Math.abs(nearest.time_s-t))nearest=p;cross.setAttribute('x1',x(nearest.time_s));cross.setAttribute('x2',x(nearest.time_s));cross.setAttribute('visibility','visible');$('readout').textContent=`${value(nearest.time_s)} s · ${nearest.stage} · ${value(nearest.pressure)} bar · ${value(nearest.flow)} mL/s · ${value(nearest.weight)} g · ${value(nearest.temperature)} °C`;});
  svg.addEventListener('pointerleave',()=>cross.setAttribute('visibility','hidden'));
  card.append(svg);return card;
}
async function selectShot(summary){
  const version=++selectionVersion;selected=summary.asset;history.replaceState(null,'','#'+selected);renderList();
  $('shot-name').textContent=summary.profile;$('shot-date').textContent=dateText(summary.timestamp,{hour:'numeric',minute:'2-digit'})+' · '+archive.timezone;
  $('png-link').hidden=true;$('json-link').hidden=true;$('curves').replaceChildren(node('p','Loading curves…','empty'));
  const m=summary.metrics;$('shot-metrics').replaceChildren();
  for(const [num,label] of [[m.duration_s,'s brew'],[m.extraction_duration_s,'s extraction'],[m.weight_g,'g output']]){const p=node('span');p.append(node('b',value(num)),document.createTextNode(label));$('shot-metrics').append(p);}
  try{
    if(!validPath(summary.json,'json')||!validPath(summary.png,'png'))throw Error('Invalid asset path');
    const response=await fetch(summary.json);if(!response.ok)throw Error('Curve file is not available yet');const shot=await response.json();if(version!==selectionVersion)return;
    $('curves').replaceChildren(...[['pressure','PRESSURE · bar','#315e49'],['flow','FLOW · mL/s','#bc703d'],['weight','SCALE WEIGHT · g','#577598'],['temperature','MEASURED TEMPERATURE · °C','#a45a6b']].map(args=>drawCurve(shot,...args)));
    $('png-link').href=summary.png;$('png-link').hidden=false;$('json-link').href=summary.json;$('json-link').hidden=false;
    $('readout').textContent='Move over a curve to inspect a sample.';
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
