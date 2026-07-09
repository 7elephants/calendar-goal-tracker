/**
 * HomeCard.js is mostly CardService widget wiring, which only exists inside
 * a live Google Calendar session and cannot be unit tested (see README.md's
 * "Testing" section for why, and the manual test plan that covers it
 * instead). The one pure function it exports is covered here.
 */

var HomeCard = require('../src/HomeCard.js');

describe('HomeCard.formatStatusLabel', function () {
  it('labels a success status', function () {
    expect(HomeCard.formatStatusLabel('success')).toBe('✅');
  });

  it('labels a fail status', function () {
    expect(HomeCard.formatStatusLabel('fail')).toBe('❌');
  });

  it('labels a null status as not set', function () {
    expect(HomeCard.formatStatusLabel(null)).toBe('');
  });
});
