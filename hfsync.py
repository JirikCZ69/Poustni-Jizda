"""Záloha účtů, žebříčku a uložených her do soukromého HF datasetu.

Disk na Hugging Face Spaces (zdarma) se při restartu/uspání smaže, proto:
  - při startu se data stáhnou z datasetu (restore),
  - pak se každé 2 minuty (a při vypínání) nahrají, pokud se změnila.
Aktivní jen když je nastaven HF_TOKEN (secret Space) a PJ_HF_DATASET (např. "jmeno/pouste-jizda-data").
"""
import os, signal, sys, threading, time

REPO = os.environ.get('PJ_HF_DATASET', '').strip()
TOKEN = os.environ.get('HF_TOKEN', '').strip()
PATTERNS = ['leaderboard.json', 'saves/*.json']
INTERVAL = 120

_lock = threading.Lock()
_last = None
_dir = None


def enabled():
    return bool(REPO and TOKEN)


def _sig(data_dir):
    out = []
    sd = os.path.join(data_dir, 'saves')
    saves = sorted(f for f in os.listdir(sd) if f.endswith('.json')) if os.path.isdir(sd) else []
    for rel in ['leaderboard.json'] + ['saves/' + f for f in saves]:
        p = os.path.join(data_dir, rel)
        try:
            st = os.stat(p)
            out.append((rel, st.st_size, st.st_mtime_ns))
        except OSError:
            pass
    return tuple(out)


def restore(data_dir):
    """Stáhne zálohu (volat před načtením databáze)."""
    global _last, _dir
    _dir = data_dir
    if not enabled():
        print('[záloha] vypnuto (chybí HF_TOKEN nebo PJ_HF_DATASET)')
        return
    try:
        from huggingface_hub import create_repo, snapshot_download
        create_repo(REPO, repo_type='dataset', private=True, exist_ok=True, token=TOKEN)
        os.makedirs(data_dir, exist_ok=True)
        snapshot_download(repo_id=REPO, repo_type='dataset', local_dir=data_dir, token=TOKEN, allow_patterns=PATTERNS)
        print('[záloha] data obnovena z', REPO)
    except Exception as e:
        print('[záloha] obnova selhala:', type(e).__name__, str(e)[:200])
    try:
        _last = _sig(data_dir)
    except OSError:
        _last = None


def push(reason='změna'):
    global _last
    if not enabled() or not _dir:
        return
    with _lock:
        try:
            s = _sig(_dir)
        except OSError:
            return
        if s == _last or not s:
            return
        try:
            from huggingface_hub import upload_folder
            upload_folder(folder_path=_dir, repo_id=REPO, repo_type='dataset', token=TOKEN,
                          allow_patterns=PATTERNS, commit_message='záloha (' + reason + ')')
            _last = s
            print('[záloha] nahráno (' + reason + ')')
        except Exception as e:
            print('[záloha] nahrání selhalo:', type(e).__name__, str(e)[:200])


def start():
    if not enabled():
        return

    def loop():
        while True:
            time.sleep(INTERVAL)
            push()
    threading.Thread(target=loop, daemon=True).start()

    def on_term(signum, frame):
        push('vypínání')
        sys.exit(0)
    try:
        signal.signal(signal.SIGTERM, on_term)
    except (ValueError, OSError):
        pass
