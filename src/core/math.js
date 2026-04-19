import * as THREE from "three";
export const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
export const lerp = (a,b,t)=> a + (b-a)*t;
export const rand = (a,b)=> a + Math.random()*(b-a);
export const randInt = (a,b)=> (a + Math.floor(Math.random()*(b-a+1)));
export const v3 = (x=0,y=0,z=0)=> new THREE.Vector3(x,y,z);
