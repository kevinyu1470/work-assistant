'use strict';
const Cloud={key:'',base:null,revision:0,ready:false,busy:false,reading:false,pending:false,error:'',conflict:null,timer:null,formBase:null,recovery:[],retryAt:0,failures:0,lastVerifiedAt:null,verified:false,fatal:false};
const originalEdit=editEvent,originalSubmit=submitEvent;
const localDirty=()=>!!Cloud.base&&!CloudMerge.sameDocument(state,Cloud.base);
function cloudPaint(){
 const status=$('#save-state');if(!status)return;
 const storageIssue=typeof DurableTrip!=='undefined'&&!DurableTrip.status.ok&&!DurableTrip.status.pending;
 const text=storageIssue?'裝置儲存失敗 · 點此備份':Cloud.error||(!Cloud.ready?'正在連接雲端':Cloud.conflict?'有共編衝突，點此處理':Cloud.busy||Cloud.pending?'修改已暫存 · 等待雲端確認':!Cloud.verified?'目前顯示離線備份':'已同步 · 版本 '+Cloud.revision);
 status.innerHTML='<i></i>'+esc(text);status.classList.toggle('storage-error',storageIssue||!!Cloud.error||!!Cloud.conflict);
 status.setAttribute('role','button');status.setAttribute('tabindex','0');status.style.cursor='pointer';
}
updateSaveState=cloudPaint;
async function cloudRequest(method,payload,query=''){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch(CLOUD_CONFIG.url+query,{method,headers:{'Content-Type':'application/json','apikey':CLOUD_CONFIG.key,'x-trip-key':Cloud.key},cache:'no-store',signal:controller.signal,...(payload?{body:JSON.stringify(payload)}:{})});
  let result;try{result=await response.json();}catch{result={error:'invalid_response'};}
  if(!response.ok){const error=new Error(result.error||'network_error');error.status=response.status;error.result=result;throw error;}
  if(!query.startsWith('?action=history')&&(!Number.isSafeInteger(result.revision)||result.revision<1||(!result.notModified&&!CloudMerge.validTrip(result.state))))throw Error('invalid_cloud_document');
  return result;
 }finally{clearTimeout(timer);}
}
function installTripMetadata(doc){TRIP_DAYS.splice(0,TRIP_DAYS.length,...doc.tripDays);TRAVEL_NOTES.splice(0,TRAVEL_NOTES.length,...doc.travelNotes);if(!TRIP_DAYS.some(d=>d.date===selected))selected=TRIP_DAYS.find(d=>d.date===todayJapan())?.date||TRIP_DAYS[0].date;}
function rememberCloud(){if(!Cloud.base||!Cloud.ready)return;DurableTrip.write({base:Cloud.base,local:state,revision:Cloud.revision,dirty:localDirty()||!!Cloud.conflict||!!Cloud.recovery.length});try{localStorage.setItem('kansai-last-trip',Cloud.key);}catch{}}
function verified(){Cloud.verified=true;Cloud.lastVerifiedAt=new Date().toISOString();Cloud.error='';Cloud.failures=0;Cloud.retryAt=0;Cloud.fatal=false;}
function failed(error){Cloud.verified=false;Cloud.failures++;Cloud.retryAt=Date.now()+Math.min(60000,2000*2**Math.min(Cloud.failures,5))+Math.random()*1000;Cloud.fatal=[400,401,404,413].includes(error.status);Cloud.error=error.status===401||error.status===404?'旅程連結無法驗證 · 本機資料仍保留':error.status===400||error.status===413?'資料無法送出 · 請點此匯出備份':navigator.onLine?'連線中斷 · 保留修改，稍後重試':'離線 · 顯示已下載行程，修改稍後同步';}
function cloudApply(doc,revision){
 if(revision<Cloud.revision)return false;
 const checked=validateBackup(doc);if(Cloud.base)TripUpdates.compare(Cloud.base,checked,state);installTripMetadata(checked);state=checked;Cloud.base=clone(checked);Cloud.revision=revision;verified();rememberCloud();if(!$('#sheet').open)render();cloudPaint();return true;
}
function showCloudConflict(){
 if(!Cloud.conflict)return;
 if($('#sheet').open){toast('有共編衝突，關閉表單後點上方同步狀態處理');return;}
 const names={title:'名稱',start:'開始時間',end:'結束時間',date:'日期',location:'地點',note:'備註',done:'完成狀態',status:'時間狀態',hotel:'飯店',hotelAddress:'飯店地址'};
 const fields=[...new Set(Cloud.conflict.paths.map(p=>(p.startsWith('.settings.voucher_')?'票券與憑證':p.startsWith('.settings.booking_')?'住宿或航班資料':names[p.split('.').pop()]||'同一個行程')))];
 openSheet('你們修改了相同的內容',`<p class="confirm-msg">你和朋友都改了：<strong>${esc(fields.join('、'))}</strong>。不同欄位的修改會合併，以下選擇只處理衝突欄位。</p><div class="sheet-actions"><button class="btn" id="cloud-use-remote">採用雲端的修改</button><button class="btn primary" id="cloud-use-mine">保留我的修改</button></div>`);
 $('#cloud-use-remote').onclick=()=>resolveCloudConflict(false);$('#cloud-use-mine').onclick=()=>resolveCloudConflict(true);
}
function recoverNext(){
 while(Cloud.recovery.length){const packet=Cloud.recovery.shift(),remote=clone(state),merged=CloudMerge.mergeTrip(packet.base,packet.local,remote);
  if(merged.conflicts.length){state=validateBackup(CloudMerge.mergeTrip(packet.base,remote,packet.local).state);Cloud.conflict={base:packet.base,remote,serverBase:clone(Cloud.base),revision:Cloud.revision,paths:merged.conflicts};break;}
  state=validateBackup(merged.state);
 }
 installTripMetadata(state);Cloud.pending=localDirty()||!!Cloud.conflict;
}
function resolveCloudConflict(mine){
 const c=Cloud.conflict;if(!c)return;
 const merged=mine?CloudMerge.mergeTrip(c.base,c.remote,state):CloudMerge.mergeTrip(c.base,state,c.remote);
 state=validateBackup(merged.state);Cloud.base=clone(c.serverBase||c.remote);Cloud.revision=c.revision;Cloud.conflict=null;recoverNext();closeSheet();render();rememberCloud();if(Cloud.conflict)showCloudConflict();else cloudFlush(true);
}
save=function(){
 state.updatedAt=new Date().toISOString();Cloud.pending=localDirty()||!!Cloud.conflict;Cloud.fatal=false;Cloud.retryAt=0;rememberCloud();
 if(!Cloud.ready){Cloud.error='尚未連線，修改未同步';cloudPaint();return;}
 cloudPaint();clearTimeout(Cloud.timer);Cloud.timer=setTimeout(()=>cloudFlush(),250);
};
async function cloudFlush(force=false){
 if(!Cloud.ready||Cloud.busy||!Cloud.pending||Cloud.conflict||(!force&&(Cloud.fatal||Date.now()<Cloud.retryAt)))return;
 if(!navigator.onLine){Cloud.error='離線 · 修改已暫存，連線後同步';cloudPaint();return;}
 Cloud.busy=true;Cloud.pending=false;cloudPaint();
 const sent=clone(state),base=clone(Cloud.base);
 try{
  const reply=await cloudRequest('PUT',{base,state:sent,baseRevision:Cloud.revision});
  if(reply.revision<Cloud.revision)throw Error('stale_cloud_reply');
  TripUpdates.compare(base,reply.state,sent);
  const merged=CloudMerge.mergeTrip(sent,state,reply.state);
  verified();Cloud.base=clone(reply.state);Cloud.revision=reply.revision;
  if(merged.conflicts.length){Cloud.conflict={base:sent,remote:reply.state,revision:reply.revision,paths:merged.conflicts};Cloud.pending=true;}
  else{state=validateBackup(merged.state);installTripMetadata(state);Cloud.pending=localDirty();if(!$('#sheet').open)render();}
 }catch(error){
  Cloud.pending=true;
  if(error.status===409&&CloudMerge.validTrip(error.result?.state)&&error.result.revision>=Cloud.revision){
   TripUpdates.compare(base,error.result.state,state);
   const merged=CloudMerge.mergeTrip(base,state,error.result.state);
   if(merged.conflicts.length)Cloud.conflict={base,remote:error.result.state,revision:error.result.revision,paths:merged.conflicts};
   else{state=validateBackup(merged.state);Cloud.base=clone(error.result.state);Cloud.revision=error.result.revision;}
  }else failed(error);
 }finally{Cloud.busy=false;rememberCloud();cloudPaint();if(Cloud.conflict)showCloudConflict();else if(Cloud.pending&&!Cloud.error)Cloud.timer=setTimeout(()=>cloudFlush(),150);}
}
async function cloudPoll(force=false){
 if(!Cloud.ready||Cloud.busy||Cloud.reading||Cloud.pending||Cloud.conflict||$('#sheet').open||document.hidden||(!force&&(Cloud.fatal||Date.now()<Cloud.retryAt)))return;
 if(!navigator.onLine){Cloud.verified=false;Cloud.error='離線 · 目前顯示已下載的行程';cloudPaint();return;}
 Cloud.reading=true;
 try{const reply=await cloudRequest('GET',null,'?since='+Cloud.revision);if(Cloud.busy||Cloud.pending||$('#sheet').open)return;
  if(reply.revision>Cloud.revision){cloudApply(reply.state,reply.revision);toast('已收到同行朋友的修改');}
  else if(reply.revision===Cloud.revision){verified();cloudPaint();}
 }catch(error){failed(error);cloudPaint();}finally{Cloud.reading=false;}
}

