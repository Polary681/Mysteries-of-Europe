// GLSL snippets shared by the landing scene and its systems (sky, stars, water, post passes).
/* =====================================================================================  GLSL */
export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hash13(vec3 p3){p3=fract(p3*.1031);p3+=dot(p3,p3.zyx+31.32);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y);}
float vnoise3(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),u.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),u.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),u.x),u.y),u.z);}
float fbm2(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*vnoise(p);p=m*p+vec2(3.1,1.7);a*=.5;}return s;}
// fbm that drops the octaves smaller than a pixel (fw = noise units per pixel)
float fbmAA(vec2 p, float fw){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*mix(vnoise(p),.5,smoothstep(.2,.5,fw));p=m*p+vec2(3.1,1.7);fw*=2.;a*=.5;}return s;}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vnoise3(p);p=p*2.03+vec3(5.1,1.7,3.3);a*=.5;}return s;}
`;
// derivative bump mapping in view space (no tangents needed)
export const GLSL_BUMP = /* glsl */`
vec3 bumpN(vec3 n, float h){vec3 p=-vViewPosition;vec3 dpx=dFdx(p),dpy=dFdy(p);float dhx=dFdx(h),dhy=dFdy(h);
  vec3 r1=cross(dpy,n),r2=cross(n,dpx);float det=dot(dpx,r1);vec3 g=sign(det)*(dhx*r1+dhy*r2);return normalize(abs(det)*n-g);}
`;


/** the drifting cloud cover of the sky dome, for a view direction d (shared by the sky and the stars so clouds hide stars) */
export const GLSL_CLOUDS = /* glsl */`
float cloudCover(vec3 d, float t){
  float y = d.y;
  vec2 cu = d.xz / (y + .1) * 1.4 + vec2(t * .0035, t * .0012);
  float cn = fbm2(cu * .9); float cov = smoothstep(.48, .78, cn) * smoothstep(-.02, .12, y);
  return cov * (.55 + .45 * smoothstep(.2, .9, fbm2(cu * .25 + 7.)));
}
// a cloud bank drifting across the Moon (the "veil" event): k = 0..1
float moonVeil(vec3 d, vec3 moon, float k, float t){
  if (k <= 0.) return 0.;
  float a = acos(clamp(dot(d, moon), -1., 1.));
  vec2 q = vec2(dot(d, normalize(cross(moon, vec3(0.,1.,0.)))), d.y - moon.y) * 9.;
  float n = fbm2(q * 1.3 + vec2(t * .05, 0.));
  return k * smoothstep(.42, .08, a) * smoothstep(.25, .6, n + .25);
}
`;
