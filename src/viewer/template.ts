// ============================================================
// auk — AI Context Engineering Platform
// Graph viewer template — renders the dependency/call graph as
// ONE self-contained HTML file: no CDN, no external requests.
// Hand-rolled canvas force-directed layout with seeded initial
// positions so screenshots are reproducible.
// ============================================================

import type { DependencyGraph } from '../types/analysis.js';

const LAYER_COLORS: Record<string, string> = {
  api: '#e15759', controller: '#f28e2b', service: '#4e79a7', data: '#76b7b2',
  model: '#59a14f', ui: '#edc948', utility: '#b07aa1', config: '#9c755f',
  test: '#bab0ac', unknown: '#79706e',
};

export function renderGraphHtml(graph: DependencyGraph, projectName: string): string {
  const data = {
    files: graph.nodes.map(n => ({
      id: n.id, layer: n.layer, degree: n.centrality.degree, exports: n.symbols.slice(0, 12),
    })),
    edges: graph.edges.map(e => ({ s: e.source, t: e.target })),
    symbols: (graph.symbols ?? []).map(s => ({
      id: s.id, file: s.file, name: s.name, kind: s.kind,
      fanIn: s.metrics.fanIn, fanOut: s.metrics.fanOut,
    })),
    callEdges: (graph.callEdges ?? []).filter(e => e.resolved).map(e => ({ s: e.source, t: e.target, k: e.kind })),
    layers: LAYER_COLORS,
    project: projectName,
    generatedAt: graph.generatedAt,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>auk graph — ${escapeHtml(projectName)}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#1a1a1a; --panel:#f4f4f5; --line:#d4d4d8; }
  @media (prefers-color-scheme: dark) { :root { --bg:#101014; --fg:#e4e4e7; --panel:#1c1c22; --line:#3f3f46; } }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.4 -apple-system,'Segoe UI',sans-serif; background:var(--bg); color:var(--fg); overflow:hidden; }
  #toolbar { position:fixed; top:0; left:0; right:0; display:flex; gap:12px; align-items:center; padding:10px 14px; background:var(--panel); border-bottom:1px solid var(--line); z-index:2; }
  #toolbar h1 { font-size:15px; margin:0; }
  #search { flex:0 0 260px; padding:6px 10px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); }
  #legend { display:flex; gap:10px; flex-wrap:wrap; font-size:12px; }
  .chip { display:inline-flex; align-items:center; gap:4px; }
  .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
  canvas { display:block; cursor:grab; }
  #panel { position:fixed; top:54px; right:0; bottom:0; width:320px; padding:14px; background:var(--panel); border-left:1px solid var(--line); overflow:auto; display:none; z-index:2; }
  #panel h2 { font-size:14px; word-break:break-all; margin:0 0 8px; }
  #panel h3 { font-size:12px; text-transform:uppercase; opacity:.7; margin:14px 0 4px; }
  #panel ul { margin:0; padding-left:18px; font-size:12px; }
  #panel li { word-break:break-all; }
  #panel .close { float:right; cursor:pointer; border:none; background:none; color:var(--fg); font-size:16px; }
  #hint { position:fixed; bottom:10px; left:14px; font-size:11px; opacity:.6; z-index:2; }
</style>
</head>
<body>
<div id="toolbar">
  <h1>auk graph — ${escapeHtml(projectName)}</h1>
  <input id="search" type="search" placeholder="Filter files…">
  <div id="legend"></div>
</div>
<canvas id="c"></canvas>
<div id="panel"></div>
<div id="hint">drag to pan · wheel to zoom · drag nodes · click for details</div>
<script type="application/json" id="auk-graph">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
const DATA = JSON.parse(document.getElementById('auk-graph').textContent);
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H; function resize(){ W=canvas.width=innerWidth*devicePixelRatio; H=canvas.height=innerHeight*devicePixelRatio; canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px'; }
resize(); addEventListener('resize', resize);

// seeded PRNG so layouts are reproducible
let seed = 42; function rand(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }

const idx = new Map(DATA.files.map((f,i)=>[f.id,i]));
const N = DATA.files.length;
const nodes = DATA.files.map(f=>({ ...f,
  x:(rand()-0.5)*Math.sqrt(N)*120, y:(rand()-0.5)*Math.sqrt(N)*120, vx:0, vy:0,
  r: 4+Math.min(14, Math.sqrt(f.degree)*2.2) }));
const links = DATA.edges.filter(e=>idx.has(e.s)&&idx.has(e.t)).map(e=>({a:idx.get(e.s), b:idx.get(e.t)}));

// adjacency for highlighting
const adj = nodes.map(()=>new Set());
for(const l of links){ adj[l.a].add(l.b); adj[l.b].add(l.a); }

let cam = { x:0, y:0, k: Math.max(0.2, 2.2/Math.log2(N+2)) };
let selected = -1, hovered = -1, filter = '';
let alpha = 1;

function tick(){
  if(alpha < 0.003) return;
  alpha *= 0.985;
  // repulsion (grid-bucketed for larger graphs)
  const cell = 120, grid = new Map();
  nodes.forEach((n,i)=>{ const k=(n.x/cell|0)+':'+(n.y/cell|0); (grid.get(k)||grid.set(k,[]).get(k)).push(i); });
  for(const [key,bucket] of grid){
    const [gx,gy]=key.split(':').map(Number);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const other = grid.get((gx+dx)+':'+(gy+dy)); if(!other) continue;
      for(const i of bucket)for(const j of other){ if(i>=j) continue;
        const a=nodes[i], b=nodes[j];
        let ddx=a.x-b.x, ddy=a.y-b.y, d2=ddx*ddx+ddy*ddy||1;
        if(d2>cell*cell*4) continue;
        const f = 1800*alpha/d2;
        ddx*=f; ddy*=f; a.vx+=ddx; a.vy+=ddy; b.vx-=ddx; b.vy-=ddy;
      }
    }
  }
  // springs
  for(const l of links){
    const a=nodes[l.a], b=nodes[l.b];
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||1;
    const f=(d-90)*0.02*alpha;
    a.vx+=dx/d*f; a.vy+=dy/d*f; b.vx-=dx/d*f; b.vy-=dy/d*f;
  }
  // centering + integrate
  for(const n of nodes){
    n.vx-=n.x*0.001*alpha; n.vy-=n.y*0.001*alpha;
    n.x+=n.vx; n.y+=n.vy; n.vx*=0.6; n.vy*=0.6;
  }
}

function matches(n){ return !filter || n.id.toLowerCase().includes(filter); }

function draw(){
  tick();
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.clearRect(0,0,innerWidth,innerHeight);
  ctx.translate(innerWidth/2+cam.x, innerHeight/2+cam.y);
  ctx.scale(cam.k, cam.k);

  const focusSet = selected>=0 ? adj[selected] : null;
  ctx.lineWidth = 1/cam.k;
  for(const l of links){
    const dim = (focusSet && l.a!==selected && l.b!==selected);
    ctx.strokeStyle = dim ? 'rgba(128,128,128,0.06)' : 'rgba(128,128,128,0.25)';
    ctx.beginPath(); ctx.moveTo(nodes[l.a].x, nodes[l.a].y); ctx.lineTo(nodes[l.b].x, nodes[l.b].y); ctx.stroke();
  }
  nodes.forEach((n,i)=>{
    const dim = (!matches(n)) || (focusSet && i!==selected && !focusSet.has(i));
    ctx.globalAlpha = dim ? 0.12 : 1;
    ctx.fillStyle = DATA.layers[n.layer] || '#79706e';
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
    if(i===selected || i===hovered){ ctx.strokeStyle='#fff'; ctx.lineWidth=2/cam.k; ctx.stroke(); }
    if(cam.k>0.7 && !dim && (n.degree>6 || i===selected || i===hovered)){
      ctx.fillStyle='var(--fg)'; ctx.fillStyle=getComputedStyle(document.body).color;
      ctx.font = (11/cam.k)+'px sans-serif';
      ctx.fillText(n.id.split('/').pop(), n.x+n.r+3/cam.k, n.y+3/cam.k);
    }
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}

function pick(mx,my){
  const x=(mx-innerWidth/2-cam.x)/cam.k, y=(my-innerHeight/2-cam.y)/cam.k;
  for(let i=nodes.length-1;i>=0;i--){ const n=nodes[i]; const dx=n.x-x, dy=n.y-y;
    if(dx*dx+dy*dy < (n.r+3)*(n.r+3)) return i; }
  return -1;
}

let drag=null, panning=false, px=0, py=0;
canvas.addEventListener('mousedown', e=>{
  const i=pick(e.clientX,e.clientY);
  if(i>=0){ drag=i; } else { panning=true; }
  px=e.clientX; py=e.clientY;
});
addEventListener('mousemove', e=>{
  hovered = drag===null&&!panning ? pick(e.clientX,e.clientY) : hovered;
  canvas.style.cursor = hovered>=0 ? 'pointer' : 'grab';
  if(drag!==null){ nodes[drag].x+=(e.clientX-px)/cam.k; nodes[drag].y+=(e.clientY-py)/cam.k; alpha=Math.max(alpha,0.1); }
  else if(panning){ cam.x+=e.clientX-px; cam.y+=e.clientY-py; }
  px=e.clientX; py=e.clientY;
});
addEventListener('mouseup', e=>{
  if(drag!==null && Math.abs(e.clientX-px)<3){ /* drop */ }
  if(!panning && drag===null){}
  drag=null; panning=false;
});
canvas.addEventListener('click', e=>{
  const i=pick(e.clientX,e.clientY);
  selected = i;
  showPanel(i);
});
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const f = Math.exp(-e.deltaY*0.0015);
  cam.k = Math.min(5, Math.max(0.05, cam.k*f));
},{passive:false});

const panel = document.getElementById('panel');
function showPanel(i){
  if(i<0){ panel.style.display='none'; return; }
  const n = nodes[i];
  const deps = links.filter(l=>l.a===i).map(l=>nodes[l.b].id);
  const dependents = links.filter(l=>l.b===i).map(l=>nodes[l.a].id);
  const syms = DATA.symbols.filter(s=>s.file===n.id).sort((a,b)=>b.fanIn-a.fanIn).slice(0,10);
  panel.innerHTML = '<button class="close" onclick="this.parentNode.style.display=\\'none\\'">×</button>'
    + '<h2>'+esc(n.id)+'</h2>'
    + '<div><span class="dot" style="background:'+(DATA.layers[n.layer]||'#777')+'"></span> '+esc(n.layer)+' · degree '+n.degree+'</div>'
    + (syms.length? '<h3>Symbols (by fan-in)</h3><ul>'+syms.map(s=>'<li>'+esc(s.name)+' <small>('+s.kind+', in '+s.fanIn+' / out '+s.fanOut+')</small></li>').join('')+'</ul>':'')
    + (deps.length? '<h3>Imports ('+deps.length+')</h3><ul>'+deps.slice(0,15).map(d=>'<li>'+esc(d)+'</li>').join('')+'</ul>':'')
    + (dependents.length? '<h3>Imported by ('+dependents.length+')</h3><ul>'+dependents.slice(0,15).map(d=>'<li>'+esc(d)+'</li>').join('')+'</ul>':'');
  panel.style.display='block';
}
function esc(s){ const d=document.createElement('span'); d.textContent=s; return d.innerHTML; }

document.getElementById('search').addEventListener('input', e=>{ filter=e.target.value.toLowerCase(); });

const legend = document.getElementById('legend');
const usedLayers = [...new Set(nodes.map(n=>n.layer))].sort();
legend.innerHTML = usedLayers.map(l=>'<span class="chip"><span class="dot" style="background:'+(DATA.layers[l]||'#777')+'"></span>'+esc(l)+'</span>').join('');

draw();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
