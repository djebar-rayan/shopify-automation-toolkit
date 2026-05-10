'use strict';

// ============================================================
// lib/task-file.js — Parser de fichier de tâche
// ------------------------------------------------------------
// Format documenté dans tasks/_template.md :
//   ## Cible (Scope, Filtre, Nb entités concernées)
//   ## Action (Type, Champ modifié, Valeur)
//   ## Validation avant application (cases à cocher)
//   ## Critères de succès
//   ## Résultats (rempli par appendTaskResult)
// ============================================================

const fs = require('fs');
const path = require('path');

function parseTaskFile(taskPath) {
  if (!fs.existsSync(taskPath)) {
    throw new Error(`Fichier de tâche introuvable : ${taskPath}`);
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

  const cibleBlock = section('Cible');
  const actionBlock = section('Action');
  const validationBlock = section('Validation avant application');
  const successBlock = section('Critères de succès');
  const headerName = (raw.match(/^#\s+(.+)$/m) || [])[1] || path.basename(taskPath);
  const date = (raw.match(/\*\*Date\*\*\s*:\s*(.+)/) || [])[1] || '';

  const validation = {
    checkInStoreData: /^\s*-\s*\[x\]/im.test(validationBlock.split('\n')[0] || ''),
    showDryRun:       /\[x\][^\n]*Afficher les changements/i.test(validationBlock),
    askConfirm:       /\[x\][^\n]*Demander confirmation/i.test(validationBlock),
  };

  return {
    name: headerName,
    date,
    raw,
    path: taskPath,
    cible: {
      scope: field(cibleBlock, 'Scope').toLowerCase(),
      filter: field(cibleBlock, 'Filtre'),
      countDeclared: parseInt(field(cibleBlock, 'Nb entités concernées') || '0', 10),
    },
    action: {
      type: field(actionBlock, 'Type').toLowerCase(),
      field: field(actionBlock, 'Champ modifié'),
      value: field(actionBlock, 'Valeur'),
    },
    validation,
    success: successBlock,
  };
}

function appendTaskResult(taskPath, summary) {
  const ts = new Date().toISOString();
  const block = [
    '',
    `## Résultats — ${ts}`,
    ...summary.map(l => `- ${l}`),
    '',
  ].join('\n');
  fs.appendFileSync(taskPath, block, 'utf8');
}

module.exports = { parseTaskFile, appendTaskResult };
