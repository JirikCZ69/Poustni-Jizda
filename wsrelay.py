"""Záložní přenos pro multiplayer přes WebSocket na našem serveru.

Když se prohlížeče nespojí napřímo (WebRTC – mobilní data, CGNAT, přísné routery), hra pošle data přes server.
Místnost = 4místný kód lobby. Hostitel drží jedno spojení, každý připojený hráč svoje; server jen přeposílá:
  hostitel ← {"t":"j","c":id} připojil se hráč, {"t":"l","c":id} odešel, {"t":"m","c":id,"d":…} zpráva od hráče
  hostitel → {"c":id,"d":…} zpráva hráči, {"t":"k","c":id} vyhodit hráče
  hráč     ← {"t":"o"} spojeno s hostitelem, {"d":…} zpráva od hostitele, {"t":"x"} lobby neexistuje / je plné
  hráč     → {"d":…}
Obě strany posílají {"t":"p"} (ping) každých ~15 s.
Ochrana: max místností, max hráčů v místnosti, max velikost rámce, limit zpráv za sekundu, žádné cizí opcody.
"""
import base64, hashlib, json, re, socket, struct, threading, time

GUID = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
ROOM_RE = re.compile(r'^\d{4}$')
MAX_ROOMS = 200
MAX_PER_ROOM = 3            # hráči kromě hostitele (celkem 4)
MAX_CONNS = 70              # všech WS spojení dohromady (každé drží vlákno)
MAX_FRAME = 64 * 1024
MSG_RATE, MSG_BURST = 400, 1500  # zprávy za sekundu na spojení (hostitel posílá za 3 hráče i přeposílá ~300/s)
IDLE = 45                   # s bez jakékoli zprávy → konec

_lock = threading.Lock()
_rooms = {}                 # kód → {'host': WS, 'peers': {id: WS}}
_count = [0]
_next = [1]


class Closed(Exception):
    pass


class WS:
    def __init__(self, sock):
        self.sock, self.wlock, self.alive = sock, threading.Lock(), True
        self.tok, self.tt = MSG_BURST, time.monotonic()

    def _read(self, n):
        b = b''
        while len(b) < n:
            ch = self.sock.recv(n - len(b))
            if not ch:
                raise Closed()
            b += ch
        return b

    def recv(self):
        """Vrátí text další zprávy (ping/pong vyřídí sám)."""
        while True:
            h = self._read(2)
            fin, op, masked, ln = h[0] & 0x80, h[0] & 0x0F, h[1] & 0x80, h[1] & 0x7F
            if ln == 126:
                ln = struct.unpack('>H', self._read(2))[0]
            elif ln == 127:
                ln = struct.unpack('>Q', self._read(8))[0]
            if not masked or ln > MAX_FRAME or not fin:
                raise Closed()          # klient musí maskovat; fragmentaci nepotřebujeme
            mask = self._read(4)
            data = bytearray(self._read(ln))
            for i in range(ln):
                data[i] ^= mask[i & 3]
            if op == 8:
                raise Closed()
            if op == 9:
                self.send_raw(10, bytes(data))
                continue
            if op == 10:
                continue
            if op != 1:
                raise Closed()
            now = time.monotonic()
            self.tok = min(MSG_BURST, self.tok + (now - self.tt) * MSG_RATE)
            self.tt = now
            if self.tok < 1:
                raise Closed()          # zahlcování
            self.tok -= 1
            return data.decode('utf-8', 'strict')

    def send_raw(self, op, payload):
        n = len(payload)
        hdr = bytes([0x80 | op]) + (bytes([n]) if n < 126 else bytes([126]) + struct.pack('>H', n) if n < 65536 else bytes([127]) + struct.pack('>Q', n))
        with self.wlock:
            if not self.alive:
                return
            try:
                self.sock.sendall(hdr + payload)
            except OSError:
                self.alive = False

    def send(self, obj):
        self.send_raw(1, json.dumps(obj, separators=(',', ':')).encode())

    def close(self):
        if self.alive:
            self.send_raw(8, b'')
        self.alive = False
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass


def handshake(handler):
    """Přepne HTTP spojení na WebSocket. Vrátí WS nebo None."""
    h = handler.headers
    key = h.get('Sec-WebSocket-Key', '')
    if h.get('Upgrade', '').lower() != 'websocket' or not re.fullmatch(r'[A-Za-z0-9+/=]{16,40}', key):
        return None
    acc = base64.b64encode(hashlib.sha1(key.encode() + GUID).digest()).decode()
    handler.wfile.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                         'Sec-WebSocket-Accept: ' + acc + '\r\n\r\n').encode())
    handler.wfile.flush()
    handler.close_connection = True
    handler.connection.settimeout(IDLE)
    return WS(handler.connection)


def serve(handler, room, role):
    """Obslouží jedno WS spojení (běží ve vlákně požadavku, dokud se neodpojí)."""
    if not ROOM_RE.match(room or '') or role not in ('host', 'join'):
        return handler.send_error(400)
    with _lock:
        if _count[0] >= MAX_CONNS:
            return handler.send_error(503)
        _count[0] += 1
    try:
        ws = handshake(handler)
        if not ws:
            return handler.send_error(400)
        if role == 'host':
            _host(ws, room)
        else:
            _join(ws, room)
    except (Closed, OSError, ValueError, UnicodeDecodeError):
        pass
    finally:
        with _lock:
            _count[0] -= 1


def _msg(ws):
    try:
        d = json.loads(ws.recv())
    except ValueError:
        raise Closed()
    if not isinstance(d, dict):
        raise Closed()
    return d


def _host(ws, room):
    with _lock:
        r = _rooms.get(room)
        if (r and r['host'].alive) or len(_rooms) >= MAX_ROOMS:
            ws.send({'t': 'x'})
            ws.close()
            return
        r = _rooms[room] = {'host': ws, 'peers': {}}
    ws.send({'t': 'h'})
    try:
        while True:
            d = _msg(ws)
            t = d.get('t')
            if t == 'p':
                continue
            c = d.get('c')
            with _lock:
                p = r['peers'].get(c)
            if not p:
                continue
            if t == 'k':
                p.close()
            elif 'd' in d:
                p.send({'d': d['d']})
    finally:
        ws.close()
        with _lock:
            if _rooms.get(room) is r:
                del _rooms[room]
            peers = list(r['peers'].values())
        for p in peers:
            p.close()


def _join(ws, room):
    with _lock:
        r = _rooms.get(room)
        if not r or not r['host'].alive or len(r['peers']) >= MAX_PER_ROOM:
            r = None
        else:
            cid = _next[0]
            _next[0] += 1
            r['peers'][cid] = ws
    if not r:
        ws.send({'t': 'x'})
        ws.close()
        return
    host = r['host']
    host.send({'t': 'j', 'c': cid})
    ws.send({'t': 'o'})
    try:
        while True:
            d = _msg(ws)
            if d.get('t') == 'p' or 'd' not in d:
                continue
            if not host.alive:
                break
            host.send({'t': 'm', 'c': cid, 'd': d['d']})
    finally:
        ws.close()
        with _lock:
            r['peers'].pop(cid, None)
        host.send({'t': 'l', 'c': cid})
