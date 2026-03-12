#!/usr/bin/env node
'use strict';

// ============================================================
// import-grain-tracker.js
//
// One-time migration script: reads a Grain-Tracker save file
// (encrypted or plain JSON) and imports all data into the
// holmes-risk PostgreSQL tables via the Express REST API.
//
// Usage:
//   node scripts/import-grain-tracker.js <save-file> [password]
//
// Environment variables:
//   SESSION_COOKIE  — required; value of the connect.sid cookie
//                     e.g. "connect.sid=s%3A..."
//   API_BASE        — optional; defaults to http://localhost:3000/api
//
// The save file can be either:
//   1. Encrypted auth record (JSON with salt, dataIv, dataCt)
//   2. Plain JSON export (AppState with contracts, positions, etc.)
//
// The script imports in dependency order:
//   settings → contracts → rolls → hedges → positions →
//   crop inventory → bin inventory → price log → documents
// ============================================================

const fs = require('fs');
const crypto = require('crypto');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const SESSION_COOKIE = process.env.SESSION_COOKIE;
const SAVE_FILE = process.argv[2];
const PASSWORD = process.argv[3];

// ─── Counters ───────────────────────────────────────────────

const counts = {
  settings:      { ok: 0, fail: 0 },
  contracts:     { ok: 0, fail: 0 },
  rolls:         { ok: 0, fail: 0 },
  hedges:        { ok: 0, fail: 0 },
  positions:     { ok: 0, fail: 0 },
  cropInventory: { ok: 0, fail: 0 },
  binInventory:  { ok: 0, fail: 0 },
  priceLog:      { ok: 0, fail: 0 },
  documents:     { ok: 0, fail: 0 },
};
const errors = [];

// ─── Validation ─────────────────────────────────────────────

function fatal(msg) {
  console.error(`\nFATAL: ${msg}\n`);
  process.exit(1);
}

if (!SAVE_FILE) {
  fatal('Usage: node scripts/import-grain-tracker.js <save-file> [password]\n'
      + '  Set SESSION_COOKIE env var to an authenticated session cookie.');
}

if (!SESSION_COOKIE) {
  fatal('SESSION_COOKIE environment variable is required.\n'
      + '  Log in to the app in a browser, copy the connect.sid cookie value,\n'
      + '  then: SESSION_COOKIE="connect.sid=s%3A..." node scripts/import-grain-tracker.js ...');
}

if (!fs.existsSync(SAVE_FILE)) {
  fatal(`Save file not found: ${SAVE_FILE}`);
}

// ─── Decryption ─────────────────────────────────────────────

/**
 * Derive an AES-256-GCM key from a password + salt using PBKDF2.
 * Matches the Grain-Tracker's Web Crypto implementation:
 *   PBKDF2, SHA-256, 310000 iterations, 256-bit key
 */
