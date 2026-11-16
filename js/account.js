// account.js – účet (jméno + heslo), žebříček a postup hry uložený na serveru (přihlásíš se odkudkoli a máš svůj progres)
const SYNC_KEYS = ['pj_rally', 'pj_drag', 'pj_dragsb', 'pj_xp', 'pj_perks', 'pj_best', 'pj_cars', 'pj_air'];
const Account = {
  token: null, name: null, me: null, sentKm: 0, sentT: 0, recShown: false,
  init() {
    // každá změna postupu se po chvilce pošle na server
    const set0 = U.store.set;
    U.store.set = (k, v) => { set0.call(U.store, k, v); if (SYNC_KEYS.includes(k)) this.dirty(); };
    addEventListener('pagehide', () => this.flushSave());
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flushSave(); });
    const s = U.store.get('pj_acct', null);
    if (s && s.token) { this.token = s.token; this.name = s.name; this.api('/api/me', {}).then(u => { this.me = u; this.renderBar(); this.pullSave(false); }).catch(e => { if (e.status === 401) this.clear(); }); }
    this.renderBar();
    $('acctBox').addEventListener('click', (e) => this.click(e));
    $('acctBox').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.submit('login'); } e.stopPropagation(); });
    $('board').addEventListener('click', (e) => { if (e.target.id === 'board' || e.target.dataset.bd === 'close') $('board').style.display = 'none'; else if (e.target.dataset.bd === 'reload') this.openBoard(); else if (e.target.dataset.bd && e.target.dataset.bd.startsWith('rs:')) { this.rsTab = +e.target.dataset.bd.slice(3); this.renderRally(); } });
    $('nickWrap').addEventListener('click', (e) => {
      const a = e.target.dataset.ac;
      if (a === 'open') this.openForm();
      else if (a === 'logout') this.logout();
      else if (a === 'board') this.openBoard();
    });
  },
  async api(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ token: this.token }, body)) } : {});
    let d = null; try { d = await r.json(); } catch (e) { /* není JSON = server bez API */ }
    if (!r.ok || !d) { const err = new Error((d && d.error) || 'Server žebříčku neběží – spusť hru přes „python server.py“'); err.status = r.status; throw err; }
    return d;
  },
  esc(t) { return String(t).replace(/[<>&"]/g, ''); },
  // ---------- postup hry na serveru ----------
  syncInfo() { try { return JSON.parse(localStorage.getItem('pj_sync') || 'null'); } catch (e) { return null; } },
  dirty() {
    if (!this.token || !this.name || this._applying) return;
    try { localStorage.setItem('pj_sync', JSON.stringify({ user: this.name.toLowerCase(), t: Date.now() })); } catch (e) { /* nic */ }
    this._pending = true; clearTimeout(this._svT); this._svT = setTimeout(() => this.pushSave(), 2500);
  },
  pack() {
    const keys = {};
    for (const k of SYNC_KEYS) { const v = localStorage.getItem(k); if (v !== null) keys[k] = v; }
    return { t: (this.syncInfo() || {}).t || Date.now(), keys };
  },
  async pushSave() {
    if (!this.token) return;
    clearTimeout(this._svT);
    try { await this.api('/api/save', { data: this.pack() }); this._pending = false; this.savedAt = Date.now(); this.renderBar(); } catch (e) { /* server bez API – zkusíme příště */ }
  },
  flushSave() {
    if (!this.token || !this._pending || !navigator.sendBeacon) return;
    try { navigator.sendBeacon('/api/save', new Blob([JSON.stringify({ token: this.token, data: this.pack() })], { type: 'text/plain' })); this._pending = false; } catch (e) { /* nic */ }
  },
  async pullSave(fromLogin) {
    if (!this.token || !this.name) return;
    let srv = null;
    try { srv = (await this.api('/api/load', {})).data; } catch (e) { return; }
    const me = this.name.toLowerCase(), loc = this.syncInfo(), mine = loc && loc.user === me;
    if (srv && srv.keys && (!mine || (srv.t || 0) > (loc.t || 0))) {
      // na serveru je novější postup (nebo jsi na jiném počítači) → načíst
      let changed = false;
      this._applying = true;
      for (const k of SYNC_KEYS) { const v = srv.keys[k]; if (typeof v === 'string' && localStorage.getItem(k) !== v) { localStorage.setItem(k, v); changed = true; } }
      localStorage.setItem('pj_sync', JSON.stringify({ user: me, t: srv.t || Date.now() }));
      this._applying = false;
      if (changed && !sessionStorage.getItem('pj_synced')) {
        sessionStorage.setItem('pj_synced', '1');
        const note = document.createElement('div'); note.textContent = '☁ Načítám tvůj uložený postup…';
        note.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:9999;background:rgba(14,12,10,.92);color:#ffcf86;padding:16px 26px;border-radius:12px;font:bold 20px Arial;border:2px solid #ffb347';
        document.body.appendChild(note);
        setTimeout(() => location.reload(), 900);
      }
    } else if (!srv || (mine && (loc.t || 0) > (srv.t || 0))) {
      // server nic nemá (nový účet si vezme dosavadní postup) nebo je tady novější → nahrát
      if (!mine) localStorage.setItem('pj_sync', JSON.stringify({ user: me, t: Date.now() }));
      this.pushSave();
    }
  },
  clear() { this.token = null; this.name = null; this.me = null; U.store.set('pj_acct', null); this.renderBar(); },
  set(d) { this.token = d.token; this.name = d.name; this.me = d; U.store.set('pj_acct', { token: d.token, name: d.name }); this.renderBar(); sessionStorage.removeItem('pj_synced'); this.pullSave(true); },
  renderBar() {
    const w = $('nickWrap'); if (!w) return;
    if (this.name) {
      const m = this.me;
      w.innerHTML = `<div class="acBar">👤 <b>${this.esc(this.name)}</b>${m ? `<span>rekord ${m.bestKm.toFixed(2)} km · MP výhry ${m.mpWins}/${m.mpGames}</span>` : ''}<span title="Postup hry se ukládá k tvému účtu">${this.savedAt ? '☁ uloženo' : '☁'}</span><button data-ac="logout" class="ghost">Odhlásit</button></div>`;
    } else {
      w.innerHTML = `Hraješ jako host: <input id="nick" maxlength="16" placeholder="Řidič" autocomplete="off"> <button data-ac="open">🔑 Přihlásit / registrovat</button>
        <div class="acHint">Jako host se tvoje výsledky do žebříčku nezapisují.</div>`;
      $('nick').value = U.store.get('pj_nick', '');
      $('nick').oninput = () => U.store.set('pj_nick', $('nick').value.trim().slice(0, 16));
    }
  },
  openForm(err) {
    $('acctBox').innerHTML = `<h2>🔑 Účet hráče</h2>
      <p style="opacity:.85;margin-top:0">Pod svým jménem se zapisuješ do žebříčku – kdo dojel nejdál a kdo má nejvíc výher v multiplayeru.</p>
      <div class="acForm"><label>Jméno<input id="acName" maxlength="16" autocomplete="username" value="${this.esc(U.store.get('pj_nick', ''))}"></label>
      <label>Heslo<input id="acPass" type="password" maxlength="64" autocomplete="current-password"></label></div>
      <div id="acErr">${err ? this.esc(err) : ''}</div>
      <div><button class="btn" data-acf="login">Přihlásit</button><button class="btn alt" data-acf="register">Nový účet</button><button class="btn alt" data-acf="close">Zavřít</button></div>
      <p style="opacity:.6;font-size:12px">Heslo se ukládá jen jako hash na serveru, na kterém hra běží. Nepoužívej heslo, které máš jinde.</p>`;
    $('acct').style.display = 'flex';
    setTimeout(() => $('acName').focus(), 30);
  },
  click(e) {
    const a = e.target.dataset.acf; if (!a) { if (e.target.id === 'acct') $('acct').style.display = 'none'; return; }
    if (a === 'close') $('acct').style.display = 'none'; else this.submit(a);
  },
  async submit(kind) {
    const name = $('acName').value.trim(), pass = $('acPass').value;
    if (!name || !pass) { $('acErr').textContent = 'Vyplň jméno i heslo'; return; }
    $('acErr').textContent = '…';
    try {
      const d = await this.api(kind === 'register' ? '/api/register' : '/api/login', { name, pass, token: undefined });
      this.set(d); $('acct').style.display = 'none'; Sfx.coin && Sfx.coin();
      Game.msg && Game.msg(kind === 'register' ? `Účet ${d.name} vytvořen – vítej v žebříčku!` : `Přihlášen jako ${d.name}`, 'good');
    } catch (err) { $('acErr').textContent = err.message; }
  },
  async logout() { if (this._pending) await this.pushSave(); try { await this.api('/api/logout', {}); } catch (e) { /* nevadí */ } this.clear(); },

  // ---------- zápis výsledků ----------
  newRun() { this.sentKm = 0; this.sentT = 0; this.recShown = false; this.rid = Math.random().toString(36).slice(2, 12); },   // rid = id jízdy → server ji započítá jednou, hned při prvním hlášení
  tick(km) {   // volá se ze hry; posílá průběžně, ať se rekord neztratí ani při zavření okna
    if (!this.token) return;
    const now = performance.now();
    if (km - this.sentKm >= 0.2 && now - this.sentT > 8000) { this.sentT = now; this.run(km, false); }
  },
  run(km, final) {
    if (!this.token) return;
    this.sentKm = Math.max(this.sentKm, km);
    const prev = this.me ? this.me.bestKm : 0;
    this.api('/api/run', { km, final: !!final, rid: this.rid || (this.rid = Math.random().toString(36).slice(2, 12)) }).then(d => {
      this.me = d;
      if (d.record && !this.recShown && prev > 0) { this.recShown = true; Game.msg(`🏆 Nový osobní rekord v žebříčku: ${km.toFixed(2)} km!`, 'good'); }
    }).catch(() => {});
  },
  // nejlepší čas rally etapy (server si nechá jen lepší)
  rally(stage, time, crew) {
    if (!this.token) return Promise.resolve(null);
    return this.api('/api/rally', { stage, time, crew }).then(d => { this.me = d; return d; }).catch(() => null);
  },
  async rallyBoard() { try { const d = await this.api('/api/leaderboard'); return d.rally || {}; } catch (e) { return null; } },
  mp(win) {
    if (!this.token) return;
    this.api('/api/mp', { win: !!win }).then(d => { this.me = d; }).catch(() => {});
  },

  // ---------- žebříček ----------
  async openBoard() {
    $('boardBox').innerHTML = '<h2>🏆 Žebříček</h2><p>Načítám…</p>';
    $('board').style.display = 'flex';
    let d;
    try { d = await this.api('/api/leaderboard'); } catch (err) {
      $('boardBox').innerHTML = `<h2>🏆 Žebříček</h2><p>${this.esc(err.message)}</p><button class="btn alt" data-bd="close">Zavřít</button>`; return;
    }
    const me = (this.name || '').toLowerCase(), medal = (i) => ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
    const table = (rows, cols, cell) => rows.length
      ? `<table class="bdT"><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${rows.map((u, i) => `<tr class="${u.name.toLowerCase() === me ? 'me' : ''}"><td>${medal(i)}</td><td>${this.esc(u.name)}</td>${cell(u)}</tr>`).join('')}</table>`
      : '<p style="opacity:.7">Zatím nikdo. Buď první!</p>';
    $('boardBox').innerHTML = `<h2>🏆 Žebříček</h2><div style="opacity:.75;margin:-6px 0 10px">${d.players} registrovaných hráčů</div>
      <div class="bdCols"><div><h3>🏜 Kdo dojel nejdál</h3>${table(d.dist, ['#', 'Hráč', 'Rekord', 'Jízd'], u => `<td><b>${u.bestKm.toFixed(2)} km</b></td><td>${u.runs}</td>`)}</div>
      <div><h3>👥 Nejvíc výher v multiplayeru</h3>${table(d.wins, ['#', 'Hráč', 'Výhry', 'Zápasů'], u => `<td><b>${u.mpWins}</b></td><td>${u.mpGames}</td>`)}</div></div>
      <h3 style="margin-top:14px">🗺 Rally – nejlepší časy etap</h3><div id="bdRally"></div>
      ${this.name ? '' : '<p style="opacity:.8">Přihlas se v menu a tvoje jízdy se začnou zapisovat.</p>'}
      <div><button class="btn alt" data-bd="reload">↻ Obnovit</button><button class="btn" data-bd="close">Zavřít</button></div>`;
    this.bdRally = d.rally || {}; this.renderRally();
  },
  renderRally() {
    const el = $('bdRally'); if (!el || typeof RALLY_STAGES === 'undefined') return;
    const ids = Object.keys(this.bdRally || {}).filter(k => /^r\d+$/.test(k)).map(k => +k.slice(1) - 1), mine = typeof Rally !== 'undefined' && Rally.sv ? Rally.sv.stage || 0 : 0, top = Math.max(mine, ...ids, 0), tabsN = Array.from({ length: Math.min(top + 1, 40) }, (_, k) => k);
    const i = Math.min(this.rsTab || 0, top), st = RALLY_STAGES[i], rows = this.bdRally[st.id] || [], me = (this.name || '').toLowerCase();
    const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
    el.innerHTML = '<div class="bdTabs">' + tabsN.map(k => `<button data-bd="rs:${k}" class="${k === i ? 'on' : ''}">${RALLY_STAGES[k].name}</button>`).join('') + '</div>' +
      (rows.length ? `<table class="bdT"><tr><th>#</th><th>Hráč</th><th>Čas</th><th>Posádka</th></tr>${rows.map((r, k) => `<tr class="${r.name.toLowerCase() === me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][k] || k + 1 + '.'}</td><td>${this.esc(r.name)}</td><td><b>${fmt(r.t)}</b></td><td style="opacity:.8">${this.esc(r.crew || '')}</td></tr>`).join('')}</table>` : '<p style="opacity:.7">Na této etapě zatím nikdo nezajel čas. Buď první!</p>');
  },
};
