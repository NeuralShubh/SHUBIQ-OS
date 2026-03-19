'use strict';
const API_BASE = '';
const TOKEN_KEY = 'shubiq_token_v1';
function getToken(){ return localStorage.getItem(TOKEN_KEY)||''; }
function setToken(t){ t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY); }
function showLogin(){ document.getElementById('login-page').style.display='block'; document.getElementById('app').style.display='none'; }
function showApp(){ document.getElementById('login-page').style.display='none'; document.getElementById('app').style.display='grid'; }

async function apiFetch(path,options={}){
  const headers=Object.assign({'Content-Type':'application/json'},options.headers||{});
  const token=getToken(); if(token) headers.Authorization='Bearer '+token;
  const res=await fetch(API_BASE+path,Object.assign({credentials:'same-origin'},options,{headers}));
  let payload=null; try{payload=await res.json()}catch(e){}
  if(res.status===401){setToken('');showLogin();throw new Error(payload&&payload.error?payload.error:'Unauthorized');}
  if(!res.ok)throw new Error(payload&&payload.error?payload.error:'Request failed');
  return payload;
}

const CURRENCIES={INR:{sym:'₹'},USD:{sym:'$'},EUR:{sym:'€'},GBP:{sym:'£'},AED:{sym:'د.إ'},SGD:{sym:'S$'},CAD:{sym:'CA$'},AUD:{sym:'A$'}};
function cs(c){return CURRENCIES[c]?CURRENCIES[c].sym:'₹';}
function fmt(n,cur='INR'){const s=cs(cur);const x=Math.abs(n);if(x>=10000000)return s+(x/10000000).toFixed(2)+'Cr';if(x>=100000)return s+(x/100000).toFixed(2)+'L';if(x>=1000)return s+(x/1000).toFixed(1)+'K';return s+x.toLocaleString('en-IN',{maximumFractionDigits:2});}
function fmtFull(n,cur='INR'){return cs(cur)+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtSigned(n,cur='INR'){const sign=n<0?'-':'';const x=Math.abs(n);const s=cs(cur);if(x>=10000000)return sign+s+(x/10000000).toFixed(2)+'Cr';if(x>=100000)return sign+s+(x/100000).toFixed(2)+'L';if(x>=1000)return sign+s+(x/1000).toFixed(1)+'K';return sign+s+x.toLocaleString('en-IN',{maximumFractionDigits:2});}

let DB={settings:{bizName:'',ownerName:'Admin',email:'',phone:'',address:'',gst:'',website:'',bankName:'',bankHolder:'',bankAcc:'',bankIfsc:'',upi:'',currency:'INR',tax:18,terms:30,fyStart:'April',invNotes:''},clients:[],projects:[],documents:[],expenses:[],products:[],subscriptions:[],counters:{INV:0,QUO:0,PRO:0}};

async function loadDB(){try{const d=await apiFetch('/api/db');if(d)DB=d;}catch(e){showToast('Load failed: '+e.message,'error');}}

async function doLogin(){
  const pass=document.getElementById('login-pass').value;
  try{
    const res=await apiFetch('/api/auth/login',{method:'POST',body:JSON.stringify({password:pass})});
    if(res&&res.token){setToken(res.token);if(res.data)DB=res.data;else await loadDB();showApp();initApp();document.getElementById('login-error').textContent='';document.getElementById('login-pass').value='';return;}
    throw new Error('Login failed');
  }catch(e){document.getElementById('login-error').textContent='Incorrect password. Try again.';document.getElementById('login-pass').style.borderColor='var(--red)';setTimeout(()=>{document.getElementById('login-pass').style.borderColor='';},2000);}
}
function doLogout(){setToken('');showLogin();showToast('Signed out','info');}
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

const PAGE_NAMES={dashboard:'Dashboard','overall-expenses':'Overall Expenses',projects:'Projects',clients:'Clients',invoices:'Documents',income:'Income',expenses:'Expenses',pnl:'P&L Report',products:'Products',subscriptions:'Income','labs-expenses':'Labs Expenses','labs-analytics':'Labs Analytics',documents:'Document Center',settings:'Settings'};
function nav(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nitem').forEach(n=>n.classList.remove('active'));
  const page=document.getElementById('page-'+id);if(page)page.classList.add('active');
  document.querySelectorAll('.nitem').forEach(n=>{if(n.getAttribute('onclick')&&n.getAttribute('onclick').includes("'"+id+"'"))n.classList.add('active');});
  document.getElementById('bc-current').textContent=PAGE_NAMES[id]||id;
  closeMobileMenu();renderPage(id);
}
function renderPage(id){
  if(id==='dashboard')renderDashboard();
  else if(id==='overall-expenses'){renderOverallExpenses();renderOverallExpStats();}
  else if(id==='projects')renderProjects();
  else if(id==='clients')renderClients();
  else if(id==='invoices'){renderDocs();renderDocStats();}
  else if(id==='income'){renderIncome();renderIncomeStats();}
  else if(id==='expenses'){renderExpenses();renderExpStats();}
  else if(id==='pnl')renderPnL();
  else if(id==='products')renderProducts();
  else if(id==='subscriptions'){renderSubscriptions();renderSubStats();}
  else if(id==='labs-expenses'){renderLabsExpenses();renderLabsExpStats();}
  else if(id==='labs-analytics')renderLabsAnalytics();
  else if(id==='documents')renderDocCenter();
  else if(id==='settings')loadSettings();
}

function initApp(){
  const hr=new Date().getHours();const greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  document.getElementById('dash-greeting').textContent=greet+', '+(DB.settings.ownerName||'Admin');
  document.getElementById('dash-date').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  document.getElementById('user-name-sb').textContent=DB.settings.ownerName||'Admin';
  document.getElementById('user-avatar-sb').textContent=(DB.settings.ownerName||'AD').substring(0,2).toUpperCase();
  updateNavBadges();renderDashboard();
}

function updateNavBadges(){
  const ap=DB.projects.filter(p=>p.status==='Active').length;
  const pi=DB.documents.filter(d=>d.type==='invoice'&&d.status==='Pending').length;
  document.getElementById('nb-projects').textContent=ap;
  document.getElementById('nb-clients').textContent=DB.clients.filter(c=>c.status==='Active').length;
  const nb=document.getElementById('nb-invoices');
  if(pi>0){nb.textContent=pi;nb.style.display='';}else{nb.style.display='none';}
}

function buildMonthlyData(records,vKey,dKey){
  const arr=new Array(12).fill(0);const fyS=DB.settings.fyStart==='January'?0:3;
  records.forEach(r=>{const d=new Date(r[dKey]);if(isNaN(d))return;arr[(d.getMonth()-fyS+12)%12]+=(r[vKey]||0);});return arr;
}
function buildMonthlyDataCalendar(records,vKey,dKey){
  const arr=new Array(12).fill(0);
  records.forEach(r=>{const d=new Date(r[dKey]);if(isNaN(d))return;arr[d.getMonth()]+=(r[vKey]||0);});
  return arr;
}

let dashCharts={};
function renderDashboard(){
  const siRaw=DB.documents.filter(d=>d.type==='invoice'&&d.status==='Paid').reduce((s,d)=>s+d.total,0);
  const projPaid=DB.projects.reduce((s,p)=>s+(p.paid||0),0);
  const si=siRaw>0?siRaw:projPaid;
  const li=DB.subscriptions.reduce((s,x)=>s+x.amount,0);
  const te=DB.expenses.reduce((s,e)=>s+e.amount,0);
  const np=si+li-te;
  const outInv=DB.documents.filter(d=>d.type==='invoice'&&d.status!=='Paid').reduce((s,d)=>s+Math.max(d.total-(d.paidAmount||0),0),0);
  const outProj=DB.projects.reduce((s,p)=>s+Math.max((p.budget||0)-(p.paid||0),0),0);
  const out=outInv>0?outInv:outProj;
  const outLabel=outInv>0?`${DB.documents.filter(d=>d.type==='invoice'&&d.status!=='Paid').length} invoices`:`${DB.projects.filter(p=>Math.max((p.budget||0)-(p.paid||0),0)>0).length} projects`;
  document.getElementById('dash-stats').innerHTML=`
    <div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmt(si+li)}</div><div class="stat-change up">Combined</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>
    <div class="stat"><div class="stat-label">Net Profit</div><div class="stat-value ${np>=0?'green':'red'}">${fmt(np)}</div><div class="stat-change ${np>=0?'up':'down'}">${np>=0?'Profitable':'Loss'}</div><div class="stat-icon ${np>=0?'green':'red'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div>
    <div class="stat"><div class="stat-label">Outstanding</div><div class="stat-value amber">${fmt(out)}</div><div class="stat-change neutral">${outLabel}</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg></div></div>
    <div class="stat"><div class="stat-label">Total Expenses</div><div class="stat-value red">${fmt(te)}</div><div class="stat-change neutral">${DB.expenses.length} entries</div><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/></svg></div></div>`;
  const months=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  const studioRecords=siRaw>0
    ? DB.documents.filter(d=>d.type==='invoice'&&d.status==='Paid').map(d=>({amount:d.total,date:d.date}))
    : DB.projects.filter(p=>p.paid>0).map(p=>({amount:p.paid,date:p.start||p.due||''}));
  const sm=buildMonthlyData(studioRecords,'amount','date');
  const lm=buildMonthlyData(DB.subscriptions,'amount','date');
  const em=buildMonthlyData(DB.expenses,'amount','date');
  const sym=cs(DB.settings.currency||'INR');
  if(dashCharts.trend){dashCharts.trend.destroy();dashCharts.trend=null;}
  const tc=document.getElementById('dashTrendChart');
  if(tc){dashCharts.trend=new Chart(tc,{type:'bar',data:{labels:months,datasets:[{label:'Studio',data:sm,backgroundColor:'rgba(54,132,219,0.65)',borderColor:'#3684DB',borderWidth:1,borderRadius:4},{label:'Labs',data:lm,backgroundColor:'rgba(245,158,11,0.65)',borderColor:'#F59E0B',borderWidth:1,borderRadius:4},{label:'Expenses',data:em,backgroundColor:'rgba(239,68,68,0.4)',borderColor:'#EF4444',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});}
  if(dashCharts.split){dashCharts.split.destroy();dashCharts.split=null;}
  const sc=document.getElementById('dashSplitChart');
  if(sc){dashCharts.split=new Chart(sc,{type:'doughnut',data:{datasets:[{data:[si,li],backgroundColor:['#3684DB','#F59E0B'],borderColor:'#0D2237',borderWidth:3,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false}}}});}
  const pct=si+li>0?Math.round(si/(si+li)*100):0;
  document.getElementById('dash-split-legend').innerHTML=`<div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:#3684DB"></div><div class="qm-label">Studio</div></div><div><div class="qm-value">${fmt(si)}</div><div style="font-size:0.7rem;color:var(--text4)">${pct}%</div></div></div><div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:#F59E0B"></div><div class="qm-label">Labs</div></div><div><div class="qm-value">${fmt(li)}</div><div style="font-size:0.7rem;color:var(--text4)">${100-pct}%</div></div></div><div class="qm-row" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:8px"><div class="qm-label" style="font-weight:600;color:var(--text)">Total</div><div class="qm-value">${fmt(si+li)}</div></div>`;
  const recentDocs=[...DB.documents].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,2);
  const recentExp=[...DB.expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,2);
  const acts=[...recentDocs.map(d=>({icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>',bg:'var(--accent-glow)',col:'var(--accent)',text:d.type.charAt(0).toUpperCase()+d.type.slice(1)+' '+d.num+' '+(d.status==='Paid'?'marked Paid':'created'),time:formatDate(d.date)})),...recentExp.map(e=>({icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',bg:'var(--amber-glow)',col:'var(--amber)',text:'Expense: '+e.description+' '+fmtFull(e.amount,e.currency),time:formatDate(e.date)}))].slice(0,4);
  document.getElementById('dash-activity').innerHTML=acts.length?acts.map(a=>`<div class="activity-item"><div class="act-icon" style="background:${a.bg};color:${a.col}">${a.icon}</div><div><div class="act-text">${a.text}</div><div class="act-time">${a.time}</div></div></div>`).join(''):'<div class="empty-state" style="padding:20px"><p>No recent activity</p></div>';
  const up=DB.projects.filter(p=>p.status!=='Completed').sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,4);
  document.getElementById('dash-deadlines').innerHTML=up.map(p=>{const cl=DB.clients.find(c=>c.id===p.client);const dl=Math.ceil((new Date(p.due)-new Date())/(1000*60*60*24));const urg=dl<=7?'red':dl<=21?'amber':'green';return`<div class="hover-row" onclick="nav('projects')"><div><div style="font-size:0.83rem;font-weight:600;color:var(--text)">${p.name}</div><div style="font-size:0.72rem;color:var(--text4)">${cl?cl.name:'-'}</div></div><div style="text-align:right"><div class="badge badge-${urg} no-dot" style="font-size:0.68rem">${dl>0?dl+'d left':'Overdue'}</div><div style="font-size:0.7rem;color:var(--text4);margin-top:3px">${formatDate(p.due)}</div></div></div>`;}).join('')||'<div class="empty-state" style="padding:30px 20px"><p>No upcoming deadlines</p></div>';
  const outs=DB.documents.filter(d=>d.type==='invoice'&&d.status==='Pending');
  document.getElementById('dash-outstanding').innerHTML=outs.map(d=>{const cl=DB.clients.find(c=>c.id===d.client);const ov=new Date(d.due)<new Date();return`<div class="hover-row" onclick="nav('invoices')"><div><div style="font-size:0.83rem;font-weight:600;color:var(--text)">${d.num}</div><div style="font-size:0.72rem;color:var(--text4)">${cl?cl.name:'-'}</div></div><div style="text-align:right"><div style="font-size:0.88rem;font-weight:600;color:var(--amber)">${fmtFull(d.total,d.currency)}</div><div class="badge badge-${ov?'red':'amber'} no-dot" style="font-size:0.68rem;margin-top:3px">${ov?'Overdue':'Pending'}</div></div></div>`;}).join('')||'<div class="empty-state" style="padding:30px 20px"><p>No outstanding payments</p></div>';
}
function updateDashboard(){renderDashboard();}

let projFilter='',projStatusFilter='';
function renderProjects(){
  populateClientDropdowns();
  let data=DB.projects;
  if(projFilter)data=data.filter(p=>p.name.toLowerCase().includes(projFilter)||getClientName(p.client).toLowerCase().includes(projFilter));
  if(projStatusFilter)data=data.filter(p=>p.status===projStatusFilter);
  const tb=data.reduce((s,p)=>s+p.budget,0);const tp=data.reduce((s,p)=>s+p.paid,0);const ac=data.filter(p=>p.status==='Active').length;
  document.getElementById('proj-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Projects</div><div class="stat-value">${DB.projects.length}</div><div class="stat-change neutral">${ac} active</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/></svg></div></div><div class="stat"><div class="stat-label">Total Budget</div><div class="stat-value">${fmt(tb)}</div><div class="stat-change neutral">All projects</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div class="stat"><div class="stat-label">Amount Received</div><div class="stat-value green">${fmt(tp)}</div><div class="stat-change up">${tb>0?Math.round(tp/tb*100):0}% collected</div><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div></div><div class="stat"><div class="stat-label">Pending Amount</div><div class="stat-value amber">${fmt(tb-tp)}</div><div class="stat-change neutral">To collect</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div>`;
  document.getElementById('proj-count-badge').textContent=data.length+' projects';
  document.getElementById('projects-tbody').innerHTML=data.map(p=>{const cl=DB.clients.find(c=>c.id===p.client);const pct=p.progress;const pc=pct===100?'green':pct>60?'blue':pct>30?'amber':'red';const rem=p.budget-p.paid;return`<tr><td><div class="td-main">${p.name}</div>${p.desc?`<div class="td-sub">${p.desc.substring(0,40)}...</div>`:''}</td><td>${cl?`<div style="font-size:0.82rem">${cl.name}</div>`:'<span style="color:var(--text4)">-</span>'}</td><td><span class="badge badge-blue no-dot">${p.service}</span></td><td><div style="font-weight:600">${fmtFull(p.budget,p.currency)}</div></td><td style="color:var(--green);font-weight:600">${fmtFull(p.paid,p.currency)}</td><td style="color:var(--amber);font-weight:500">${fmtFull(rem,p.currency)}</td><td style="min-width:100px"><div style="font-size:0.72rem;color:var(--text3);margin-bottom:4px">${pct}%</div><div class="progress"><div class="progress-fill ${pc}" style="width:${pct}%"></div></div></td><td>${statusBadge(p.status)}</td><td style="color:var(--text3);font-size:0.8rem">${formatDate(p.due)}</td><td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="editProject('${p.id}')">Edit</button><button class="btn btn-ghost btn-sm" onclick="quickInvoice('${p.id}')">Invoice</button></td></tr>`;}).join('')||'<tr><td colspan="10"><div class="empty-state"><h3>No Projects</h3><p>Create your first project</p></div></td></tr>';
}
function filterProjects(v){projFilter=v.toLowerCase();renderProjects();}
function filterProjectsByStatus(v){projStatusFilter=v;renderProjects();}
function sortTable(type,field){if(type==='projects'){DB.projects.sort((a,b)=>{if(field==='budget'||field==='paid')return b[field]-a[field];return String(a[field]).localeCompare(String(b[field]));});renderProjects();}}
function editProject(id){const p=DB.projects.find(x=>x.id===id);if(!p)return;populateClientDropdowns();document.getElementById('ep-id').value=id;document.getElementById('ep-name').value=p.name;setSelect('ep-client',p.client);setSelect('ep-service',p.service);setSelect('ep-status',p.status);document.getElementById('ep-budget').value=p.budget;document.getElementById('ep-paid').value=p.paid;document.getElementById('ep-progress').value=p.progress;document.getElementById('ep-due').value=p.due;document.getElementById('ep-desc').value=p.desc||'';openModal('editProjectModal');}
async function saveProject(){const name=document.getElementById('p-name').value.trim();if(!name){showToast('Project name required','error');return;}const payload={name,client:document.getElementById('p-client').value,service:document.getElementById('p-service').value,status:document.getElementById('p-status').value,budget:parseFloat(document.getElementById('p-budget').value)||0,paid:parseFloat(document.getElementById('p-paid').value)||0,progress:parseInt(document.getElementById('p-progress').value)||0,start:document.getElementById('p-start').value,due:document.getElementById('p-due').value,desc:document.getElementById('p-desc').value,currency:document.getElementById('p-currency').value};try{const res=await apiFetch('/api/projects',{method:'POST',body:JSON.stringify(payload)});DB.projects.unshift(res);closeModal('addProjectModal');renderProjects();updateNavBadges();showToast('Project created','success');}catch(e){showToast(e.message,'error');}}
async function updateProject(){const id=document.getElementById('ep-id').value;const payload={name:document.getElementById('ep-name').value,client:document.getElementById('ep-client').value,service:document.getElementById('ep-service').value,status:document.getElementById('ep-status').value,budget:parseFloat(document.getElementById('ep-budget').value)||0,paid:parseFloat(document.getElementById('ep-paid').value)||0,progress:parseInt(document.getElementById('ep-progress').value)||0,due:document.getElementById('ep-due').value,desc:document.getElementById('ep-desc').value};try{await apiFetch('/api/projects/'+id,{method:'PUT',body:JSON.stringify(payload)});const idx=DB.projects.findIndex(p=>p.id===id);if(idx>=0)DB.projects[idx]={...DB.projects[idx],...payload};closeModal('editProjectModal');renderProjects();showToast('Project updated','success');}catch(e){showToast(e.message,'error');}}
function deleteProject(id){confirmAction('Delete this project? This cannot be undone.',async()=>{try{await apiFetch('/api/projects/'+id,{method:'DELETE'});DB.projects=DB.projects.filter(p=>p.id!==id);closeModal('editProjectModal');renderProjects();updateNavBadges();showToast('Project deleted','info');}catch(e){showToast(e.message,'error');}});}
function quickInvoice(pid){const p=DB.projects.find(x=>x.id===pid);if(!p)return;nav('invoices');openNewDoc('invoice');setTimeout(()=>{setSelect('doc-client',p.client);document.getElementById('doc-subject').value=p.name;document.getElementById('doc-project').value=pid;},100);}

function renderClients(){
  const colors=['#3684DB','#22C55E','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#F97316'];
  document.getElementById('clients-grid').innerHTML=DB.clients.map((c,i)=>`<div class="card client-card" style="cursor:pointer" onclick="editClientInline('${c.id}')"><div class="client-head"><div class="client-avatar" style="background:${colors[i%colors.length]}22;border:1px solid ${colors[i%colors.length]}33;color:${colors[i%colors.length]}">${c.name.substring(0,2).toUpperCase()}</div><div style="flex:1;min-width:0"><div class="client-title">${c.name}</div><div class="client-sub">${c.contact||''}</div></div><span class="badge ${c.status==='Active'?'badge-green':'badge-gray'} no-dot" style="font-size:0.65rem;align-self:flex-start">${c.status}</span></div><div class="divider" style="margin:12px 0"></div><div class="client-meta">${c.email?`<div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:${c.email}" onclick="event.stopPropagation()">${c.email}</a></div>`:''}${c.phone?`<div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.8 19.79 19.79 0 01.22 3.18 2 2 0 012.2 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.07a16 16 0 006.29 6.29l.63-.63a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${c.phone}</div>`:''}${c.address?`<div class="client-address">${c.address}</div>`:''}</div></div>`).join('')||'<div style="grid-column:1/-1"><div class="empty-state"><h3>No Clients Yet</h3><p>Add your first client</p></div></div>';
}
function editClientInline(id){const c=DB.clients.find(x=>x.id===id);if(!c)return;document.getElementById('c-name').value=c.name;document.getElementById('c-contact').value=c.contact||'';document.getElementById('c-email').value=c.email||'';document.getElementById('c-phone').value=c.phone||'';setSelect('c-industry',c.industry||'Technology');setSelect('c-status',c.status||'Active');document.getElementById('c-address').value=c.address||'';document.getElementById('c-gst').value=c.gst||'';document.getElementById('c-website').value=c.website||'';const modal=document.getElementById('addClientModal');modal.querySelector('.modal-title').textContent='Edit Client';const btn=modal.querySelector('.btn-primary');btn.textContent='Update Client';btn.setAttribute('onclick',`updateClientById('${id}')`);const del=modal.querySelector('#client-delete-btn');del.style.display='';del.setAttribute('onclick',`deleteClientById('${id}')`);openModal('addClientModal');}
async function saveClient(){const name=document.getElementById('c-name').value.trim();if(!name){showToast('Client name required','error');return;}const payload={name,contact:document.getElementById('c-contact').value,email:document.getElementById('c-email').value,phone:document.getElementById('c-phone').value,industry:document.getElementById('c-industry').value,status:document.getElementById('c-status').value,address:document.getElementById('c-address').value,gst:document.getElementById('c-gst').value,website:document.getElementById('c-website').value};try{const res=await apiFetch('/api/clients',{method:'POST',body:JSON.stringify(payload)});DB.clients.unshift(res);closeModal('addClientModal');renderClients();populateClientDropdowns();updateNavBadges();resetClientModal();showToast('Client added','success');}catch(e){showToast(e.message,'error');}}
async function updateClientById(id){const payload={name:document.getElementById('c-name').value,contact:document.getElementById('c-contact').value,email:document.getElementById('c-email').value,phone:document.getElementById('c-phone').value,industry:document.getElementById('c-industry').value,status:document.getElementById('c-status').value,address:document.getElementById('c-address').value,gst:document.getElementById('c-gst').value,website:document.getElementById('c-website').value};try{await apiFetch('/api/clients/'+id,{method:'PUT',body:JSON.stringify(payload)});const idx=DB.clients.findIndex(c=>c.id===id);if(idx>=0)DB.clients[idx]={...DB.clients[idx],...payload};closeModal('addClientModal');renderClients();populateClientDropdowns();resetClientModal();showToast('Client updated','success');}catch(e){showToast(e.message,'error');}}
function deleteClientById(id){confirmAction('Delete this client? This will not remove their past documents.',async()=>{try{await apiFetch('/api/clients/'+id,{method:'DELETE'});DB.clients=DB.clients.filter(c=>c.id!==id);closeModal('addClientModal');renderClients();populateClientDropdowns();updateNavBadges();resetClientModal();showToast('Client deleted','info');}catch(e){showToast(e.message,'error');}});}
function resetClientModal(){const modal=document.getElementById('addClientModal');modal.querySelector('.modal-title').textContent='Add Client';const btn=modal.querySelector('.btn-primary');btn.textContent='Add Client';btn.setAttribute('onclick','saveClient()');const del=modal.querySelector('#client-delete-btn');del.style.display='none';del.setAttribute('onclick','deleteClientById(\"\")');}

let docTypeFilter='all',docSearch='';
function filterDocs(type,el){docTypeFilter=type;document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));if(el)el.classList.add('active');renderDocs();}
function searchDocs(v){docSearch=v.toLowerCase();renderDocs();}
function renderDocStats(){const invs=DB.documents.filter(d=>d.type==='invoice');const paid=invs.reduce((s,d)=>s+(d.status==='Paid'?d.total:(d.paidAmount||0)),0);const pending=invs.reduce((s,d)=>s+(d.status==='Paid'?0:Math.max(d.total-(d.paidAmount||0),0)),0);const overdue=invs.filter(d=>d.status!=='Paid'&&new Date(d.due)<new Date());document.getElementById('inv-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Invoiced</div><div class="stat-value">${fmt(invs.reduce((s,d)=>s+d.total,0))}</div><div class="stat-change neutral">${invs.length} invoices</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg></div></div><div class="stat"><div class="stat-label">Paid</div><div class="stat-value green">${fmt(paid)}</div><div class="stat-change up">${invs.filter(d=>d.status==='Paid').length} paid</div><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div></div><div class="stat"><div class="stat-label">Pending</div><div class="stat-value amber">${fmt(pending)}</div><div class="stat-change neutral">${invs.filter(d=>d.status!=='Paid').length} unpaid</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div><div class="stat"><div class="stat-label">Overdue</div><div class="stat-value ${overdue.length>0?'red':''}">${overdue.length}</div><div class="stat-change ${overdue.length>0?'down':'neutral'}">${overdue.length>0?'Needs attention':'All on time'}</div><div class="stat-icon ${overdue.length>0?'red':'green'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/></svg></div></div>`;}
function renderDocs(){let data=DB.documents;if(docTypeFilter!=='all')data=data.filter(d=>d.type===docTypeFilter);if(docSearch)data=data.filter(d=>d.num.toLowerCase().includes(docSearch)||d.subject.toLowerCase().includes(docSearch)||(getClientName(d.client)||'').toLowerCase().includes(docSearch));data=[...data].sort((a,b)=>new Date(b.date)-new Date(a.date));document.getElementById('docs-tbody').innerHTML=data.map(d=>{const cl=DB.clients.find(c=>c.id===d.client);const ov=d.status!=='Paid'&&new Date(d.due)<new Date();const sb=d.status==='Paid'?'badge-green':d.status==='Accepted'?'badge-blue':ov?'badge-red':d.status==='Draft'?'badge-gray':'badge-amber';const tb=d.type==='invoice'?'badge-blue':d.type==='quotation'?'badge-purple':'badge-gray';const showPay=d.type==='invoice'&&(d.status==='Pending'||d.status==='Partially Paid');return`<tr><td><span style="font-family:var(--font-display);font-size:0.82rem;font-weight:700;color:var(--text)">${d.num}</span></td><td><span class="badge ${tb} no-dot" style="text-transform:capitalize">${d.type}</span></td><td>${cl?`<span style="font-size:0.82rem">${cl.name}</span>`:'-'}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.subject}</td><td style="font-weight:600">${fmtFull(d.total,d.currency)}</td><td><span class="badge badge-gray no-dot" style="font-size:0.7rem">${d.currency}</span></td><td style="color:var(--text3);font-size:0.8rem">${formatDate(d.date)}</td><td><span class="badge ${sb} no-dot">${ov?'Overdue':d.status}</span></td><td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="viewDoc('${d.id}')">View</button>${showPay?`<button class="btn btn-success btn-sm" onclick="recordPayment('${d.id}')">Record Payment</button>`:''}${d.type==='invoice'&&d.status==='Paid'?`<button class="btn btn-ghost btn-sm" onclick="markUnpaid('${d.id}')">Undo Paid</button>`:''}<button class="btn btn-ghost btn-sm" onclick="deleteDoc('${d.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button></td></tr>`;}).join('')||'<tr><td colspan="9"><div class="empty-state"><h3>No Documents</h3><p>Create your first invoice</p></div></td></tr>';}
async function markPaid(id){try{const d=DB.documents.find(x=>x.id===id);if(!d)return;await apiFetch('/api/documents/'+id,{method:'PUT',body:JSON.stringify({status:'Paid',paidAmount:d.total,projectId:d.projectId})});const idx=DB.documents.findIndex(x=>x.id===id);if(idx>=0){DB.documents[idx].status='Paid';DB.documents[idx].paidAmount=d.total;}if(d.projectId)await syncProjectPaid(d.projectId);renderDocs();renderDocStats();updateNavBadges();showToast('Invoice marked as Paid','success');}catch(e){showToast(e.message,'error');}}
async function recordPayment(id){const d=DB.documents.find(x=>x.id===id);if(!d)return;const remain=Math.max(d.total-(d.paidAmount||0),0);const raw=prompt(`Enter payment amount (remaining ${fmtFull(remain,d.currency)})`,'');if(raw===null)return;const amt=parseFloat(String(raw).replace(/[^0-9.]/g,''));if(!Number.isFinite(amt)||amt<=0){showToast('Invalid amount','error');return;}const paidNow=Math.min((d.paidAmount||0)+amt,d.total);const status=paidNow>=d.total?'Paid':'Partially Paid';try{await apiFetch('/api/documents/'+id,{method:'PUT',body:JSON.stringify({status,paidAmount:paidNow,projectId:d.projectId})});const idx=DB.documents.findIndex(x=>x.id===id);if(idx>=0){DB.documents[idx].status=status;DB.documents[idx].paidAmount=paidNow;}if(d.projectId)await syncProjectPaid(d.projectId);renderDocs();renderDocStats();updateNavBadges();showToast(status==='Paid'?'Invoice marked as Paid':'Partial payment recorded','success');}catch(e){showToast(e.message,'error');}}
async function markUnpaid(id){try{const d=DB.documents.find(x=>x.id===id);await apiFetch('/api/documents/'+id,{method:'PUT',body:JSON.stringify({status:'Pending',paidAmount:0,projectId:d?d.projectId:''})});const idx=DB.documents.findIndex(x=>x.id===id);if(idx>=0){DB.documents[idx].status='Pending';DB.documents[idx].paidAmount=0;}if(d&&d.projectId)await syncProjectPaid(d.projectId);renderDocs();renderDocStats();updateNavBadges();showToast('Invoice marked as Pending','info');}catch(e){showToast(e.message,'error');}}
function deleteDoc(id){confirmAction('Delete this document?',async()=>{try{const d=DB.documents.find(x=>x.id===id);await apiFetch('/api/documents/'+id,{method:'DELETE'});DB.documents=DB.documents.filter(x=>x.id!==id);recalcDocCounters();if(d&&d.projectId)await syncProjectPaid(d.projectId);renderDocs();renderDocStats();showToast('Document deleted','info');}catch(e){showToast(e.message,'error');}});}

async function syncProjectPaid(projectId){
  const p=DB.projects.find(x=>x.id===projectId);
  if(!p)return;
  const related=DB.documents.filter(d=>d.projectId===projectId&&d.type==='invoice');
  const paid=related.reduce((s,d)=>s+(d.status==='Paid'?d.total:(d.paidAmount||0)),0);
  const payload={name:p.name,client:p.client,service:p.service,status:p.status,budget:p.budget,paid, currency:p.currency,progress:p.progress,start:p.start,due:p.due,desc:p.desc};
  await apiFetch('/api/projects/'+projectId,{method:'PUT',body:JSON.stringify(payload)});
  p.paid=paid;
  renderProjects();
  renderDashboard();
}

let lineItemCount=0;
function recalcDocCounters(){const next={INV:DB.counters?.INV||0,QUO:DB.counters?.QUO||0,PRO:DB.counters?.PRO||0};DB.documents.forEach(d=>{const m=/^(INV|QUO|PRO)-(\\d+)/.exec(d.num||'');if(m){const n=parseInt(m[2],10);if(n>next[m[1]])next[m[1]]=n;}});DB.counters={...DB.counters,...next};}
function openNewDoc(type){populateClientDropdowns();recalcDocCounters();document.getElementById('doc-type').value=type;document.getElementById('doc-edit-id').value='';document.getElementById('doc-project').value='';const prefix=type==='invoice'?'INV':type==='quotation'?'QUO':'PRO';const counter=(DB.counters[prefix]||0);document.getElementById('doc-num').value=prefix+'-'+String(counter+1).padStart(3,'0');document.getElementById('doc-date').value=today();const dd=new Date();dd.setDate(dd.getDate()+(DB.settings.terms||30));document.getElementById('doc-due').value=dd.toISOString().split('T')[0];document.getElementById('doc-subject').value='';document.getElementById('doc-notes').value=DB.settings.invNotes||'';const taxVal=Number.isFinite(DB.settings.tax)?DB.settings.tax:18;document.getElementById('doc-tax').value=taxVal;document.getElementById('doc-currency').value=DB.settings.currency||'INR';setSelect('doc-client','');document.getElementById('newDocTitle').textContent={invoice:'New Invoice',quotation:'New Quotation',proposal:'New Proposal'}[type];lineItemCount=0;document.getElementById('line-items-container').innerHTML=`<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 36px;gap:8px;margin-bottom:6px;padding:0 4px"><div style="font-size:0.7rem;color:var(--text4);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Description</div><div style="font-size:0.7rem;color:var(--text4);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Qty</div><div style="font-size:0.7rem;color:var(--text4);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Rate</div><div style="font-size:0.7rem;color:var(--text4);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Amount</div><div></div></div>`;addLineItem();recalcDoc();openModal('newDocModal');}
function addLineItem(){lineItemCount++;const id=lineItemCount;const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:2fr 1fr 1fr 1fr 36px;gap:8px;margin-bottom:8px;align-items:center';row.id='li-row-'+id;row.innerHTML=`<input type="text" placeholder="Description" id="li-desc-${id}" style="height:36px"><input type="number" placeholder="1" id="li-qty-${id}" value="1" min="1" style="height:36px" oninput="calcLineItem(${id})"><input type="number" placeholder="0" id="li-rate-${id}" value="0" style="height:36px" oninput="calcLineItem(${id})"><input type="number" id="li-amt-${id}" value="0" readonly style="height:36px;opacity:0.7"><button class="btn btn-ghost btn-sm" style="padding:0;width:36px;justify-content:center;height:36px" onclick="removeLineItem(${id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;document.getElementById('line-items-container').appendChild(row);}
function removeLineItem(id){const r=document.getElementById('li-row-'+id);if(r)r.remove();recalcDoc();}
function calcLineItem(id){const q=parseFloat(document.getElementById('li-qty-'+id)?.value)||0;const r=parseFloat(document.getElementById('li-rate-'+id)?.value)||0;const a=document.getElementById('li-amt-'+id);if(a)a.value=(q*r).toFixed(2);recalcDoc();}
function recalcDoc(){let sub=0;const con=document.getElementById('line-items-container');if(!con)return;con.querySelectorAll('[id^="li-amt-"]').forEach(r=>{sub+=parseFloat(r.value)||0;});const tp=parseFloat(document.getElementById('doc-tax')?.value)||0;const ta=sub*tp/100;const tot=sub+ta;const cur=document.getElementById('doc-currency')?.value||'INR';const sym=cs(cur);document.getElementById('doc-subtotal').textContent=sym+sub.toFixed(2);document.getElementById('doc-tax-label').textContent='Tax ('+tp+'%)';document.getElementById('doc-tax-val').textContent=sym+ta.toFixed(2);document.getElementById('doc-total').textContent=sym+tot.toFixed(2);}
function getLineItems(){const items=[];let i=1;while(document.getElementById('li-row-'+i)){const desc=document.getElementById('li-desc-'+i)?.value||'';const qty=parseFloat(document.getElementById('li-qty-'+i)?.value)||0;const rate=parseFloat(document.getElementById('li-rate-'+i)?.value)||0;if(desc||rate>0)items.push({desc,qty,rate});i++;}return items;}
async function saveDocument(){const type=document.getElementById('doc-type').value;const client=document.getElementById('doc-client').value;if(!client){showToast('Please select a client','error');return;}const items=getLineItems();if(items.length===0){showToast('Add at least one line item','error');return;}const sub=items.reduce((s,i)=>s+(i.qty*i.rate),0);const tp=parseFloat(document.getElementById('doc-tax').value)||0;const ta=sub*tp/100;const tot=sub+ta;const projectId=document.getElementById('doc-project').value||'';const payload={type,client,projectId,subject:document.getElementById('doc-subject').value,items,subtotal:sub,tax:tp,taxAmt:ta,total:tot,paidAmount:0,currency:document.getElementById('doc-currency').value,date:document.getElementById('doc-date').value,due:document.getElementById('doc-due').value,status:type==='invoice'?'Pending':type==='quotation'?'Pending':'Draft',notes:document.getElementById('doc-notes').value};try{const res=await apiFetch('/api/documents',{method:'POST',body:JSON.stringify(payload)});DB.documents.unshift(res);const pref=type==='invoice'?'INV':type==='quotation'?'QUO':'PRO';DB.counters[pref]=(DB.counters[pref]||0)+1;closeModal('newDocModal');renderDocs();renderDocStats();updateNavBadges();showToast(pref+' created: '+res.num,'success');}catch(e){showToast(e.message,'error');}}
function viewDoc(id){const d=DB.documents.find(x=>x.id===id);if(!d)return;document.getElementById('doc-preview-content').innerHTML=buildDocHTML(d);openModal('docPreviewModal');}
function previewDocument(){const type=document.getElementById('doc-type').value;const client=document.getElementById('doc-client').value;const items=getLineItems();const sub=items.reduce((s,i)=>s+(i.qty*i.rate),0);const tp=parseFloat(document.getElementById('doc-tax').value)||0;const ta=sub*tp/100;const tot=sub+ta;const d={type,num:document.getElementById('doc-num').value,client,subject:document.getElementById('doc-subject').value,items,subtotal:sub,tax:tp,taxAmt:ta,total:tot,currency:document.getElementById('doc-currency').value,date:document.getElementById('doc-date').value,due:document.getElementById('doc-due').value,notes:document.getElementById('doc-notes').value,status:'Preview'};closeModal('newDocModal');document.getElementById('doc-preview-content').innerHTML=buildDocHTML(d);openModal('docPreviewModal');}
function buildDocHTML(d){const s=DB.settings;const cl=DB.clients.find(c=>c.id===d.client);const sym=cs(d.currency);const tl=d.type.charAt(0).toUpperCase()+d.type.slice(1);const sbg=d.status==='Paid'?'#dcfce7':d.status==='Overdue'?'#fef2f2':'#fffbeb';const sc=d.status==='Paid'?'#16a34a':d.status==='Overdue'?'#dc2626':'#b45309';return`<div class="invoice-preview" id="printable-doc"><div class="inv-header"><div><h1 style="font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:#1a1a2e;margin-bottom:6px">${s.bizName||'SHUBIQ Agency'}</h1>${s.email?`<div style="font-size:0.82rem;color:#64748b;margin-bottom:2px"><a href="mailto:${s.email}" style="color:#64748b;text-decoration:none">${s.email}</a></div>`:''}${s.phone?`<div style="font-size:0.82rem;color:#64748b;margin-bottom:2px">${s.phone}</div>`:''}${s.address?`<div style="font-size:0.82rem;color:#64748b;margin-bottom:2px">${s.address}</div>`:''}${s.gst?`<div style="font-size:0.78rem;color:#94a3b8">GST: ${s.gst}</div>`:''}</div><div class="inv-meta"><div style="font-size:1.2rem;font-weight:700;color:#1e293b;margin-bottom:4px">${tl.toUpperCase()}</div><div class="inv-num">${d.num}</div><div style="font-size:0.78rem;color:#64748b;margin-top:4px">Date: ${formatDateFull(d.date)}</div>${d.due?`<div style="font-size:0.78rem;color:#64748b">Due: ${formatDateFull(d.due)}</div>`:''}<div style="margin-top:8px"><span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:0.72rem;font-weight:600;background:${sbg};color:${sc};border:1px solid ${sc}33">${d.status}</span></div></div></div><div class="inv-info-grid"><div><div class="inv-section-title">Billed To</div>${cl?`<div style="font-weight:600;color:#1e293b;font-size:0.92rem">${cl.name}</div>${cl.contact?`<div style="font-size:0.82rem;color:#64748b">${cl.contact}</div>`:''}${cl.email?`<div style="font-size:0.82rem;color:#3684DB">${cl.email}</div>`:''}${cl.phone?`<div style="font-size:0.82rem;color:#64748b">${cl.phone}</div>`:''}${cl.address?`<div style="font-size:0.82rem;color:#64748b">${cl.address}</div>`:''}${cl.gst?`<div style="font-size:0.78rem;color:#94a3b8">GST: ${cl.gst}</div>`:''}`:`<div style="color:#94a3b8;font-size:0.82rem">Client not specified</div>`}</div><div><div class="inv-section-title">Subject</div><div style="font-weight:500;color:#1e293b;font-size:0.88rem">${d.subject||'-'}</div></div></div><table class="inv-table"><thead><tr><th style="width:40%">Description</th><th style="text-align:center;width:15%">Qty</th><th style="text-align:right;width:20%">Rate (${d.currency})</th><th style="text-align:right;width:25%">Amount (${d.currency})</th></tr></thead><tbody>${(d.items||[]).map(i=>`<tr><td>${i.desc}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${sym}${parseFloat(i.rate).toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td style="text-align:right;font-weight:500">${sym}${(i.qty*i.rate).toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>`).join('')}</tbody></table><div class="inv-totals"><div class="inv-total-row"><span>Subtotal</span><span>${sym}${parseFloat(d.subtotal).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>${d.tax>0?`<div class="inv-total-row"><span>Tax (${d.tax}%)</span><span>${sym}${parseFloat(d.taxAmt).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>`:''}<div class="inv-total-row grand"><span>Total</span><span>${sym}${parseFloat(d.total).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div></div>${s.bankName&&d.type==='invoice'?`<div class="inv-footer"><div style="font-weight:600;color:#374151;margin-bottom:8px">Payment Details</div><div class="inv-bank"><div class="inv-bank-title">Bank Transfer</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${s.bankName?`<div><div class="inv-label">Bank</div><div class="inv-value">${s.bankName}</div></div>`:''}${s.bankHolder?`<div><div class="inv-label">Account Holder</div><div class="inv-value">${s.bankHolder}</div></div>`:''}${s.bankAcc?`<div><div class="inv-label">Account No.</div><div class="inv-value">${s.bankAcc}</div></div>`:''}${s.bankIfsc?`<div><div class="inv-label">IFSC/SWIFT</div><div class="inv-value">${s.bankIfsc}</div></div>`:''}${s.upi?`<div><div class="inv-label">UPI ID</div><div class="inv-value">${s.upi}</div></div>`:''}</div></div>${d.notes?`<div style="margin-top:16px;font-size:0.82rem;color:#64748b">${d.notes}</div>`:''}</div>`:`${d.notes?`<div class="inv-footer"><p style="font-size:0.82rem;color:#64748b">${d.notes}</p></div>`:''}`}<div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:0.75rem;color:#94a3b8">Generated by <a href="https://shubiq.com" style="color:#3684DB;text-decoration:none">shubiq.com</a></div></div>`;}
function printDoc(){const c=document.getElementById('printable-doc');if(!c)return;const w=window.open('','_blank','width=900,height=700');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#0b1a2b;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:#3684DB;text-decoration:none}.invoice-preview{background:#fff;color:#111;border-radius:18px;padding:40px;font-family:'DM Sans',sans-serif;max-width:760px;margin:0 auto;box-shadow:0 18px 40px rgba(2,10,20,0.18)}.invoice-preview h1{font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;color:#1a1a2e}.inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e8f4ff}.inv-meta{text-align:right}.inv-meta .inv-num{font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;color:#3684DB}.inv-section{margin-bottom:24px}.inv-section-title{font-size:0.7rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}.inv-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}.inv-label{font-size:0.72rem;color:#94a3b8;margin-bottom:2px}.inv-value{font-size:0.88rem;font-weight:500;color:#1e293b}table.inv-table{width:100%;border-collapse:collapse}table.inv-table thead th{background:#f8fafc;padding:10px 14px;text-align:left;font-size:0.72rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0}table.inv-table tbody td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:0.85rem;color:#374151}.inv-totals{margin-left:auto;max-width:280px;margin-top:16px}.inv-total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:0.85rem;color:#64748b;border-bottom:1px solid #f1f5f9}.inv-total-row.grand{font-size:1rem;font-weight:700;color:#1e293b;border-bottom:none;padding-top:10px;border-top:2px solid #3684DB;margin-top:4px}.inv-footer{margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:0.78rem;color:#94a3b8}.inv-bank{background:#f8fafc;border-radius:8px;padding:14px;margin-top:12px;font-size:0.82rem}.inv-bank-title{font-weight:600;color:#374151;margin-bottom:6px;font-size:0.8rem}@media print{@page{margin:12mm}body{background:#0b1a2b;padding:0} .invoice-preview{box-shadow:none;margin:0 auto}}<\/style></head><body>${c.outerHTML}<script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000)}<\/script></body></html>`);w.document.close();}
function renderDocCenter(){const types=[{label:'Invoice',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',type:'invoice',color:'#3684DB'},{label:'Quotation',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',type:'quotation',color:'#8B5CF6'},{label:'Proposal',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',type:'proposal',color:'#F59E0B'}];document.getElementById('docs-grid').innerHTML=types.map(t=>{const count=DB.documents.filter(d=>d.type===t.type).length;const prefix=t.type==='invoice'?'INV':t.type==='quotation'?'QUO':'PRO';const next=prefix+'-'+String((DB.counters[prefix]||0)+1).padStart(3,'0');return`<div class="card" style="cursor:pointer" onclick="openNewDoc('${t.type}')"><div style="width:48px;height:48px;border-radius:12px;background:${t.color}18;border:1px solid ${t.color}30;display:flex;align-items:center;justify-content:center;color:${t.color};margin-bottom:14px">${t.icon}</div><div style="font-family:var(--font-display);font-size:1rem;font-weight:700;color:var(--text);margin-bottom:4px">New ${t.label}</div><div style="font-size:0.78rem;color:var(--text4);margin-bottom:14px">${count} created &middot; Next: ${next}</div><button class="btn btn-primary btn-sm" style="width:100%;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Create ${t.label}</button></div>`;}).join('');}

let expFilter='',expCatFilter='',labsExpFilter='',labsExpCatFilter='',overallExpFilter='',overallExpCatFilter='',incomeFilter='',expCharts={},labsExpCharts={},overallExpCharts={},incomeCharts={};
let currentExpenseScope='studio';
const EXP_CATS={'Software':'#3684DB','Marketing':'#F59E0B','Payroll':'#22C55E','Office':'#8B5CF6','Infrastructure':'#EF4444','Travel':'#06B6D4','Misc':'#758BA5'};

function openAddExpense(scope='studio'){currentExpenseScope=scope;openModal('addExpenseModal');}
function openQuickAdd(){openModal('quickAddModal');}
function getExpensesByScope(scope){return DB.expenses.filter(e=>(e.scope||'studio')===scope);}

function renderIncomeStats(){
  const invs=DB.documents.filter(d=>d.type==='invoice'&&d.status==='Paid');
  const total=invs.reduce((s,d)=>s+d.total,0);
  const thisMonth=invs.filter(d=>d.date&&d.date.startsWith(new Date().toISOString().substring(0,7))).reduce((s,d)=>s+d.total,0);
  const byClient={};invs.forEach(d=>{const c=getClientName(d.client)||'Unknown';byClient[c]=(byClient[c]||0)+d.total;});
  const top=Object.entries(byClient).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('inc-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Income</div><div class="stat-value green">${fmt(total)}</div><div class="stat-change neutral">${invs.length} invoices</div><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="21 14 21 7 14 7"/></svg></div></div><div class="stat"><div class="stat-label">This Month</div><div class="stat-value">${fmt(thisMonth)}</div><div class="stat-change neutral">Current month</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div></div><div class="stat"><div class="stat-label">Top Client</div><div class="stat-value" style="font-size:1.2rem">${top?top[0]:'-'}</div><div class="stat-change neutral">${top?fmt(top[1]):''}</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg></div></div><div class="stat"><div class="stat-label">Avg Monthly</div><div class="stat-value">${fmt(total/12)}</div><div class="stat-change neutral">Per month</div><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>`;
}

function renderIncome(){
  const invs=DB.documents.filter(d=>d.type==='invoice'&&d.status==='Paid');
  const byClient={};invs.forEach(d=>{const c=getClientName(d.client)||'Unknown';byClient[c]=(byClient[c]||0)+d.total;});
  if(incomeCharts.split){incomeCharts.split.destroy();incomeCharts.split=null;}
  const sc=document.getElementById('incSplitChart');
  if(sc){const items=Object.entries(byClient).sort((a,b)=>b[1]-a[1]);if(items.length){incomeCharts.split=new Chart(sc,{type:'doughnut',data:{labels:items.map(i=>i[0]),datasets:[{data:items.map(i=>i[1]),backgroundColor:items.map((_,i)=>['#22C55E','#3684DB','#F59E0B','#8B5CF6','#06B6D4','#EF4444'][i%6]),borderColor:'#0D2237',borderWidth:2,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false}}}});const total=items.reduce((s,i)=>s+i[1],0);document.getElementById('inc-split-legend').innerHTML=items.map((i,idx)=>`<div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:${['#22C55E','#3684DB','#F59E0B','#8B5CF6','#06B6D4','#EF4444'][idx%6]}"></div><div class="qm-label">${i[0]}</div></div><div><div class="qm-value">${fmt(i[1])}</div><div style="font-size:0.68rem;color:var(--text4)">${total>0?Math.round(i[1]/total*100):0}%</div></div></div>`).join('');}}
  if(incomeCharts.trend){incomeCharts.trend.destroy();incomeCharts.trend=null;}
  const tc=document.getElementById('incTrendChart');const sym=cs(DB.settings.currency||'INR');
  if(tc){const months=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];const data=buildMonthlyData(invs,'total','date');incomeCharts.trend=new Chart(tc,{type:'line',data:{labels:months,datasets:[{data,borderColor:'#22C55E',backgroundColor:'rgba(34,197,94,0.08)',fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:'#22C55E'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});}
  let data=invs;if(incomeFilter)data=data.filter(d=>d.num.toLowerCase().includes(incomeFilter)||d.subject.toLowerCase().includes(incomeFilter)||(getClientName(d.client)||'').toLowerCase().includes(incomeFilter));
  data=[...data].sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById('income-tbody').innerHTML=data.map(d=>{const cl=getClientName(d.client);return`<tr><td><span style="font-family:var(--font-display);font-size:0.82rem;font-weight:700;color:var(--text)">${d.num}</span></td><td>${cl||'-'}</td><td style="font-weight:600;color:var(--green)">${fmtFull(d.total,d.currency)}</td><td><span class="badge badge-gray no-dot" style="font-size:0.7rem">${d.currency}</span></td><td style="color:var(--text3);font-size:0.8rem">${formatDate(d.date)}</td><td><span class="badge badge-green no-dot">Paid</span></td><td><button class="btn btn-ghost btn-sm" onclick="viewDoc('${d.id}')">View</button></td></tr>`;}).join('')||'<tr><td colspan="7"><div class="empty-state"><h3>No Income</h3><p>Mark invoices as paid to see income here</p></div></td></tr>';
}
function filterIncome(v){incomeFilter=v.toLowerCase();renderIncome();}

function renderExpStats(){
  const data=getExpensesByScope('studio');
  const total=data.reduce((s,e)=>s+e.amount,0);
  const byCat={};data.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount;});
  const topCat=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const thisMonth=data.filter(e=>e.date&&e.date.startsWith(new Date().toISOString().substring(0,7))).reduce((s,e)=>s+e.amount,0);
  document.getElementById('exp-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Expenses</div><div class="stat-value red">${fmt(total)}</div><div class="stat-change neutral">${data.length} entries</div><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div class="stat"><div class="stat-label">This Month</div><div class="stat-value">${fmt(thisMonth)}</div><div class="stat-change neutral">Current month</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div></div><div class="stat"><div class="stat-label">Top Category</div><div class="stat-value" style="font-size:1.2rem">${topCat?topCat[0]:'-'}</div><div class="stat-change neutral">${topCat?fmt(topCat[1]):''}</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg></div></div><div class="stat"><div class="stat-label">Avg Monthly</div><div class="stat-value">${fmt(total/12)}</div><div class="stat-change neutral">Per month</div><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>`;
}

function renderLabsExpStats(){
  const data=getExpensesByScope('labs');
  const total=data.reduce((s,e)=>s+e.amount,0);
  const byCat={};data.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount;});
  const topCat=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const thisMonth=data.filter(e=>e.date&&e.date.startsWith(new Date().toISOString().substring(0,7))).reduce((s,e)=>s+e.amount,0);
  document.getElementById('labs-exp-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Expenses</div><div class="stat-value red">${fmt(total)}</div><div class="stat-change neutral">${data.length} entries</div><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div class="stat"><div class="stat-label">This Month</div><div class="stat-value">${fmt(thisMonth)}</div><div class="stat-change neutral">Current month</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div></div><div class="stat"><div class="stat-label">Top Category</div><div class="stat-value" style="font-size:1.2rem">${topCat?topCat[0]:'-'}</div><div class="stat-change neutral">${topCat?fmt(topCat[1]):''}</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg></div></div><div class="stat"><div class="stat-label">Avg Monthly</div><div class="stat-value">${fmt(total/12)}</div><div class="stat-change neutral">Per month</div><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>`;
}

function renderOverallExpStats(){
  const data=getExpensesByScope('overall');
  const total=data.reduce((s,e)=>s+e.amount,0);
  const byCat={};data.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount;});
  const topCat=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const thisMonth=data.filter(e=>e.date&&e.date.startsWith(new Date().toISOString().substring(0,7))).reduce((s,e)=>s+e.amount,0);
  const el=document.getElementById('overall-exp-stats');
  if(!el)return;
  el.innerHTML=`<div class="stat"><div class="stat-label">Total Expenses</div><div class="stat-value red">${fmt(total)}</div><div class="stat-change neutral">${data.length} entries</div><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div class="stat"><div class="stat-label">This Month</div><div class="stat-value">${fmt(thisMonth)}</div><div class="stat-change neutral">Current month</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div></div><div class="stat"><div class="stat-label">Top Category</div><div class="stat-value" style="font-size:1.2rem">${topCat?topCat[0]:'-'}</div><div class="stat-change neutral">${topCat?fmt(topCat[1]):''}</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg></div></div><div class="stat"><div class="stat-label">Avg Monthly</div><div class="stat-value">${fmt(total/12)}</div><div class="stat-change neutral">Per month</div><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>`;
}

function renderExpenses(){
  const dataScoped=getExpensesByScope('studio');
  const byCat={};
  dataScoped.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount;});

  if(expCharts.cat){expCharts.cat.destroy();expCharts.cat=null;}
  const cc=document.getElementById('expCatChart');
  if(cc){
    const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    if(cats.length){
      expCharts.cat=new Chart(cc,{type:'doughnut',data:{labels:cats.map(c=>c[0]),datasets:[{data:cats.map(c=>c[1]),backgroundColor:cats.map(c=>EXP_CATS[c[0]]||'#758BA5'),borderColor:'#0D2237',borderWidth:2,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false}}}});
      const total=Object.values(byCat).reduce((s,v)=>s+v,0);
      document.getElementById('exp-cat-legend').innerHTML=cats.map(c=>`<div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:${EXP_CATS[c[0]]||'#758BA5'}"></div><div class="qm-label">${c[0]}</div></div><div><div class="qm-value">${fmt(c[1])}</div><div style="font-size:0.68rem;color:var(--text4)">${total>0?Math.round(c[1]/total*100):0}%</div></div></div>`).join('');
    }
  }

  if(expCharts.trend){expCharts.trend.destroy();expCharts.trend=null;}
  const tc=document.getElementById('expTrendChart');
  const sym=cs(DB.settings.currency||'INR');
  if(tc){
    const months=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const data=buildMonthlyData(dataScoped,'amount','date');
    expCharts.trend=new Chart(tc,{type:'line',data:{labels:months,datasets:[{data,borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.06)',fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:'#EF4444'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});
  }

  let data=dataScoped;
  if(expFilter)data=data.filter(e=>e.description.toLowerCase().includes(expFilter)||e.vendor.toLowerCase().includes(expFilter));
  if(expCatFilter)data=data.filter(e=>e.category===expCatFilter);
  data=[...data].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=data.map(e=>{
    const notes=e.notes?`<div class="td-sub">${e.notes}</div>`:'';
    return `<tr><td><div class="td-main">${e.description}</div>${notes}</td><td><span class="badge no-dot" style="background:${EXP_CATS[e.category]||'#758BA5'}18;color:${EXP_CATS[e.category]||'#758BA5'};border:1px solid ${EXP_CATS[e.category]||'#758BA5'}30">${e.category}</span></td><td style="font-weight:600;color:var(--red)">${fmtFull(e.amount,e.currency)}</td><td><span class="badge badge-gray no-dot" style="font-size:0.7rem">${e.currency}</span></td><td style="color:var(--text3);font-size:0.8rem">${formatDate(e.date)}</td><td style="color:var(--text3)">${e.vendor||'-'}</td><td><button class="btn btn-ghost btn-sm" onclick="deleteExpense('${e.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button></td></tr>`;
  }).join('')||'<tr><td colspan="7"><div class="empty-state"><h3>No Expenses</h3><p>Add your first expense</p></div></td></tr>';
  document.getElementById('expenses-tbody').innerHTML=rows;
}

function renderOverallExpenses(){
  const dataScoped=getExpensesByScope('overall');
  const byCat={};
  dataScoped.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount;});

  if(overallExpCharts.cat){overallExpCharts.cat.destroy();overallExpCharts.cat=null;}
  const cc=document.getElementById('overallExpCatChart');
  if(cc){
    const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    if(cats.length){
      overallExpCharts.cat=new Chart(cc,{type:'doughnut',data:{labels:cats.map(c=>c[0]),datasets:[{data:cats.map(c=>c[1]),backgroundColor:cats.map(c=>EXP_CATS[c[0]]||'#758BA5'),borderColor:'#0D2237',borderWidth:2,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false}}}});
      const total=Object.values(byCat).reduce((s,v)=>s+v,0);
      document.getElementById('overall-exp-cat-legend').innerHTML=cats.map(c=>`<div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:${EXP_CATS[c[0]]||'#758BA5'}"></div><div class="qm-label">${c[0]}</div></div><div><div class="qm-value">${fmt(c[1])}</div><div style="font-size:0.68rem;color:var(--text4)">${total>0?Math.round(c[1]/total*100):0}%</div></div></div>`).join('');
    }
  }

  if(overallExpCharts.trend){overallExpCharts.trend.destroy();overallExpCharts.trend=null;}
  const tc=document.getElementById('overallExpTrendChart');
  const sym=cs(DB.settings.currency||'INR');
  if(tc){
    const months=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const data=buildMonthlyData(dataScoped,'amount','date');
    overallExpCharts.trend=new Chart(tc,{type:'line',data:{labels:months,datasets:[{data,borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.06)',fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:'#EF4444'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});
  }

  let data=dataScoped;
  if(overallExpFilter)data=data.filter(e=>e.description.toLowerCase().includes(overallExpFilter)||e.vendor.toLowerCase().includes(overallExpFilter));
  if(overallExpCatFilter)data=data.filter(e=>e.category===overallExpCatFilter);
  data=[...data].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=data.map(e=>{
    const notes=e.notes?`<div class="td-sub">${e.notes}</div>`:'';
    return `<tr><td><div class="td-main">${e.description}</div>${notes}</td><td><span class="badge no-dot" style="background:${EXP_CATS[e.category]||'#758BA5'}18;color:${EXP_CATS[e.category]||'#758BA5'};border:1px solid ${EXP_CATS[e.category]||'#758BA5'}30">${e.category}</span></td><td style="font-weight:600;color:var(--red)">${fmtFull(e.amount,e.currency)}</td><td><span class="badge badge-gray no-dot" style="font-size:0.7rem">${e.currency}</span></td><td style="color:var(--text3);font-size:0.8rem">${formatDate(e.date)}</td><td style="color:var(--text3)">${e.vendor||'-'}</td><td><button class="btn btn-ghost btn-sm" onclick="deleteExpense('${e.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button></td></tr>`;
  }).join('')||'<tr><td colspan="7"><div class="empty-state"><h3>No Overall Expenses</h3><p>Add your first shared expense</p></div></td></tr>';
  const tbody=document.getElementById('overall-expenses-tbody');
  if(tbody)tbody.innerHTML=rows;
}

function renderLabsExpenses(){
  const dataScoped=getExpensesByScope('labs');
  const byCat={};
  dataScoped.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+e.amount;});

  if(labsExpCharts.cat){labsExpCharts.cat.destroy();labsExpCharts.cat=null;}
  const cc=document.getElementById('labsExpCatChart');
  if(cc){
    const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    if(cats.length){
      labsExpCharts.cat=new Chart(cc,{type:'doughnut',data:{labels:cats.map(c=>c[0]),datasets:[{data:cats.map(c=>c[1]),backgroundColor:cats.map(c=>EXP_CATS[c[0]]||'#758BA5'),borderColor:'#0D2237',borderWidth:2,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false}}}});
      const total=Object.values(byCat).reduce((s,v)=>s+v,0);
      document.getElementById('labs-exp-cat-legend').innerHTML=cats.map(c=>`<div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:${EXP_CATS[c[0]]||'#758BA5'}"></div><div class="qm-label">${c[0]}</div></div><div><div class="qm-value">${fmt(c[1])}</div><div style="font-size:0.68rem;color:var(--text4)">${total>0?Math.round(c[1]/total*100):0}%</div></div></div>`).join('');
    }
  }

  if(labsExpCharts.trend){labsExpCharts.trend.destroy();labsExpCharts.trend=null;}
  const tc=document.getElementById('labsExpTrendChart');
  const sym=cs(DB.settings.currency||'INR');
  if(tc){
    const months=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const data=buildMonthlyData(dataScoped,'amount','date');
    labsExpCharts.trend=new Chart(tc,{type:'line',data:{labels:months,datasets:[{data,borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.06)',fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:'#EF4444'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});
  }

  let data=dataScoped;
  if(labsExpFilter)data=data.filter(e=>e.description.toLowerCase().includes(labsExpFilter)||e.vendor.toLowerCase().includes(labsExpFilter));
  if(labsExpCatFilter)data=data.filter(e=>e.category===labsExpCatFilter);
  data=[...data].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=data.map(e=>{
    const notes=e.notes?`<div class="td-sub">${e.notes}</div>`:'';
    return `<tr><td><div class="td-main">${e.description}</div>${notes}</td><td><span class="badge no-dot" style="background:${EXP_CATS[e.category]||'#758BA5'}18;color:${EXP_CATS[e.category]||'#758BA5'};border:1px solid ${EXP_CATS[e.category]||'#758BA5'}30">${e.category}</span></td><td style="font-weight:600;color:var(--red)">${fmtFull(e.amount,e.currency)}</td><td><span class="badge badge-gray no-dot" style="font-size:0.7rem">${e.currency}</span></td><td style="color:var(--text3);font-size:0.8rem">${formatDate(e.date)}</td><td style="color:var(--text3)">${e.vendor||'-'}</td><td><button class="btn btn-ghost btn-sm" onclick="deleteExpense('${e.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button></td></tr>`;
  }).join('')||'<tr><td colspan="7"><div class="empty-state"><h3>No Expenses</h3><p>Add your first expense</p></div></td></tr>';
  document.getElementById('labs-expenses-tbody').innerHTML=rows;
}
function filterExpenses(v){expFilter=v.toLowerCase();renderExpenses();}
function filterExpensesByCategory(v){expCatFilter=v;renderExpenses();}
function filterLabsExpenses(v){labsExpFilter=v.toLowerCase();renderLabsExpenses();}
function filterLabsExpensesByCategory(v){labsExpCatFilter=v;renderLabsExpenses();}
function filterOverallExpenses(v){overallExpFilter=v.toLowerCase();renderOverallExpenses();}
function filterOverallExpensesByCategory(v){overallExpCatFilter=v;renderOverallExpenses();}

async function saveExpense(){
  const description=document.getElementById('ex-desc').value.trim();
  if(!description){showToast('Description required','error');return;}
  const payload={description,category:document.getElementById('ex-cat').value,vendor:document.getElementById('ex-vendor').value,amount:parseFloat(document.getElementById('ex-amount').value)||0,currency:document.getElementById('ex-currency').value,date:document.getElementById('ex-date').value,notes:document.getElementById('ex-notes').value,scope:currentExpenseScope};
  try{
    const res=await apiFetch('/api/expenses',{method:'POST',body:JSON.stringify(payload)});
    DB.expenses.unshift(res);
    closeModal('addExpenseModal');
    renderExpenses();renderExpStats();
    renderLabsExpenses();renderLabsExpStats();
    renderOverallExpenses();renderOverallExpStats();
    renderDashboard();
    showToast('Expense added','success');
  }catch(e){showToast(e.message,'error');}
}
function deleteExpense(id){confirmAction('Delete this expense?',async()=>{try{await apiFetch('/api/expenses/'+id,{method:'DELETE'});DB.expenses=DB.expenses.filter(e=>e.id!==id);renderExpenses();renderExpStats();renderLabsExpenses();renderLabsExpStats();renderOverallExpenses();renderOverallExpStats();renderDashboard();showToast('Expense deleted','info');}catch(e){showToast(e.message,'error');}});}

let pnlCharts={};
let pnlYear = new Date().getFullYear();

function ensurePnlYears(){
  const sel=document.getElementById('pnl-year');
  if(!sel) return;
  const years=new Set();
  const dates=[...DB.documents.map(d=>d.date),...DB.subscriptions.map(s=>s.date),...DB.expenses.map(e=>e.date)];
  dates.forEach(d=>{const dt=new Date(d); if(!isNaN(dt)) years.add(dt.getFullYear());});
  if(years.size===0){years.add(new Date().getFullYear());}
  const list=[...years].sort((a,b)=>a-b);
  sel.innerHTML=list.map(y=>`<option value="${y}">${y}</option>`).join('');
  if(!list.includes(pnlYear)) pnlYear=list[list.length-1];
  sel.value=String(pnlYear);
}

function renderPnL(){
  ensurePnlYears();
  const yearSel=document.getElementById('pnl-year');
  if(yearSel) pnlYear=parseInt(yearSel.value,10);

  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const inYear = d => {const dt=new Date(d); return !isNaN(dt) && dt.getFullYear()===pnlYear;};

  const invsPaid=DB.documents.filter(d=>d.type==='invoice'&&d.status==='Paid'&&inYear(d.date));
  const projPaid=DB.projects.filter(p=>inYear(p.start||p.due||''));
  const studioRecords=invsPaid.length
    ? invsPaid.map(d=>({amount:d.total,date:d.date}))
    : projPaid.filter(p=>p.paid>0).map(p=>({amount:p.paid,date:p.start||p.due||''}));
  const sm = buildMonthlyDataCalendar(studioRecords,'amount','date');
  const lm = buildMonthlyDataCalendar(DB.subscriptions.filter(s=>inYear(s.date)),'amount','date');
  const em = buildMonthlyDataCalendar(DB.expenses.filter(e=>inYear(e.date)),'amount','date');
  const ti = sm.map((v,i)=>v+lm[i]);
  const nm = ti.map((v,i)=>v-em[i]);
  const tr = ti.reduce((s,v)=>s+v,0);
  const te = em.reduce((s,v)=>s+v,0);
  const np = tr-te;
  const mg = tr>0?Math.round(np/tr*100):0;
  const sym = cs(DB.settings.currency||'INR');

  document.getElementById('pnl-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmt(tr)}</div><div class="stat-change up">${pnlYear}</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div><div class="stat"><div class="stat-label">Total Expenses</div><div class="stat-value red">${fmt(te)}</div><div class="stat-change down">Outflows</div><div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/></svg></div></div><div class="stat"><div class="stat-label">Net Profit</div><div class="stat-value ${np>=0?'green':'red'}">${fmtSigned(np)}</div><div class="stat-change ${np>=0?'up':'down'}">${np>=0?'After expenses':'Loss'}</div><div class="stat-icon ${np>=0?'green':'red'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div class="stat"><div class="stat-label">Profit Margin</div><div class="stat-value ${mg>30?'green':mg>15?'amber':mg>=0?'red':'red'}">${mg}%</div><div class="stat-change ${mg>30?'up':mg>15?'neutral':mg>=0?'down':'down'}">Net margin</div><div class="stat-icon ${mg>30?'green':'amber'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div></div>`;

  if(pnlCharts.bar){pnlCharts.bar.destroy();pnlCharts.bar=null;}
  const bc=document.getElementById('pnlBarChart');
  if(bc){pnlCharts.bar=new Chart(bc,{type:'bar',data:{labels:months,datasets:[{label:'Revenue',data:ti,backgroundColor:'rgba(34,197,94,0.55)',borderColor:'#22C55E',borderWidth:1,borderRadius:4},{label:'Expenses',data:em,backgroundColor:'rgba(239,68,68,0.45)',borderColor:'#EF4444',borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});}

  if(pnlCharts.profit){pnlCharts.profit.destroy();pnlCharts.profit=null;}
  const pc=document.getElementById('pnlProfitChart');
  if(pc){pnlCharts.profit=new Chart(pc,{type:'line',data:{labels:months,datasets:[{data:nm,borderColor:'#22C55E',backgroundColor:'rgba(34,197,94,0.07)',fill:true,tension:0.4,pointRadius:4,pointBackgroundColor:'#22C55E'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:10}},grid:{color:'rgba(54,132,219,0.05)'}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>sym+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}});}

  document.getElementById('pnl-table').innerHTML=`<div style="overflow-x:auto"><table style="background:transparent"><thead><tr><th>Category</th>${months.map(m=>`<th style="text-align:right">${m}</th>`).join('')}<th style="text-align:right">Total</th></tr></thead><tbody><tr style="background:rgba(34,197,94,0.04)"><td style="font-weight:600;color:var(--green)">Studio Revenue</td>${sm.map(v=>`<td style="text-align:right;color:var(--green);font-size:0.78rem">${sym}${(v/1000).toFixed(0)}K</td>`).join('')}<td style="text-align:right;font-weight:700;color:var(--green)">${fmt(sm.reduce((s,v)=>s+v,0))}</td></tr><tr style="background:rgba(245,158,11,0.04)"><td style="font-weight:600;color:var(--amber)">Labs Revenue</td>${lm.map(v=>`<td style="text-align:right;color:var(--amber);font-size:0.78rem">${sym}${(v/1000).toFixed(0)}K</td>`).join('')}<td style="text-align:right;font-weight:700;color:var(--amber)">${fmt(lm.reduce((s,v)=>s+v,0))}</td></tr><tr style="background:rgba(54,132,219,0.05)"><td style="font-weight:700;color:var(--text)">Total Revenue</td>${ti.map(v=>`<td style="text-align:right;font-weight:600;font-size:0.78rem">${sym}${(v/1000).toFixed(0)}K</td>`).join('')}<td style="text-align:right;font-weight:700">${fmt(tr)}</td></tr><tr style="background:rgba(239,68,68,0.04)"><td style="font-weight:600;color:var(--red)">Total Expenses</td>${em.map(v=>`<td style="text-align:right;color:var(--red);font-size:0.78rem">${sym}${(v/1000).toFixed(0)}K</td>`).join('')}<td style="text-align:right;font-weight:700;color:var(--red)">${fmt(te)}</td></tr><tr style="background:rgba(34,197,94,0.08);border-top:2px solid rgba(54,132,219,0.2)"><td style="font-weight:700;color:${np>=0?'var(--green)':'var(--red)'};font-size:0.92rem">Net Profit</td>${nm.map(v=>`<td style="text-align:right;font-weight:700;color:${v>=0?'var(--green)':'var(--red)'};font-size:0.78rem">${v<0?'-':''}${sym}${(Math.abs(v)/1000).toFixed(0)}K</td>`).join('')}<td style="text-align:right;font-weight:700;color:${np>=0?'var(--green)':'var(--red)'};font-size:0.95rem">${fmtSigned(np)}</td></tr></tbody></table></div>`;
}

function renderProducts(){const sc={'Live':'green','Beta':'amber','Development':'blue','Archived':'gray'};document.getElementById('products-grid').innerHTML=DB.products.map(p=>`<div class="card product-card" onclick="openProductDetails('${p.id}')"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px"><div><div style="font-family:var(--font-display);font-size:1rem;font-weight:700;color:var(--text)">${p.name}</div><div style="font-size:0.75rem;color:var(--text4);margin-top:2px">${p.cat}</div></div><span class="badge badge-${sc[p.status]||'gray'} no-dot">${p.status}</span></div><div style="font-size:0.8rem;color:var(--text3);margin-bottom:16px;line-height:1.5">${p.desc||''}</div><div class="divider" style="margin:0 0 14px"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px"><div style="text-align:center;padding:10px;background:var(--surface);border-radius:8px"><div style="font-size:0.68rem;color:var(--text4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Monthly</div><div style="font-family:var(--font-display);font-weight:700;font-size:0.9rem;color:var(--text)">${p.monthly>0?cs(p.currency)+p.monthly:'-'}</div></div><div style="text-align:center;padding:10px;background:var(--surface);border-radius:8px"><div style="font-size:0.68rem;color:var(--text4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Yearly</div><div style="font-family:var(--font-display);font-weight:700;font-size:0.9rem;color:var(--text)">${p.yearly>0?cs(p.currency)+p.yearly:'-'}</div></div><div style="text-align:center;padding:10px;background:var(--surface);border-radius:8px"><div style="font-size:0.68rem;color:var(--text4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Lifetime</div><div style="font-family:var(--font-display);font-weight:700;font-size:0.9rem;color:var(--text)">${p.lifetime>0?cs(p.currency)+p.lifetime:'-'}</div></div></div>${p.totalRev>0?`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);border-radius:8px"><span style="font-size:0.75rem;color:var(--text4)">Total Revenue</span><span style="font-family:var(--font-display);font-weight:700;color:var(--green)">${fmt(p.totalRev,p.currency)}</span></div>`:''}${p.launch?`<div style="font-size:0.72rem;color:var(--text4);margin-top:10px">Launched: ${formatDate(p.launch)}</div>`:'<div style="font-size:0.72rem;color:var(--amber);margin-top:10px">Not yet launched</div>'}</div>`).join('')||'<div style="grid-column:1/-1"><div class="empty-state"><h3>No Products</h3><p>Add your first Labs product</p></div></div>';}
async function saveProduct(){
  const id=document.getElementById('prod-id').value;
  const name=document.getElementById('prod-name').value.trim();
  if(!name){showToast('Product name required','error');return;}
  const payload={
    name,
    cat:document.getElementById('prod-cat').value,
    desc:document.getElementById('prod-desc').value,
    status:document.getElementById('prod-status').value,
    launch:document.getElementById('prod-launch').value,
    monthly:parseFloat(document.getElementById('prod-monthly').value)||0,
    yearly:parseFloat(document.getElementById('prod-yearly').value)||0,
    lifetime:parseFloat(document.getElementById('prod-lifetime').value)||0,
    currency:document.getElementById('prod-currency').value,
  };
  try{
    if(id){
      const cur=DB.products.find(x=>x.id===id);
      const totalRev=cur?cur.totalRev||0:0;
      await apiFetch('/api/products/'+id,{method:'PUT',body:JSON.stringify({...payload,totalRev})});
      DB.products=DB.products.map(p=>p.id===id?{...p,...payload,totalRev}:p);
      closeModal('addProductModal');
      renderProducts();
      populateProductDropdowns();
      showToast('Product updated','success');
    }else{
      const res=await apiFetch('/api/products',{method:'POST',body:JSON.stringify(payload)});
      DB.products.unshift(res);
      closeModal('addProductModal');
      renderProducts();
      populateProductDropdowns();
      showToast('Product added','success');
    }
    document.getElementById('prod-id').value='';
  }catch(e){showToast(e.message,'error');}
}
let currentProductId='';
function openAddProductModal(){
  document.getElementById('prod-id').value='';
  document.getElementById('prod-name').value='';
  document.getElementById('prod-cat').value='SaaS';
  document.getElementById('prod-desc').value='';
  document.getElementById('prod-status').value='Live';
  document.getElementById('prod-launch').value='';
  document.getElementById('prod-monthly').value='';
  document.getElementById('prod-yearly').value='';
  document.getElementById('prod-lifetime').value='';
  document.getElementById('prod-currency').value=DB.settings.currency||'INR';
  openModal('addProductModal');
}

function openProductDetails(id){
  const p=DB.products.find(x=>x.id===id); if(!p){showToast('Product not found','error');return;}
  currentProductId=id;
  const sc={'Live':'green','Beta':'amber','Development':'blue','Archived':'gray'};
  document.getElementById('prod-detail-name').textContent=p.name;
  document.getElementById('prod-detail-cat').textContent=p.cat||'';
  document.getElementById('prod-detail-desc').textContent=p.desc||'';
  document.getElementById('prod-detail-status').innerHTML=`<span class="badge badge-${sc[p.status]||'gray'} no-dot">${p.status}</span>`;
  document.getElementById('prod-detail-monthly').textContent=p.monthly>0?cs(p.currency)+p.monthly:'?';
  document.getElementById('prod-detail-yearly').textContent=p.yearly>0?cs(p.currency)+p.yearly:'?';
  document.getElementById('prod-detail-lifetime').textContent=p.lifetime>0?cs(p.currency)+p.lifetime:'?';
  document.getElementById('prod-detail-launch').textContent=p.launch?`Launched: ${formatDate(p.launch)}`:'Not yet launched';
  document.getElementById('prod-detail-total').textContent=p.totalRev>0?`Total Revenue: ${fmt(p.totalRev,p.currency)}`:'Total Revenue: ?';

  const tx=DB.subscriptions.filter(s=>s.product===id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const body=document.getElementById('prod-detail-tx');
  body.innerHTML = tx.map(t=>`<tr><td>${formatDate(t.date)}</td><td style="text-transform:capitalize">${t.plan}</td><td>${fmtFull(t.amount,t.currency)}</td><td>${t.subscribers}</td><td>${t.notes||''}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty-state" style="padding:20px"><p>No transactions yet</p></div></td></tr>';
  openModal('productDetailModal');
}

function openEditProduct(){
  const p=DB.products.find(x=>x.id===currentProductId); if(!p){return;}
  document.getElementById('prod-id').value=p.id;
  document.getElementById('prod-name').value=p.name||'';
  document.getElementById('prod-cat').value=p.cat||'SaaS';
  document.getElementById('prod-desc').value=p.desc||'';
  document.getElementById('prod-status').value=p.status||'Live';
  document.getElementById('prod-launch').value=p.launch||'';
  document.getElementById('prod-monthly').value=p.monthly||'';
  document.getElementById('prod-yearly').value=p.yearly||'';
  document.getElementById('prod-lifetime').value=p.lifetime||'';
  document.getElementById('prod-currency').value=p.currency||DB.settings.currency||'INR';
  closeModal('productDetailModal');
  openModal('addProductModal');
}

function deleteProduct(){
  const p=DB.products.find(x=>x.id===currentProductId); if(!p){return;}
  confirmAction('Delete this product? This will not delete transactions.', async()=>{
    try{
      await apiFetch('/api/products/'+p.id,{method:'DELETE'});
      DB.products=DB.products.filter(x=>x.id!==p.id);
      DB.subscriptions=DB.subscriptions.map(s=>s.product===p.id?{...s,product:''}:s);
      closeModal('productDetailModal');
      renderProducts();
      populateProductDropdowns();
      showToast('Product deleted','info');
    }catch(e){showToast(e.message,'error');}
  });
}

function renderSubStats(){const total=DB.subscriptions.reduce((s,x)=>s+x.amount,0);const totalSubs=DB.subscriptions.reduce((s,x)=>s+x.subscribers,0);const monthly=DB.subscriptions.filter(x=>x.plan==='monthly').reduce((s,x)=>s+x.amount,0);document.getElementById('sub-stats').innerHTML=`<div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmt(total)}</div><div class="stat-change up">Labs</div><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div class="stat"><div class="stat-label">Total Entries</div><div class="stat-value">${DB.subscriptions.length}</div><div class="stat-change neutral">Revenue entries</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg></div></div><div class="stat"><div class="stat-label">Monthly Revenue</div><div class="stat-value">${fmt(monthly)}</div><div class="stat-change neutral">Monthly plans</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div></div><div class="stat"><div class="stat-label">Total Subscribers</div><div class="stat-value">${totalSubs}</div><div class="stat-change up">All products</div><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div></div>`;}
function renderSubscriptions(){populateProductDropdowns();const pc={monthly:'badge-green',yearly:'badge-amber',lifetime:'badge-purple'};document.getElementById('subs-tbody').innerHTML=DB.subscriptions.map(s=>{const prod=DB.products.find(p=>p.id===s.product);return`<tr><td><div class="td-main">${prod?prod.name:'-'}</div></td><td><span class="badge ${pc[s.plan]||'badge-gray'} no-dot" style="text-transform:capitalize">${s.plan}</span></td><td style="font-weight:600;color:var(--green)">${fmtFull(s.amount,s.currency)}</td><td><span class="badge badge-gray no-dot" style="font-size:0.7rem">${s.currency}</span></td><td>${s.subscribers}</td><td style="color:var(--text3);font-size:0.8rem">${formatDate(s.date)}</td><td><button class="btn btn-ghost btn-sm" onclick="deleteSub('${s.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button></td></tr>`;}).join('')||'<tr><td colspan="7"><div class="empty-state"><h3>No Entries</h3><p>Add revenue from your products</p></div></td></tr>';}
async function saveSubscription(){const product=document.getElementById('sub-prod').value;if(!product){showToast('Select a product','error');return;}const payload={product,plan:document.getElementById('sub-plan').value,amount:parseFloat(document.getElementById('sub-amount').value)||0,currency:document.getElementById('sub-currency').value,subscribers:parseInt(document.getElementById('sub-count').value)||1,date:document.getElementById('sub-date').value,notes:document.getElementById('sub-notes').value};try{const res=await apiFetch('/api/subscriptions',{method:'POST',body:JSON.stringify(payload)});DB.subscriptions.unshift(res);const prod=DB.products.find(p=>p.id===product);if(prod)prod.totalRev=(prod.totalRev||0)+payload.amount;closeModal('addSubModal');renderSubscriptions();renderSubStats();showToast('Revenue entry saved','success');}catch(e){showToast(e.message,'error');}}
function deleteSub(id){confirmAction('Delete this entry?',async()=>{try{await apiFetch('/api/subscriptions/'+id,{method:'DELETE'});DB.subscriptions=DB.subscriptions.filter(s=>s.id!==id);renderSubscriptions();renderSubStats();showToast('Entry deleted','info');}catch(e){showToast(e.message,'error');}});}

let labsCharts={};
function renderLabsAnalytics(){
  const tr=DB.subscriptions.reduce((s,x)=>s+x.amount,0);
  const ts=DB.subscriptions.reduce((s,x)=>s+x.subscribers,0);
  const monthly=DB.subscriptions.filter(x=>x.plan==='monthly').reduce((s,x)=>s+x.amount,0);
  const yearly=DB.subscriptions.filter(x=>x.plan==='yearly').reduce((s,x)=>s+x.amount,0);
  const ms=DB.subscriptions.filter(x=>x.plan==='monthly').reduce((s,x)=>s+x.subscribers,0);
  const ys=DB.subscriptions.filter(x=>x.plan==='yearly').reduce((s,x)=>s+x.subscribers,0);
  document.getElementById('labs-stats').innerHTML=`
    <div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value green">${fmt(tr)}</div><div class="stat-change up">Labs products</div><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div>
    <div class="stat"><div class="stat-label">Total Subscribers</div><div class="stat-value">${ts}</div><div class="stat-change up">Paying users</div><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div></div>
    <div class="stat"><div class="stat-label">Monthly MRR</div><div class="stat-value amber">${fmt(monthly)}</div><div class="stat-change neutral">${ms} subscribers</div><div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div></div>
    <div class="stat"><div class="stat-label">Annual ARR</div><div class="stat-value purple">${fmt(yearly)}</div><div class="stat-change neutral">${ys} subscribers</div><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>`;

  const prd={};
  DB.products.forEach(p=>{prd[p.id]=0;});
  DB.subscriptions.forEach(s=>{if(prd[s.product]!==undefined)prd[s.product]+=s.amount;});

  if(labsCharts.prod){labsCharts.prod.destroy();labsCharts.prod=null;}
  const lp=document.getElementById('labsProdChart');
  if(lp){
    const prods=DB.products.filter(p=>prd[p.id]>0);
    if(prods.length){
      labsCharts.prod=new Chart(lp,{
        type:'bar',
        data:{labels:prods.map(p=>p.name),datasets:[{data:prods.map(p=>prd[p.id]),backgroundColor:['#F59E0B','#3684DB','#22C55E','#8B5CF6'].slice(0,prods.length),borderRadius:6}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#758BA5',font:{size:11}},grid:{display:false}},y:{ticks:{color:'#758BA5',font:{size:10},callback:v=>cs(DB.settings.currency||'INR')+(v/1000)+'K'},grid:{color:'rgba(54,132,219,0.05)'}}}}
      });
    }
  }

  if(labsCharts.plan){labsCharts.plan.destroy();labsCharts.plan=null;}
  const lplan=document.getElementById('labsPlanChart');
  if(lplan){
    const ls=Math.max(ts-ms-ys,0);
    labsCharts.plan=new Chart(lplan,{type:'doughnut',data:{datasets:[{data:[ms,ys,ls],backgroundColor:['#22C55E','#F59E0B','#8B5CF6'],borderColor:'#0D2237',borderWidth:3,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false}}}});
    document.getElementById('labs-plan-legend').innerHTML=`
      <div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:#22C55E"></div><div class="qm-label">Monthly</div></div><div class="qm-value">${ms}</div></div>
      <div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:#F59E0B"></div><div class="qm-label">Yearly</div></div><div class="qm-value">${ys}</div></div>
      <div class="qm-row"><div style="display:flex;align-items:center;gap:6px"><div class="dot" style="background:#8B5CF6"></div><div class="qm-label">Lifetime</div></div><div class="qm-value">${ls}</div></div>`;
  }
}

function updatePrintMeta(){
  const biz=document.getElementById('print-biz-name');
  const period=document.getElementById('print-period-label');
  const date=document.getElementById('print-date');
  if(biz) biz.textContent = (DB.settings && DB.settings.bizName) ? DB.settings.bizName : 'SHUBIQ Business OS';
  if(period){
    const sel=document.getElementById('pnl-period');
    period.textContent = sel && sel.selectedIndex>=0 ? sel.options[sel.selectedIndex].textContent : 'FY 2025-26';
  }
  if(date){
    date.textContent = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  }
}
function loadSettings(){const s=DB.settings;const map={'biz-name':'bizName','owner-name':'ownerName','email':'email','phone':'phone','address':'address','gst':'gst','website':'website','bank-name':'bankName','bank-holder':'bankHolder','bank-acc':'bankAcc','bank-ifsc':'bankIfsc','upi':'upi','inv-notes':'invNotes'};Object.entries(map).forEach(([f,k])=>{const el=document.getElementById('s-'+f);if(el)el.value=s[k]||'';});setSelect('s-currency',s.currency||'INR');const taxVal=Number.isFinite(s.tax)?s.tax:18;document.getElementById('s-tax').value=taxVal;document.getElementById('s-terms').value=s.terms||30;setSelect('s-fy',s.fyStart||'April');}
async function saveSettings(){const rawTax=parseFloat(document.getElementById('s-tax').value);const tax=Number.isFinite(rawTax)?rawTax:18;DB.settings={...DB.settings,bizName:document.getElementById('s-biz-name').value,ownerName:document.getElementById('s-owner-name').value,email:document.getElementById('s-email').value,phone:document.getElementById('s-phone').value,address:document.getElementById('s-address').value,gst:document.getElementById('s-gst').value,website:document.getElementById('s-website').value,bankName:document.getElementById('s-bank-name').value,bankHolder:document.getElementById('s-bank-holder').value,bankAcc:document.getElementById('s-bank-acc').value,bankIfsc:document.getElementById('s-bank-ifsc').value,upi:document.getElementById('s-upi').value,currency:document.getElementById('s-currency').value,tax,terms:parseInt(document.getElementById('s-terms').value)||30,fyStart:document.getElementById('s-fy').value,invNotes:document.getElementById('s-inv-notes').value};try{await apiFetch('/api/settings',{method:'PUT',body:JSON.stringify(DB.settings)});document.getElementById('user-name-sb').textContent=DB.settings.ownerName||'Admin';document.getElementById('user-avatar-sb').textContent=(DB.settings.ownerName||'AD').substring(0,2).toUpperCase();showToast('Settings saved successfully','success');}catch(e){showToast(e.message,'error');}}
async function changePassword(){const cur=document.getElementById('s-cur-pass').value;const nw=document.getElementById('s-new-pass').value;if(nw.length<6){showToast('New password must be 6+ characters','error');return;}try{await apiFetch('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:cur,newPassword:nw})});document.getElementById('s-cur-pass').value='';document.getElementById('s-new-pass').value='';showToast('Password updated successfully','success');}catch(e){showToast(e.message||'Password update failed','error');}}
function confirmReset(){confirmAction('This will permanently delete ALL data. This cannot be undone.',async()=>{try{await apiFetch('/api/reset',{method:'POST'});await loadDB();initApp();nav('dashboard');showToast('All data reset','success');}catch(e){showToast(e.message||'Reset failed','error');}});}

function statusBadge(s){const m={Active:'badge-green',Completed:'badge-blue','In Review':'badge-amber','On Hold':'badge-gray',Pending:'badge-amber',Paid:'badge-green',Draft:'badge-gray',Accepted:'badge-blue'};return`<span class="badge ${m[s]||'badge-gray'} no-dot">${s}</span>`;}
function getClientName(id){const c=DB.clients.find(x=>x.id===id);return c?c.name:'';}
function today(){return new Date().toISOString().split('T')[0];}
function formatDate(d){if(!d)return'-';try{return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}}
function formatDateFull(d){if(!d)return'-';try{return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});}catch(e){return d;}}
function setSelect(id,val){const el=document.getElementById(id);if(!el)return;for(let i=0;i<el.options.length;i++){if(el.options[i].value===val){el.selectedIndex=i;return;}}}
function populateClientDropdowns(){['p-client','ep-client','doc-client'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const cur=el.value;el.innerHTML='<option value="">Select client...</option>'+DB.clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');if(cur)setSelect(id,cur);});}
function populateProductDropdowns(){const el=document.getElementById('sub-prod');if(!el)return;const cur=el.value;el.innerHTML='<option value="">Select product...</option>'+DB.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');if(cur)setSelect('sub-prod',cur);}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));if(e.key==='/'&&!e.target.closest('input,textarea,select'))document.getElementById('global-search').focus();});
document.querySelectorAll('.modal-overlay').forEach(overlay=>{overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open');});});
function showToast(msg,type='success'){const container=document.getElementById('toast-container');const toast=document.createElement('div');toast.className='toast '+type;const icons={success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>',error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'};toast.innerHTML=`<div class="toast-icon">${icons[type]||icons.info}</div>${msg}`;container.appendChild(toast);requestAnimationFrame(()=>toast.classList.add('show'));setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>toast.remove(),300);},3000);}
let pendingAction=null;
function confirmAction(msg,cb){document.getElementById('confirmText').textContent=msg;pendingAction=cb;const btn=document.getElementById('confirmActionBtn');btn.onclick=()=>{if(pendingAction)pendingAction();closeModal('confirmModal');pendingAction=null;};openModal('confirmModal');}
function globalSearch(v){if(!v.trim())return;const q=v.toLowerCase();const results=[...DB.projects.filter(p=>p.name.toLowerCase().includes(q)).map(p=>({page:'projects'})),...DB.clients.filter(c=>c.name.toLowerCase().includes(q)).map(c=>({page:'clients'})),...DB.documents.filter(d=>d.num.toLowerCase().includes(q)||d.subject.toLowerCase().includes(q)).map(d=>({page:'invoices'}))];if(results.length>0){nav(results[0].page);showToast(`Found ${results.length} result(s) for "${v}"`, 'info');}else showToast('No results found','info');}
function toggleMobileMenu(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobile-overlay').classList.toggle('show');}
function closeMobileMenu(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobile-overlay').classList.remove('show');}
document.querySelectorAll('input[type=date]').forEach(el=>{if(!el.value)el.value=today();});

async function boot(){const token=getToken();if(token){try{await apiFetch('/api/auth/verify');await loadDB();showApp();initApp();return;}catch(e){setToken('');}}showLogin();}
boot();
