import type {Node} from './map';
/** Absent metadata preserves the delivery time of pre-upgrade flows. */
export function sendDelaySeconds(n:Node):number {
 if(!n.sendDelay)return 0;
 if(n.sendDelay.mode==='manual')return n.sendDelay.seconds;
 if(n.mediaType==='audio')return Math.ceil(n.mediaDuration||0);
 if(n.mediaType)return 2;
 const length=Array.from(n.text.replace(/\{\{\s*first_name\s*\}\}/g,'Ana').trim()).length;
 return length?Math.min(30,Math.max(2,Math.ceil(length/12))):0;
}
