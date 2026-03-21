/* ── Holmes AI Chat Widget ──────────────────────────────────────
 * Self-contained chat widget loaded by all 5 apps.
 * Dependencies: CONFIG (for API URL), esc(), escapeAttr()
 * Global: window.AI_CHAT
 * ─────────────────────────────────────────────────────────────── */
'use strict';

(function() {
  var AI = window.AI_CHAT = {};
  var panel, messagesEl, inputEl, sendBtn, historyPanel, historyList;
  var conversationId = null;
  var isStreaming = false;
  var appContext = 'portal';
  var lastViewedAt = 0;

  // ── Detect app context from <body data-ai-context> ──
  function detectContext() {
    var body = document.body;
    appContext = (body && body.getAttribute('data-ai-context')) || 'portal';
  }

  // ── Minimal Markdown parser (bold, tables, lists, code, line breaks) ──
  function mdToHtml(md) {
    if (!md) return '';
    // Escape HTML first
    var h = typeof esc === 'function' ? esc(md) : md.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Code blocks
    h = h.replace(/```[\s\S]*?```/g, function(m) {
      return '<pre><code>' + m.slice(3, -3).trim() + '</code></pre>';
    });
    // Inline code
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Tables (simple: lines starting with |)
    h = h.replace(/((?:^\|.+\|$\n?)+)/gm, function(tableBlock) {
      var rows = tableBlock.trim().split('\n').filter(function(r) { return r.trim(); });
      if (rows.length < 2) return tableBlock;
      var html = '<table>';
      rows.forEach(function(row, i) {
        if (row.match(/^\|\s*[-:]+/)) return; // separator row
        var cells = row.split('|').filter(function(c) { return c.trim() !== ''; });
        var tag = (i === 0) ? 'th' : 'td';
        html += '<tr>' + cells.map(function(c) { return '<' + tag + '>' + c.trim() + '</' + tag + '>'; }).join('') + '</tr>';
      });
      html += '</table>';
      return html;
    });
    // Unordered lists
    h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
    h = h.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    h = h.replace(/<\/ul>\s*<ul>/g, ''); // merge adjacent
    // Line breaks
    h = h.replace(/\n/g, '<br>');
    return h;
  }

  // ── Build DOM ──
  function init() {
    detectContext();

    // FAB button
    var fab = document.createElement('button');
    fab.className = 'ai-fab';
    fab.setAttribute('title', 'Holmes AI');
    fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="ai-unread" id="aiUnread"></span>';
    fab.onclick = function() { AI.toggle(); };
    document.body.appendChild(fab);

    // Panel
    panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML =
      '<div class="ai-header">' +
        '<span class="ai-header-title">Holmes AI</span>' +
        '<button class="ai-header-btn" onclick="AI_CHAT.showHistory()" title="History">&#128218;</button>' +
        '<button class="ai-header-btn" onclick="AI_CHAT.close()" title="Close">&times;</button>' +
      '</div>' +
      '<div class="ai-messages" id="aiMessages"></div>' +
      '<div class="ai-input-row">' +
        '<textarea class="ai-input" id="aiInput" placeholder="Ask about your farm data..." rows="1"></textarea>' +
        '<button class="ai-send-btn" id="aiSend" onclick="AI_CHAT.send()">Send</button>' +
      '</div>' +
      '<div class="ai-footer">' +
        'Prefix <b>deep:</b> for complex analysis' +
        (appContext === 'portal' ? ' &middot; <a onclick="AI_CHAT.openAnalysis()">Open AI Analysis</a>' : '') +
      '</div>' +
      '<div class="ai-history-panel" id="aiHistoryPanel">' +
        '<div class="ai-header">' +
          '<span class="ai-header-title">Team Query History</span>' +
          '<button class="ai-header-btn" onclick="AI_CHAT.hideHistory()">&larr; Back</button>' +
        '</div>' +
        '<div style="padding:8px"><input class="ai-input" id="aiHistorySearch" placeholder="Search queries..." oninput="AI_CHAT.searchHistory(this.value)" style="width:100%;box-sizing:border-box"></div>' +
        '<div class="ai-history-list" id="aiHistoryList"></div>' +
      '</div>';
    document.body.appendChild(panel);

    messagesEl = document.getElementById('aiMessages');
    inputEl = document.getElementById('aiInput');
    sendBtn = document.getElementById('aiSend');
    historyPanel = document.getElementById('aiHistoryPanel');
    historyList = document.getElementById('aiHistoryList');

    // Enter to send (shift+enter for newline)
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); AI.send(); }
    });

    // Ctrl+/ to toggle
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); AI.toggle(); }
    });

    // Load recent team queries as landing state
    loadRecentQueries();
  }

  // ── Recent queries (landing state) ──
  function loadRecentQueries() {
    var base = '';
    fetch(base + '/api/ai/history?limit=10', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(rows) {
        if (!rows.length || conversationId) return;
        var html = '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Recent team queries:</div>';
        rows.forEach(function(r) {
          var ago = timeAgo(r.updated_at);
          html += '<div class="ai-history-item" onclick="AI_CHAT.rerun(\'' + (typeof escapeAttr === 'function' ? escapeAttr(r.lastQuery || '') : '') + '\')">' +
            '<div class="ai-h-user">' + (typeof esc === 'function' ? esc(r.user_name) : r.user_name) + ' <span class="ai-h-time">' + ago + '</span></div>' +
            '<div class="ai-h-query">' + (typeof esc === 'function' ? esc(r.lastQuery || r.title || '') : (r.lastQuery || '')) + '</div>' +
          '</div>';
        });
        messagesEl.innerHTML = html;
      })
      .catch(function() {});
  }

  function timeAgo(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  // ── Send message ──
  AI.send = function() {
    var msg = inputEl.value.trim();
    if (!msg || isStreaming) return;
    isStreaming = true;
    sendBtn.disabled = true;
    inputEl.value = '';

    // Clear landing state on first message
    if (!conversationId && messagesEl.querySelector('.ai-history-item')) {
      messagesEl.innerHTML = '';
    }

    // Add user message
    addMessage('user', msg);

    // Add typing indicator
    var typingId = 'ai-typing-' + Date.now();
    messagesEl.insertAdjacentHTML('beforeend',
      '<div class="ai-msg assistant" id="' + typingId + '"><div class="ai-typing"><span></span><span></span><span></span></div></div>');
    scrollBottom();

    // Stream response
    var base = '';
    fetch(base + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: msg, conversationId: conversationId, appContext: appContext }),
    }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var responseText = '';

      function read() {
        reader.read().then(function(result) {
          if (result.done) { finishStream(typingId, responseText); return; }
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          lines.forEach(function(line) {
            if (!line.startsWith('data: ')) return;
            try {
              var evt = JSON.parse(line.slice(6));
              if (evt.type === 'token') {
                responseText += evt.data;
                updateTyping(typingId, responseText);
              } else if (evt.type === 'status') {
                showStatus(evt.data);
              } else if (evt.type === 'similar') {
                showSimilar(evt.data);
              } else if (evt.type === 'error') {
                responseText = 'Error: ' + (evt.data.message || 'Unknown error');
                updateTyping(typingId, responseText);
              } else if (evt.type === 'metadata') {
                if (evt.data.conversationId) conversationId = evt.data.conversationId;
              }
            } catch(e) {}
          });
          read();
        }).catch(function(err) {
          responseText = responseText || 'Connection error: ' + err.message;
          finishStream(typingId, responseText);
        });
      }
      read();
    }).catch(function(err) {
      finishStream(typingId, 'Error: ' + err.message);
    });
  };

  function updateTyping(id, text) {
    var el = document.getElementById(id);
    if (el) { el.innerHTML = mdToHtml(text); scrollBottom(); }
  }

  function finishStream(id, text) {
    var el = document.getElementById(id);
    if (el) { el.innerHTML = mdToHtml(text); el.removeAttribute('id'); }
    isStreaming = false;
    sendBtn.disabled = false;
    scrollBottom();
  }

  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    div.innerHTML = role === 'user' ? (typeof esc === 'function' ? esc(text) : text) : mdToHtml(text);
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function showStatus(text) {
    var existing = messagesEl.querySelector('.ai-msg.status:last-of-type');
    if (existing) { existing.textContent = text; return; }
    var div = document.createElement('div');
    div.className = 'ai-msg status';
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function showSimilar(data) {
    var div = document.createElement('div');
    div.className = 'ai-msg similar';
    div.innerHTML = 'Similar query from <b>' + (typeof esc === 'function' ? esc(data.userName) : data.userName) +
      '</b> (' + timeAgo(data.date) + ')';
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── History ──
  AI.showHistory = function() {
    historyPanel.classList.add('open');
    AI.searchHistory('');
  };

  AI.hideHistory = function() {
    historyPanel.classList.remove('open');
  };

  AI.searchHistory = function(query) {
    var base = '';
    var url = base + '/api/ai/history?limit=50' + (query ? '&search=' + encodeURIComponent(query) : '');
    fetch(url, { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(rows) {
        historyList.innerHTML = rows.map(function(r) {
          return '<div class="ai-history-item" onclick="AI_CHAT.rerun(\'' + (typeof escapeAttr === 'function' ? escapeAttr(r.lastQuery || '') : '') + '\')">' +
            '<div class="ai-h-user">' + (typeof esc === 'function' ? esc(r.user_name) : r.user_name) +
            ' <span class="ai-h-time">' + timeAgo(r.updated_at) + '</span>' +
            ' <span style="color:var(--text3);font-size:10px">' + (typeof esc === 'function' ? esc(r.app_context) : r.app_context) + '</span></div>' +
            '<div class="ai-h-query">' + (typeof esc === 'function' ? esc(r.lastQuery || r.title || '') : (r.lastQuery || '')) + '</div>' +
          '</div>';
        }).join('') || '<div style="padding:16px;text-align:center;color:var(--text3)">No queries yet</div>';
      }).catch(function() {});
  };

  AI.rerun = function(query) {
    AI.hideHistory();
    inputEl.value = query;
    AI.send();
  };

  // ── Open/Close ──
  AI.open = function() { panel.classList.add('open'); inputEl.focus(); };
  AI.close = function() { panel.classList.remove('open'); };
  AI.toggle = function() { panel.classList.contains('open') ? AI.close() : AI.open(); };

  AI.openAnalysis = function() {
    if (typeof showPage === 'function') showPage('aiAnalysis');
  };

  // ── New conversation ──
  AI.newConversation = function() {
    conversationId = null;
    messagesEl.innerHTML = '';
    loadRecentQueries();
  };

  // Expose mdToHtml for analysis page
  AI._mdToHtml = mdToHtml;

  // ── Init on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
