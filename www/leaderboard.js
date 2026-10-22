// Online leaderboard: talks to Supabase's REST API directly (no library needed).
// Scores that can't be sent (no internet) wait in localStorage and are sent next time.
window.Leaderboard = (() => {
  const cfg = window.LEADERBOARD || {};
  const enabled = !!(cfg.url && cfg.key);
  const QUEUE_KEY = 'slijepa-karta-queue';
  const ID_KEY = 'slijepa-karta-device';
  const NICK_KEY = 'slijepa-karta-nickname';

  const store = {
    get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  function deviceId() {
    let id = store.get(ID_KEY, null);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
      store.set(ID_KEY, id);
    }
    return id;
  }

  // Supabase publishable keys go in the apikey header only (they aren't JWTs).
  const headers = () => ({ apikey: cfg.key, 'Content-Type': 'application/json' });

  // A few words are blocked outright; the rest is moderated by deleting rows in Supabase.
  const BLOCKED = ['kurac', 'picka', 'pička', 'jebe', 'jeb', 'peder', 'kurva', 'drolja', 'fuck', 'shit', 'nigg', 'cunt', 'dick', 'nazi'];
  function checkNickname(raw) {
    const nick = raw.trim().replace(/\s+/g, ' ');
    if (nick.length < 2) return { error: 'Nadimak treba imati barem 2 znaka.' };
    if (nick.length > 16) return { error: 'Nadimak može imati najviše 16 znakova.' };
    if (!/^[\p{L}\p{N} ._-]+$/u.test(nick)) return { error: 'Samo slova, brojke, razmak, točka, crtica.' };
    const flat = nick.toLowerCase().replace(/[^\p{L}]/gu, '');
    if (BLOCKED.some(w => flat.includes(w))) return { error: 'Odaberi drugi nadimak.' };
    return { nick };
  }

  async function send(entry) {
    const res = await fetch(`${cfg.url}/rest/v1/scores`, {
      method: 'POST', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(entry),
    });
    // 4xx means the server refused this score (e.g. rate limit); retrying won't help.
    if (!res.ok && res.status >= 500) throw new Error('server ' + res.status);
    return res.ok;
  }

  // Sends queued scores. Returns how many were sent.
  async function flush() {
    if (!enabled) return 0;
    const queue = store.get(QUEUE_KEY, []);
    let sent = 0;
    while (queue.length) {
      try { await send(queue[0]); } catch { break; } // offline: keep the rest for later
      queue.shift(); sent++;
      store.set(QUEUE_KEY, queue);
    }
    return sent;
  }

  // Queues the score and tries to send it. Resolves to 'sent' or 'queued'.
  async function submit({ nickname, points, reached, finished, durationS }) {
    store.set(NICK_KEY, nickname);
    const queue = store.get(QUEUE_KEY, []);
    queue.push({ nickname, points, reached, finished, duration_s: Math.max(20, Math.round(durationS)), client_id: deviceId() });
    store.set(QUEUE_KEY, queue);
    await flush();
    return store.get(QUEUE_KEY, []).length ? 'queued' : 'sent';
  }

  async function top(limit = 20) {
    const res = await fetch(`${cfg.url}/rest/v1/scores?select=nickname,points,reached,finished,created_at&order=points.desc,created_at.asc&limit=${limit}`, { headers: headers() });
    if (!res.ok) throw new Error('server ' + res.status);
    return res.json();
  }

  return { enabled, checkNickname, submit, flush, top, lastNickname: () => store.get(NICK_KEY, '') };
})();
