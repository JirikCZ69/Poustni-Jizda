"""Pouštní jízda – herní server: servíruje hru a drží účty + žebříček.

Spuštění:  python server.py [port]        (výchozí port 8765)
Data:      data/leaderboard.json  (hesla jen jako PBKDF2 hash se solí, přihlašovací tokeny jen jako SHA-256 hash)

Bezpečnost (veřejný hosting):
  * ven jde jen index.html a js/*.js (whitelist) – data, zdroják serveru, TTS model ani nic jiného stáhnout nejde
  * limity na počet požadavků z jedné IP (registrace, přihlášení, API, hlas spolujezdce), velikost požadavků,
    počet současných spojení a timeout pomalých spojení
  * bezpečnostní hlavičky (CSP, nosniff, zákaz vkládání do cizích stránek)
  * za reverzní proxy (Caddy/nginx/Cloudflare) spusť s proměnnou PJ_TRUST_PROXY=1, ať se limity počítají podle IP hráče
  * hesla po síti chrání jen HTTPS → na veřejném internetu vždy přes HTTPS (proxy / hosting s certifikátem)
"""
import hashlib, hmac, json, os, re, secrets, sys, threading, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('PJ_DATA') or os.path.join(ROOT, 'data')
DB_PATH = os.path.join(DATA_DIR, 'leaderboard.json')
SAVE_DIR = os.path.join(DATA_DIR, 'saves')     # postup hry každého účtu (rally, drag, perky…)
TTS_DIR = os.path.join(DATA_DIR, 'tts')        # cache hlášení spolujezdce
import hfsync                                  # záloha dat do HF datasetu (jen na hostingu)
hfsync.restore(DATA_DIR)
SAVE_MAX = 600_000
MAX_USERS = 20_000
TTS_CACHE_MAX = 8_000                          # max souborů v cache hlasu (ať nikdo nezaplní disk)
TRUST_PROXY = os.environ.get('PJ_TRUST_PROXY') == '1'
# realistický mužský hlas spolujezdce: Piper (offline neuronový TTS) + český mužský hlas „jirka“
# soubory: tts/piper/piper.exe (nebo piper) a tts/cs_CZ-jirka-medium.onnx (+ .onnx.json)
PIPER_DIR = os.path.join(ROOT, 'tts')
TTS_LOCK = threading.Lock()
TTS_TEXT_RE = re.compile(r'^[\w\s.,!?…:;()%+\'"–-]{1,180}$', re.UNICODE)

# veřejné soubory – nic jiného server nevydá
JS_RE = re.compile(r'^/js/[a-z0-9_]{1,40}\.js$')
CTYPES = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8'}
CSP = ("default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://unpkg.com; "
       "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob: https://translate.google.com; font-src 'self' data:; "
       "connect-src 'self' https://*.peerjs.com wss://*.peerjs.com; object-src 'none'; base-uri 'none'; "
       "form-action 'self'; frame-ancestors 'self' https://huggingface.co")


def piper_paths():
    exe = None
    for n in ('piper.exe', 'piper'):
        c = os.path.join(PIPER_DIR, 'piper', n)
        if os.path.isfile(c):
            exe = c
    model = None
    if os.path.isdir(PIPER_DIR):
        for n in sorted(os.listdir(PIPER_DIR)):
            if n.startswith('cs_CZ') and n.endswith('.onnx'):
                model = os.path.join(PIPER_DIR, n)
    return (exe, model) if exe and model else (None, None)


NAME_RE = re.compile(r'^[\w ._-]{2,16}$', re.UNICODE)
RID_RE = re.compile(r'^[a-z0-9]{4,16}$')
ITER = 120_000
lock = threading.Lock()


