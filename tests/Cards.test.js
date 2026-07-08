/**
 * Cards.js is mostly CardService widget wiring, which only exists inside a
 * live Google Calendar session and cannot be unit tested (see docs/README.md
 * "Testing" section for why, and the manual test plan that covers it
 * instead). The one pure function it exports is covered here.
 */

var Cards = require('../src/Cards.js');

describe('Cards.formatStatusLabel', function () {
  it('labels a success status', function () {
    expect(Cards.formatStatusLabel('success')).toBe('✅');
  });

  it('labels a fail status', function () {
    expect(Cards.formatStatusLabel('fail')).toBe('❌');
  });

  it('labels a null status as not set', function () {
    expect(Cards.formatStatusLabel(null)).toBe('');
  });
});
