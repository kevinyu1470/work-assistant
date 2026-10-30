'use strict';
// Public Osaka coordinates only. No itinerary, room key or geolocation is sent.
const KansaiWeather=(()=>{
 const URL='https://api.open-meteo.com/v1/forecast?latitude=34.6937&longitude=135.5023&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16';
 const KEY='kansai-osaka-weather-v1',TTL=30*60*1000,MAX_AGE=24*60*60*1000;
 let data=null,pending=null,failed=false,attempt=0,selected='';
 const japanDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const text=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function decode(payload,at=Date.now()){
  const d=payload?.daily,fields=['weather_code','temperature_2m_max','temperature_2m_min','precipitation_probability_max'];
  if(!d||!Array.isArray(d.time)||!d.time.length||!fields.every(k=>Array.isArray(d[k])&&d[k].length===d.time.length))throw Error('Invalid weather data');
  return {at,days:d.time.map((date,i)=>{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid weather date');
   const num=(key,min,max)=>typeof d[key][i]==='number'&&Number.isFinite(d[key][i])&&d[key][i]>=min&&d[key][i]<=max?d[key][i]:null;
   return {date,code:num('weather_code',0,99),high:num('temperature_2m_max',-90,65),low:num('temperature_2m_min',-90,65),rain:num('precipitation_probability_max',0,100)};
  })};
 }
 function condition(c){
  if(c===null)return ['☁️','資料待更新'];
  if(c===0)return ['☀️','晴天'];if(c===1)return ['🌤️','晴時多雲'];if(c===2)return ['⛅','多雲'];if(c===3)return ['☁️','陰天'];
  if(c===45||c===48)return ['🌫️','有霧'];if(c>=95)return ['⛈️','雷雨'];
  if([71,73,75,77,85,86].includes(c))return ['🌨️','降雪'];
  if([56,57,66,67].includes(c))return ['🌧️','凍雨'];
  if(c>=80&&c<=82)return ['🌦️','陣雨'];if(c>=51&&c<=55)return ['🌧️','毛毛雨'];
  if(c>=61&&c<=65)return ['🌧️','下雨'];return ['☁️','天氣變化'];
 }
 function view(model,date,now=Date.now()){
  const today=japanDate(),fresh=model&&now-model.at<MAX_AGE&&model.at<=now+60000;
  const all=fresh?model.days.filter(d=>d.date>=today):[],idx=all.findIndex(d=>d.date===date);
  const start=idx<0?0:Math.min(idx,Math.max(0,all.length-7)),days=all.slice(start,start+7);
  return {days,available:idx>=0,stale:!!model&&(failed||now-model.at>TTL),today};
 }
 function draw(){
  const host=document.getElementById('osaka-weather');if(!host)return;
  const v=view(data,selected),fmt=d=>`${+d.slice(5,7)}/${+d.slice(8,10)}`,degree=n=>n===null?'—':Math.round(n)+'°';
  const subtitle=v.days.length?`${fmt(v.days[0].date)} — ${fmt(v.days.at(-1).date)} · 日本時間`: '日本時間 · 一週預報';
  host.innerHTML=`<div class="weather-heading"><div><span class="weather-eyebrow">OSAKA WEATHER</span><h2>大阪，一週天氣</h2><p>${subtitle}</p></div><button type="button" class="weather-refresh" data-weather-refresh ${pending?'disabled':''} aria-label="重新取得大阪天氣">${pending?'更新中…':'↻ 更新'}</button></div>`+
   (v.days.length?`<div class="weather-days" tabindex="0" role="region" aria-label="每日預報，可左右滑動">${v.days.map(d=>{const [emoji,label]=condition(d.code);return `<div class="weather-day ${d.date===selected?'is-selected':''}"><span class="weather-weekday">${d.date===v.today?'今天':'週'+'日一二三四五六'[new Date(d.date+'T12:00:00+09:00').getUTCDay()]}</span><span class="weather-date">${fmt(d.date)}</span><span class="weather-symbol" aria-hidden="true">${emoji}</span><span class="weather-condition">${label}</span><span class="weather-temp"><b>${degree(d.high)}</b><span>${degree(d.low)}</span></span><span class="weather-rain">降雨 ${d.rain===null?'—':Math.round(d.rain)+'%'}</span></div>`;}).join('')}</div><p class="weather-notice">${v.available?'大阪市區預報；京都、奈良與山區天氣可能不同。':`${text(fmt(selected))} 尚無可用預報，先顯示最新一週；接近出發再查看。`}</p>`:`<p class="weather-empty" role="status">${pending?'正在取得大阪最新預報…':'暫時無法取得天氣，請稍後重試。行程仍可照常使用。'}</p>`)+
   `<div class="weather-footer"><span>${v.days.length?`${v.stale?'先顯示快取 · ':''}${new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(data.at))} 取得`:'連線後可更新'}${failed&&v.days.length?' · 更新失敗，請重試':''}</span><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo ↗</a></div><p class="weather-footnote">°C 高／低溫 · 降雨為每日最高機率 · 預報隨時可能調整</p>`;
 }
 function load(force=false){
  if(pending)return pending;
  if(!force&&((data&&Date.now()-data.at<TTL&&data.days.some(d=>d.date===japanDate()))||Date.now()-attempt<60000)){draw();return Promise.resolve();}
  attempt=Date.now();failed=false;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  pending=(async()=>{try{
   const response=await fetch(URL,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
   if(!response.ok)throw Error('Weather unavailable');
   const payload=await response.json();data=decode(payload);try{localStorage.setItem(KEY,JSON.stringify({payload,at:data.at}));}catch{}
  }catch{failed=true;}finally{clearTimeout(timer);pending=null;draw();}})();
  draw();return pending;
 }
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Number.isFinite(saved.at)&&Date.now()-saved.at<MAX_AGE&&saved.at<=Date.now())data=decode(saved.payload,saved.at);}catch{}
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-weather-refresh]'))load(true);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.getElementById('osaka-weather'))load();});
 window.addEventListener('online',()=>{if(document.getElementById('osaka-weather'))load(true);});
 setInterval(()=>{if(!document.hidden&&document.getElementById('osaka-weather'))load();},TTL);
 return {mount(date){selected=date;draw();load();},decode,condition,view};
})();