# ---------- omezení počtu požadavků (token bucket podle klíče, typicky IP) ----------
class Limiter:
    def __init__(self, rate, burst):
        self.rate, self.burst, self.b, self.lk = rate, burst, {}, threading.Lock()

    def allow(self, key, cost=1.0):
        now = time.time()
        with self.lk:
            if len(self.b) > 50_000:     # úklid, ať slovník neroste do nekonečna
                self.b = {k: v for k, v in self.b.items() if now - v[1] < 3600}
            tok, t = self.b.get(key, (self.burst, now))
            tok = min(self.burst, tok + (now - t) * self.rate)
            if tok < cost:
                self.b[key] = (tok, now)
                return False
            self.b[key] = (tok - cost, now)
            return True

    def check(self, key):     # jsou ještě pokusy? (nic neodečte)
        now = time.time()
        with self.lk:
            tok, t = self.b.get(key, (self.burst, now))
            return min(self.burst, tok + (now - t) * self.rate) >= 1


LIM_HTTP = Limiter(40, 400)           # všechny požadavky z IP (načtení hry ~35 souborů)
LIM_API = Limiter(5, 60)              # API z IP
LIM_REG = Limiter(5 / 3600, 5)        # registrace: 5 za hodinu z IP
LIM_LOGIN_IP = Limiter(8 / 60, 8)     # neúspěšná přihlášení z IP
LIM_LOGIN_NAME = Limiter(20 / 600, 20)  # neúspěšná přihlášení na jeden účet (proti hádání z mnoha IP)
LIM_TTS = Limiter(3, 400)             # generování hlasu (nové hlášky) z IP – start etapy jich přednačte hodně
LIM_TTS_ALL = Limiter(6, 60)          # generování hlasu celkem
LIM_SAVE = Limiter(1, 10)             # ukládání postupu na účet
LIM_MP = Limiter(1 / 15, 4)           # výsledky multiplayeru na účet
run_seen = {}                         # (účet, id jízdy) -> čas prvního hlášení – kontrola nereálné vzdálenosti


def load():
    try:
        with open(DB_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'users': {}}


def save(db):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DB_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DB_PATH)


DB = load()


def save_path(u):
    return os.path.join(SAVE_DIR, hashlib.sha1(u['name'].lower().encode('utf-8')).hexdigest() + '.json')


def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), bytes.fromhex(salt), ITER).hex()


def tok_hash(tok):
    return 'h:' + hashlib.sha256(tok.encode('utf-8')).hexdigest()


def public(u):
    return {'name': u['name'], 'bestKm': round(u.get('bestKm', 0), 2), 'mpWins': u.get('mpWins', 0), 'mpGames': u.get('mpGames', 0),
            'runs': u.get('runs', 0)}


def by_token(tok):
    if not isinstance(tok, str) or not re.match(r'^[0-9a-f]{48}$', tok):
        return None
    th = tok_hash(tok)
    for u in DB['users'].values():
        for t in u.get('tokens', []):
            # tokeny se ukládají jen jako hash; staré (z dřívějška) v čisté podobě se při použití převedou
            if hmac.compare_digest(th, t):
                return u
            if not t.startswith('h:') and hmac.compare_digest(tok, t):
                u['tokens'] = [th if x == t else x for x in u['tokens']]
                save(DB)
                return u
    return None


def new_token(u):
    tok = secrets.token_hex(24)
    u['tokens'] = (u.get('tokens', []) + [tok_hash(tok)])[-8:]   # max 8 přihlášených zařízení
    return tok


