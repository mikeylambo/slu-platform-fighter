export type ClashChoice='press'|'parry'|'slip';
export function resolveClash(a:ClashChoice,b:ClashChoice):0|1|null{if(a===b)return null;return (a==='parry'&&b==='press'||a==='press'&&b==='slip'||a==='slip'&&b==='parry')?0:1;}
