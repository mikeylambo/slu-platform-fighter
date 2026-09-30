/** Browser audio is presentation-only and starts exclusively after a user gesture. */
export class AudioPort {
 private context:AudioContext|null=null; private volume:GainNode|null=null; enabled=true;
 start(){if(!this.context){this.context=new AudioContext();this.volume=this.context.createGain();this.volume.gain.value=.09;this.volume.connect(this.context.destination);}void this.context.resume();}
 cue(kind:'hit'|'jump'|'stance'|'menu'|'clank'){
  if(!this.context||!this.volume||!this.enabled)return;
  const ctx=this.context,t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
  const freq={hit:110,jump:420,stance:260,menu:660,clank:1500}[kind];
  o.type=kind==='hit'?'sawtooth':'sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(kind==='jump'?freq*1.8:freq*.4,t+.14);
  g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.8,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+.2);
  o.connect(g);g.connect(this.volume);o.start(t);o.stop(t+.21);o.onended=()=>{o.disconnect();g.disconnect();};
 }
}
