export const MAX_BYTES=10*1024*1024, CHUNK=256*1024;
const types:Record<string,{kind:string;extension:string}>={
 'image/jpeg':{kind:'image',extension:'jpg'},'image/png':{kind:'image',extension:'png'},'image/webp':{kind:'image',extension:'webp'},
 'video/mp4':{kind:'video',extension:'mp4'},'audio/mpeg':{kind:'audio',extension:'mp3'},'audio/mp4':{kind:'audio',extension:'m4a'},
 'audio/wav':{kind:'audio',extension:'wav'},'audio/x-wav':{kind:'audio',extension:'wav'},'audio/ogg':{kind:'audio',extension:'ogg'},
 'audio/aac':{kind:'audio',extension:'aac'},
 'application/pdf':{kind:'file',extension:'pdf'},'application/msword':{kind:'file',extension:'doc'},
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{kind:'file',extension:'docx'}
};
export function mediaFormat(type:string,kind:string){const value=types[type];return value?.kind===kind?value:null;}
export function mediaSignature(bytes:Uint8Array,type:string){
 const text=(start:number,end:number)=>new TextDecoder().decode(bytes.subarray(start,end));
 if(type==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/webp')return text(0,4)==='RIFF'&&text(8,12)==='WEBP';
 if(type==='audio/wav'||type==='audio/x-wav')return text(0,4)==='RIFF'&&text(8,12)==='WAVE';
 if(type==='audio/ogg')return text(0,4)==='OggS';
 if(type==='audio/mpeg')return text(0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224;
 if(type==='audio/aac')return bytes[0]===255&&(bytes[1]&246)===240;
 if(type==='application/pdf')return text(0,5)==='%PDF-';
 if(type==='application/msword')return [208,207,17,224,161,177,26,225].every((v,i)=>bytes[i]===v);
 if(type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return text(0,2)==='PK'&&bytes[2]===3&&bytes[3]===4&&new TextDecoder().decode(bytes).includes('word/document.xml');
 return text(4,8)==='ftyp';
}

