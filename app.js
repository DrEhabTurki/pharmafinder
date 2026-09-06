const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const normalize=s=>(s||"").toLowerCase().trim().replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/[ًٌٍَُِّْ]/g,"");

let medicines=[];
let recent=JSON.parse(localStorage.getItem("pharmaRecent")||"[]");
let sheetUrl=localStorage.getItem("pharmaSheetUrl")||"";

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

function openSettings(){
  $("#settingsModal").hidden=false;
  document.body.style.overflow="hidden";
  $("#sheetUrl").value=sheetUrl;
  $("#sheetStatus").textContent="";
}

function closeSettings(){
  $("#settingsModal").hidden=true;
  document.body.style.overflow="auto";
}

// ========== Event listeners for modals ==========
$("#addMedicineBtn").onclick=openModal;
$("#closeModalBtn").onclick=closeModal;
$("#cancelModalBtn").onclick=closeModal;
$("#medicineModal").querySelector(".modal-overlay").onclick=closeModal;

$("#settingsBtn").onclick=openSettings;
$("#closeSettingsBtn").onclick=closeSettings;
$("#settingsModal").querySelector(".modal-overlay").onclick=closeSettings;

// Close modals on Escape key
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    if(!$("#medicineModal").hidden)closeModal();
    if(!$("#settingsModal").hidden)closeSettings();
  }
});

// ========== Google Sheets Integration ==========
function getSheetId(url){
  const match=url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?match[1]:null;
}

function getSheetApiUrl(sheetId){
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/query?tqx=out:json`;
}

async function loadFromGoogleSheets(){
  const url=$("#sheetUrl").value.trim();
  if(!url){
    $("#sheetStatus").textContent="❌ الرجاء إدخال رابط الشيت";
    return;
  }

  const sheetId=getSheetId(url);
  if(!sheetId){
    $("#sheetStatus").textContent="❌ رابط غير صحيح. تأكد من رابط جوجل شيتس";
    return;
  }

  $("#sheetStatus").textContent="⏳ جاري التحميل...";
  
  try{
    const apiUrl=getSheetApiUrl(sheetId);
    const response=await fetch(apiUrl);
    const text=await response.text();
    
    // Parse Google Sheets response
    const jsonStart=text.indexOf("{");
    const jsonEnd=text.lastIndexOf("}")+1;
    const json=JSON.parse(text.substring(jsonStart,jsonEnd));
    
    if(!json.table||!json.table.rows){
      $("#sheetStatus").textContent="❌ لا توجد بيانات في الشيت";
      return;
    }

    medicines=[];
    const rows=json.table.rows;
    const cols=json.table.cols;

    // Get column indices
    let nameIdx=-1,ingredientIdx=-1,strengthIdx=-1,formIdx=-1,manufacturerIdx=-1,appearanceIdx=-1,notesIdx=-1;
    
    if(json.table.cols){
      json.table.cols.forEach((col,i)=>{
        const label=col.label?col.label.toLowerCase():"";
        if(label.includes("اسم"))nameIdx=i;
        if(label.includes("مادة"))ingredientIdx=i;
        if(label.includes("تركيز"))strengthIdx=i;
        if(label.includes("شكل"))formIdx=i;
        if(label.includes("شركة"))manufacturerIdx=i;
        if(label.includes("وصف"))appearanceIdx=i;
        if(label.includes("ملاحظة"))notesIdx=i;
      });
    }

    // Parse rows
    rows.forEach((row,idx)=>{
      if(idx===0)return; // Skip header
      const item={
        id:Date.now()+idx,
        name:row.c[nameIdx]?row.c[nameIdx].v:"",
        ingredient:row.c[ingredientIdx]?row.c[ingredientIdx].v:"",
        strength:row.c[strengthIdx]?row.c[strengthIdx].v:"",
        form:row.c[formIdx]?row.c[formIdx].v:"",
        manufacturer:row.c[manufacturerIdx]?row.c[manufacturerIdx].v:"",
        appearance:row.c[appearanceIdx]?row.c[appearanceIdx].v:"",
        notes:row.c[notesIdx]?row.c[notesIdx].v:""
      };
      if(item.name)medicines.push(item);
    });

    localStorage.setItem("pharmaSheetUrl",url);
    sheetUrl=url;
    $("#sheetStatus").textContent=`✓ تم تحميل ${medicines.length} دواء بنجاح`;
    setTimeout(closeSettings,1500);
    updateStats();
    renderResults(medicines.map(m=>({...m,_score:0})));
  }catch(e){
    console.error(e);
    $("#sheetStatus").textContent="❌ خطأ في تحميل البيانات. تأكد من إعدادات المشاركة";
  }
}

$("#loadSheetBtn").onclick=loadFromGoogleSheets;

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
 ${m._score?'<div class="match">درجة تطابق وصف البحث: <span class="confidence">'+m._score+'%</span></div>':''}
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
 medicines.push(item);
 closeModal();
 updateStats();
 search("");
 alert("✓ تمت إضافة الدواء بنجاح!");
};

// ========== Initialize ==========
renderResults([]);
renderRecent();
updateStats();

// Auto-load sheet if URL saved
if(sheetUrl){
  $("#sheetUrl").value=sheetUrl;
}
