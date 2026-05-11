'use strict';

// ============================================================
// lib/shopify-graphql.js
// Runs GraphQL queries/mutations against the Shopify Admin API via
// the Shopify CLI.
// ------------------------------------------------------------
// Critical rules (see CLAUDE.md):
//   - the query is passed via --query-file (never inline → Windows `{}`)
//   - stdio: 'inherit' is mandatory (the CLI exits when there is no TTY)
//   - the response has NO `.data` envelope (read it directly)
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = require('./config');

function ensureTmp() {
  fs.mkdirSync(config.TMP_DIR, { recursive: true });
}

function execGql(queryString, variables, allowMutations = false) {
  ensureTmp();
  const qFile = path.join(config.TMP_DIR, 'gq.graphql');
  const vFile = path.join(config.TMP_DIR, 'gv.json');
  const oFile = path.join(config.TMP_DIR, 'gr.json');
  if (fs.existsSync(oFile)) fs.unlinkSync(oFile);
  fs.writeFileSync(qFile, queryString, 'utf8');
  fs.writeFileSync(vFile, JSON.stringify(variables || {}), 'utf8');
  let cmd = `shopify store execute --store ${config.STORE} --query-file "${qFile}" --output-file "${oFile}" --variable-file "${vFile}"`;
  if (allowMutations) cmd += ' --allow-mutations';
  try {
    execSync(cmd, { encoding: 'utf8', timeout: 120000, stdio: 'inherit' });
  } catch (_) {
    // The CLI may exit with a non-zero code even when the output file
    // is written correctly. We check the file existence instead.
  }
  if (!fs.existsSync(oFile)) return { _error: 'no_output' };
  try {
    const p = JSON.parse(fs.readFileSync(oFile, 'utf8'));
    if (p.errors) return { _error: 'graphql', _msg: JSON.stringify(p.errors) };
    return p;
  } catch (e) {
    return { _error: 'parse', _msg: e.message };
  }
}

function execMutation(queryString, variables) {
  return execGql(queryString, variables, true);
}

function isAccessDenied(res) {
  if (!res) return false;
  if (res._error === 'graphql' && /ACCESS_DENIED/i.test(res._msg || '')) return true;
  return false;
}

module.exports = { execGql, execMutation, isAccessDenied };
