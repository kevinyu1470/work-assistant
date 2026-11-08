const CACHE='kansai-cloud-v19-atlas';
const FILES=['./','./index.html','./release-update.js?v=atlas-20261108','./food-guide.js?v=unified-20261106','./updates.js?v=unified-20261106','./airline-brand.js?v=airline-20261030','./metro.js?v=atlas-20261108','./metro.css?v=atlas-20261108','./style.css?v=unified-20261106','./weather.js?v=weather-20261030','./booking-core.js?v=dashboard-20261030','./bookings.js?v=airline-20261030','./checklist.js?v=checklist-20261030','./dashboard.js?v=airline-20261030','./voucher-core.js?v=vouchers-20261030','./vouchers.js?v=vouchers-20261030','./data.js','./app.js?v=unified-20261106','./day-covers.js?v=day-covers-20261029','./config.js','./sync-core.js?v=vouchers-20261030','./cloud.js?v=unified-20261106','./autumn.svg','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));self.skipWaiting();});
const VERSION='atlas-20261108';
async function refreshWindow(client){
 if(!client.url.startsWith(self.registration.scope))return;
 try{
  const answer=await new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve(null),2000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};client.postMessage({type:'UPDATE_CHECK'},[channel.port2]);});
  if(answer?.version===VERSION)return;
  if(answer?.safe||(!answer&&client.visibilityState==='hidden'))await client.navigate(client.url);
  else client.postMessage({type:'RELEASE_ACTIVE',version:VERSION});
 }catch{}
}
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 await Promise.all((await self.clients.matchAll({type:'window',includeUncontrolled:true})).map(refreshWindow));
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('kansai-cloud-')&&k!==CACHE).map(k=>caches.delete(k)));
})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('network');return response;}).catch(()=>caches.match(event.request).then(r=>r||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));});

