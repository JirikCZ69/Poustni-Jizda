"""Piper jako trvale běžící proces (model se načte jen jednou).

Jednorázové spuštění piperu načítá model ~1 s na PC, na slabém hostingu ~15–20 s – proto se proces drží
otevřený a věty se mu posílají po řádcích (--json-input). Když něco selže, vrátí False a server použije
jednorázové spuštění.
"""
import json, os, subprocess, threading

_lock = threading.Lock()
_proc = None


def _start(exe, model):
    global _proc
    _proc = subprocess.Popen([exe, '--model', model, '--json-input', '--length_scale', '0.85', '--noise_scale', '0.5',
                              '--noise_w', '0.6', '--sentence_silence', '0.18'],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)


def synth(exe, model, text, out, timeout=40):
    """Vytvoří WAV s textem do souboru out. True = povedlo se."""
    global _proc
    with _lock:
        for attempt in range(2):
            try:
                if _proc is None or _proc.poll() is not None:
                    _start(exe, model)
                line = json.dumps({'text': text, 'output_file': out}, ensure_ascii=False) + '\n'
                _proc.stdin.write(line.encode('utf-8'))
                _proc.stdin.flush()
                res = [None]
                t = threading.Thread(target=lambda: res.__setitem__(0, _proc.stdout.readline()), daemon=True)
                t.start(); t.join(timeout)
                if res[0] and os.path.exists(out):
                    return True
                raise RuntimeError('piper neodpověděl')
            except Exception:
                try:
                    _proc.kill()
                except Exception:
                    pass
                _proc = None
        return False


def batch(exe, model, items):
    """Hromadné generování (při sestavení obrazu): items = [(text, soubor)]."""
    p = subprocess.Popen([exe, '--model', model, '--json-input', '--length_scale', '0.85', '--noise_scale', '0.5',
                          '--noise_w', '0.6', '--sentence_silence', '0.18'],
                         stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    data = ''.join(json.dumps({'text': t, 'output_file': f}, ensure_ascii=False) + '\n' for t, f in items)
    p.communicate(data.encode('utf-8'), timeout=3600)
