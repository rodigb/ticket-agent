import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCriteria, summarizeCriteria } from '../src/agent/criteriaChecks';

describe('checkCriteria', () => {
  const good = [
    'Given a registered email, When the user requests a reset, Then a single-use link is emailed.',
    'Given an expired link, When it is opened, Then the user sees an error and can request a new one.',
    'Given a valid link, When a new password is submitted, Then the user can log in with it.',
  ];

  it('scores a well-formed set', () => {
    const r = checkCriteria(good);
    assert.equal(r.count, 3);
    assert.equal(r.countOk, true);
    assert.equal(r.gwtRate, 1);
    assert.equal(r.hasFailureCase, true);
    assert.equal(r.vagueRate, 0);
    assert.equal(r.duplicates, 0);
  });

  it('flags non-Given/When/Then and vague wording', () => {
    const r = checkCriteria(['The page works properly', 'It behaves as expected', 'Looks good, user-friendly etc.']);
    assert.equal(r.gwtRate, 0);
    assert.equal(r.vagueRate, 1);
    assert.equal(r.hasFailureCase, false);
  });

  it('requires Given, then When, then Then, in that order', () => {
    assert.equal(checkCriteria(['Then x happens when y, given z']).gwtRate, 0);
    assert.equal(checkCriteria(['given z, when y, then x']).gwtRate, 1); // case-insensitive
  });

  it('counts near-duplicates but not distinct criteria', () => {
    const dup = checkCriteria([
      'Given a logged in user, When they click export, Then a Jira file downloads.',
      'Given a logged in user, When they click export, Then a Jira file is downloaded.',
      'Given an empty ticket, When export is clicked, Then an error is shown.',
    ]);
    assert.equal(dup.duplicates, 1);
    assert.equal(checkCriteria(good).duplicates, 0);
  });

  it('checks the 3 to 6 range at both ends', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => `Given state ${i}, When action ${i}, Then result ${i}`);
    assert.deepEqual([2, 3, 6, 7].map((n) => checkCriteria(items(n)).countOk), [false, true, true, false]);
  });

  it('handles an empty list without NaN', () => {
    const r = checkCriteria([]);
    assert.deepEqual(r, { count: 0, countOk: false, gwtRate: 0, hasFailureCase: false, vagueRate: 0, duplicates: 0 });
  });
});

describe('summarizeCriteria', () => {
  it('returns null for no tickets, not zeros', () => assert.equal(summarizeCriteria([]), null));
  it('averages across tickets', () => {
    const s = summarizeCriteria([
      checkCriteria(['Given a, When b, Then c', 'Given d, When e, Then f error', 'Given g, When h, Then i']),
      checkCriteria(['It works properly']),
    ])!;
    assert.equal(s.gwtRate, 0.5);
    assert.equal(s.countOkRate, 0.5);
    assert.equal(s.failureCaseRate, 0.5);
    assert.equal(s.vagueRate, 0.5);
  });
});