editEvent=function(id){const current=state.events.find(e=>e.id===id);Cloud.formBase=current?clone(current):null;originalEdit(id);};
submitEvent=function(form){
 const before=Cloud.formBase,id=form.dataset.id;
 if(before&&id){
  const remote=state.events.find(e=>e.id===id),draft={...before,...Object.fromEntries(new FormData(form))};
  if(!remote){$('#form-error').textContent='這一站已被朋友刪除。請關閉後重新新增，避免恢復已刪除的行程。';return;}
  const merged=CloudMerge.mergeTrip(before,draft,remote);
  if(merged.conflicts.length&&form.dataset.acceptConflict!=='yes'){
   $('#form-error').innerHTML='朋友也改了這一站的相同欄位。<br><button type="button" class="text-btn" id="reload-remote">載入朋友版本</button>　<button type="button" class="text-btn" id="keep-draft">保留我的修改並儲存</button>';
   $('#reload-remote').onclick=()=>editEvent(id);$('#keep-draft').onclick=()=>{form.dataset.acceptConflict='yes';submitEvent(form)};return;
  }
  const result=form.dataset.acceptConflict==='yes'?CloudMerge.mergeTrip(before,remote,draft).state:merged.state;
  for(const [name,value]of Object.entries(result))if(form.elements.namedItem(name))form.elements.namedItem(name).value=value;
 }
 originalSubmit(form);
};
function shareTrip(){
 const link=location.origin+location.pathname+'#trip='+Cloud.key;
 openSheet('邀請朋友一起安排',`<p class="confirm-msg">把這個連結傳給同行朋友。你們會編輯同一份行程，連線時通常數秒內同步。<br>持有連結的人可以查看及修改這趟旅行。</p><label class="field">同行共編連結<input id="share-url" readonly value="${esc(link)}"></label><div class="sheet-actions"><button class="btn" id="native-share">傳給朋友</button><button class="btn primary" id="copy-share">複製連結</button></div>`);
 $('#copy-share').onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('共編連結已複製');}catch{$('#share-url').select();toast('請複製選取的連結');}};
 $('#native-share').onclick=async()=>{if(navigator.share){try{await navigator.share({title:'一起安排關西旅行',url:link});}catch{}}else $('#copy-share').click();};
}
function joinScreen(message){
 $('#cloud-gate').innerHTML=`<div class="cloud-welcome"><span class="brand-mark">旅</span><div class="overline">KANSAI, TOGETHER.</div><h1>一起，把旅行排好。</h1><p>${esc(message)}</p><label class="field">旅程連結或共編碼<input id="join-code" placeholder="貼上朋友傳來的完整連結" autocomplete="off"></label><button class="btn primary" id="join-trip">加入旅程</button><p class="form-help">用 Safari 開啟後，可透過分享選單加入主畫面。</p></div>`;
 $('#join-trip').onclick=()=>{const value=$('#join-code').value.trim();let key=value;try{key=new URLSearchParams(new URL(value).hash.slice(1)).get('trip')||value}catch{}if(!/^[a-f0-9]{64}$/.test(key)){toast('請貼上完整的旅程共編連結');return;}location.hash='trip='+key;location.reload();};
}

