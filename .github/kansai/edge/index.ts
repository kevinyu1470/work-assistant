import {mergeTrip,validTrip,sameDocument} from './core.mjs';
const allowedOrigin='https://kevinyu1470.github.io';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Allow-Headers':'apikey, x-trip-key, content-type','Vary':'Origin','Access-Control-Max-Age':'600','X-Content-Type-Options':'nosniff',...(status===503?{'Retry-After':'4'}:{})}});
const timedFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(10000)});
Deno.serve(async(request)=>{
 if(request.method==='OPTIONS')return json({ok:true});
 if(!['GET','PUT'].includes(request.method))return json({error:'method_not_allowed'},405);
 const origin=request.headers.get('origin');if(origin&&origin!==allowedOrigin)return json({error:'origin_not_allowed'},403);
 const key=request.headers.get('x-trip-key')||'';
 if(!/^[a-f0-9]{64}$/.test(key))return json({error:'invalid_trip_key'},401);
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 const root=Deno.env.get('SUPABASE_URL')+'/rest/v1';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!service)return json({error:'service_unavailable'},503);
 const headers={'apikey':service,'Authorization':'Bearer '+service,'Content-Type':'application/json','Prefer':'return=representation'};
 try{
  const query=new URL(request.url).searchParams;
  if(request.method==='GET'&&query.get('action')==='history'){
   const raw=query.get('revision');const revision=raw===null?null:Number(raw);
   if(revision!==null&&(!Number.isSafeInteger(revision)||revision<1))return json({error:'invalid_revision'},400);
   const response=await timedFetch(root+'/rpc/kansai_trip_history',{method:'POST',headers,body:JSON.stringify({room_hash:hash,wanted_revision:revision})});
   if(!response.ok)return json({error:'history_unavailable'},503);
   const history=await response.json();return history?json(history):json({error:'version_not_found'},404);
  }
  let input;
  if(request.method==='PUT'){
   if(Number(request.headers.get('content-length')||0)>550000)return json({error:'payload_too_large'},413);
   const text=await request.text();if(text.length>550000)return json({error:'payload_too_large'},413);
   try{input=JSON.parse(text)}catch{return json({error:'invalid_json'},400)}
   if(!validTrip(input?.base)||!validTrip(input?.state))return json({error:'invalid_state'},400);
  }
  for(let attempt=0;attempt<5;attempt++){
   const metadataOnly=request.method==='GET'&&/^\d+$/.test(query.get('since')||'');
   const read=await timedFetch(root+'/kansai_trip_rooms?id=eq.'+hash+'&select='+(metadataOnly?'revision,updated_at':'doc,revision,updated_at'),{headers});
   if(!read.ok)return json({error:'database_unavailable'},503);
   const rows=await read.json();if(!rows[0])return json({error:'trip_not_found'},404);
   const current=rows[0];
   const reply=()=>json({state:current.doc,revision:current.revision,updatedAt:current.updated_at});
   if(request.method==='GET'){
    if(query.get('since')===String(current.revision))return json({notModified:true,revision:current.revision,updatedAt:current.updated_at});
    if(metadataOnly){const full=await timedFetch(root+'/kansai_trip_rooms?id=eq.'+hash+'&select=doc,revision,updated_at',{headers});if(!full.ok)return json({error:'database_unavailable'},503);const rows=await full.json();if(!rows[0])return json({error:'trip_not_found'},404);return json({state:rows[0].doc,revision:rows[0].revision,updatedAt:rows[0].updated_at});}
    return reply();
   }
   const result=mergeTrip(input.base,input.state,current.doc);
   if(result.conflicts.length)return json({error:'edit_conflict',conflicts:result.conflicts,state:current.doc,revision:current.revision},409);
   if(!validTrip(result.state))return json({error:'invalid_merged_state'},400);
   // A retried request whose response was lost must not create another revision/backup.
   if(sameDocument(result.state,current.doc))return reply();
   const updatedAt=new Date().toISOString();result.state.updatedAt=updatedAt;
   const write=await timedFetch(root+'/kansai_trip_rooms?id=eq.'+hash+'&revision=eq.'+current.revision,{method:'PATCH',headers,body:JSON.stringify({doc:result.state,revision:current.revision+1,updated_at:updatedAt})});
   if(!write.ok)return json({error:'database_unavailable'},503);
   const updated=await write.json();if(updated[0])return json({state:updated[0].doc,revision:updated[0].revision,updatedAt:updated[0].updated_at});
  }
  return json({error:'busy_retry'},503);
 }catch{return json({error:'temporarily_unavailable'},503)}
});
