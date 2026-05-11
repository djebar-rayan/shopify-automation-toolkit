'use strict';

// ============================================================
// lib/task-file.js — Task file parser
// ------------------------------------------------------------
// Format documented in tasks/_template.md:
//   ## Target           (Scope, Filter, Entities affected)
//   ## Action           (Type, Field, Value)
//   ## Validation       (checkboxes)
//   ## Success criteria
//   ## Results          (appended by appendTaskResult)
// ============================================================

const fs = require('fs');
const path = require('path');

function parseTaskFile(taskPath) {
  if (!fs.existsSync(taskPath)) {
    throw new Error(`Task file not found: ${taskPath}`);
  }
  const raw = fs.readFileSync(taskPath, 'utf8');

  function section(name) {
    const re = new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |\\Z)`, 'mi');
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  }
  function field(block, key) {
    const re = new RegExp(`^[-*]\\s*\\*\\*${key}\\*\\*\\s*:\\s*(.+)$`, 'mi');
    const m = block.match(re);
    return m ? m[1].trim() : '';
  }

  const targetBlock = section('Target');
  const actionBlock = section('Action');
  const validationBlock = section('Validation');
  const successBlock = section('Success criteria');
  const headerName = (raw.match(/^#\s+(.+)$/m) || [])[1] || path.basename(taskPath);
  const date = (raw.match(/\*\*Date\*\*\s*:\s*(.+)/) || [])[1] || '';

  const validation = {
    checkInStoreData: /^\s*-\s*\[x\]/im.test(validationBlock.split('\n')[0] || ''),
    showDryRun:       /\[x\][^\n]*[Ss]how[^\n]*(changes|dry-run)/i.test(validationBlock),
    askConfirm:       /\[x\][^\n]*[Aa]sk[^\n]*confirm/i.test(validationBlock),
  };

  return {
    name: headerName,
    date,
    raw,
    path: taskPath,
    target: {
      scope: field(targetBlock, 'Scope').toLowerCase(),
      filter: field(targetBlock, 'Filter'),
      countDeclared: parseInt(field(targetBlock, 'Entities affected') || '0', 10),
    },
    action: {
      type: field(actionBlock, 'Type').toLowerCase(),
      field: field(actionBlock, 'Field'),
      value: field(actionBlock, 'Value'),
    },
    validation,
    success: successBlock,
  };
}

function appendTaskResult(taskPath, summary) {
  const ts = new Date().toISOString();
  const block = [
    '',
    `## Results — ${ts}`,
    ...summary.map(l => `- ${l}`),
    '',
  ].join('\n');
  fs.appendFileSync(taskPath, block, 'utf8');
}

module.exports = { parseTaskFile, appendTaskResult };
