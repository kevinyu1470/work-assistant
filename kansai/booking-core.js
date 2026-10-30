'use strict';
const BookingCore=(()=>{
 const PREFIX='booking_',fields=['name','address','checkIn','checkOut','checkInTime','checkOutTime','date','endDate','start','end','from','to','reference','terminal','direction','note'];
 const clean=s=>String(s??'').normalize('NFKC').trim();
 function dates(text,year){
  const out=[],add=(y,m,d)=>{const v=`${y}-${String(+String(m).replace(/\s/g,'')).padStart(2,'0')}-${String(+String(d).replace(/\s/g,'')).padStart(2,'0')}`;if(!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&!out.includes(v))out.push(v);};
  for(const m of text.matchAll(/\b(20\d{2})\s*[-/.年]\s*(\d(?:[ \t]*\d)?)\s*[-/.月]\s*(\d(?:[ \t]*\d)?)\s*日?/g))add(m[1],m[2],m[3]);
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  for(const m of text.matchAll(/\b(\d{1,2})\s+(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)[,\s]+(20\d{2})\b/gi))add(m[3],months[m[2].slice(0,3).toLowerCase()],m[1]);
  for(const m of text.matchAll(/\b(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(\d{1,2})[,\s]+(20\d{2})\b/gi))add(m[3],months[m[1].slice(0,3).toLowerCase()],m[2]);
  if(!out.length)for(const m of text.matchAll(/(?:^|[^\d/-])(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?(?!\d)/g))add(year,m[1],m[2]);
  return out;
 }
 function parse(raw,kind,year){
  const text=clean(raw),lines=text.split(/\n/).map(clean).filter(Boolean),out={kind},ds=dates(text,year);
  const labeled=regex=>{for(let i=0;i<lines.length;i++){const m=lines[i].match(regex);if(m)return clean(m[1]||lines[i+1]||'');}return '';};
  const times=[...text.matchAll(/\b([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\b/g)].map(m=>m[1].padStart(2,'0')+':'+m[2]);
  const ref=labeled(/(?:訂單編號|預訂編號|訂位代號|確認編號|予約番号|Booking\s*(?:ID|number|reference)|Confirmation\s*(?:number|code)|PNR)\s*[:：#]?\s*([A-Z0-9][A-Z0-9 -]{3,40})/i);if(ref)out.reference=ref.replace(/\s/g,'');
  if(kind==='hotel'){
   out.name=labeled(/(?:飯店名稱|酒店名稱|住宿名稱|宿泊施設名|ホテル名|Hotel\s*name)\s*[:：]\s*(.+)/i)||lines.find(l=>/(?:hotel|inn|resort|hostel|ホテル|旅館|飯店|酒店)/i.test(l)&&!/(?:check.?in|check.?out|入住|退房|address|地址|confirmation|預訂|訂單|booking.com)/i.test(l))||'';
   out.address=labeled(/(?:地址|住所|所在地|Address)\s*[:：]\s*(.+)/i);
   const ci=labeled(/(?:入住(?:日期)?|チェックイン|Check[ -]?in)\s*[:：]?\s*(.*)/i),co=labeled(/(?:退房(?:日期)?|チェックアウト|Check[ -]?out)\s*[:：]?\s*(.*)/i);
   out.checkIn=dates(ci,year)[0]||ds[0]||'';out.checkOut=dates(co,year)[0]||ds[1]||'';
   out.checkInTime=ci.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]||'';out.checkOutTime=co.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]||'';
  }else{
   const flight=text.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s*[- ]?\s*(\d{2,4})\b/);out.name=flight?flight[1]+flight[2]:'';
   out.date=ds[0]||'';out.endDate=ds[0]||'';
   const dep=labeled(/(?:出發|起飛|Departure)\s*[:：]\s*(.*)/i),arr=labeled(/(?:抵達|到達|Arrival)\s*[:：]\s*(.*)/i);
   out.date=dates(dep,year)[0]||out.date;out.endDate=dates(arr,year)[0]||out.date;
   if(/(?:\+1\b|翌日|隔日)/.test(arr||text)&&out.endDate===out.date&&out.date)out.endDate=new Date(Date.parse(out.date)+86400000).toISOString().slice(0,10);
   out.start=dep.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]||times[0]||'';out.end=arr.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]||times[1]||'';
   const airports=[...text.matchAll(/\b(TPE|TSA|KHH|KIX|ITM|NRT|HND|UKB|NGO|FUK|CTS|OKA|HKG|ICN|SIN)\b/g)].map(m=>m[1]);out.from=airports[0]||'';out.to=airports.find(a=>a!==airports[0])||'';
   out.terminal=labeled(/(?:航廈|Terminal)\s*[:：]?\s*([^\n]{1,80})/i);
  }
  for(const k of ['start','end','checkInTime','checkOutTime'])if(out[k])out[k]=out[k].padStart(5,'0');
  for(const k of fields)if(out[k])out[k]=clean(out[k]).slice(0,k==='note'?1500:500);
  return out;
 }
 function validDate(v){return !v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
 function validate(b){
  if(!b||!['hotel','flight'].includes(b.kind)||!clean(b.name))return '請填寫飯店名稱或航班號碼';
  if(b.direction&&!['outbound','return','other'].includes(b.direction))return '請選擇航程類型';
  for(const k of fields)if(b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>(k==='note'?1500:500)))return '資料過長，請縮短文字';
  for(const k of ['checkIn','checkOut','date','endDate'])if(!validDate(b[k]))return '請確認日期格式';
  for(const k of ['start','end','checkInTime','checkOutTime'])if(b[k]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(b[k]))return '請確認時間格式';
  if(b.kind==='hotel'&&b.checkIn&&b.checkOut&&b.checkOut<=b.checkIn)return '退房日期應晚於入住日期';
  if(b.kind==='flight'&&b.date&&b.endDate&&b.endDate<b.date)return '抵達日期不可早於出發日期';
  return '';
 }
 function records(settings){return Object.entries(settings).filter(([k])=>/^booking_[a-zA-Z0-9_-]{1,100}$/.test(k)).flatMap(([id,v])=>{try{const b=JSON.parse(v);return validate(b)?[]:[{...b,id}];}catch{return [];}}).sort((a,b)=>(a.checkIn||a.date||'9999').localeCompare(b.checkIn||b.date||'9999'));}
 function direction(b,days=[]){
  if(['outbound','return','other'].includes(b.direction))return b.direction;
  const tw=/(?:TPE|TSA|KHH|桃園|松山|高雄|TAIPEI|TAIWAN)/i,jp=/(?:KIX|ITM|NRT|HND|UKB|NGO|FUK|CTS|OKA|關西|関西|大阪|成田|羽田|OSAKA|KANSAI|TOKYO)/i;
  if(tw.test(b.from||'')&&jp.test(b.to||''))return 'outbound';
  if(jp.test(b.from||'')&&tw.test(b.to||''))return 'return';
  if(days.length&&b.date===days[0].date)return 'outbound';
  if(days.length>1&&b.date===days.at(-1).date)return 'return';
  return 'other';
 }
 function duplicate(a,b){
  const norm=s=>clean(s).toUpperCase().replace(/[\s-]/g,'');
  if(a.kind!==b.kind||a.kind!=='flight'||!a.date||!a.start)return false;
  return ['name','date','start','from','to'].every(k=>norm(a[k])===norm(b[k]));
 }
 return {PREFIX,fields,parse,dates,validate,records,direction,duplicate};
})();
