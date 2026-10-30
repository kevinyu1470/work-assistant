'use strict';
const VoucherCore=(()=>{
 const kinds={ticket:'景點票券',tour:'行程／一日遊',transfer:'機場接駁／交通',other:'其他憑證'},platforms=['KKday','Klook','Trip.com','其他'];
 function valid(v){if(!v||!kinds[v.kind]||!platforms.includes(v.platform)||typeof v.title!=='string'||!v.title.trim()||v.title.length>120)return false;
 for(const k of ['eventId','date','time','reference','meeting','people','note'])if(v[k]!==undefined&&(typeof v[k]!=='string'||v[k].length>(k==='note'?2000:500)))return false;
 if(v.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||isNaN(Date.parse(v.date))||new Date(v.date).toISOString().slice(0,10)!==v.date))return false;
 if(v.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time))return false;
 return Array.isArray(v.assets)&&v.assets.length<=6&&v.assets.every(a=>a&&/^[a-f0-9-]{36}\.(png|jpg|webp|pdf)$/.test(a.id)&&typeof a.name==='string'&&a.name.length<=180&&['image/png','image/jpeg','image/webp','application/pdf'].includes(a.mime)&&Number.isInteger(a.size)&&a.size>0&&a.size<=10*1024*1024);
 }
 function list(settings){return Object.entries(settings).filter(([k,v])=>/^voucher_[a-zA-Z0-9_-]{1,100}$/.test(k)&&v).flatMap(([id,raw])=>{try{const v=JSON.parse(raw);return valid(v)?[{...v,id}]:[];}catch{return [];}}).sort((a,b)=>((a.date||'9999')+(a.time||'')).localeCompare((b.date||'9999')+(b.time||'')));}
 function parse(raw,year){const text=String(raw||'').normalize('NFKC'),lines=text.split('\n').map(s=>s.trim()).filter(Boolean),out={};
 out.platform=/kkday/i.test(text)?'KKday':/klook/i.test(text)?'Klook':/trip\.com/i.test(text)?'Trip.com':'其他';
 out.kind=/(接駁|接送|空港|送迎|transfer|shuttle|airport\s*(?:bus|pickup))/i.test(text)?'transfer':/(一日遊|導遊|day\s*tour)/i.test(text)?'tour':'ticket';
 const field=re=>{for(let i=0;i<lines.length;i++){const m=lines[i].match(re);if(m)return (m[1]||lines[i+1]||'').trim();}return '';};
 out.title=field(/(?:活動名稱|商品名稱|行程名稱|Product|Activity)\s*[:：]\s*(.*)/i)||lines.find(s=>!/(?:voucher|憑證|訂單|booking|kkday|klook|trip\.com|確認|confirmation)/i.test(s)&&s.length>4&&s.length<120)||'';
 out.reference=field(/(?:訂單編號|預訂編號|訂位代號|確認編號|Booking\s*(?:ID|number|reference)|Confirmation\s*(?:number|code)|Order\s*(?:ID|number))\s*[:：#]?\s*([A-Z0-9][A-Z0-9 -]{3,40})/i).replace(/\s/g,'');
 out.meeting=field(/(?:集合地點|上車地點|接送地點|Meeting\s*point|Pickup\s*location)\s*[:：]?\s*(.*)/i);
 out.date=BookingCore.dates(text,year)[0]||'';out.time=text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]?.padStart(5,'0')||'';
 for(const k of Object.keys(out))out[k]=out[k].slice(0,k==='title'?120:500);return out;
 }
 return {kinds,platforms,valid,list,parse};
})();
