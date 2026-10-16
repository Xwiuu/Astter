try{let e=typeof window<`u`?window:typeof global<`u`?global:typeof globalThis<`u`?globalThis:typeof self<`u`?self:{},t=new e.Error().stack;t&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[t]=`a55dd866-2de5-42d3-91d5-1b3123d0a970`,e._sentryDebugIdIdentifier=`sentry-dbid-a55dd866-2de5-42d3-91d5-1b3123d0a970`)}catch{}import"./_sentry-release-injection-file-CIaQsB16.js";import{a as e}from"./rolldown-runtime-Ciu2z6aO.js";import{t}from"./react-CBDM120z.js";import{t as n}from"./compiler-runtime-C77ZsWdH.js";import{t as r}from"./jsx-runtime-CwX24cBp.js";import{g as i,n as a}from"./useQuery-D26LCGW4.js";import{i as o,n as s,r as c}from"./queryClient-CAHEpcPh.js";import{H as l,N as u,P as d,S as f,U as p,_ as m,k as h,x as g}from"./proxy-D-Ixe006.js";import{t as _}from"./use-reduced-motion-tx8679OO.js";import{t as v}from"./buddy-Bw9qwxH9.js";var y=class extends i{constructor(e,t){super(e,t)}bindMethods(){super.bindMethods(),this.fetchNextPage=this.fetchNextPage.bind(this),this.fetchPreviousPage=this.fetchPreviousPage.bind(this)}setOptions(e,t){super.setOptions({...e,behavior:o()},t)}getOptimisticResult(e){return e.behavior=o(),super.getOptimisticResult(e)}fetchNextPage(e){return this.fetch({...e,meta:{fetchMore:{direction:`forward`}}})}fetchPreviousPage(e){return this.fetch({...e,meta:{fetchMore:{direction:`backward`}}})}createResult(e,t){let{state:n}=e,r=super.createResult(e,t),{isFetching:i,isRefetching:a,isError:o,isRefetchError:l}=r,u=n.fetchMeta?.fetchMore?.direction,d=o&&u===`forward`,f=i&&u===`forward`,p=o&&u===`backward`,m=i&&u===`backward`;return{...r,fetchNextPage:this.fetchNextPage,fetchPreviousPage:this.fetchPreviousPage,hasNextPage:s(t,n.data),hasPreviousPage:c(t,n.data),isFetchNextPageError:d,isFetchingNextPage:f,isFetchPreviousPageError:p,isFetchingPreviousPage:m,isRefetchError:l&&!d&&!p,isRefetching:a&&!f&&!m}}};function b(e,t){return a(e,y,t)}function x(...e){let t=!Array.isArray(e[0]),n=t?0:-1,r=e[0+n],i=e[1+n],a=e[2+n],o=e[3+n],s=h(i,a,o);return t?s(r):s}var S=e(t(),1);function C(e){let t=p(()=>f(e)),{isStatic:n}=(0,S.useContext)(m);if(n){let[,n]=(0,S.useState)(e);(0,S.useEffect)(()=>t.on(`change`,n),[])}return t}function w(e,t){let n=C(t()),r=()=>n.set(t());return r(),l(()=>{let t=()=>d.preRender(r,!1,!0),n=e.map(e=>e.on(`change`,t));return()=>{n.forEach(e=>e()),u(r)}}),n}function T(e){g.current=[],e();let t=w(g.current,e);return g.current=void 0,t}function E(e,t,n,r){if(typeof e==`function`)return T(e);let i=typeof t==`function`?t:x(t,n,r);return Array.isArray(e)?D(e,i):D([e],([e])=>i(e))}function D(e,t){let n=p(()=>[]);return w(e,()=>{n.length=0;let r=e.length;for(let t=0;t<r;t++)n[t]=e[t].get();return t(n)})}var O=n(),k=`#version 300 es
in vec2 aPosition;
out vec2 vPosition;
void main() {
  vPosition = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`,A=`#version 300 es
precision highp float;
in vec2 vPosition;
out vec4 outColor;
uniform sampler2D uImage;
uniform float uOpen;
uniform float uBlink;
uniform float uRoll;
uniform float uLift;
uniform float uFocus;
uniform vec2 uStretch;

const float SIZE = 1024.0;
const float PADDING = 1.08;
const vec2 BALL = vec2(510.0, 498.0);
const vec2 LEFT_EYE = vec2(372.0, 328.0);
const vec2 RIGHT_EYE = vec2(645.0, 328.0);
const vec2 EYE_RADIUS = vec2(92.0, 112.0);
const float EYELID_REACH = 170.0;
const vec2 SMILE_CENTER = vec2(512.0, 380.0);
const float SMILE_RADIUS = 337.0;
const float SMILE_HALF_WIDTH = 300.0;

// Squashes the printed eye toward its center and stretches the surrounding
// skin to fill the gap. Monotonic per column, so no seams or doubled ink.
vec2 blink(vec2 p, vec2 eye) {
  vec2 d = p - eye;
  float column = 1.0 - pow(d.x / EYE_RADIUS.x, 2.0);
  if (column <= 0.0 || abs(d.y) >= EYELID_REACH) return p;
  float eyeHalf = EYE_RADIUS.y * sqrt(column);
  float lidHalf = eyeHalf * max(1.0 - uBlink, 0.04);
  float y = abs(d.y);
  float source = y < lidHalf
    ? y * eyeHalf / lidHalf
    : eyeHalf + (y - lidHalf) * (EYELID_REACH - eyeHalf) / (EYELID_REACH - lidHalf);
  return vec2(p.x, eye.y + sign(d.y) * mix(y, source, smoothstep(0.0, 0.35, column)));
}

vec2 mouth(vec2 p) {
  vec2 v = p - SMILE_CENTER;
  float t = clamp(v.x / SMILE_HALF_WIDTH, -1.0, 1.0);
  float bulge = (1.0 - t * t) * smoothstep(50.0, 150.0, v.y);
  float radial = length(v) - SMILE_RADIUS;
  // Magnifying around the smile's centerline thickens the printed stroke.
  // The falloff keeps the mapping monotonic, so nothing folds or tears.
  float zoom = 1.0 / (1.0 + uOpen * 1.2 * bulge);
  float weight = 1.0 - smoothstep(40.0, 130.0, abs(radial));
  float source = radial * mix(1.0, zoom, weight);
  return SMILE_CENTER + normalize(v) * (SMILE_RADIUS + source);
}

void main() {
  vec2 p = SIZE * 0.5 + vPosition * vec2(1.0, -1.0) * SIZE * 0.5 * PADDING;
  float cr = cos(uRoll);
  float sr = sin(uRoll);
  p = BALL + mat2(cr, -sr, sr, cr) * (p - BALL) / uStretch + vec2(0.0, uLift);
  float eyeDistance = min(length((p - LEFT_EYE) / EYE_RADIUS), length((p - RIGHT_EYE) / EYE_RADIUS));
  p.y -= uFocus * 55.0 * (1.0 - smoothstep(1.0, 1.8, eyeDistance));
  p = blink(blink(mouth(p), LEFT_EYE), RIGHT_EYE);
  vec2 uv = p / SIZE;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    outColor = vec4(0.0);
    return;
  }
  // Masks stray pixels along the source image's border.
  float ball = length((p - BALL) / vec2(468.0, 478.0));
  outColor = texture(uImage, uv) * (1.0 - smoothstep(1.015, 1.035, ball));
}`;function j(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.warn(`assistant-avatar-shader-failed`,e.getShaderInfoLog(r)),e.deleteShader(r),null)):null}var M=.16;function N(e,{image:t,focused:n,dragging:r,level:i,reducedMotion:a,onFailed:o}){let s=e.getContext(`webgl2`,{premultipliedAlpha:!0});if(!s)return null;let c=j(s,s.VERTEX_SHADER,k),l=j(s,s.FRAGMENT_SHADER,A),u=s.createProgram();if(!c||!l||!u||(s.attachShader(u,c),s.attachShader(u,l),s.linkProgram(u),!s.getProgramParameter(u,s.LINK_STATUS)))return null;s.useProgram(u);let d=s.createBuffer();s.bindBuffer(s.ARRAY_BUFFER,d),s.bufferData(s.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),s.STATIC_DRAW);let f=s.getAttribLocation(u,`aPosition`);s.enableVertexAttribArray(f),s.vertexAttribPointer(f,2,s.FLOAT,!1,0,0);let p=e=>s.getUniformLocation(u,e),m=p(`uFocus`),h=p(`uOpen`),g=p(`uBlink`),_=p(`uRoll`),v=p(`uLift`),y=p(`uStretch`),b=s.createTexture(),x=i&&!a?1:0,S=0,C=0,w=-1,T=a?1/0:performance.now()/1e3+1.5+Math.random()*2,E=0,D,O=!1,N=!1,P=t=>{let a=t/1e3,o=e.ownerDocument.defaultView?.devicePixelRatio??1,c=Math.min(1024,Math.ceil(e.clientWidth*o*2));c>0&&e.width!==c&&(e.width=c,e.height=c),C+=(+!!n?.()-C)*.12,s.uniform1f(m,C);let l=+!!r?.(),u=l?.9:Math.min(1,(i?.()??0)*1.2);S+=(u-S)*(u>S?.5:.15),a>=T&&(w=a,T=a+(Math.random()<.15?.3:2.5+Math.random()*3.5));let d=(a-w)/M,f=d>=0&&d<1?Math.sin(Math.PI*d):0,p=1+x*.008*Math.sin(a*1.7);s.viewport(0,0,e.width,e.height),s.clearColor(0,0,0,0),s.clear(s.COLOR_BUFFER_BIT),s.uniform1f(h,S),s.uniform1f(g,l?.65:f),s.uniform1f(_,x*(l*(.12+.06*Math.sin(a*12))+.025*Math.sin(a*.8)+.03*S*Math.sin(a*5.3)+C*.008*Math.sin(a*8))),s.uniform1f(v,x*(6*S+4*Math.sin(a*1.7)+C*(-15+4*Math.sin(a*8)))),s.uniform2f(y,p*(1-x*.02*S),p*(1+x*.035*S)),s.drawArrays(s.TRIANGLE_STRIP,0,4),i||d<1?E=requestAnimationFrame(P):Number.isFinite(T)&&(D=setTimeout(()=>E=requestAnimationFrame(P),(T-a)*1e3))},F=()=>{!O||N||(cancelAnimationFrame(E),clearTimeout(D),E=requestAnimationFrame(P))},I=new ResizeObserver(F);I.observe(e);let L=new Image;L.onload=()=>{N||(s.bindTexture(s.TEXTURE_2D,b),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),s.texImage2D(s.TEXTURE_2D,0,s.RGBA,s.RGBA,s.UNSIGNED_BYTE,L),s.generateMipmap(s.TEXTURE_2D),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR_MIPMAP_LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),O=!0,F())},L.onerror=()=>{N||o()},L.src=t;let R=e=>{e.preventDefault(),cancelAnimationFrame(E),clearTimeout(D),o()};return e.addEventListener(`webglcontextlost`,R),()=>{N=!0,I.disconnect(),cancelAnimationFrame(E),clearTimeout(D),e.removeEventListener(`webglcontextlost`,R),s.deleteTexture(b),s.deleteBuffer(d),s.deleteProgram(u),s.deleteShader(c),s.deleteShader(l)}}var P=r();function F(e){let t=(0,O.c)(14),{level:n,focused:r,dragging:i,className:a}=e,o=r!==void 0&&r,s=i!==void 0&&i,c=_(),l=(0,S.useRef)(s),u,d;t[0]===s?(u=t[1],d=t[2]):(u=()=>{l.current=s},d=[s],t[0]=s,t[1]=u,t[2]=d),(0,S.useEffect)(u,d);let f=(0,S.useRef)(o),p,m;t[3]===o?(p=t[4],m=t[5]):(p=()=>{f.current=o},m=[o],t[3]=o,t[4]=p,t[5]=m),(0,S.useEffect)(p,m);let h=(0,S.useRef)(null),[g,y]=(0,S.useState)(!1),b,x;if(t[6]!==n||t[7]!==c?(b=()=>{let e=h.current;if(!e)return;let t=N(e,{image:v,focused:()=>f.current,dragging:()=>l.current,level:n?()=>n.get():void 0,reducedMotion:!!c,onFailed:()=>y(!0)});return t||y(!0),t??void 0},x=[n,c],t[6]=n,t[7]=c,t[8]=b,t[9]=x):(b=t[8],x=t[9]),(0,S.useEffect)(b,x),g){let e=`object-contain ${a}`,n;return t[10]===e?n=t[11]:(n=(0,P.jsx)(`img`,{src:v,alt:``,className:e}),t[10]=e,t[11]=n),n}let C;return t[12]===a?C=t[13]:(C=(0,P.jsx)(`canvas`,{ref:h,"aria-hidden":`true`,className:a}),t[12]=a,t[13]=C),C}export{b as i,E as n,C as r,F as t};
//# sourceMappingURL=BuddyFace-BY5TY1M6.js.map