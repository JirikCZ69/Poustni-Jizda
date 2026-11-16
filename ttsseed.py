"""Předem namluvené kousky hlášek spolujezdce (rally). Spouští se při sestavení Docker obrazu:
    python ttsseed.py
Klient skládá hlášky z kousků oddělených čárkou/tečkou, takže stačí namluvit tyto kousky."""
import hashlib, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SEED_DIR = os.path.join(ROOT, 'ttsseed')


def fragments():
    out = set()
    for d in ('Levá', 'Pravá'):
        for s in range(1, 7):
            out.add(f'{d} {s}'); out.add(f'{d} {s} dlouhá')
            if s <= 2:   # po „Brzda,“ s malým písmenem
                out.add(f'{d.lower()} {s}'); out.add(f'{d.lower()} {s} dlouhá')
    out.update(['Levý vracák', 'Pravý vracák', 'levý vracák', 'pravý vracák', 'Brzda', 'utahuje se', 'otevírá se', 'hned',
                'Mírně klikatá', 'naplno', 'Skok Rovně', 'drž stopu', 'Přes horizont', 'Pozor',
                'asfalt', 'šotolina', 'písek', 'mimo trať', 'Cíl Naplno do cíle', 'Start', 'Jedem'])
    for n in range(50, 2001, 50):
        out.add(str(n))
    return sorted(out)


def path(text):
    return os.path.join(SEED_DIR, 'p3_' + hashlib.sha1(text.encode('utf-8')).hexdigest() + '.wav')


if __name__ == '__main__':
    import ttspiper
    sys.path.insert(0, ROOT)
    exe = os.path.join(ROOT, 'tts', 'piper', 'piper.exe' if os.name == 'nt' else 'piper')
    model = os.path.join(ROOT, 'tts', 'cs_CZ-jirka-medium.onnx')
    os.makedirs(SEED_DIR, exist_ok=True)
    items = [(t, path(t)) for t in fragments() if not os.path.exists(path(t))]
    ttspiper.batch(exe, model, items)
    ok = sum(os.path.exists(path(t)) for t in fragments())
    print(f'tts seed: {ok}/{len(fragments())}')
    if ok < len(fragments()):
        sys.exit(1)
