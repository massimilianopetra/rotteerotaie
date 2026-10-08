// Scrive js/versione.js con la versione (da package.json) e la build (numero di commit, commit, data).
// Si lancia con "npm run versione"; parte da solo prima di "npm run deploy".
// Il file generato non va in git (.gitignore): ogni copia pubblicata ha la sua build.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const radice = path.join(__dirname, '..');
const git = cmd => { try { return execSync('git ' + cmd, { cwd: radice, encoding: 'utf8' }).trim(); } catch (e) { return ''; } };

const versione = require(path.join(radice, 'package.json')).version;
const build = parseInt(git('rev-list --count HEAD'), 10) || 0;
const commit = git('rev-parse --short HEAD') || '?';
const modifiche = git('status --porcelain --untracked-files=no') !== ''; // modifiche non ancora committate
const ora = new Date();
const due = n => String(n).padStart(2, '0');
const data = `${ora.getFullYear()}-${due(ora.getMonth() + 1)}-${due(ora.getDate())} ${due(ora.getHours())}:${due(ora.getMinutes())}`;

const dati = { versione, build, commit, modifiche, data };
const testo = '// File generato da scripts/versione.js: non modificarlo a mano.\n' +
  'window.VERSIONE = ' + JSON.stringify(dati, null, 2) + ';\n';
fs.writeFileSync(path.join(radice, 'js', 'versione.js'), testo);
console.log(`Rotaie & Rotte v${versione} · build ${build} (${commit}${modifiche ? ', con modifiche' : ''}) · ${data}`);
