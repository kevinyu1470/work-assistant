'use strict';
// Shared travel state. The public application key never grants table access.
const Cloud={key:'',base:null,revision:0,ready:false,busy:false,pending:false,error:'',conflict:null,timer:null,formBase:null};
const cachedSave=save,originalEdit=editEvent,originalSubmit=submitEvent;
const roomCache=()=> 'kansai-cloud-cache-'+Cloud.key.slice(0,16);
function cloudPaint(){
 const status=$('#save-state');
 const text=Cloud.error||(!Cloud.ready?'正在連接雲端':Cloud.conflict?'有共編衝突，點此處理':Cloud.busy||Cloud.pending?'正在同步修改…':'已同步 · 每 4 秒更新');
 status.innerHTML='<i></i>'+esc(text);status.classList.toggle('storage-error',!!Cloud.error||!!Cloud.conflict);
 status.setAttribute('role','button');status.setAttribute('tabindex','0');status.style.cursor='pointer';
}
updateSaveState=cloudPaint;
async function cloudRequest(method,payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(CLOUD_CONFIG.url,{method,headers:{'Content-Type':'application/json','apikey':CLOUD_CONFIG.key,'x-trip-key':Cloud.key},cache:'no-store',signal:controller.signal,...(payload?{body:JSON.stringify(payload)}:{})});
  const result=await response.json();if(!response.ok){const error=new Error(result.error||'network_error');error.status=response.status;error.result=result;throw error;}return result;
 }finally{clearTimeout(timer);}
}
function installTripMetadata(doc){TRIP_DAYS.splice(0,TRIP_DAYS.length,...doc.tripDays);TRAVEL_NOTES.splice(0,TRAVEL_NOTES.length,...doc.travelNotes);if(!TRIP_DAYS.some(d=>d.date===selected))selected=TRIP_DAYS.find(d=>d.date===todayJapan())?.date||TRIP_DAYS[0].date;}
function rememberCloud(){try{localStorage.setItem(roomCache(),JSON.stringify({base:Cloud.base,local:state,dirty:Cloud.base&&JSON.stringify(state)!==JSON.stringify(Cloud.base)}));localStorage.setItem('kansai-last-trip',Cloud.key);}catch{}}
function cloudApply(doc,revision){installTripMetadata(doc);state=validateBackup(doc);Cloud.base=clone(state);Cloud.revision=revision;Cloud.error='';rememberCloud();if(!$('#sheet').open)render();cloudPaint();}
function showCloudConflict(){
 if(!Cloud.conflict)return;
 if($('#sheet').open){toast('有共編衝突，關閉表單後點上方同步狀態處理');return;}
 const names={title:'名稱',start:'開始時間',end:'結束時間',date:'日期',location:'地點',note:'備註',done:'完成狀態',status:'時間狀態',hotel:'飯店',hotelAddress:'飯店地址'};
 const fields=[...new Set(Cloud.conflict.paths.map(p=>names[p.split('.').pop()]||'同一個行程'))];
 openSheet('你們修改了相同的內容',`<p class="confirm-msg">你和朋友都改了：<strong>${esc(fields.join('、'))}</strong>。其他不同欄位的修改會自動合併。請選擇這些相同欄位要保留哪一邊。</p><div class="sheet-actions"><button class="btn" id="cloud-use-remote">採用朋友的修改</button><button class="btn primary" id="cloud-use-mine">保留我的修改</button></div>`);
 $('#cloud-use-remote').onclick=()=>resolveCloudConflict(false);$('#cloud-use-mine').onclick=()=>resolveCloudConflict(true);
}
function resolveCloudConflict(mine){
 const c=Cloud.conflict;if(!c)return;
 const merged=mine?CloudMerge.mergeTrip(c.base,c.remote,state):CloudMerge.mergeTrip(c.base,state,c.remote);
 state=validateBackup(merged.state);Cloud.base=clone(c.remote);Cloud.revision=c.revision;Cloud.conflict=null;Cloud.pending=true;closeSheet();render();rememberCloud();cloudFlush();
}
save=function(){
 state.updatedAt=new Date().toISOString();rememberCloud();
 if(!Cloud.ready){Cloud.error='尚未連線，修改未同步';cloudPaint();return;}
 Cloud.pending=true;Cloud.error='';cloudPaint();clearTimeout(Cloud.timer);Cloud.timer=setTimeout(cloudFlush,250);
};
async function cloudFlush(){
 if(!Cloud.ready||Cloud.busy||!Cloud.pending||Cloud.conflict)return;
 Cloud.busy=true;Cloud.pending=false;cloudPaint();
 const sent=clone(state),base=clone(Cloud.base);
 try{
  const reply=await cloudRequest('PUT',{base,state:sent});
  const merged=CloudMerge.mergeTrip(sent,state,reply.state);
  // Local edits made while the request was in flight remain queued.
  if(merged.conflicts.length){Cloud.conflict={base:sent,remote:reply.state,revision:reply.revision,paths:merged.conflicts};Cloud.pending=true;}
  else{const stillEditing=JSON.stringify(state)!==JSON.stringify(sent);state=validateBackup(merged.state);Cloud.base=clone(reply.state);Cloud.revision=reply.revision;Cloud.pending=Cloud.pending||stillEditing;Cloud.error='';rememberCloud();if(!$('#sheet').open)render();}
 }catch(error){
  Cloud.pending=true;
  if(error.status===409&&error.result?.state){
   const merged=CloudMerge.mergeTrip(base,state,error.result.state);
   if(merged.conflicts.length)Cloud.conflict={base,remote:error.result.state,revision:error.result.revision,paths:merged.conflicts};
   else{state=validateBackup(merged.state);Cloud.base=clone(error.result.state);Cloud.revision=error.result.revision;}
  }else{Cloud.error=navigator.onLine?'連線失敗 · 修改暫存，稍後重試':'離線 · 修改暫存，尚未同步';}
 }finally{Cloud.busy=false;cloudPaint();if(Cloud.conflict)showCloudConflict();else if(Cloud.pending&&!Cloud.error)Cloud.timer=setTimeout(cloudFlush,150);}
}
async function cloudPoll(){
 if(!Cloud.ready||Cloud.busy||Cloud.pending||Cloud.conflict||$('#sheet').open||document.hidden)return;
 try{const reply=await cloudRequest('GET');if(Cloud.busy||Cloud.pending||$('#sheet').open)return;if(reply.revision!==Cloud.revision){cloudApply(reply.state,reply.revision);toast('已收到同行朋友的修改');}else{Cloud.error='';cloudPaint();}}
 catch{Cloud.error=navigator.onLine?'連線中斷，正在重試':'離線 · 目前顯示上次同步的內容';cloudPaint();}
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
 const gate=document.createElement('div');gate.id='cloud-gate';gate.className='cloud-gate';gate.innerHTML='<div class="cloud-welcome"><span class="brand-mark">旅</span><h2>正在打開你們的旅程…</h2><p>連接同行朋友的最新安排</p></div>';document.body.append(gate);
 let key=new URLSearchParams(location.hash.slice(1)).get('trip');if(!key){try{key=localStorage.getItem('kansai-last-trip')}catch{}}
 if(!/^[a-f0-9]{64}$/.test(key||'')){joinScreen('貼上共編連結，和同行朋友一起安排行程。');return;}
 Cloud.key=key;location.hash='trip='+key;
 try{
  let outbox=null;try{outbox=JSON.parse(localStorage.getItem(roomCache())||'null')}catch{}
  const reply=await cloudRequest('GET');installTripMetadata(reply.state);Cloud.ready=true;
  if(outbox?.dirty&&CloudMerge.validTrip(outbox.base)&&CloudMerge.validTrip(outbox.local)){
   const merged=CloudMerge.mergeTrip(outbox.base,outbox.local,reply.state);
   Cloud.base=clone(reply.state);Cloud.revision=reply.revision;Cloud.pending=true;
   if(merged.conflicts.length){state=validateBackup(outbox.local);Cloud.conflict={base:outbox.base,remote:reply.state,revision:reply.revision,paths:merged.conflicts};}
   else state=validateBackup(merged.state);
   render();rememberCloud();cloudPaint();
  }else cloudApply(reply.state,reply.revision);
  gate.remove();
 }
 catch(error){joinScreen(error.status===404||error.status===401?'這個旅程連結無法使用，請向同行朋友取得完整連結。':'暫時連不上雲端，請確認網路後重新開啟連結。');return;}
 const share=document.createElement('button');share.id='share-trip';share.className='btn cloud-share';share.innerHTML=icon('plane')+'<span>邀請同行</span>';share.onclick=shareTrip;$('.top-actions').prepend(share);
 $('#save-state').onclick=()=>Cloud.conflict?showCloudConflict():Cloud.pending?cloudFlush():cloudPoll();
 $('#save-state').onkeydown=e=>{if(e.key==='Enter')$('#save-state').click();};
 setInterval(()=>Cloud.pending?cloudFlush():cloudPoll(),4000);
 window.addEventListener('online',()=>Cloud.pending?cloudFlush():cloudPoll());document.addEventListener('visibilitychange',()=>{if(!document.hidden)Cloud.pending?cloudFlush():cloudPoll();});
 if(Cloud.conflict)showCloudConflict();else if(Cloud.pending)cloudFlush();
}
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
