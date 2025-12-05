// Tab State Logic
const TabStateFolds = {
  toCompressed: (state) => btoa(unescape(encodeURIComponent(state.tabs.map(t => t.url).join('\n')))),
  toShareURL: (state) => 'https://vinodhalaharvi.github.io/tab-state-qr/#' + TabStateFolds.toCompressed(state)
};

const TabStateParsers = {
  fromCompressed: (compressed) => {
    const data = compressed.replace(/^https:\/\/vinodhalaharvi\.github\.io\/tab-state-qr\/#/, '');
    const decoded = decodeURIComponent(escape(atob(data)));
    const urls = decoded.split('\n').filter(u => u.startsWith('http'));
    return { tabs: urls.map(url => ({ url, title: url })) };
  },
  auto: (input) => {
    const trimmed = input.trim();
    if (trimmed.startsWith('https://vinodhalaharvi.github.io/tab-state-qr/#') || /^[A-Za-z0-9+/]+=*$/.test(trimmed)) {
      return TabStateParsers.fromCompressed(trimmed);
    }
    const urls = trimmed.split('\n').filter(u => u.startsWith('http'));
    if (urls.length > 0) return { tabs: urls.map(url => ({ url, title: url })) };
    return JSON.parse(trimmed);
  }
};

const Storage = {
  KEY: 'tabstate_history',
  async save(state) {
    const history = await Storage.get();
    history.unshift({ 
      id: Date.now(), 
      timestamp: Date.now(), 
      data: TabStateFolds.toCompressed(state), 
      tabCount: state.tabs.length, 
      preview: state.tabs.slice(0,3).map(t => { 
        try { return new URL(t.url).hostname; } catch(e) { return ''; }
      }).join(', ') 
    });
    if (history.length > 20) history.pop();
    await chrome.storage.local.set({ [Storage.KEY]: history });
  },
  async get() { 
    return (await chrome.storage.local.get(Storage.KEY))[Storage.KEY] || []; 
  }
};

function generateQR(state, container) {
  container.innerHTML = '';
  const data = TabStateFolds.toShareURL(state);
  
  // Use QR Server API - produces guaranteed scannable QR codes
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(data);
  
  const img = document.createElement('img');
  img.src = qrUrl;
  img.width = 180;
  img.height = 180;
  img.style.borderRadius = '8px';
  
  img.onerror = function() {
    container.innerHTML = '<div style="color:#ef4444;padding:20px">QR generation failed</div>';
  };
  
  container.appendChild(img);
  return { dataSize: data.length, fullData: data, img: img };
}

class UI {
  constructor() {
    this.state = { tabs: [] };
    this.selected = new Set();
    this.qr = null;
    this.init();
  }
  
  async init() {
    document.querySelectorAll('.nav-btn').forEach(b => 
      b.addEventListener('click', e => this.switchSection(e.target.dataset.section))
    );
    document.getElementById('copyBtn').addEventListener('click', () => this.copy());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refresh());
    document.getElementById('downloadBtn').addEventListener('click', () => this.download());
    document.getElementById('saveHistoryBtn').addEventListener('click', () => this.saveHistory());
    document.getElementById('restoreFromPaste').addEventListener('click', () => this.restoreFromPaste());
    document.getElementById('selectAllBtn').addEventListener('click', () => this.toggleAll());
    document.getElementById('generateSelected').addEventListener('click', () => this.genSelected());
    await this.refresh();
    await this.loadHistory();
  }
  
  switchSection(id) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-section="' + id + '"]').classList.add('active');
    document.getElementById(id).classList.add('active');
  }
  
  async refresh() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const valid = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    this.state = {
      tabs: valid.map(t => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl })),
      timestamp: Date.now()
    };
    document.getElementById('tabCount').textContent = valid.length + ' tabs';
    document.getElementById('statTabs').textContent = valid.length;
    this.renderTabs(valid);
    this.genQR();
  }
  
  renderTabs(tabs) {
    const el = document.getElementById('tabList');
    this.selected = new Set(tabs.map((_, i) => i));
    el.innerHTML = tabs.map((t, i) => {
      let d = '';
      try { d = new URL(t.url).hostname; } catch(e) {}
      return '<div class="tab-item" data-i="' + i + '">' +
        '<input type="checkbox" checked>' +
        '<img class="tab-favicon" src="' + (t.favIconUrl || '') + '">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="tab-title">' + this.esc(t.title || t.url) + '</div>' +
          '<div class="tab-domain">' + d + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    
    el.querySelectorAll('.tab-favicon').forEach(img =>
      img.addEventListener('error', function() { this.style.display = 'none'; })
    );
    
    el.querySelectorAll('.tab-item').forEach(item => {
      const cb = item.querySelector('input');
      const i = parseInt(item.dataset.i);
      item.addEventListener('click', e => {
        if (e.target !== cb) cb.checked = !cb.checked;
        if (cb.checked) this.selected.add(i); else this.selected.delete(i);
      });
    });
  }
  
  toggleAll() {
    const cbs = document.querySelectorAll('#tabList input');
    const all = this.selected.size === cbs.length;
    cbs.forEach((cb, i) => {
      cb.checked = !all;
      if (!all) this.selected.add(i); else this.selected.delete(i);
    });
  }
  
  genSelected() {
    this.state = {
      tabs: this.state.tabs.filter((_, i) => this.selected.has(i)),
      timestamp: Date.now()
    };
    this.genQR();
    this.switchSection('generate');
    document.getElementById('tabCount').textContent = this.state.tabs.length + ' tabs';
    document.getElementById('statTabs').textContent = this.state.tabs.length;
  }
  
  genQR() {
    this.qr = generateQR(this.state, document.getElementById('qrcode'));
    document.getElementById('statSize').textContent = this.qr.dataSize || 0;
  }
  
  async copy() {
    if (!this.qr || !this.qr.fullData) return;
    await navigator.clipboard.writeText(this.qr.fullData);
    this.toast('Copied!');
  }
  
  download() {
    if (!this.qr || !this.qr.img) return;
    const a = document.createElement('a');
    a.download = 'tabs-' + Date.now() + '.png';
    a.href = this.qr.img.src;
    a.click();
    this.toast('Saved!');
  }
  
  async saveHistory() {
    await Storage.save(this.state);
    this.toast('Saved!');
    await this.loadHistory();
  }
  
  async loadHistory() {
    const h = await Storage.get();
    const el = document.getElementById('historyList');
    if (!h.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div>No saved states</div></div>';
      return;
    }
    el.innerHTML = h.map(x =>
      '<div class="history-item" data-id="' + x.id + '">' +
        '<div class="history-meta">' +
          '<span class="history-date">' + new Date(x.timestamp).toLocaleString() + '</span>' +
          '<span class="history-count">' + x.tabCount + ' tabs</span>' +
        '</div>' +
        '<div class="history-preview">' + this.esc(x.preview) + '</div>' +
      '</div>'
    ).join('');
    el.querySelectorAll('.history-item').forEach(item =>
      item.addEventListener('click', () => this.restoreHistory(item.dataset.id))
    );
  }
  
  async restoreHistory(id) {
    const h = await Storage.get();
    const e = h.find(x => x.id === parseInt(id));
    if (!e) return;
    try {
      const s = TabStateParsers.fromCompressed(e.data);
      await this.openTabs(s.tabs);
      this.toast('Opened ' + s.tabs.length + ' tabs!');
    } catch(err) {
      this.toast('Failed: ' + err.message, true);
    }
  }
  
  async restoreFromPaste() {
    const input = document.getElementById('pasteInput').value.trim();
    if (!input) { this.toast('Paste data', true); return; }
    try {
      const s = TabStateParsers.auto(input);
      await this.openTabs(s.tabs);
      this.toast('Opened ' + s.tabs.length + ' tabs!');
    } catch(e) {
      this.toast('Invalid: ' + e.message, true);
    }
  }
  
  async openTabs(tabs) {
    for (const t of tabs) await chrome.tabs.create({ url: t.url, active: false });
  }
  
  toast(msg, err) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' error' : '');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
  }
  
  esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', function() { new UI(); });