class Handler(BaseHTTPRequestHandler):
    server_version = 'PJ'
    sys_version = ''
    timeout = 20                  # pomalá/visící spojení se zavřou
    protocol_version = 'HTTP/1.0'

    def log_message(self, fmt, *args):
        if '/api/' in (self.path or ''):
            return
        super().log_message(fmt, *args)

    def ip(self):
        if TRUST_PROXY:
            xf = self.headers.get('X-Forwarded-For', '')
            if xf:
                return xf.split(',')[-1].strip()[:64]
        return self.client_address[0]

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        # krátká chyba bez detailů o serveru
        body = (str(code)).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    # ---------- statické soubory: jen whitelist ----------
    def static_file(self, head):
        p = self.path.split('?', 1)[0].split('#', 1)[0]
        if p in ('/', '/index.html'):
            rel = 'index.html'
        elif JS_RE.match(p):
            rel = p[1:]
        else:
            return self.send_error(404)
        fn = os.path.join(ROOT, *rel.split('/'))
        try:
            with open(fn, 'rb') as f:
                data = f.read()
        except OSError:
            return self.send_error(404)
        self.send_response(200)
        self.send_header('Content-Type', CTYPES[os.path.splitext(fn)[1]])
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def do_GET(self):
        if not LIM_HTTP.allow(self.ip()):
            return self.send_error(429)
        p = self.path.split('?', 1)[0]
        if p == '/api/leaderboard':
            if not LIM_API.allow(self.ip()):
                return self.reply(429, {'error': 'Moc požadavků, zpomal'})
            return self.leaderboard()
        if p == '/api/tts':
            return self.tts()
        if p.startswith('/api/'):
            return self.send_error(404)
        return self.static_file(False)

    def do_HEAD(self):
        if not LIM_HTTP.allow(self.ip()):
            return self.send_error(429)
        return self.static_file(True)

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def leaderboard(self):
        with lock:
            us = [public(u) for u in DB['users'].values()]
            rally = {}
            for u in DB['users'].values():
                for sid, r in (u.get('rally') or {}).items():
                    rally.setdefault(sid, []).append({'name': u['name'], 't': r['t'], 'crew': r.get('crew', '')})
        dist = sorted([u for u in us if u['bestKm'] > 0], key=lambda u: -u['bestKm'])[:50]
        wins = sorted([u for u in us if u['mpGames'] > 0], key=lambda u: (-u['mpWins'], u['mpGames']))[:50]
        for sid in rally:
            rally[sid] = sorted(rally[sid], key=lambda r: r['t'])[:30]
        self.reply(200, {'dist': dist, 'wins': wins, 'rally': rally, 'players': len(us)})

    def do_POST(self):
        ip = self.ip()
        if not LIM_HTTP.allow(ip) or not LIM_API.allow(ip):
            return self.reply(429, {'error': 'Moc požadavků, zpomal'})
        p = self.path.split('?', 1)[0]
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if n < 0:
                raise ValueError
            if n > (SAVE_MAX + 2000 if p == '/api/save' else 4096):
                return self.reply(413, {'error': 'Moc dat'})
            d = json.loads(self.rfile.read(n) or b'{}')
            if not isinstance(d, dict):
                raise ValueError
        except (ValueError, OSError):
            return self.reply(400, {'error': 'Špatný požadavek'})
        with lock:
            if p == '/api/register':
                return self.register(d, ip)
            if p == '/api/login':
                return self.login(d, ip)
            u = by_token(d.get('token'))
            if not u:
                return self.reply(401, {'error': 'Nejsi přihlášený – přihlas se znovu'})
            if p == '/api/me':
                return self.reply(200, public(u))
            if p == '/api/save':     # uložení postupu hry k účtu
                if not LIM_SAVE.allow(u['name'].lower()):
                    return self.reply(429, {'error': 'Ukládáš moc často'})
                data = d.get('data')
                if not isinstance(data, dict):
                    return self.reply(400, {'error': 'Špatná data'})
                raw = json.dumps(data, ensure_ascii=False)
                if len(raw) > SAVE_MAX:
                    return self.reply(413, {'error': 'Moc velký save'})
                os.makedirs(SAVE_DIR, exist_ok=True)
                tmp = save_path(u) + '.tmp'
                with open(tmp, 'w', encoding='utf-8') as f:
                    f.write(raw)
                os.replace(tmp, save_path(u))
                return self.reply(200, {'ok': True, 't': data.get('t', 0)})
            if p == '/api/load':     # načtení postupu (jiný počítač, nový prohlížeč)
                try:
                    with open(save_path(u), encoding='utf-8') as f:
                        return self.reply(200, {'data': json.load(f)})
                except (OSError, ValueError):
                    return self.reply(200, {'data': None})
            if p == '/api/logout':
                tok = d.get('token')
                th = tok_hash(tok)
                u['tokens'] = [t for t in u.get('tokens', []) if t != th and t != tok]
                save(DB)
                return self.reply(200, {'ok': True})
            if p == '/api/run':      # dojetá vzdálenost (průběžně i po smrti)
                return self.run(u, d)
            if p == '/api/mp':       # výsledek multiplayeru
                if not LIM_MP.allow(u['name'].lower()):
                    return self.reply(429, {'error': 'Moc výsledků za sebou'})
                u['mpGames'] = u.get('mpGames', 0) + 1
                if d.get('win') is True:
                    u['mpWins'] = u.get('mpWins', 0) + 1
                save(DB)
                return self.reply(200, public(u))
            if p == '/api/rally':    # čas rally etapy (ukládá se nejlepší na etapu)
                sid = str(d.get('stage', ''))[:24]
                try:
                    t = float(d.get('time', 0))
                except (TypeError, ValueError):
                    return self.reply(400, {'error': 'time'})
                if not re.match(r'^[a-z0-9_-]{1,24}$', sid) or not (20.0 <= t <= 7200.0):
                    return self.reply(400, {'error': 'Neplatný čas'})
                rl = u.setdefault('rally', {})
                if sid not in rl and len(rl) >= 64:
                    return self.reply(400, {'error': 'Neplatná etapa'})
                crew = re.sub(r'[<>&"\'`\\]', '', str(d.get('crew', '')))[:40]
                old = rl.get(sid)
                rec = old is None or t < old['t']
                if rec:
                    rl[sid] = {'t': round(t, 3), 'crew': crew}
                    save(DB)
                return self.reply(200, {'record': rec, **public(u)})
        return self.reply(404, {'error': 'Neznámá akce'})

    def run(self, u, d):
        try:
            km = float(d.get('km', 0))
        except (TypeError, ValueError):
            return self.reply(400, {'error': 'km'})
        if km != km:   # NaN
            km = 0.0
        km = max(0.0, min(km, 100000.0))
        rid = d.get('rid')
        changed = False
        now = time.time()
        if isinstance(rid, str) and RID_RE.match(rid):
            key = (u['name'].lower(), rid)
            if len(run_seen) > 20_000:
                for k in [k for k, t in run_seen.items() if now - t > 6 * 3600]:
                    del run_seen[k]
            t0 = run_seen.setdefault(key, now)
            # rozumná horní mez: první hlášení max 3 km, dál nejvýš ~430 km/h (podvržená čísla neprojdou)
            km = min(km, 3.0 + (now - t0) * 0.12)
            if u.get('lastRid') != rid:      # jízda se započítá hned při prvním hlášení (ne až po smrti)
                u['lastRid'] = rid
                u['runs'] = u.get('runs', 0) + 1
                changed = True
        else:
            km = min(km, 3.0)
            if d.get('final'):
                u['runs'] = u.get('runs', 0) + 1
                changed = True
        rec = km > u.get('bestKm', 0)
        if rec:
            u['bestKm'] = km
        if rec or changed:
            save(DB)
        return self.reply(200, {'record': rec, **public(u)})

    # hlášení spolujezdce česky: Piper (offline) nebo jednou z Google překladače, pak z cache
    def tts(self):
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('q', [''])[0].strip()[:180]
        if not q or not TTS_TEXT_RE.match(q):
            return self.send_error(400)
        os.makedirs(TTS_DIR, exist_ok=True)
        key = hashlib.sha1(q.encode('utf-8')).hexdigest()
        exe, model = piper_paths()
        fn_p = os.path.join(TTS_DIR, 'p3_' + key + '.wav')
        fn_g = os.path.join(TTS_DIR, key + '.mp3')
        if exe and os.path.exists(fn_p):
            return self.send_audio(fn_p, 'audio/wav', 'male')
        if not exe and os.path.exists(fn_g):
            return self.send_audio(fn_g, 'audio/mpeg', 'female')
        # nová hláška → generování stojí výkon/síť, proto limit a strop velikosti cache
        if not LIM_TTS.allow(self.ip()) or not LIM_TTS_ALL.allow('all'):
            return self.send_error(429)
        try:
            if len(os.listdir(TTS_DIR)) >= TTS_CACHE_MAX:
                return self.send_error(503)
        except OSError:
            return self.send_error(503)
        if exe:     # 1) Piper – skutečný mužský hlas, bez přelaďování
            fn = fn_p
            import subprocess
            try:
                with TTS_LOCK:
                    if not os.path.exists(fn):
                        subprocess.run([exe, '--model', model, '--output_file', fn + '.tmp', '--length_scale', '1.0', '--noise_scale', '0.5', '--noise_w', '0.6', '--sentence_silence', '0.18'],
                                       input=q.encode('utf-8'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=True)
                        os.replace(fn + '.tmp', fn)
            except Exception:
                fn = None
            if fn:
                return self.send_audio(fn, 'audio/wav', 'male')
        fn = fn_g
        if not os.path.exists(fn):
            url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=cs&client=tw-ob&q=' + urllib.parse.quote(q)
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=6) as r:
                    data = r.read(400_000)
                if len(data) < 500:
                    raise ValueError('není mp3')
                with open(fn + '.tmp', 'wb') as f:
                    f.write(data)
                os.replace(fn + '.tmp', fn)
            except Exception:
                return self.send_error(502)
        return self.send_audio(fn, 'audio/mpeg', 'female')

    def send_audio(self, fn, ctype, voice):
        try:
            with open(fn, 'rb') as f:
                data = f.read()
        except OSError:
            return self.send_error(404)
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('X-Voice', voice)
        self.send_header('Access-Control-Expose-Headers', 'X-Voice')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def register(self, d, ip):
        name, pw = str(d.get('name', '')).strip(), str(d.get('pass', ''))
        if not NAME_RE.match(name):
            return self.reply(400, {'error': 'Jméno: 2–16 znaků (písmena, čísla, mezera, _ - .)'})
        if len(pw) < 6 or len(pw) > 64:
            return self.reply(400, {'error': 'Heslo musí mít 6–64 znaků'})
        key = name.lower()
        if key in DB['users']:
            return self.reply(409, {'error': 'Tohle jméno už někdo má'})
        if len(DB['users']) >= MAX_USERS:
            return self.reply(503, {'error': 'Registrace jsou teď plné'})
        if not LIM_REG.allow(ip):
            return self.reply(429, {'error': 'Moc registrací – zkus to později'})
        salt = secrets.token_hex(16)
        u = {'name': name, 'salt': salt, 'hash': hash_pw(pw, salt), 'created': int(time.time()), 'bestKm': 0, 'mpWins': 0, 'mpGames': 0, 'runs': 0}
        tok = new_token(u)
        DB['users'][key] = u
        save(DB)
        self.reply(200, {'token': tok, **public(u)})

    def login(self, d, ip):
        name, pw = str(d.get('name', '')).strip()[:32], str(d.get('pass', ''))[:128]
        key = name.lower()
        # jen zkontrolovat, jestli jsou ještě pokusy (bez odečtu); odečítá se až při chybě
        if not LIM_LOGIN_IP.check(ip) or not LIM_LOGIN_NAME.check(key):
            return self.reply(429, {'error': 'Moc pokusů – zkus to za minutu'})
        u = DB['users'].get(key)
        if not u or not hmac.compare_digest(hash_pw(pw, u['salt']), u['hash']):
            LIM_LOGIN_IP.allow(ip)
            LIM_LOGIN_NAME.allow(key)
            return self.reply(401, {'error': 'Špatné jméno nebo heslo'})
        tok = new_token(u)
        save(DB)
        self.reply(200, {'token': tok, **public(u)})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64
    slots = threading.BoundedSemaphore(128)    # max současných spojení – zbytek se rovnou zavře

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def handle_error(self, request, client_address):
        pass    # odpojení klientů apod. nevypisovat celé tracebacky


if __name__ == '__main__':
    for st in (sys.stdout, sys.stderr):   # konzole na Windows neumí češtinu → nespadnout
        try:
            st.reconfigure(errors='replace')
        except (AttributeError, ValueError):
            pass
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or 8765)   # hosting (Railway…) dává port v PORT
    srv = Server(('0.0.0.0', port), Handler)
    hfsync.start()
    print(f'Pouštní jízda běží na http://localhost:{port}  (z jiného PC: http://<IP tohoto PC>:{port})')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
