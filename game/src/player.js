// Movement: acceleration, friction, gravity, crouch and jump, resolved as a box
// against the world's colliders one axis at a time, so a wall never swallows a
// body. Bots move through the same helper with their own input.
import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.4;
const CROUCH_SPEED = 2.5;
const GROUND_ACCEL = 44;
const AIR_ACCEL = 10;
const FRICTION = 9.5;
const GRAVITY = 21;
const JUMP_SPEED = 6.4;

// One shared body integrator. `move` is a plain object {x, y, z, vx, vy, vz,
// height, eye, onGround, crouching}; `wish` is a unit xz direction (or 0,0);
// `wantJump` and `wantCrouch` are booleans. Reuses one probe box, allocates
// nothing per call.
export function makeMover(colliders) {
  const probe = new THREE.Box3();

  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (let i = 0; i < colliders.length; i += 1) {
      if (probe.intersectsBox(colliders[i])) return colliders[i];
    }
    return null;
  }

  function stepBody(move, wishX, wishZ, wantJump, wantCrouch, dt) {
    if (wantCrouch && !move.crouching) {
      move.crouching = true;
      move.height = CROUCH_HEIGHT;
    } else if (!wantCrouch && move.crouching && !overlaps(move.x, move.y, move.z, STAND_HEIGHT, 0.02)) {
      move.crouching = false;
      move.height = STAND_HEIGHT;
    }
    const eyeTarget = move.crouching ? CROUCH_EYE : STAND_EYE;
    move.eye += (eyeTarget - move.eye) * Math.min(1, dt * 12);

    const speed = move.crouching ? CROUCH_SPEED : WALK_SPEED;
    const blend = Math.min(1, (move.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
    move.vx += (wishX * speed - move.vx) * blend;
    move.vz += (wishZ * speed - move.vz) * blend;
    if (move.onGround && wishX === 0 && wishZ === 0) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      move.vx *= damp;
      move.vz *= damp;
    }

    if (wantJump && move.onGround) {
      move.vy = JUMP_SPEED;
      move.onGround = false;
    }
    move.vy -= GRAVITY * dt;

    const nextX = move.x + move.vx * dt;
    if (!overlaps(nextX, move.y, move.z, move.height, 0.04)) move.x = nextX;
    else move.vx = 0;
    const nextZ = move.z + move.vz * dt;
    if (!overlaps(move.x, move.y, nextZ, move.height, 0.04)) move.z = nextZ;
    else move.vz = 0;

    move.y += move.vy * dt;
    move.onGround = false;
    const hit = overlaps(move.x, move.y, move.z, move.height, 0);
    if (hit && move.vy <= 0) {
      move.y = hit.max.y;
      move.vy = 0;
      move.onGround = true;
    } else if (hit) {
      move.y = hit.min.y - move.height;
      move.vy = 0;
    }
    if (move.y < 0) {
      move.y = 0;
      move.vy = 0;
      move.onGround = true;
    }
    move.vy = Math.max(-30, move.vy);
  }

  return { stepBody, overlaps };
}

export function createPlayer(colliders) {
  const mover = makeMover(colliders);
  const move = {
    x: 0, y: 0, z: 19, vx: 0, vy: 0, vz: 0,
    height: STAND_HEIGHT, eye: STAND_EYE, onGround: true, crouching: false,
  };
  let yaw = 0;
  let pitch = 0;

  function look(dx, dy, sensitivity = 0.0021) {
    yaw -= dx * sensitivity;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    pitch = Math.min(1.45, pitch + pitchKick);
    yaw += yawKick;
  }

  function step(dt, keys) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let wishX = 0;
    let wishZ = 0;
    if (forward || strafe) {
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      wishX = -sin * forward + cos * strafe;
      wishZ = -cos * forward - sin * strafe;
      const len = Math.hypot(wishX, wishZ) || 1;
      wishX /= len;
      wishZ /= len;
    }
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    mover.stepBody(move, wishX, wishZ, keys.has('Space'), crouch, dt);
  }

  return {
    move,
    step,
    look,
    recoil,
    get yaw() { return yaw; },
    set yaw(v) { yaw = v; },
    get pitch() { return pitch; },
    set pitch(v) { pitch = v; },
    groundSpeed() {
      return Math.hypot(move.vx, move.vz);
    },
    eyePos(out) {
      out.set(move.x, move.y + move.eye, move.z);
      return out;
    },
    teleport(x, z, newYaw) {
      move.x = x;
      move.y = 0;
      move.z = z;
      move.vx = 0;
      move.vy = 0;
      move.vz = 0;
      yaw = newYaw;
      pitch = 0;
    },
  };
}
