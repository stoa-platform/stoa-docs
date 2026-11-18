import assert from 'node:assert/strict';
import test from 'node:test';
import {notifyReadinessFailures} from '../notify-readiness-failures.mjs';

const env = {
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_REPOSITORY: 'stoa-platform/stoa-docs',
  GITHUB_RUN_ID: '123',
  GITHUB_SHA: 'a819c4483529fa5cfda8d30b9348bcef8531dd14',
  STOA_N8N_CI_EVENT_TOKEN: 'test-token',
};

const testResult = (projectName, status, resultStatus) => ({
  projectName, status, results: [{status: resultStatus}],
});

const report = {
  suites: [
    {
      suites: [{
        specs: [{
          title: 'Readiness stays in view when switching EN → FR',
          tests: [
            testResult('desktop', 'unexpected', 'failed'),
            testResult('mobile', 'flaky', 'failed'),
          ],
        }, {
          title: 'Readiness stays in view when switching FR → EN',
          tests: [
            testResult('desktop', 'unexpected', 'passed'),
            testResult('mobile', 'unexpected', 'timedOut'),
          ],
        }],
      }],
    },
  ],
  errors: [{message: 'Runner-level error'}],
};

test('sends only failed scenarios, with profile, commit and run link, using stable IDs', async () => {
  const requests = [];
  const send = async (url, request) => {
    assert.equal(url, 'https://n8n.gostoa.dev/webhook/stoa-events');
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers['X-STOA-Event-Token'], 'test-token');
    assert.equal(request.headers['User-Agent'], 'stoa-docs-ci/1.0');
    requests.push(JSON.parse(request.body));
    return Response.json({status: requests.length <= 2 ? 'posted' : 'duplicate'});
  };

  assert.equal(await notifyReadinessFailures(report, env, send), 2);
  assert.equal(await notifyReadinessFailures(report, {...env, GITHUB_RUN_ATTEMPT: '2'}, send), 2);
  const [english, french, sameEnglish, sameFrench] = requests;
  assert.deepEqual(english, sameEnglish);
  assert.deepEqual(french, sameFrench);
  assert.notEqual(english.event_id, french.event_id);
  assert.match(english.event_id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(english.source, 'ci');
  assert.equal(english.type, 'ci.alert');
  assert.equal(english.link, 'https://github.com/stoa-platform/stoa-docs/actions/runs/123');
  assert.match(english.summary, /a819c4483529fa5cfda8d30b9348bcef8531dd14.*\[desktop\].*EN → FR/);
  assert.match(french.summary, /\[mobile\].*FR → EN/);
});

test('skips runner errors and calls out a missing credential before any request', async () => {
  const send = () => assert.fail('unexpected HTTP request');
  assert.equal(await notifyReadinessFailures({suites: [], errors: report.errors}, {}, send), 0);
  await assert.rejects(notifyReadinessFailures(report, {}, send), /STOA_N8N_CI_EVENT_TOKEN is missing/);
});

test('reports unconfirmed delivery and attempts the remaining alert', async () => {
  let count = 0;
  const send = async () => ++count === 1
    ? Response.json({status: 'rejected'})
    : Response.json({status: 'posted'});
  await assert.rejects(notifyReadinessFailures(report, env, send), /did not confirm 1 alert.*rejected/);
  assert.equal(count, 2);
});
