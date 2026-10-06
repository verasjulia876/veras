/** Instagram media is newest first. Stop only after reaching the saved boundary. */
export async function firstPostAfter(at:number, page:(after?:string)=>Promise<any>){
 const candidates:{id:string;time:number}[]=[];
 let cursor:string|undefined;
 for(let i=0;i<20;i++){
  const result=await page(cursor);
  if(!Array.isArray(result.data))throw Error('Lista de publicações inválida.');
  let reached=false;
  for(const item of result.data){
   const time=Date.parse(item.timestamp)/1000;
   if(!Number.isFinite(time))throw Error('Publicação sem data válida.');
   if(time<=at)reached=true;
   else if(/^\d+$/.test(item.id))candidates.push({id:item.id,time});
  }
  if(reached||!result.paging?.next)return candidates.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id))[0]?.id;
  const next=result.paging?.cursors?.after;
  if(!next||next===cursor)throw Error('Paginação de publicações inválida.');
  cursor=next;
 }
 throw Error('Não foi possível localizar o primeiro post com segurança.');
}
