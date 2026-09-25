let registerMode=false, currentCourse=null, currentQcms=[], examMode=false;

const $=s=>document.querySelector(s);
async function api(url,opts={}){const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Erreur");return d}
function showPage(name){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  const el=$( "#"+name+"Page"); if(el) el.classList.remove("hidden");
  if(name==="dashboard") loadDashboard();
  if(name==="courses") loadCourses();
  if(name==="stats") loadStats();
}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function boot(){
  const d=await api("/api/auth/me");
  if(d.user){$("#authPage").classList.add("hidden");$("#nav").classList.remove("hidden");showPage("dashboard")}
  else showPage("auth");
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$("#logout").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()};
$("#loginTab").onclick=()=>{registerMode=false;setAuthMode()};
$("#registerTab").onclick=()=>{registerMode=true;setAuthMode()};
function setAuthMode(){
  $("#loginTab").classList.toggle("active",!registerMode);$("#registerTab").classList.toggle("active",registerMode);
  $("#authSubmit").textContent=registerMode?"Créer mon compte":"Se connecter";$("#authMsg").textContent="";
}
$("#authForm").onsubmit=async e=>{
  e.preventDefault();$("#authMsg").textContent="Chargement…";
  try{
    const d=await api(registerMode?"/api/auth/register":"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("#email").value,password:$("#password").value})});
    $("#authPage").classList.add("hidden");$("#nav").classList.remove("hidden");showPage("dashboard");
  }catch(err){$("#authMsg").textContent=err.message}
};

async function loadDashboard(){
  const d=await api("/api/dashboard");
  $("#dashStats").innerHTML=[
    ["Cours",d.courses.length],["QCM disponibles",d.qcmCount],["Sessions",d.attempts],["Moyenne",d.average+"%"]
  ].map(x=>`<div class="stat-card"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
  $("#dashCourses").innerHTML=d.courses.length?d.courses.map(c=>`<div class="row" style="padding:13px 0;border-bottom:1px solid var(--line)"><strong style="flex:1">${esc(c.title)}</strong><span class="course-meta">${c.qcm_count||0} QCM</span><button class="primary" onclick="openCourse(${c.id})">Ouvrir</button></div>`).join(""):"<p class='course-meta'>Aucun cours pour l'instant.</p>";
}
async function loadCourses(){
  const list=await api("/api/courses");
  $("#courseList").innerHTML=list.length?list.map(c=>`<div class="course-card" onclick="openCourse(${c.id})"><h3>${esc(c.title)}</h3><div class="course-meta">${esc(c.filename||"Cours collé")} · ${c.qcm_count||0} QCM</div></div>`).join(""):"<div class='panel'><p>Ta bibliothèque est vide. Commence par ajouter ton premier cours.</p></div>";
}
$("#courseForm").onsubmit=async e=>{
  e.preventDefault();$("#courseMsg").textContent="Import en cours…";
  try{
    const fd=new FormData();fd.append("title",$("#courseTitle").value);fd.append("text",$("#courseText").value);
    if($("#coursePdf").files[0])fd.append("pdf",$("#coursePdf").files[0]);
    const d=await api("/api/courses",{method:"POST",body:fd});
    $("#courseMsg").textContent="Cours enregistré !";$("#courseMsg").className="msg success";e.target.reset();loadCourses();openCourse(d.id);
  }catch(err){$("#courseMsg").textContent=err.message}
};

async function openCourse(id){
  currentCourse=id;showPage("course");
  const d=await api("/api/courses/"+id); currentQcms=d.qcms;
  $("#courseDetail").innerHTML=`
    <div class="page-head"><div><p class="eyebrow">COURS</p><h2>${esc(d.course.title)}</h2><p class="course-meta">${currentQcms.length} QCM enregistrés</p></div></div>
    <div class="panel">
      <h3>Générer des QCM</h3>
      <div class="row">
        <label style="flex:1">Nombre<select id="genCount">${[5,10,20,50,100].map(n=>`<option>${n}</option>`).join("")}</select></label>
        <label style="flex:1">Difficulté<select id="genDiff"><option value="facile">Facile</option><option value="intermediaire" selected>Intermédiaire</option><option value="difficile">Difficile</option></select></label>
      </div>
      <button class="primary" onclick="generateQcms()">Générer avec l'IA</button>
      <p id="genMsg" class="msg"></p>
    </div>
    <div class="panel"><h3>Banque de QCM</h3><div id="qcmBank">${renderQcms(currentQcms)}</div></div>`;
}
function renderQcms(qcms){
  if(!qcms.length)return "<p class='course-meta'>Aucun QCM. Lance une génération.</p>";
  return qcms.map((q,i)=>`<article class="qcm-card"><div class="qcm-head"><div><strong>${i+1}. ${esc(q.stem)}</strong><div class="course-meta">Source : ${esc(q.source_page||"non précisée")}</div></div><span class="badge">${esc(q.difficulty)}</span></div>${q.items.map(it=>`<div class="item"><b>${it.letter}.</b> ${esc(it.statement)}<div class="correction"><b>${it.is_true?"Vrai":"Faux"}</b> — ${esc(it.explanation||"")}</div></div>`).join("")}</article>`).join("");
}
async function generateQcms(){
  $("#genMsg").textContent="Génération et enregistrement…";
  try{
    const d=await api(`/api/courses/${currentCourse}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({count:Number($("#genCount").value),difficulty:$("#genDiff").value})});
    $("#genMsg").textContent=`${d.saved} QCM enregistrés.`;openCourse(currentCourse);
  }catch(e){$("#genMsg").textContent=e.message}
}

