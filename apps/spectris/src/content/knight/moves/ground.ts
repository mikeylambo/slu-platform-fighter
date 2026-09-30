import { strike as s, type Move } from './types.js';
export const GROUND: Move[] = [
 {key:'jab',name:'Gauntlet Flurry I',faf:18,landing:0,strikes:[s(2,1,2,1.25,1.4,.7,[10,1],[20,20])]},
 {key:'jab-2',name:'Gauntlet Flurry II',faf:18,landing:0,strikes:[s(2,1,2,1.4,1.4,.7,[10,1],[20,20])]},
 {key:'jab-3',name:'Gauntlet Flurry III',faf:18,landing:0,strikes:[s(4,1,3,1.5,1.4,.8,[10,3],[20,20])]},
 {key:'rapid-jab',name:'Soul Flurry',faf:24,landing:0,strikes:[s(2,1,1),s(6,1,1),s(10,1,1),s(14,1,3)]},
 {key:'forward-tilt',name:'Triple Thrust',faf:30,landing:0,strikes:[s(5,2,4),s(11,2,4),s(17,2,6,2.1,1.4,1.1)]},
 {key:'up-tilt',name:'Crown Arc',faf:26,landing:0,strikes:[s(6,7,8,.2,2.8,1.5,[1,10],[50,70])]},
 {key:'down-tilt',name:'Ankle Cut',faf:16,landing:0,strikes:[s(4,2,6,1.6,.45,.8,[10,2],[35,40])]},
 {key:'dash-attack',name:'Lunge',faf:34,landing:0,strikes:[s(7,5,10,1.9,1.4,1.15,[10,4],[60,60])]},
 {key:'forward-smash',name:'Longreach',faf:48,landing:0,shatter:true,strikes:[s(14,4,18,3,1.4,1.2,[10,4],[45,98])]},
 {key:'up-smash',name:'Orbit',faf:44,landing:0,shatter:true,strikes:[s(10,3,4,.1,2.7,1.5,[0,10],[15,20]),s(15,3,4,.1,2.7,1.5,[0,10],[15,20]),s(20,3,8,.1,2.7,1.5,[0,10],[50,95])]},
 {key:'down-smash',name:'Twin Cut',faf:40,landing:0,strikes:[s(7,2,13,1.7,.6,1.1,[10,3],[40,90]),s(13,2,13,-1.7,.6,1.1,[-10,3],[40,90])]},
];
