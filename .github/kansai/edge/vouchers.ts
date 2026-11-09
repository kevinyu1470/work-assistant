const storageFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(20000)});
const ORIGIN='https://kevinyu1470.github.io',BUCKET='kansai-vouchers',LIMIT=10*1024*1024;
const response=(body,status=200)=>Response.json(body,{status,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, x-trip-key, content-type','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'}});
const assetPattern=/^[a-f0-9-]{36}\.(png|jpg|webp|pdf)$/;
async function limitedBody(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('too_large');}chunks.push(value);}const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;}
function fileType(b){if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return ['image/png','png'];if(b[0]===255&&b[1]===216&&b[2]===255)return ['image/jpeg','jpg'];if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return ['image/webp','webp'];if(new TextDecoder().decode(b.slice(0,5))==='%PDF-')return ['application/pdf','pdf'];return null;}
Deno.serve(async(request)=>{
 if(request.method==='OPTIONS')return response({ok:true});if(request.method!=='POST')return response({error:'method_not_allowed'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==ORIGIN)return response({error:'origin_not_allowed'},403);
 const key=request.headers.get('x-trip-key')||'';if(!/^[a-f0-9]{64}$/.test(key))return response({error:'invalid_trip_key'},401);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
 const base=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!base||!service)return response({error:'unavailable'},503);
 const headers={apikey:service,Authorization:'Bearer '+service},jsonHeaders={...headers,'Content-Type':'application/json'};
 try{
  const read=await storageFetch(base+'/rest/v1/kansai_trip_rooms?id=eq.'+hash+'&select=doc',{headers});if(!read.ok)return response({error:'database_unavailable'},503);const rows=await read.json();if(!rows[0])return response({error:'trip_not_found'},404);
  const refs=new Set();for(const [k,v] of Object.entries(rows[0].doc.settings||{}))if(k.startsWith('voucher_')&&typeof v==='string'&&v){try{for(const a of JSON.parse(v).assets||[])if(typeof a.id==='string')refs.add(a.id);}catch{}}
  const contentType=request.headers.get('content-type')||'';
  if(contentType.startsWith('multipart/form-data')){
   if(Number(request.headers.get('content-length')||0)>LIMIT+65536)return response({error:'file_too_large'},413);
   const body=await limitedBody(request,LIMIT+65536);const form=await new Response(body,{headers:{'Content-Type':contentType}}).formData();const file=form.get('file');
   if(!(file instanceof File)||!file.size||file.size>LIMIT)return response({error:'file_too_large'},413);
   const bytes=new Uint8Array(await file.arrayBuffer()),type=fileType(bytes);if(!type)return response({error:'unsupported_file'},415);
   const bucket=await storageFetch(base+'/storage/v1/bucket/'+BUCKET,{headers});
   if(bucket.ok){const existing=await bucket.json();if(existing.public)return response({error:'unsafe_bucket_configuration'},503);}
   else{const create=await storageFetch(base+'/storage/v1/bucket',{method:'POST',headers:jsonHeaders,body:JSON.stringify({id:BUCKET,name:BUCKET,public:false,file_size_limit:LIMIT,allowed_mime_types:['image/png','image/jpeg','image/webp','application/pdf']})});if(!create.ok){const verify=await storageFetch(base+'/storage/v1/bucket/'+BUCKET,{headers});if(!verify.ok||(await verify.json()).public)return response({error:'storage_unavailable'},503);}}
   const listing=await storageFetch(base+'/storage/v1/object/list/'+BUCKET,{method:'POST',headers:jsonHeaders,body:JSON.stringify({prefix:hash,limit:101,offset:0})});if(!listing.ok)return response({error:'storage_unavailable'},503);if((await listing.json()).length>=100)return response({error:'attachment_limit'},409);
   const id=crypto.randomUUID()+'.'+type[1],path=hash+'/'+id;
   const uploaded=await storageFetch(base+'/storage/v1/object/'+BUCKET+'/'+path,{method:'POST',headers:{...headers,'Content-Type':type[0],'x-upsert':'false','Cache-Control':'private, max-age=0'},body:bytes});
   if(!uploaded.ok)return response({error:'upload_failed'},503);
   return response({asset:{id,name:file.name.slice(0,180),mime:type[0],size:file.size}});
  }
  const raw=await limitedBody(request,4096);let input;try{input=JSON.parse(new TextDecoder().decode(raw));}catch{return response({error:'invalid_json'},400);}
  if(!assetPattern.test(input?.id||''))return response({error:'invalid_asset'},400);const path=hash+'/'+input.id;
  if(input.action==='sign'){
   if(!refs.has(input.id))return response({error:'asset_not_in_trip'},404);
   const signed=await storageFetch(base+'/storage/v1/object/sign/'+BUCKET+'/'+path,{method:'POST',headers:jsonHeaders,body:JSON.stringify({expiresIn:300})});if(!signed.ok)return response({error:'file_not_found'},404);const result=await signed.json();
   if(typeof result.signedURL!=='string'||!result.signedURL.startsWith('/object/sign/'+BUCKET+'/'+hash+'/'))return response({error:'sign_failed'},503);
   return response({url:base+'/storage/v1'+result.signedURL,expiresIn:300});
  }
  if(input.action==='delete'){
   if(refs.has(input.id))return response({error:'asset_still_in_use'},409);
   // Historical versions must remain restorable with their original attachments.
   const history=await storageFetch(base+'/rest/v1/rpc/kansai_trip_asset_in_history',{method:'POST',headers:jsonHeaders,body:JSON.stringify({room_hash:hash,asset_id:input.id})});
   if(!history.ok)return response({error:'database_unavailable'},503);
   if(await history.json())return response({error:'asset_still_in_use'},409);
   const deleted=await storageFetch(base+'/storage/v1/object/'+BUCKET,{method:'DELETE',headers:jsonHeaders,body:JSON.stringify({prefixes:[path]})});if(!deleted.ok)return response({error:'delete_failed'},503);return response({ok:true});
  }
  return response({error:'invalid_action'},400);
 }catch(e){return response({error:e instanceof Error&&e.message==='too_large'?'file_too_large':'temporarily_unavailable'},e instanceof Error&&e.message==='too_large'?413:503);}
});