function buildPractice(qcms, timed=false){
  if(!qcms.length)return "<p>Il n'y a pas encore de QCM. Importe un cours puis génère ta banque.</p>";
  const selected=qcms.slice(0,timed?Math.min(20,qcms.length):Math.min(10,qcms.length));
  examMode=timed;
  return `<div class="row" style="justify-content:space-between"><p>${timed?"Épreuve chronométrée":"Révision"} · ${selected.length} QCM</p><button class="primary" onclick="submitPractice()">Valider</button></div>
  ${timed?'<div id="timer" class="big-score" style="font-size:30px">20:00</div>':""}
  <div id="practiceQs">${selected.map((q,qi)=>`<article class="qcm-card"><strong>${qi+1}. ${esc(q.stem)}</strong>${q.items.map(it=>`<div class="item"><label><input type="checkbox" data-item="${it.id}"> <b>${it.letter}.</b> ${esc(it.statement)}</label></div>`).join("")}</article>`).join("")}</div>`;
}
async function loadPractice(){
  const list=await api("/api/courses");
  if(!list.length){$("#practiceArea").innerHTML="<p>Ajoute d'abord un cours.</p>";return}
  const all=[];
  for(const c of list){const d=await api("/api/courses/"+c.id);all.push(...d.qcms.map(q=>({...q,course_id:c.id})))}
  $("#practiceArea").innerHTML=buildPractice(all,false);
}
async function loadExam(){
  const list=await api("/api/courses");
  const all=[];
  for(const c of list){const d=await api("/api/courses/"+c.id);all.push(...d.qcms.map(q=>({...q,course_id:c.id})))}
  $("#examArea").innerHTML=buildPractice(all,true);
}
async function submitPractice(){
  const checked=[...document.querySelectorAll("#practiceQs input[data-item]")].map(x=>({itemId:Number(x.dataset.item),selected:x.checked}));
  try{
    const d=await api("/api/attempts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:currentCourse,mode:examMode?"examen":"revision",answers:checked})});
    $("#practiceArea").innerHTML=`<div class="panel"><p class="eyebrow">RÉSULTAT</p><div class="big-score">${d.percent}%</div><p>${d.score} bonne(s) réponse(s) sur ${d.total} proposition(s).</p><button class="primary" onclick="showPage('stats')">Voir mes statistiques</button></div>`;
  }catch(e){alert(e.message)}
}
async function loadStats(){
  const d=await api("/api/stats");
  $("#statsArea").innerHTML=`<div class="panel"><h3>Historique</h3><table class="table"><tr><th>Date</th><th>Mode</th><th>Cours</th><th>Score</th></tr>${d.history.map(x=>`<tr><td>${esc(x.created_at)}</td><td>${esc(x.mode)}</td><td>${esc(x.title||"—")}</td><td>${x.total?Math.round(x.score*100/x.total):0}%</td></tr>`).join("")}</table></div>
  <div class="panel" style="margin-top:16px"><h3>Erreurs fréquentes</h3>${d.weak.length?d.weak.map(x=>`<p><b>${esc(x.title)}</b> — ${esc(x.statement)} <span class="wrong">(${x.errors} erreur(s))</span></p>`).join(""):"<p>Pas encore assez de réponses pour faire ressortir des erreurs.</p>"}</div>`;
}
window.showPage=showPage;window.openCourse=openCourse;window.generateQcms=generateQcms;window.submitPractice=submitPractice;
const oldShow=showPage;
showPage=function(name){oldShow(name);if(name==="practice")loadPractice();if(name==="exam")loadExam()};
boot();
