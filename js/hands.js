// hands.js – ruce v první osobě: držení věcí, úchop zbraní, ruce na volantu, řazení a ruční brzda
const Hands = (() => {
  const skin = U.mat(0xc68a5e), sleeve = U.mat(0x4a5a6a), cuff = U.mat(0x3a4652);
  const V = THREE.Vector3;
  // ruka: prsty míří do -z, dlaň dolů; side = 1 levá, -1 pravá; withArm = rukáv dozadu (+z)
  function hand(side, withArm, grip) {
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, m, rx, ry, rz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); g.add(o); return o; };
    const curl = grip ? 1.3 : 0.5;
    box(0.085, 0.03, 0.09, 0, 0, 0, skin);
    for (let i = 0; i < 4; i++) {
      const x = (-0.03 + i * 0.02) * side, len = [0.055, 0.065, 0.062, 0.05][i];
      const f = new THREE.Group(); f.position.set(x, 0, -0.045); f.rotation.x = -curl; g.add(f);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, len), skin); s.position.z = -len / 2; f.add(s);
    }
    box(0.022, 0.022, 0.055, side * 0.048, -0.008, -0.02, skin, 0, side * 0.7, 0);
    if (withArm) { box(0.078, 0.07, 0.07, 0, 0.004, 0.075, cuff); box(0.085, 0.08, 0.38, 0, 0.004, 0.28, sleeve); }
    return g;
  }
  // úchopy zbraní v souřadnicích modelu zbraně: [x,y,z, náklon] pro pravou a levou ruku
  const GRIPS = {
    knife: { R: [0, -0.01, 0.035] }, boxer: { R: [0, 0.0, 0.04] }, machete: { R: [0, -0.005, 0.05] },
    bat: { R: [0, 0, 0.05], L: [0, 0, -0.06] }, pistol: { R: [0, -0.05, 0.03], L: [0.02, -0.07, 0.035] },
    shotgun: { R: [0, -0.02, 0.14], L: [0, -0.03, -0.26] }, sniper: { R: [0, -0.04, 0.12], L: [0, -0.03, -0.3] },
    smg: { R: [0, -0.06, 0.07], L: [0, -0.04, -0.22] },
  };
  function attachToWeapon(model, id) {
    const g = GRIPS[id]; if (!g) return;
    const r = hand(-1, true, true); r.position.set(...g.R); r.rotation.set(-0.35, 0.15, -1.25); model.add(r);
    if (g.L) { const l = hand(1, true, true); l.position.set(...g.L); l.rotation.set(-0.2, -0.45, 1.3); model.add(l); }
  }
  // ruce držící věc (přidané k "holderu" hráče)
  function holder(h) {
    const l = hand(1, true, true), r = hand(-1, true, true);
    l.position.set(-0.19, -0.04, 0.02); l.rotation.set(-0.2, -0.35, 1.4);
    r.position.set(0.19, -0.04, 0.02); r.rotation.set(-0.2, 0.35, -1.4);
    h.add(l); h.add(r);
    return [l, r];
  }

  // ---------- ruce za volantem ----------
  function carRig(parts) {
    const rig = new THREE.Group(); parts.root.add(rig);
    const L = hand(1, false, true), R = hand(-1, false, true);
    rig.add(L); rig.add(R);
    const seg = () => { const g = new THREE.BoxGeometry(0.085, 0.08, 1); g.translate(0, 0, 0.5); const m = new THREE.Mesh(g, sleeve); rig.add(m); return m; };
    // tělo řidiče (trup, boky, nohy na pedálech) – ruce už nekončí ve vzduchu
    const pants = U.mat(0x2e3a4e), shoe = U.mat(0x2a2018), belt = U.mat(0x3a2a1a);
    const part = (w, h, d, x, y, z, m, rx) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; rig.add(o); return o; };
    part(0.44, 0.46, 0.2, 0.38, 0.85, -0.38, sleeve);                       // trup
    part(0.46, 0.1, 0.22, 0.38, 1.05, -0.39, sleeve);                       // ramena
    for (const sx of [0.16, 0.6]) part(0.12, 0.12, 0.14, sx, 1.03, -0.38, sleeve);
    part(0.42, 0.05, 0.21, 0.38, 0.63, -0.37, belt);                        // pásek
    part(0.42, 0.14, 0.3, 0.38, 0.66, -0.4, pants);                         // boky na sedadle
    for (const lx of [0.28, 0.49]) {
      part(0.15, 0.14, 0.46, lx, 0.66, -0.12, pants, 0.05);                 // stehno
      part(0.13, 0.32, 0.13, lx, 0.53, 0.21, pants, -0.89);                 // lýtko
      part(0.12, 0.09, 0.25, lx, 0.4, 0.38, shoe, -0.25);                   // bota na pedálu
    }
    const st = { rig, L, R, la: seg(), lf: seg(), ra: seg(), rf: seg(), shift: 0, hb: 0, rad: 0 };
    rig.visible = false;
    return st;
  }
  const RADIO_PT = new V(-0.46, 0.86, 0.38), tmpA = new V(), tmpB = new V(), Z = new V(0, 0, 1), NZ = new V(0, 0, -1);
  function place(m, a, b) { tmpA.subVectors(b, a); const len = tmpA.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(Z, tmpA.normalize()); m.scale.set(1, 1, len); }
  function arm(st, side, shoulder, target, upper, fore, handG, dt) {
    const elbow = new V().lerpVectors(shoulder, target, 0.5); elbow.y -= 0.12; elbow.x += side * 0.07;
    place(upper, shoulder, elbow); place(fore, elbow, target);
    handG.position.copy(target);
    tmpB.subVectors(target, elbow).normalize();
    handG.quaternion.setFromUnitVectors(NZ, tmpB);
  }
  function updateCar(st, car, driving, dt) {
    st.rig.visible = driving;
    if (!driving) return;
    const p = car.parts;
    p.wheelGrp.updateMatrix(); p.gearStick.updateMatrix(); p.hbLever.updateMatrix();
    const wl = new V(0.14, 0.075, 0.02).applyMatrix4(p.wheelGrp.matrix), wr = new V(-0.14, 0.075, 0.02).applyMatrix4(p.wheelGrp.matrix);
    const gk = new V(0, 0.24, 0).applyMatrix4(p.gearStick.matrix), hk = new V(0, 0.03, 0.24).applyMatrix4(p.hbLever.matrix);
    st.shift += U.clamp((car.shiftAnim > 0 ? 1 : 0) - st.shift, -dt * 7, dt * 7);
    st.hb += U.clamp((car.handbrake && car.speed > 0.3 ? 1 : 0) - st.hb, -dt * 6, dt * 6);
    st.rad += U.clamp((car.radioAnim > 0 ? 1 : 0) - st.rad, -dt * 6, dt * 6);
    if (car.radioAnim > 0) car.radioAnim -= dt;
    const rt = wr.clone().lerp(gk, st.shift).lerp(hk, st.hb).lerp(RADIO_PT, st.rad);
    arm(st, 1, new V(0.62, 1.04, -0.38), wl, st.la, st.lf, st.L, dt);
    arm(st, -1, new V(0.14, 1.04, -0.38), rt, st.ra, st.rf, st.R, dt);
  }
  return { hand, attachToWeapon, holder, carRig, updateCar };
})();
