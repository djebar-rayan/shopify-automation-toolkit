'use strict';

// ============================================================
// lib/cli.js — Helpers ligne de commande
// ------------------------------------------------------------
//   - getFlag()  : lecture des flags --foo / --foo=val / --foo val
//   - confirm()  : prompt o/N (auto-oui si --yes)
//   - ask()      : prompt texte libre
//   - sleep()    : pause en ms
// ============================================================

const readline = require('readline');

function getFlag(name, def = null) {
  const args = process.argv.slice(2);
  const idx = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx < 0) return def;
  const arg = args[idx];
  if (arg.startsWith(`--${name}=`)) return arg.split('=').slice(1).join('=');
  const next = args[idx + 1];
  if (next && !next.startsWith('--')) return next;
  return true;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function confirm(question, defaultNo = true) {
  if (process.argv.includes('--yes')) return Promise.resolve(true);
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultNo ? '(o/N)' : '(O/n)';
    rl.question(`${question} ${suffix} > `, ans => {
      rl.close();
      const a = (ans || '').trim().toLowerCase();
      if (defaultNo) resolve(a === 'o' || a === 'oui' || a === 'y' || a === 'yes');
      else resolve(!(a === 'n' || a === 'non' || a === 'no'));
    });
  });
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} > `, ans => {
      rl.close();
      resolve((ans || '').trim());
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { getFlag, hasFlag, confirm, ask, sleep };
