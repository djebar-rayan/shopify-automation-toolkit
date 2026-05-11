---
name: recurring-monitor
description: Sets up a recurring (weekly/monthly) automated Shopify audit via CronCreate or n8n, compares results with the previous audit and produces a delta progress report. Use when the user wants to schedule recurring audits, monitor KPI evolution over time, set up weekly/monthly Shopify store health checks, or track SEO improvement progress.
---

# Recurring Monitor

Sets up recurring automated Shopify audits and tracks KPI progress
over time.

## Instructions

### Step 1 — Choose a scheduling mode

**Option A — CronCreate (Claude Code native)**
- Runs directly in Claude Code through the `schedule` skill
- Requires Claude Code to be running at execution time

**Option B — n8n workflow (autonomous)**
- Runs even when Claude Code is closed
- Sends results via email/webhook

### Step 2 — Recommended cadence

| Use case | Cadence | Rationale |
|---|---|---|
| SEO tracking (meta) | Weekly | Changes take 1–2 weeks to propagate |
| Content tracking | Bi-weekly | Progressive enrichment |
| Stock/price watch | Daily | Fast-moving changes |
| Full audit | Monthly | Big-picture overview |

### Step 3 — Diff between audits

Modify `audit/full-audit.js` (or wrap it) to support `--diff`:

1. Save every audit with a timestamp in `audit-history/audit-YYYY-MM-DD.json`
2. Compute the delta vs the previous one
3. Generate a readable delta report

JS skeleton:

```javascript
const HIST = path.join(config.WORKSPACE, 'audit-history');
fs.mkdirSync(HIST, { recursive: true });
const today = new Date().toISOString().split('T')[0];
fs.writeFileSync(path.join(HIST, `audit-${today}.json`),
  JSON.stringify({ scores, products: analyzed.map(p => ({ id: p.id, score: p._a.score, flags: p._a.flags.map(f => f.code) })) }, null, 2));

if (process.argv.includes('--diff')) {
  const files = fs.readdirSync(HIST).sort();
  if (files.length >= 2) {
    const prev = JSON.parse(fs.readFileSync(path.join(HIST, files[files.length - 2]), 'utf8'));
    const curr = JSON.parse(fs.readFileSync(path.join(HIST, files[files.length - 1]), 'utf8'));
    generateDiffReport(prev, curr);
  }
}
```

### Step 4 — Configure Cron (Option A)

Via the `schedule` skill:

```
Create a weekly trigger (Monday 8am) that:
1. Runs "node audit/full-audit.js --diff"
2. Reads audit-report.md
3. Sends a summary of the changes
```

### Step 5 — Configure n8n (Option B)

Workflow:

1. **Trigger**: Schedule (cron `0 8 * * 1` = Monday 8am)
2. **Execute Command**: `node <path>/audit/full-audit.js --diff`
3. **Read File**: `audit-report.md`
4. **Email/Slack/Webhook**: send the summary

### Step 6 — Progress report format

```markdown
# Report — KPI evolution (week of {date})

## Progress
| KPI | Last week | This week | Delta |
|---|---|---|---|
| SEO score | X.X/10 | Y.Y/10 | +0.X |
| P1 issues | A | B | -C ✓ |
| Products without meta | A | B | -C ✓ |

## Applied corrections
- … (derived from the flag delta)

## Remaining work
- Priority 1: …
- Priority 2: …
```

### Step 7 — Alerts

Configure alerts when:

- The overall score drops by more than 0.5 point
- The active product count changes abruptly
- A flagship product loses its SEO meta (regression)

### Step 8 — Rotation

- Keep the last 12 audits (~ 3 months)
- Never delete the **first** audit (historical baseline)
- Store under `audit-history/` (gitignored by default)
