export interface Strike { start: number; active: number; strain: number; x: number; y: number; radius: number; direction: [number, number]; kb: [number, number]; }
export interface Move { key: string; name: string; faf: number; landing: number; shatter?: boolean; strikes: Strike[]; }
export function strike(start: number, active: number, strain: number, x=1.6, y=1.4, radius=1.1, direction: [number,number]=[10,5], kb: [number,number]=[40,60]): Strike { return {start,active,strain,x,y,radius,direction,kb}; }
