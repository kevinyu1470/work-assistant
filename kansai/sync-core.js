const CloudMerge=(()=>{
// Pure helpers shared by the cloud endpoint and deterministic tests.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function mergeTrip(base,mine,theirs){
 // Older app versions omit unknown booking keys; deletion requires an explicit empty string.
 if(object(mine?.settings)&&object(theirs?.settings)){
  mine={...mine,settings:{...mine.settings}};
  for(const [k,v] of Object.entries(theirs.settings))if(/^(?:booking|voucher)_[a-zA-Z0-9_-]+$/.test(k)&&mine.settings[k]===undefined)mine.settings[k]=v;
 }
 const conflicts=[];
 function merge(b,m,t,path){
  if(same(m,b))return t;
  if(same(t,b)||same(m,t))return m;
  if(Array.isArray(b)&&Array.isArray(m)&&Array.isArray(t)&&[...b,...m,...t].every(x=>object(x)&&typeof x.id==='string')){
   const bm=new Map(b.map(x=>[x.id,x])),mm=new Map(m.map(x=>[x.id,x])),tm=new Map(t.map(x=>[x.id,x]));
   return [...new Set([...t,...m].map(x=>x.id))].map(id=>merge(bm.get(id),mm.get(id),tm.get(id),path+'.'+id)).filter(x=>x!==undefined);
  }
  if(object(b)&&object(m)&&object(t)){
   const out={};for(const k of new Set([...Object.keys(b),...Object.keys(m),...Object.keys(t)])){
    if(['__proto__','constructor','prototype'].includes(k))continue;
    const value=merge(b[k],m[k],t[k],path+'.'+k);if(value!==undefined)out[k]=value;
   }return out;
  }
  if(path==='.updatedAt')return t;
  conflicts.push(path);return t;
 }
 return {state:merge(base,mine,theirs,''),conflicts};
}
function validTrip(x){
 if(!object(x)||x.version!==1||!Array.isArray(x.events)||x.events.length>1000||!Array.isArray(x.checklist)||x.checklist.length>100||!object(x.settings)||!object(x.days))return false;
 if(!Array.isArray(x.tripDays)||!x.tripDays.length||x.tripDays.length>366||!Array.isArray(x.travelNotes)||x.travelNotes.length>100)return false;
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(x.tripDays.some(d=>!object(d)||!validDate(d.date)||['title','area','mark','route','tip'].some(k=>typeof d[k]!=='string'||d[k].length>2000)))return false;
 const noteIcons=['pin','star','temple','leaf','train','clock','calendar','plane','info','bag'];
 if(x.travelNotes.some(n=>!object(n)||!noteIcons.includes(n.icon)||['title','body','label'].some(k=>typeof n[k]!=='string'||n[k].length>6000)||(n.url!==undefined&&(typeof n.url!=='string'||n.url.length>2000))))return false;
 const ids=new Set(),dates=new Set(x.tripDays.map(d=>d.date));
 if(dates.size!==x.tripDays.length)return false;
 const time=/^([01]\d|2[0-3]):[0-5]\d$/;
 for(const e of x.events){
  if(!object(e)||typeof e.id!=='string'||e.id.length>150||ids.has(e.id)||!dates.has(e.date)||!time.test(e.start)||!time.test(e.end)||e.end<e.start||!['sight','nature','travel','food','shop'].includes(e.type)||!['plan','pending','fixed'].includes(e.status)||!['Asia/Tokyo','Asia/Taipei'].includes(e.timezone)||typeof e.title!=='string'||!e.title.trim()||e.title.length>120||typeof e.done!=='boolean')return false;
  ids.add(e.id);for(const k of ['location','note','url','booking','transfer'])if(e[k]!==undefined&&(typeof e[k]!=='string'||e[k].length>6000))return false;
 }
 for(const c of x.checklist)if(!object(c)||typeof c.id!=='string'||typeof c.done!=='boolean')return false;
 for(const [k,v] of Object.entries(x.settings))if(typeof v!=='string'||v.length>6000)return false;
 for(const [d,v] of Object.entries(x.days))if(!dates.has(d)||!object(v)||Object.values(v).some(s=>typeof s!=='string'||s.length>2000))return false;
 return JSON.stringify(x).length<=250000;
}

return {mergeTrip,validTrip};
})();