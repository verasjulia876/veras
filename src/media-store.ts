import {DurableObject} from 'cloudflare:workers';
import type {AppEnv} from './meta';

import {MAX_BYTES,CHUNK,mediaSignature,mediaFormat} from './media-format';
type Metadata={size:number;type:string};
/** Uploaded media is immutable and addressed by a random, unlisted URL. */
export class FlowMedia extends DurableObject<AppEnv>{
 async fetch(req:Request){
  if(req.method==='PUT'){
   if(await this.ctx.storage.get('metadata'))return new Response('Already stored',{status:409});
   const type=(req.headers.get('Content-Type')||'').split(';')[0];
   if(!mediaFormat(type,type.startsWith('application/')?'file':type.split('/')[0]))return new Response('Formato não suportado.',{status:415});
   const reader=req.body?.getReader();if(!reader)return new Response('Arquivo vazio.',{status:400});
   const pieces:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();return new Response('Use um arquivo de até 10 MB.',{status:413});}pieces.push(value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const value of pieces){bytes.set(value,offset);offset+=value.length;}
   if(!size||!mediaSignature(bytes,type))return new Response('O conteúdo não corresponde ao formato do arquivo.',{status:415});
   await this.ctx.storage.transaction(async tx=>{
    for(let i=0;i<size;i+=CHUNK)await tx.put('chunk:'+Math.floor(i/CHUNK),bytes.slice(i,i+CHUNK));
    await tx.put('metadata',{size,type});
   });
   return Response.json({size,type});
  }
  if(!['GET','HEAD'].includes(req.method))return new Response(null,{status:405});
  const meta=await this.ctx.storage.get<Metadata>('metadata');if(!meta)return new Response(null,{status:404});
  let start=0,end=meta.size-1,status=200;const range=req.headers.get('Range');
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{'Content-Range':`bytes */${meta.size}`}});
   if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}else start=Math.max(0,meta.size-Number(match[2]));
   if(start>end||start>=meta.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${meta.size}`}});status=206;
  }
  const headers=new Headers({'Content-Type':meta.type,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'});
  if(meta.type.startsWith('application/'))headers.set('Content-Disposition','attachment');
  if(status===206)headers.set('Content-Range',`bytes ${start}-${end}/${meta.size}`);
  if(req.method==='HEAD')return new Response(null,{status,headers});
  const storage=this.ctx.storage;let index=Math.floor(start/CHUNK);const last=Math.floor(end/CHUNK);
  const stream=new ReadableStream<Uint8Array>({async pull(controller){const chunk=await storage.get<Uint8Array>('chunk:'+index);if(!chunk){controller.error(Error('Missing media chunk'));return;}controller.enqueue(chunk.subarray(index===Math.floor(start/CHUNK)?start%CHUNK:0,index===last?end%CHUNK+1:chunk.length));if(index++===last)controller.close();}});
  // Workers ignores a manually supplied Content-Length for unknown-length streams.
  // Media fetchers must receive the exact byte length for full and ranged GETs.
  const fixed=new FixedLengthStream(end-start+1);
  this.ctx.waitUntil(stream.pipeTo(fixed.writable).catch(()=>{}));
  return new Response(fixed.readable,{status,headers});
 }
}

