// Tests for lib/domain-age.js — the registration-date selection logic.
//
// The regression these pin down: a Quick Scan of mycontent.academy reported the
// domain as "recently registered" when it was 3+ years old. The fixture below is
// the real RDAP response for that domain, and it is adversarial on purpose:
// events[0] is "expiration" (a FUTURE date), the newest event is "last update of
// RDAP database", and "last changed" sits between them. Only one of the four is
// the creation date. Every naive picker gets this wrong.

const test = require('node:test');
const assert = require('node:assert');
const { selectRegistrationEvent, toAge, registrableDomain } = require('../lib/domain-age');

// Real response from rdap.identitydigital.services, 2026-10-29.
const MYCONTENT_ACADEMY_EVENTS = [
  { eventAction: 'expiration', eventDate: '2027-10-12T04:32:30.772Z' },
  { eventAction: 'registration', eventDate: '2023-10-12T04:32:30.772Z' },
  { eventAction: 'last changed', eventDate: '2026-09-17T04:19:29.89Z' },
  { eventAction: 'last update of RDAP database', eventDate: '2026-10-29T02:26:24.817Z' },
];

test('selects the registration event from the real mycontent.academy record', () => {
  assert.strictEqual(
    selectRegistrationEvent(MYCONTENT_ACADEMY_EVENTS),
    '2023-10-12T04:32:30.772Z'
  );
});

test('does not pick events[0], the newest event, or "last changed"', () => {
  const picked = selectRegistrationEvent(MYCONTENT_ACADEMY_EVENTS);
  const naive = {
    'events[0]': MYCONTENT_ACADEMY_EVENTS[0].eventDate,
    'events[last]': MYCONTENT_ACADEMY_EVENTS[MYCONTENT_ACADEMY_EVENTS.length - 1].eventDate,
    'newest by date': MYCONTENT_ACADEMY_EVENTS
      .slice()
      .sort((a, b) => Date.parse(b.eventDate) - Date.parse(a.eventDate))[0].eventDate,
    'last changed': '2026-09-17T04:19:29.89Z',
  };
  for (const [strategy, date] of Object.entries(naive)) {
    assert.notStrictEqual(picked, date, `must not select via ${strategy}`);
  }
});

test('the selected date yields the correct age, not a recent one', () => {
  const age = toAge(selectRegistrationEvent(MYCONTENT_ACADEMY_EVENTS), 'rdap');
  assert.strictEqual(age.status, 'known');
  assert.ok(age.days > 1100, `expected 3+ years, got ${age.days} days`);
  assert.strictEqual(age.iso.slice(0, 10), '2023-10-12');
  assert.strictEqual(age.source, 'rdap');
});

test('refuses to guess when no registration event is present', () => {
  // A record edit is not a creation date. Returning null here is what makes the
  // caller report "unknown" instead of inventing an age.
  assert.strictEqual(selectRegistrationEvent([
    { eventAction: 'last changed', eventDate: '2026-09-17T04:19:29.89Z' },
    { eventAction: 'expiration', eventDate: '2027-10-12T04:32:30.772Z' },
  ]), null);
});

test('eventAction matching is case-insensitive and tolerates malformed entries', () => {
  assert.strictEqual(
    selectRegistrationEvent([{ eventAction: 'Registration', eventDate: '2020-01-01T00:00:00Z' }]),
    '2020-01-01T00:00:00Z'
  );
  for (const bad of [null, undefined, [], [null], [{}], [{ eventAction: 42 }], 'nope']) {
    assert.strictEqual(selectRegistrationEvent(bad), null, `input ${JSON.stringify(bad)}`);
  }
});

test('parses 2-digit fractional seconds with Z suffix', () => {
  // "2026-09-17T04:19:29.89Z" has only two fractional digits — a shape that
  // trips naive date handling.
  const age = toAge('2023-10-12T04:32:30.772Z', 'rdap');
  assert.strictEqual(age.status, 'known');
  assert.strictEqual(toAge('2024-01-01T00:00:00.89Z', 'rdap').status, 'known');
  assert.strictEqual(toAge('2024-01-01T00:00:00Z', 'rdap').status, 'known');
});

test('rejects a future registration date rather than calling it a new domain', () => {
  const future = new Date(Date.now() + 86400000 * 365).toISOString();
  assert.strictEqual(toAge(future, 'rdap'), null);
});

test('rejects unparseable dates instead of returning NaN or 0 days', () => {
  for (const bad of ['', null, undefined, 'not-a-date', '2023-13-45T99:99:99Z', 42, {}]) {
    assert.strictEqual(toAge(bad, 'rdap'), null, `input ${JSON.stringify(bad)}`);
  }
});

test('a domain registered today is 0 days old, and still "known"', () => {
  // 0 must mean "genuinely new", never "we could not tell".
  const age = toAge(new Date().toISOString(), 'rdap');
  assert.strictEqual(age.status, 'known');
  assert.strictEqual(age.days, 0);
});

test('normalizes hostnames from URLs, www, case and trailing dots', () => {
  for (const [input, expected] of [
    ['https://mycontent.academy/', 'mycontent.academy'],
    ['https://www.MyContent.Academy/path?q=1', 'mycontent.academy'],
    ['mycontent.academy', 'mycontent.academy'],
    ['mycontent.academy.', 'mycontent.academy'],
    ['http://example.co.uk/a/b', 'example.co.uk'],
  ]) {
    assert.strictEqual(registrableDomain(input), expected, `input ${input}`);
  }
  for (const bad of ['', null, undefined, 'localhost', 'not a domain']) {
    assert.strictEqual(registrableDomain(bad), null, `input ${JSON.stringify(bad)}`);
  }
});
