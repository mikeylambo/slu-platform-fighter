export interface LifeRules { lives:number; threshold:number; }
export function losesLife(strain:number,shatter:boolean,outside:boolean,rules:LifeRules):boolean{return outside||(shatter&&strain>=rules.threshold);}
export function takeLife(remaining:number){return {remaining:Math.max(0,remaining-1),eliminated:remaining<=1};}