function deriveKeyBuffer(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * The Grain-Tracker stores IV and ciphertext as base64 strings.
 * Web Crypto's AES-GCM output = ciphertext + 16-byte auth tag appended.
 */
function decryptAesGcm(keyBuffer, ivB64, ctB64) {
  const iv = Buffer.from(ivB64, 'base64');
  const combined = Buffer.from(ctB64, 'base64');

  // Last 16 bytes are the GCM auth tag
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Read and parse the save file. Handles both encrypted and plain formats.
 */
async function readSaveFile() {
  const raw = fs.readFileSync(SAVE_FILE, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fatal(`Could not parse save file as JSON: ${e.message}`);
  }

  // Detect encrypted vs plain format
  if (parsed.salt && parsed.dataCt && parsed.dataIv) {
    // Encrypted auth record
    console.log('Detected encrypted save file.');
    if (!PASSWORD) {
      fatal('Encrypted save file requires a password.\n'
          + '  Usage: node scripts/import-grain-tracker.js <save-file> <password>');
    }

    const salt = Buffer.from(parsed.salt, 'base64');
    console.log('Deriving key (PBKDF2, 310000 iterations)...');
    const keyBuffer = deriveKeyBuffer(PASSWORD, salt);

    console.log('Decrypting data...');
    let plaintext;
    try {
      plaintext = decryptAesGcm(keyBuffer, parsed.dataIv, parsed.dataCt);
    } catch (e) {
      fatal(`Decryption failed — wrong password or corrupted data.\n  ${e.message}`);
    }

    try {
      return JSON.parse(plaintext);
    } catch (e) {
      fatal(`Decrypted data is not valid JSON: ${e.message}`);
    }
  }

  // Plain JSON — should have contracts or inventory arrays
  if (parsed.contracts || parsed.inventory || parsed.meta) {
    console.log('Detected plain (unencrypted) JSON export.');
    return parsed;
  }

  fatal('Unrecognized file format. Expected either an encrypted auth record\n'
      + '  (with salt/dataIv/dataCt) or a plain AppState JSON export.');
}

// ─── API Helpers ────────────────────────────────────────────

async function apiPost(path, body) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': SESSION_COOKIE,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPut(path, body) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': SESSION_COOKIE,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Import Functions ───────────────────────────────────────

async function importSettings(settings) {
  if (!settings) return;
  console.log('\n── Settings ──');

  const pairs = [];

  // Flatten nested objects to colon-delimited keys
  if (settings.costBasis) {
    for (const [k, v] of Object.entries(settings.costBasis)) {
      pairs.push({ key: `costBasis:${k}`, value: String(v) });
    }
  }

  if (settings.grossBushels) {
    for (const [comm, years] of Object.entries(settings.grossBushels)) {
      if (typeof years === 'object' && years !== null) {
        for (const [yr, val] of Object.entries(years)) {
          pairs.push({ key: `grossBushels:${comm}:${yr}`, value: String(val) });
        }
      } else {
        pairs.push({ key: `grossBushels:${comm}`, value: String(years) });
      }
    }
  }

  if (settings.bushelsPerContract) {
    for (const [k, v] of Object.entries(settings.bushelsPerContract)) {
      pairs.push({ key: `bushelsPerContract:${k}`, value: String(v) });
    }
  }

  if (settings.unitLabel) {
    for (const [k, v] of Object.entries(settings.unitLabel)) {
      pairs.push({ key: `unitLabel:${k}`, value: String(v) });
    }
  }

  // Array/complex settings stored as JSON
  if (settings.elevators) {
    pairs.push({ key: 'elevators', value: JSON.stringify(settings.elevators) });
  }
  if (settings.commodities) {
    pairs.push({ key: 'commodities', value: JSON.stringify(settings.commodities) });
  }

  if (settings.defaultCropYear) {
    pairs.push({ key: 'activeCropYear', value: settings.defaultCropYear });
  }

  for (const { key, value } of pairs) {
    try {
      await apiPut('/risk/settings', { key, value });
      counts.settings.ok++;
    } catch (e) {
      counts.settings.fail++;
      errors.push(`settings[${key}]: ${e.message}`);
    }
  }
  console.log(`  ${counts.settings.ok} imported, ${counts.settings.fail} failed`);
}

async function importContracts(contracts) {
  if (!contracts || contracts.length === 0) return;
  console.log(`\n── Contracts (${contracts.length}) ──`);

  // Map from Grain-Tracker contract ID → API-assigned ID
  // (the CRUD factory generates new UUIDs on insert)
  const idMap = {};

  for (const c of contracts) {
    const body = {
      commodity:      c.commodity,
      cropYear:       c.cropYear,
      contractType:   c.type,
      status:         c.status,
      bushels:        c.bushels,
      cashPrice:      c.cashPrice,
      futuresPrice:   c.futuresPrice,
      basisLevel:     c.basis,
      futuresMonth:   c.futuresMonth,
      deliveryDate:   c.deliveryDate,
      deliveryDateEnd: c.deliveryDateEnd,
      buyerName:      c.elevator,
      contractNumber: c.contractNumber,
      strategy:       c.strategy,
      company:        c.company,
      account:        c.account,
      rollCount:      c.rollCount,
      splitFromId:    c.splitFromContractId ? (idMap[c.splitFromContractId] || null) : null,
      notes:          c.notes,
    };

    try {
      const result = await apiPost('/risk/contracts', body);
      idMap[c.id] = result.id;
      counts.contracts.ok++;

      // Import roll history for this contract
      if (c.rollHistory && c.rollHistory.length > 0) {
        for (const roll of c.rollHistory) {
          try {
            await apiPost(`/risk/contracts/${result.id}/rolls`, {
              rollDate:         roll.rollDate,
              fromMonth:        roll.fromMonth,
              toMonth:          roll.toMonth,
              spread:           roll.spread,
              fee:              roll.fee,
              newFuturesPrice:  roll.newFuturesPrice,
              notes:            roll.notes,
            });
            counts.rolls.ok++;
          } catch (e) {
            counts.rolls.fail++;
            errors.push(`roll for contract ${c.id}: ${e.message}`);
          }
        }
      }

      // Import elevator hedges for this contract
      if (c.elevatorHedges && c.elevatorHedges.length > 0) {
        for (const h of c.elevatorHedges) {
          try {
            await apiPost(`/risk/contracts/${result.id}/hedges`, {
              contractType: h.contractType,
              symbol:       h.symbol,
              strikePrice:  h.strikePrice,
              contracts:    h.contracts,
              entryPrice:   h.entryPrice,
              currentPrice: h.currentPrice,
              delta:        h.delta,
              theta:        h.theta,
              status:       h.status,
              notes:        h.notes,
            });
            counts.hedges.ok++;
          } catch (e) {
            counts.hedges.fail++;
            errors.push(`hedge for contract ${c.id}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      counts.contracts.fail++;
      errors.push(`contract ${c.id} (${c.type} ${c.commodity}): ${e.message}`);
    }
  }

  console.log(`  ${counts.contracts.ok} imported, ${counts.contracts.fail} failed`);
  if (counts.rolls.ok || counts.rolls.fail)
    console.log(`  rolls: ${counts.rolls.ok} imported, ${counts.rolls.fail} failed`);
  if (counts.hedges.ok || counts.hedges.fail)
    console.log(`  hedges: ${counts.hedges.ok} imported, ${counts.hedges.fail} failed`);

  return idMap;
}

async function importPositions(positions, contractIdMap) {
  if (!positions || positions.length === 0) return;
  console.log(`\n── Positions (${positions.length}) ──`);

  const idMap = {};

  for (const p of positions) {
    const linkedContractId = p.linkedContractId
      ? (contractIdMap[p.linkedContractId] || null)
      : null;

    const body = {
      commodity:          p.commodity,
      cropYear:           p.cropYear,
      contractType:       p.contractType,
      positionSide:       p.positionSide,
      underlying:         p.symbol,
      contracts:          p.contracts,
      bushelsPerContract: p.bushelsPerContract,
      strike:             p.strikePrice,
      expiryDate:         p.expiryDate,
      entryPrice:         p.entryPrice,
      currentPrice:       p.currentPrice,
      effectiveEntryPrice: p.effectiveEntryPrice,
      closedPrice:        p.closedPrice,
      delta:              p.delta,
      gamma:              p.gamma,
      theta:              p.theta,
      vega:               p.vega,
      iv:                 p.iv,
      status:             p.status,
      closeReason:        p.closeReason,
      exerciseDate:       p.exerciseDate,
      resultingPositionId: p.resultingPositionId ? (idMap[p.resultingPositionId] || null) : null,
      sourceType:         p.sourceType,
      sourceOptionId:     p.sourceOptionId ? (idMap[p.sourceOptionId] || null) : null,
      linkedContractId:   linkedContractId,
      rolledFromId:       p.rolledFromPositionId ? (idMap[p.rolledFromPositionId] || null) : null,
      rolledToId:         p.rolledToPositionId ? (idMap[p.rolledToPositionId] || null) : null,
      splitFromId:        p.splitFromPositionId ? (idMap[p.splitFromPositionId] || null) : null,
      company:            p.company,
      account:            p.account,
      notes:              p.notes,
    };

    try {
      const result = await apiPost('/risk/positions', body);
      idMap[p.id] = result.id;
      counts.positions.ok++;
    } catch (e) {
      counts.positions.fail++;
      errors.push(`position ${p.id} (${p.contractType} ${p.commodity}): ${e.message}`);
    }
  }

  console.log(`  ${counts.positions.ok} imported, ${counts.positions.fail} failed`);
  return idMap;
}

async function importCropInventory(items) {
  if (!items || items.length === 0) return;
  console.log(`\n── Crop Inventory (${items.length}) ──`);

  for (const item of items) {
    try {
      await apiPost('/risk/crop-inventory', {
        commodity:        item.commodity,
        cropYear:         item.cropYear,
        fieldName:        item.fieldName,
        acres:            item.acres,
        yieldEstimate:    item.yieldEstimate,
        totalExpectedBu:  item.totalExpectedBu,
        actualHarvestedBu: item.actualHarvestedBu,
        notes:            item.notes,
      });
      counts.cropInventory.ok++;
    } catch (e) {
      counts.cropInventory.fail++;
      errors.push(`cropInventory (${item.commodity} ${item.fieldName}): ${e.message}`);
    }
  }

  console.log(`  ${counts.cropInventory.ok} imported, ${counts.cropInventory.fail} failed`);
}

async function importBinInventory(items) {
  if (!items || items.length === 0) return;
  console.log(`\n── Bin Inventory (${items.length}) ──`);

  for (const item of items) {
    try {
      await apiPost('/risk/bin-inventory', {
        commodity:    item.commodity,
        cropYear:     item.cropYear,
        location:     item.location,
        dateFilled:   item.dateFilled,
        totalBushels: item.totalBushels,
        notes:        item.notes,
      });
      counts.binInventory.ok++;
    } catch (e) {
      counts.binInventory.fail++;
      errors.push(`binInventory (${item.commodity} ${item.location}): ${e.message}`);
    }
  }

  console.log(`  ${counts.binInventory.ok} imported, ${counts.binInventory.fail} failed`);
}

async function importPriceLog(entries) {
  if (!entries || entries.length === 0) return;
  console.log(`\n── Price Log (${entries.length}) ──`);

  for (const entry of entries) {
    try {
      await apiPost('/risk/price-log', {
        date:         entry.date,
        commodity:    entry.commodity,
        cashPrice:    entry.cashPrice,
        basis:        entry.basis,
        futuresPrice: entry.futuresPrice,
        futuresMonth: entry.futuresMonth,
        source:       entry.source,
        notes:        entry.notes,
      });
      counts.priceLog.ok++;
    } catch (e) {
      counts.priceLog.fail++;
      errors.push(`priceLog (${entry.date} ${entry.commodity}): ${e.message}`);
    }
  }

  console.log(`  ${counts.priceLog.ok} imported, ${counts.priceLog.fail} failed`);
}

async function importDocuments(documents, settlements, contractIdMap) {
  const allDocs = [];

  if (documents && documents.length > 0) {
    for (const d of documents) {
      allDocs.push({ ...d, docType: d.docType || 'contract' });
    }
  }

  if (settlements && settlements.length > 0) {
    for (const s of settlements) {
      allDocs.push({ ...s, docType: 'settlement' });
    }
  }

  if (allDocs.length === 0) return;
  console.log(`\n── Documents (${allDocs.length}) ──`);

  for (const doc of allDocs) {
    // Resolve linked contract ID if present
    let linkedContractId = null;
    if (doc.linkedContractId) {
      linkedContractId = contractIdMap[doc.linkedContractId] || null;
    }

    try {
      await apiPost('/risk/documents', {
        docType:           doc.docType,
        fileName:          doc.fileName,
        filePath:          doc.filePath,
        parsedData:        doc.parsedData ? JSON.stringify(doc.parsedData) : null,
        linkedContractId:  linkedContractId,
      });
      counts.documents.ok++;
    } catch (e) {
      counts.documents.fail++;
      errors.push(`document (${doc.fileName || doc.id}): ${e.message}`);
    }
  }

  console.log(`  ${counts.documents.ok} imported, ${counts.documents.fail} failed`);
}

/**
 * Handle linkedDocIds on contracts: after documents are imported,
 * link each document to its contract via linkedContractId.
 * The Grain-Tracker stores doc references on the contract side
 * (contract.linkedDocIds[]), but the DB schema stores the FK
 * on the document side (risk_document.linked_contract_id).
 *
 * Since documents may already have linkedContractId set from
 * the doc object itself, this is a secondary pass for contracts
 * that reference documents via linkedDocIds array.
 */
// Note: linkedDocIds linking is handled during importDocuments
// if the document objects themselves carry a linkedContractId.
// The Grain-Tracker's contract.linkedDocIds is an array of doc IDs
// pointing back to documents — those are resolved in importDocuments.

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('  Grain-Tracker → Holmes Risk Import');
  console.log('='.repeat(60));
  console.log(`  File: ${SAVE_FILE}`);
  console.log(`  API:  ${API_BASE}`);
  console.log('');

  // 1. Read and decrypt
  const appState = await readSaveFile();

  const cropYear = appState.meta?.cropYear || 'unknown';
  const version = appState.meta?.version || 'unknown';
  console.log(`\nAppState loaded — crop year: ${cropYear}, version: ${version}`);

  // Show data summary
  console.log('Data summary:');
  console.log(`  contracts:      ${(appState.contracts || []).length}`);
  console.log(`  positions:      ${(appState.positions || []).length}`);
  console.log(`  cropInventory:  ${(appState.cropInventory || []).length}`);
  console.log(`  inventory:      ${(appState.inventory || []).length}`);
  console.log(`  priceLog:       ${(appState.priceLog || []).length}`);
  console.log(`  documents:      ${(appState.documents || []).length}`);
  console.log(`  settlements:    ${(appState.settlements || []).length}`);

  // 2. Verify API connectivity
  console.log('\nVerifying API connectivity...');
  try {
    const res = await fetch(`${API_BASE}/risk/settings`, {
      headers: { 'Cookie': SESSION_COOKIE },
    });
    if (res.status === 401 || res.status === 403) {
      fatal('Authentication failed — check your SESSION_COOKIE value.');
    }
    if (!res.ok) {
      fatal(`API returned ${res.status} — is the server running at ${API_BASE}?`);
    }
    console.log('  API connection OK');
  } catch (e) {
    fatal(`Cannot reach API at ${API_BASE}: ${e.message}`);
  }

  // 3. Import in dependency order
  await importSettings(appState.settings);

  const contractIdMap = await importContracts(appState.contracts) || {};

  await importPositions(appState.positions, contractIdMap);

  await importCropInventory(appState.cropInventory);

  await importBinInventory(appState.inventory);

  await importPriceLog(appState.priceLog);

  await importDocuments(appState.documents, appState.settlements, contractIdMap);

  // 4. Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  Import Summary');
  console.log('='.repeat(60));

  const lines = [
    ['Settings',       counts.settings],
    ['Contracts',      counts.contracts],
    ['Rolls',          counts.rolls],
    ['Hedges',         counts.hedges],
    ['Positions',      counts.positions],
    ['Crop Inventory', counts.cropInventory],
    ['Bin Inventory',  counts.binInventory],
    ['Price Log',      counts.priceLog],
    ['Documents',      counts.documents],
  ];

  let totalOk = 0, totalFail = 0;
  for (const [label, { ok, fail }] of lines) {
    if (ok > 0 || fail > 0) {
      const status = fail > 0 ? '  *** ERRORS' : '';
      console.log(`  ${label.padEnd(16)} ${String(ok).padStart(4)} ok  ${String(fail).padStart(4)} failed${status}`);
    }
    totalOk += ok;
    totalFail += fail;
  }

  console.log('  ' + '-'.repeat(40));
  console.log(`  ${'Total'.padEnd(16)} ${String(totalOk).padStart(4)} ok  ${String(totalFail).padStart(4)} failed`);

  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const err of errors) {
      console.log(`    - ${err}`);
    }
  }

  console.log('');
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('\nUnexpected error:', e);
  process.exit(2);
});
