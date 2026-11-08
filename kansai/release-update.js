'use strict';
(()=>{const VERSION='atlas-20261108b';let running=false,needsUpdate=false;
const safe=()=>!document.querySelector('dialog[open]')&&(typeof Cloud==='undefined'||Cloud.ready&&!Cloud.pending&&!Cloud.busy&&!Cloud.conflict);
function offer(){if(document.getElementById('release-prompt'))return;const b=document.createElement('div');b.id='release-prompt';b.setAttribute('role','status');b.style.cssText='position:fixed;bottom:100px;left:16px;right:16px;max-width:430px;margin:auto;background:#426650;color:white;border-radius:18px;padding:16px;z-index:9999;font:13px -apple-system,sans-serif';b.innerHTML='已下載新版，儲存並關閉表單後會自動更新。';document.body.append(b);}
function upgrade(){if(!needsUpdate||running)return;if(!safe()){offer();return;}running=true;location.reload();}
async function check(){if(document.hidden||!navigator.onLine)return;try{const r=await fetch('release.json?t='+Date.now(),{cache:'no-store'});if(r.ok&&(await r.json()).version!==VERSION){needsUpdate=true;upgrade();}}catch{}}
if('serviceWorker'in navigator){
 navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='UPDATE_CHECK'&&e.ports[0])e.ports[0].postMessage({version:VERSION,safe:safe()});if(e.data?.type==='RELEASE_ACTIVE'&&e.data.version!==VERSION){needsUpdate=true;upgrade();}});
 navigator.serviceWorker.addEventListener('controllerchange',()=>check());
}
window.addEventListener('load',()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});check();setInterval(()=>{if(needsUpdate)upgrade();else check();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){navigator.serviceWorker?.getRegistration().then(r=>r?.update()).catch(()=>{});check();}});});
})();
