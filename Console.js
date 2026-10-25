'use strict';
// ============================================================
// ===== CONSOLE.JS - встроенная консоль ======================
// ============================================================
(function() {
  var history = [];
  var historyIndex = -1;

  function print(text, className) {
    var out = document.getElementById('consoleOutput');
    if (!out) return;
    var div = document.createElement('div');
    div.className = className || '';
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  function toggle() {
    var con = document.getElementById('devConsole');
    if (!con) return;
    if (con.classList.contains('hidden')) {
      con.classList.remove('hidden');
      var inp = document.getElementById('consoleInput');
      if (inp) setTimeout(function() { inp.focus(); }, 100);
      if (document.getElementById('consoleOutput').children.length === 0) {
        print('GORODOK Dev Console', 'info');
        print('help() — список команд', 'info');
        print('', '');
      }
    } else {
      con.classList.add('hidden');
    }
  }

  function execute(cmd) {
    if (!cmd || cmd.trim() === '') return;
    cmd = cmd.trim();
    print('> ' + cmd, 'cmd');
    history.unshift(cmd);
    historyIndex = -1;

    if (cmd === 'clear()' || cmd === 'clear') {
      document.getElementById('consoleOutput').innerHTML = '';
      return;
    }
    if (cmd === 'help()' || cmd === 'help') {
      print('Команды:', 'info');
      print('  SunnoSadame("Stand") - телепорт + стенд', '');
      print('  tpHome() - в центр', '');
      print('  tpMoney(1000) - деньги', '');
      print('  tpAlley() - в подворотню', '');
      print('  clear() - очистить', '');
      print('', '');
      print('Переменные:', 'info');
      print('  game.money / game.health / game.police.wanted', '');
      return;
    }

    try {
      var result = eval(cmd);
      if (result !== undefined) print('<- ' + String(result), '');
    } catch (err) {
      print('ОШИБКА: ' + err.message, 'err');
    }
  }

  function init() {
    var toggleBtn = document.getElementById('consoleToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggle);

    var input = document.getElementById('consoleInput');
    var send = document.getElementById('consoleSend');

    if (send) {
      send.addEventListener('click', function() {
        execute(input.value);
        input.value = '';
      });
    }

    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          execute(input.value);
          input.value = '';
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          historyIndex = Math.min(historyIndex + 1, history.length - 1);
          if (history[historyIndex]) input.value = history[historyIndex];
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          historyIndex = Math.max(historyIndex - 1, -1);
          input.value = historyIndex >= 0 ? history[historyIndex] : '';
        }
      });
    }

    window.addEventListener('keydown', function(e) {
      if (e.code === 'Backquote') {
        e.preventDefault();
        toggle();
      }
    });
  }

  window.toggleDevConsole = toggle;
  window.executeConsoleCommand = execute;
  window.consolePrint = print;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();