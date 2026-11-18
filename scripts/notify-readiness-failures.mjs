import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const endpoint = 'https://n8n.gostoa.dev/webhook/stoa-events';

function* failedScenarios(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        if (test.status === 'unexpected' &&
            test.results.some(({status}) => status === 'failed' || status === 'timedOut')) {
          yield `[${test.projectName}] ${spec.title}`;
        }
      }
    }
    yield* failedScenarios(suite.suites ?? []);
  }
}

function eventId(link, commit, scenario) {
  // UUIDv8 from a stable identity so reruns of the same GitHub Actions run deduplicate in n8n.
  const bytes = createHash('sha256').update(JSON.stringify([link, commit, scenario])).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export async function notifyReadinessFailures(report, env, send = fetch) {
  const scenarios = new Set(failedScenarios(report.suites));
  if (scenarios.size === 0) {
    return 0;
  }

  const token = env.STOA_N8N_CI_EVENT_TOKEN?.trim();
  if (!token) {
    throw new Error('STOA_N8N_CI_EVENT_TOKEN is missing. Configure the dedicated n8n CI emitter to deliver alerts.');
  }

  const commit = env.GITHUB_SHA;
  const link = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const prefix = `Échec Playwright en production sur docs.gostoa.dev (${commit}) — `;
  const deliveryErrors = [];
  for (const scenario of scenarios) {
    const alert = {
      event_id: eventId(link, commit, scenario),
      source: 'ci',
      type: 'ci.alert',
      summary: prefix + scenario.replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, 500 - prefix.length),
      link,
    };
    try {
      const response = await send(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'stoa-docs-ci/1.0',
          'X-STOA-Event-Token': token,
        },
        body: JSON.stringify(alert),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        deliveryErrors.push(`${alert.event_id} HTTP ${response.status}`);
        continue;
      }
      const {status} = await response.json();
      if (status !== 'posted' && status !== 'duplicate') {
        const reason = status === 'rejected' || status === 'failed' ? status : 'invalid response';
        deliveryErrors.push(`${alert.event_id} ${reason}`);
      }
    } catch {
      deliveryErrors.push(`${alert.event_id} transport or response error`);
    }
  }

  if (deliveryErrors.length > 0) {
    throw new Error(`n8n did not confirm ${deliveryErrors.length} alert(s). ${deliveryErrors.join(', ')}`);
  }
  return scenarios.size;
}

async function main(reportPath) {
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('::warning::Playwright produced no report. No failed scenario could be identified.');
      return;
    }
    throw new Error('Unable to read the Playwright JSON report.');
  }

  const count = await notifyReadinessFailures(report, process.env);
  console.log(count === 0
    ? 'No failed Playwright scenario to notify.'
    : `n8n confirmed ${count} Playwright alert(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