async function cloudBoot(){
 if(Cloud.ready||Cloud.booting)return;Cloud.booting=true;
 let gate=$('#cloud-gate');if(!gate){gate=document.createElement('div');gate.id='cloud-gate';gate.className='cloud-gate';document.body.append(gate);}
 gate.innerHTML='<div class="cloud-welcome"><span class="brand-mark">旅</span><h2>正在打開你們的旅程…</h2><p>載入已下載資料並確認雲端版本</p></div>';
 let key=new URLSearchParams(location.hash.slice(1)).get('trip');if(!key){try{key=localStorage.getItem('kansai-last-trip')}catch{}}
 if(!/^[a-f0-9]{64}$/.test(key||'')){joinScreen('貼上共編連結，和同行朋友一起安排行程。');Cloud.booting=false;return;}
 Cloud.key=key;TripUpdates.load();location.hash='trip='+key;DurableTrip.configure(key);
 const cached=await DurableTrip.load();let reply=null,networkError=null;
 try{reply=await cloudRequest('GET');}catch(error){networkError=error;}
 const fallback=cached.clean||cached.pending.at(-1);
 if(!reply&&!fallback){joinScreen(networkError?.status===404||networkError?.status===401?'這個旅程連結無法使用，請向同行朋友取得完整連結。':'暫時連不上雲端，這個裝置尚未下載行程。連線後會再試一次。');const retry=document.createElement('button');retry.className='btn';retry.textContent='重新連線';retry.onclick=cloudBoot;$('#cloud-gate .cloud-welcome').append(retry);Cloud.booting=false;return;}
 const doc=reply?.state||fallback.base;
 installTripMetadata(doc);state=validateBackup(doc);Cloud.base=clone(state);Cloud.revision=reply?.revision||fallback.revision||0;Cloud.ready=true;
 if(reply)verified();else failed(networkError||Error('offline'));
 Cloud.recovery=cached.pending;recoverNext();rememberCloud();render();cloudPaint();gate.remove();Cloud.booting=false;
 const updates=document.createElement('button');updates.id='trip-updates-button';updates.className='btn updates-button';updates.onclick=TripUpdates.open;$('.top-actions').prepend(updates);TripUpdates.decorate();
 const share=document.createElement('button');share.id='share-trip';share.className='btn cloud-share';share.innerHTML=icon('plane')+'<span>邀請同行</span>';share.onclick=shareTrip;$('.top-actions').prepend(share);
 $('#save-state').onclick=()=>Cloud.conflict?showCloudConflict():showSyncDetails();
 $('#save-state').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#save-state').click();}};
 setInterval(()=>Cloud.pending?cloudFlush():cloudPoll(),4000);DurableTrip.compact();
 if(Cloud.conflict)showCloudConflict();else if(Cloud.pending)cloudFlush();
}
function syncTime(value){return value?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))+'（日本時間）':'尚未完成本次連線確認';}
function showSyncDetails(){
 openSheet('儲存與同步狀態',`<p class="confirm-msg">目前行程版本 <strong>${Cloud.revision}</strong><br>最後確認：${esc(syncTime(Cloud.lastVerifiedAt))}<br>${Cloud.pending?'有修改等待雲端確認，請保留此頁。':Cloud.verified?'目前修改已由雲端確認。':'目前為裝置上的備份，恢復連線後會核對最新版。'}<br>${DurableTrip.isSafe()?'本機備份已寫入。':'本機儲存尚未確認，請先匯出備份。'}</p><div class="backup-actions"><button class="btn" data-action="export">匯出目前資料</button><button class="btn" id="cloud-history">歷史版本</button></div><div class="sheet-actions"><button class="btn primary" id="cloud-retry">立即重新同步</button></div>`);
 $('#cloud-retry').onclick=()=>{closeSheet();Cloud.fatal=false;Cloud.retryAt=0;Cloud.pending?cloudFlush(true):cloudPoll(true);};$('#cloud-history').onclick=showCloudHistory;
}
async function showCloudHistory(){
 openSheet('行程歷史版本','<p class="confirm-msg">正在讀取雲端備份…</p>');
 try{const reply=await cloudRequest('GET',null,'?action=history');if(!Array.isArray(reply.versions))throw Error('invalid_history');
  openSheet('行程歷史版本',`<p class="form-help">每次雲端更新會在同一筆交易保留版本。可先下載，或選擇還原；還原也會建立新版本。</p><div style="display:grid;gap:12px">${reply.versions.map(v=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e3e5da;padding:12px 0"><span><strong>版本 ${Number(v.revision)}</strong> · ${Number(v.eventCount)} 個行程<br><small>${esc(syncTime(v.updatedAt))}</small></span><button class="btn" data-history="${Number(v.revision)}">查看</button></div>`).join('')||'<p>尚無歷史版本</p>'}</div>`);
  document.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>previewCloudVersion(Number(b.dataset.history)));
 }catch{openSheet('暫時無法讀取歷史版本','<p class="confirm-msg">目前行程仍保留在裝置上。恢復連線後可再試，或先從旅程設定匯出備份。</p>');}
}
async function previewCloudVersion(revision){
 try{const result=await cloudRequest('GET',null,'?action=history&revision='+revision),saved=validateBackup(result.state);
  openSheet('歷史版本 '+revision,`<p class="confirm-msg">${esc(syncTime(result.updatedAt))}<br>${saved.events.length} 個行程、${saved.checklist.length} 項準備清單。<br>還原將變更所有同行朋友看到的安排；目前版本仍會保留在歷史紀錄。</p><div class="backup-actions"><button class="btn" id="history-download">下載此版本</button></div><div class="sheet-actions"><button class="btn" id="history-back">返回</button><button class="btn primary" id="history-restore" ${Cloud.pending||Cloud.busy||Cloud.conflict?'disabled':''}>還原此版本</button></div>${Cloud.pending||Cloud.busy||Cloud.conflict?'<p class="form-help">請先完成目前修改的同步或處理衝突，再進行還原。</p>':''}`);
  $('#history-back').onclick=showCloudHistory;$('#history-download').onclick=()=>download('kansai-version-'+revision+'.json',JSON.stringify(saved,null,2),'application/json');
  $('#history-restore').onclick=()=>{state=clone(saved);installTripMetadata(state);save();closeSheet();render();toast('已排入還原，正在等待雲端確認');};
 }catch{toast('無法讀取此版本，請稍後再試');}
}
window.addEventListener('online',()=>{Cloud.retryAt=0;Cloud.fatal=false;if(!Cloud.ready)cloudBoot();else Cloud.pending?cloudFlush(true):cloudPoll(true);});
window.addEventListener('offline',()=>{Cloud.verified=false;Cloud.error='離線 · 已下載的行程仍可查看，修改將稍後同步';cloudPaint();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){Cloud.retryAt=0;if(!Cloud.ready)cloudBoot();else Cloud.pending?cloudFlush():cloudPoll();}});
window.addEventListener('pagehide',()=>rememberCloud());
window.addEventListener('beforeunload',e=>{if(Cloud.ready&&(Cloud.pending||Cloud.busy||Cloud.conflict||!DurableTrip.isSafe()||document.querySelector('dialog[open] form'))){e.preventDefault();e.returnValue='';}});

// Keep the opening values of long-lived forms, so a concurrent change is never
// silently overwritten by a stale settings or day form.
let sharedFormBaseline=null;
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.id==='settings-btn'||button.dataset.action==='settings')sharedFormBaseline={kind:'settings-form',base:clone(state.settings)};
 if(button.dataset.action==='edit-day'){const d=dayData(selected);sharedFormBaseline={kind:'day-form',date:selected,base:{title:d.title,route:d.route,tip:d.tip}};}
},true);
document.addEventListener('submit',event=>{
 const form=event.target,baseline=sharedFormBaseline;if(!baseline||form.id!==baseline.kind)return;
 const draft=Object.fromEntries(new FormData(form));
 const current=form.id==='settings-form'?state.settings:(()=>{const d=dayData(baseline.date);return {title:d.title,route:d.route,tip:d.tip}})();
 const merged=CloudMerge.mergeTrip(baseline.base,draft,current);
 if(merged.conflicts.length&&form.dataset.acceptConflict!=='yes'){
  event.preventDefault();event.stopImmediatePropagation();
  let warning=form.querySelector('.cloud-form-warning');if(!warning){warning=document.createElement('div');warning.className='cloud-form-warning tip-box';form.append(warning);}
  warning.innerHTML='朋友也修改了相同欄位。<br><button type="button" class="text-btn" id="cloud-reload-settings">載入朋友版本</button>　<button type="button" class="text-btn" id="cloud-keep-settings">保留我的修改並儲存</button>';
  $('#cloud-reload-settings').onclick=()=>{for(const [k,v]of Object.entries(current))if(form.elements.namedItem(k))form.elements.namedItem(k).value=v;baseline.base=clone(current);warning.remove();};
  $('#cloud-keep-settings').onclick=()=>{form.dataset.acceptConflict='yes';form.requestSubmit();};return;
 }
 const result=form.dataset.acceptConflict==='yes'?CloudMerge.mergeTrip(baseline.base,current,draft).state:merged.state;
 for(const [k,v]of Object.entries(result))if(form.elements.namedItem(k))form.elements.namedItem(k).value=v;
},true);
cloudBoot();

