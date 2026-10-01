import * as T from 'three';
export function flameMaterial(color: number) {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, tint: { value: new T.Color(color) }, power: { value: 1 } },
    vertexShader: `
 uniform float time; varying vec2 vUv; varying float edge;
 void main(){vUv=uv;vec3 p=position;float wave=sin(p.y*8.0-time*6.0)+.45*sin(p.y*17.0+time*3.0);p.x+=wave*.065*(1.0-uv.y);p.z+=sin(p.y*9.0-time*4.0)*.05;vec4 v=modelViewMatrix*vec4(p,1.0);edge=abs(dot(normalize(normalMatrix*normal),normalize(-v.xyz)));gl_Position=projectionMatrix*v;}`,
    fragmentShader: `uniform vec3 tint;uniform float time;uniform float power;varying vec2 vUv;varying float edge;void main(){float flicker=.75+.25*sin(vUv.y*23.0-time*7.0+sin(vUv.x*19.0));float alpha=pow(edge,1.3)*smoothstep(0.0,.18,vUv.y)*flicker;vec3 c=mix(tint,tint*1.4+vec3(.12),pow(vUv.y,3.0));gl_FragColor=vec4(c*power,alpha*.34);}`,
  });
}
