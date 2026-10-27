/** Fera Atacado | Cloudflare Worker + D1. Nenhum dado fictício em produção. */
const HEADERS={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
};
const json=(obj,status=200,headers={})=>new Response(JSON.stringify(obj),{status,headers:{...HEADERS,...headers}});
const fail=(message,status=400)=>json({error:message},status);
const brTime=()=>new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour12:false});
const brDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safeName=x=>String(x??'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
const validName=x=>typeof x==='string'&&safeName(x).length>=2&&safeName(x).length<=120;
const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=9999999;
const settingsDefault={rotation:11,ticker:42,auto:true};
const eventLabel={whatsapp:'WhatsApp',attender:'Attender',vivo_digital:'Vivo Digital'};
const encoder=new TextEncoder();
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const fromB64url=str=>Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4)),x=>x.charCodeAt(0));
async function hmac(secret,msg){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(msg)))}
async function hash(x){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(x)))}
function equalBytes(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a[i]^b[i];return result===0}
const cookieName='fera_admin_session';
function getCookie(req){const cookies=req.headers.get('Cookie')||'';return cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''}
async function authenticated(req,env){if(!env.SESSION_SECRET)return false;const token=getCookie(req),[payload,sig,...rest]=token.split('.');if(!payload||!sig||rest.length||payload.length>400)return false;try{const expected=await hmac(env.SESSION_SECRET,payload);if(!equalBytes(expected,fromB64url(sig)))return false;const data=JSON.parse(new TextDecoder().decode(fromB64url(payload)));return data.role==='admin'&&Number.isInteger(data.exp)&&Date.now()<data.exp}catch{return false}}
async function makeCookie(env){const payload=b64url(encoder.encode(JSON.stringify({role:'admin',exp:Date.now()+6*3600*1000})));return `${cookieName}=${payload}.${b64url(await hmac(env.SESSION_SECRET,payload))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=21600`}
async function bodyJson(req){const len=Number(req.headers.get('Content-Length')||0);if(len>400000)throw Error('Arquivo ou solicitação grande demais (limite de 400 KB).');if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error('Envie JSON.');return await req.json()}
const idempotentLoginLimit=async(env,req)=>{const ip=req.headers.get('CF-Connecting-IP')||'desconhecido',now=Math.floor(Date.now()/1000),key=b64url(await hash(ip+'|'+env.SESSION_SECRET));const limit=await env.DB.prepare('SELECT attempts, window_start FROM login_attempts WHERE ip_hash=?').bind(key).first();if(limit&&now-limit.window_start<900&&limit.attempts>=10)return {blocked:true,key,now};return {blocked:false,key,now,limit}};
async function logLoginFailure(env,p){if(!p.limit||p.now-p.limit.window_start>=900){await env.DB.prepare('INSERT INTO login_attempts (ip_hash,attempts,window_start) VALUES(?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=1,window_start=excluded.window_start').bind(p.key,p.now).run()}else await env.DB.prepare('UPDATE login_attempts SET attempts=attempts+1 WHERE ip_hash=?').bind(p.key).run()}
async function ensureToday(env){const day=brDay(),m=await env.DB.prepare("SELECT value FROM app_meta WHERE key='date'").first();if(!m)throw Error('Banco ainda não inicializado. Execute as migrations D1.');if(m.value!==day){await env.DB.batch([
  env.DB.prepare('UPDATE sellers SET whatsapp=0,attender=0,vivo_digital=0'),
  env.DB.prepare('DELETE FROM events'),
  env.DB.prepare("UPDATE app_meta SET value=? WHERE key='date'").bind(day),
]);}return day}
async function state(env,admin=false){const [all,cfg,logs]=await Promise.all([
  env.DB.prepare('SELECT name,whatsapp,attender,vivo_digital FROM sellers ORDER BY name COLLATE NOCASE').all(),
  env.DB.prepare("SELECT value FROM app_meta WHERE key='settings'").first(),
  admin?env.DB.prepare('SELECT id,name,channel,change,logged_at FROM events ORDER BY id DESC LIMIT 25').all():Promise.resolve({results:[]}),
]);let settings=settingsDefault;try{settings={...settingsDefault,...JSON.parse(cfg?.value||'{}')}}catch{}
return {date:brDay(),sellers:all.results||[],settings,events:admin?(logs.results||[]).map(e=>({...e,time:new Date(e.logged_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour12:false}),channel:eventLabel[e.channel]||e.channel})):[]}}
async function applyAction(path,data,env){const DB=env.DB;
 if(path==='/api/admin/contact'){
   const name=safeName(data.name),channel=data.channel,qty=Number(data.quantity);
   if(!validName(name)||!(channel in eventLabel)||!Number.isSafeInteger(qty)||qty<1||qty>99999)return fail('Vendedor, canal ou quantidade inválida.');
   const seller=await DB.prepare('SELECT id FROM sellers WHERE name=?').bind(name).first();if(!seller)return fail('Vendedor não encontrado.',404);
   await DB.batch([DB.prepare(`UPDATE sellers SET ${channel}=${channel}+? WHERE id=?`).bind(qty,seller.id),DB.prepare('INSERT INTO events(seller_id,name,channel,change,logged_at) VALUES(?,?,?,?,?)').bind(seller.id,name,channel,qty,new Date().toISOString())]);
 }else if(path==='/api/admin/undo'){
   const last=await DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 1').first();if(!last)return fail('Não existe lançamento para desfazer.');
   if(!(last.channel in eventLabel))return fail('Canal inválido no registro.');
   await DB.batch([DB.prepare(`UPDATE sellers SET ${last.channel}=MAX(0,${last.channel}-?) WHERE id=?`).bind(last.change,last.seller_id),DB.prepare('DELETE FROM events WHERE id=?').bind(last.id)]);
 }else if(path==='/api/admin/seller/add'){
   if(!validName(data.name))return fail('Nome inválido (2 a 120 caracteres).');
   const name=safeName(data.name),exist=await DB.prepare('SELECT id FROM sellers WHERE name=?').bind(name).first();if(exist)return fail('Este vendedor já está cadastrado.');
   await DB.prepare('INSERT INTO sellers(name) VALUES(?)').bind(name).run();
 }else if(path==='/api/admin/seller/edit'){
   const name=safeName(data.name),original=safeName(data.originalName);
   if(!validName(name)||!validName(original)||!['whatsapp','attender','vivo_digital'].every(k=>validCount(data[k])))return fail('Nome ou números inválidos.');
   const s=await DB.prepare('SELECT id FROM sellers WHERE name=?').bind(original).first();if(!s)return fail('Vendedor não encontrado.',404);
   const existing=await DB.prepare('SELECT id FROM sellers WHERE name=?').bind(name).first();if(existing&&existing.id!==s.id)return fail('Nome já cadastrado.');
   await DB.batch([DB.prepare('UPDATE sellers SET name=?,whatsapp=?,attender=?,vivo_digital=? WHERE id=?').bind(name,data.whatsapp,data.attender,data.vivo_digital,s.id),DB.prepare('DELETE FROM events')]);
 }else if(path==='/api/admin/seller/delete'){
   const name=safeName(data.name);if(!validName(name))return fail('Nome inválido.');
   const s=await DB.prepare('SELECT id FROM sellers WHERE name=?').bind(name).first();if(!s)return fail('Vendedor não encontrado.',404);
   await DB.batch([DB.prepare('DELETE FROM events WHERE seller_id=?').bind(s.id),DB.prepare('DELETE FROM sellers WHERE id=?').bind(s.id)]);
 }else if(path==='/api/admin/reset'){
   await DB.batch([DB.prepare('UPDATE sellers SET whatsapp=0,attender=0,vivo_digital=0'),DB.prepare('DELETE FROM events')]);
 }else if(path==='/api/admin/import'){
   if(!Array.isArray(data.sellers)||data.sellers.length<1||data.sellers.length>500)return fail('Envie entre 1 e 500 vendedores.');
   const seen=new Set(),clean=[];
   for(const r of data.sellers){const name=safeName(r.name);if(!validName(name)||!['whatsapp','attender','vivo_digital'].every(k=>validCount(r[k])))return fail(`Dados inválidos para ${name||'um vendedor'}.`);if(seen.has(name))return fail('Nome duplicado: '+name);seen.add(name);clean.push({name,whatsapp:r.whatsapp,attender:r.attender,vivo_digital:r.vivo_digital})}
   const stmts=[DB.prepare('DELETE FROM events'),DB.prepare('DELETE FROM sellers'),...clean.map(r=>DB.prepare('INSERT INTO sellers(name,whatsapp,attender,vivo_digital) VALUES(?,?,?,?)').bind(r.name,r.whatsapp,r.attender,r.vivo_digital))];await DB.batch(stmts);
 }else if(path==='/api/admin/settings'){
   const rotation=Number(data.rotation),ticker=Number(data.ticker),auto=data.auto;
   if(!Number.isSafeInteger(rotation)||rotation<4||rotation>60||!Number.isSafeInteger(ticker)||ticker<12||ticker>120||typeof auto!=='boolean')return fail('Configurações fora dos limites.');
   await DB.prepare("UPDATE app_meta SET value=? WHERE key='settings'").bind(JSON.stringify({rotation,ticker,auto})).run();
 }else return fail('Ação desconhecida.',404);
 return json({ok:true,...await state(env,true)});
}
export default {
 async fetch(req,env){
  const url=new URL(req.url),path=url.pathname;
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(!env.DB)return fail('Banco D1 não configurado no Worker.',503);
  if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET||env.ADMIN_PASSWORD.length<12||env.SESSION_SECRET.length<32)return fail('Configure os segredos ADMIN_PASSWORD (mínimo 12) e SESSION_SECRET (mínimo 32) na Cloudflare.',503);
  if(req.method==='POST'){
    const origin=req.headers.get('Origin');if(origin&&origin!==url.origin)return fail('Origem não permitida.',403);
    if(req.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Origem não permitida.',403);
  }
  try{
   await ensureToday(env);
   if(path==='/api/state'&&req.method==='GET')return json(await state(env,false));
   if(path==='/api/session'&&req.method==='GET')return json({authenticated:await authenticated(req,env)});
   if(path==='/api/login'&&req.method==='POST'){
     const p=await idempotentLoginLimit(env,req);if(p.blocked)return fail('Muitas tentativas. Tente novamente em 15 minutos.',429);
     const data=await bodyJson(req);const received=String(data.password??'');if(!equalBytes(await hash(received),await hash(env.ADMIN_PASSWORD))){await logLoginFailure(env,p);return fail('Senha incorreta.',401)}
     await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(p.key).run();
     return json({authenticated:true},200,{'Set-Cookie':await makeCookie(env)});
   }
   if(path==='/api/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
   if(path.startsWith('/api/admin/')&&req.method==='GET'){
     if(!await authenticated(req,env))return fail('Sessão expirada. Entre novamente.',401);
     if(path==='/api/admin/state')return json(await state(env,true));
   }
   if(path.startsWith('/api/admin/')&&req.method==='POST'){
     if(!await authenticated(req,env))return fail('Sessão expirada. Entre novamente.',401);
     return await applyAction(path,await bodyJson(req),env);
   }
   return fail('Rota não encontrada.',404);
  }catch(e){console.error('API Fera:',e);return fail(e instanceof SyntaxError?'JSON inválido.':(e.message||'Erro interno.'),/JSON inválido|inválid|grande demais|Envie JSON/.test(e.message)?400:500)}
 }
};
