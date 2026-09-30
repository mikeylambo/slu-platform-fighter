import { strike as s, type Move } from './types.js';
export const WINGS: Move[] = [
 {key:'neutral-air',name:'Blade Orbit',faf:30,landing:8,strikes:[s(4,2,2,0,1.4,1.8,[10,2],[10,10]),s(9,2,2,0,1.4,1.8,[10,2],[10,10]),s(14,2,2,0,1.4,1.8,[10,2],[10,10]),s(19,2,3,0,1.4,1.8)]},
 {key:'forward-air',name:'Tri-Lunge',faf:32,landing:9,strikes:[s(5,2,3),s(12,2,3),s(19,2,4)]},
 {key:'back-air',name:'Reverse Cut',faf:28,landing:10,strikes:[s(6,4,12,-1.7,1.5,1.1,[-10,4],[40,100])]},
 {key:'up-air',name:'Rising Flick',faf:18,landing:7,strikes:[s(3,4,6,0,3,1.2,[1,10],[30,40])]},
 {key:'down-air',name:'Dive Stab',faf:28,landing:12,strikes:[s(5,4,9,.2,-.2,.9,[1,-10],[35,70])]},
];
export const CAPE: Move[] = [
 {key:'neutral-air',name:'Veil Spin',faf:34,landing:14,strikes:[s(8,7,10,0,1.4,2,[10,4],[50,70])]},
 {key:'forward-air',name:'Cleave',faf:38,landing:18,shatter:true,strikes:[s(10,4,15,1.8,1,1.2,[3,-10],[40,80])]},
 {key:'back-air',name:'Cape Lash',faf:34,landing:14,strikes:[s(9,4,12,-2,1.4,1.4,[-10,4],[40,85])]},
 {key:'up-air',name:'Greatslash',faf:35,landing:15,strikes:[s(9,5,14,0,3,1.3,[1,10],[45,90])]},
 {key:'down-air',name:'Drop Stab',faf:30,landing:12,strikes:[s(7,3,10,.1,-.3,.85,[1,-10],[45,80])]},
];
