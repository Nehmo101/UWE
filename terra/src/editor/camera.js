// Anno-Kamera: Fokus auf der Bodenebene, Auto-Flatten, gedaempfte Interpolation,
// plus analytische Strahlen gegen das Heightfield.
import * as THREE from 'three';
import { clamp, lerp, DEG } from '../core/rng.js';
import { HALF } from '../core/store.js';
import { heightAt } from '../world/terrain.js';

export const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 3000);
camera.position.set(0, 120, 160);

/** Veraenderlicher Kamerazustand — von Zeiger, Tastatur und IO gemeinsam genutzt. */
export const cam = {
  focus: { x: 0, z: 0 }, tFocus: { x: 0, z: 0 },
  focusY: 0, tFocusY: 0,
  dist: 120, tDist: 120,
  yaw: 0.7, tYaw: 0.7,
  pitch: 42 * DEG, tPitch: 42 * DEG
};
var DAMP = 0.15;

export const keys = {};
export function initKeys(onKey) {
  window.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    keys[e.code] = true;
    onKey(e);
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { for (var k in keys) delete keys[k]; });
}

function zoomT() { return clamp((cam.tDist - 25) / (400 - 25), 0, 1); }

/** Auto-Flatten: nah = flach (30°), fern = steiler (60°). */
function autoPitch() { return lerp(30, 60, zoomT()) * DEG; }

function updateCamera(dt) {
  var f = 1 - Math.pow(1 - DAMP, dt * 60);
  cam.focus.x += (cam.tFocus.x - cam.focus.x) * f;
  cam.focus.z += (cam.tFocus.z - cam.focus.z) * f;
  cam.dist += (cam.tDist - cam.dist) * f;
  cam.yaw += (cam.tYaw - cam.yaw) * f;
  cam.pitch += (cam.tPitch - cam.pitch) * f;
  cam.tFocusY = heightAt(cam.focus.x, cam.focus.z);
  cam.focusY += (cam.tFocusY - cam.focusY) * f * 0.6;
  var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  var cx = cam.focus.x + cam.dist * cp * Math.sin(cam.yaw);
  var cz = cam.focus.z + cam.dist * cp * Math.cos(cam.yaw);
  var cy = cam.focusY + cam.dist * sp;
  var floor = heightAt(cx, cz) + 4;
  if (cy < floor) cy = floor;
  camera.position.set(cx, cy, cz);
  camera.lookAt(cam.focus.x, cam.focusY, cam.focus.z);
}

function moveFocus(dt) {
  var sp = cam.dist * 0.55 * dt;
  var fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  var rx = -fz, rz = fx;
  var mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
  if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
  if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
  if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
  if (mx || mz) {
    var l = Math.sqrt(mx * mx + mz * mz);
    cam.tFocus.x = clamp(cam.tFocus.x + mx / l * sp, -HALF - 40, HALF + 40);
    cam.tFocus.z = clamp(cam.tFocus.z + mz / l * sp, -HALF - 40, HALF + 40);
  }
  if (keys.KeyQ) cam.tYaw += 1.4 * dt;
  if (keys.KeyE) cam.tYaw -= 1.4 * dt;
}

var raycaster = new THREE.Raycaster();
var _ndc = new THREE.Vector2();
function rayFrom(ev) {
  _ndc.x = (ev.clientX / window.innerWidth) * 2 - 1;
  _ndc.y = -((ev.clientY / window.innerHeight) * 2 - 1);
  raycaster.setFromCamera(_ndc, camera);
  return raycaster.ray;
}
function rayTerrain(ray) {
  var o = ray.origin, d = ray.direction, t = 0, step;
  for (var i = 0; i < 900; i++) {
    step = Math.max(1.0, t * 0.02);
    var nt = t + step;
    var x = o.x + d.x * nt, y = o.y + d.y * nt, z = o.z + d.z * nt;
    if (y - heightAt(x, z) <= 0) {
      var lo = t, hi = nt;
      for (var b = 0; b < 22; b++) {
        var mid = (lo + hi) * 0.5;
        if ((o.y + d.y * mid) - heightAt(o.x + d.x * mid, o.z + d.z * mid) > 0) lo = mid; else hi = mid;
      }
      var ft = (lo + hi) * 0.5;
      return new THREE.Vector3(o.x + d.x * ft, o.y + d.y * ft, o.z + d.z * ft);
    }
    t = nt;
    if (t > 2400) break;
  }
  return null;
}

function rayPlane(ray, y) {
  var d = ray.direction;
  if (Math.abs(d.y) < 1e-6) return null;
  var t = (y - ray.origin.y) / d.y;
  if (t < 0) return null;
  return new THREE.Vector3(ray.origin.x + d.x * t, y, ray.origin.z + d.z * t);
}

function groundPoint(ev) {
  var ray = rayFrom(ev);
  return rayTerrain(ray) || rayPlane(ray, cam.focusY) || null;
}


export { zoomT, autoPitch, updateCamera, moveFocus, raycaster, _ndc, rayFrom,
  rayTerrain, rayPlane, groundPoint };
