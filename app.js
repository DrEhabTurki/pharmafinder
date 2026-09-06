const seedMedicines=[
{id:1,name:"باراسيتامول 500",ingredient:"Paracetamol",strength:"500 mg",form:"أقراص",manufacturer:"Demo Pharma",appearance:"شريط أبيض، أقراص بيضاء مستديرة",notes:"بيان دوائي مرفق"},
{id:2,name:"أموكسيسيلين 500",ingredient:"Amoxicillin",strength:"500 mg",form:"كبسولات",manufacturer:"Demo Pharma",appearance:"كبسولات زرقاء/بيضاء، شريط فضي",notes:""},
{id:3,name:"أملوديبين 5",ingredient:"Amlodipine",strength:"5 mg",form:"أقراص",manufacturer:"Demo Pharma",appearance:"أقراص بيضاء صغيرة، شريط فضي",notes:"بيان دوائي مرفق"},
{id:4,name:"أوميبرازول 20",ingredient:"Omeprazole",strength:"20 mg",form:"كبسولات",manufacturer:"Demo Pharma",appearance:"كبسولات حمراء/بيضاء، عبوة كرتون",notes:""},
{id:5,name:"ديكلوفيناك 50",ingredient:"Diclofenac",strength:"50 mg",form:"أقراص",manufacturer:"Demo Pharma",appearance:"أقراص بنية فاتحة، شريط فضي",notes:"بيان دوائي مرفق"},
];

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const normalize=s=>(s||"").toLowerCase().trim().replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/[ًٌٍَُِّْ]/g,"");
const stored=JSON.parse(localStorage.getItem("pharmaMedicines")||"[]");
let medicines=[...seedMedicines,...stored];
let recent=JSON.parse(localStorage.getItem("pharmaRecent")||"[]");

// ========== Modal Functions ==========
function openModal(){
  $("#medicineModal").hidden=false;
  document.body.style.overflow="hidden";
  $("#medicineForm").reset();
}

function closeModal(){
  $("#medicineModal").hidden=true;
  document.body.style.overflow="auto";
  $("#medicineForm").reset();
}

// ========== Event listeners for modal ==========
$("#addMedicineBtn").onclick=openModal;
$("#closeModalBtn").onclick=closeModal;
$("#cancelModalBtn").onclick=closeModal;
$("#medicineModal").querySelector(".modal-overlay").onclick=closeModal;

// Close modal on Escape key
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&!$("#medicineModal").hidden)closeModal();
});

// ========== Search Logic ==========
function score(m,q){
 const n=normalize(q), fields=[m.name,m.ingredient,m.strength,m.form,m.manufacturer,m.appearance,m.notes].map(normalize);
 if(!n)return 0;
 let s=0;
 fields.forEach((f,i)=>{if(f.includes(n))s+=i<2?45:15});
 n.split(/\s+/).filter(Boolean).forEach(word=>{
   fields.forEach((f,i)=>{if(f.includes(word))s+=i<2?18:6});
 });
 return Math.min(99,s);
}

function search(q,save=true){
 q=q.trim();
 if(save&&q){
   recent=[q,...recent.filter(x=>x!==q)].slice(0,8);
   localStorage.setItem("pharmaRecent",JSON.stringify(recent));
 }
 const ranked=medicines.map(m=>({...m,_score:score(m,q)})).filter(x=>x._score>0).sort((a,b)=>b._score-a._score);
 renderResults(ranked,q);
 renderRecent(); 
 updateStats(ranked.length);
}

function renderResults(items,q=""){
 const el=$("#results");
 if(!items.length){el.innerHTML='<div class="empty">لا توجد نتائج مطابقة. جرّب اسمًا أو كلمة من وصف الشكل.</div>';return}
 el.innerHTML=items.map(m=>`<article class="medicine">
 <h3>${escapeHtml(m.name)}</h3>
 <div class="meta"><span class="pill">${escapeHtml(m.ingredient)}</span><span class="pill">${escapeHtml(m.strength||"غير محدد")}</span><span class="pill">${escapeHtml(m.form)}</span></div>
 <p><strong>الشكل:</strong> ${escapeHtml(m.appearance||"غير موصوف")}</p>
 <p><strong>الشركة:</strong> ${escapeHtml(m.manufacturer||"غير محددة")}</p>
 <div class="match">درجة تطابق وصف البحث: <span class="confidence">${m._score}%</span></div>
 <small>${escapeHtml(m.notes||"")}</small>
 </article>`).join("");
}

function renderRecent(){
 const el=$("#recentSearches");
 el.innerHTML=recent.length?recent.map(x=>`<button data-recent="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join(""):"<span class='small'>لا يوجد سجل حتى الآن.</span>";
 $$("[data-recent]").forEach(b=>b.onclick=()=>{ $("#searchInput").value=b.dataset.recent; search(b.dataset.recent,false);});
}

function updateStats(rc=0){
 $("#medicineCount").textContent=medicines.length;
 $("#resultCount").textContent=rc;
 $("#recentCount").textContent=recent.length;
}

function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

// ========== Search handlers ==========
$("#searchBtn").onclick=()=>search($("#searchInput").value);
$("#searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")search(e.target.value)});
$$(".tag").forEach(b=>b.onclick=()=>{$("#searchInput").value=b.dataset.query;search(b.dataset.query)});
$("#clearBtn").onclick=()=>{$("#searchInput").value="";renderResults(medicines.map(m=>({...m,_score:0})));updateStats(medicines.length)};
$("#clearRecentBtn").onclick=()=>{recent=[];localStorage.removeItem("pharmaRecent");renderRecent();updateStats()};

// ========== Form submission ==========
$("#medicineForm").onsubmit=e=>{
 e.preventDefault();
 const data=Object.fromEntries(new FormData(e.target).entries());
 const item={id:Date.now(),...data};
 const custom=JSON.parse(localStorage.getItem("pharmaMedicines")||"[]");
 custom.push(item);
 localStorage.setItem("pharmaMedicines",JSON.stringify(custom));
 medicines=[...seedMedicines,...custom];
 closeModal();
 updateStats();
 search("");
 alert("✓ تمت إضافة الدواء بنجاح!");
};

// ========== Initialize ==========
renderResults(medicines.map(m=>({...m,_score:0})));
renderRecent();
updateStats(medicines.length);

// ========== PWA install button ==========
let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").hidden=false});
$("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt=null;$("#installBtn").hidden=true};
