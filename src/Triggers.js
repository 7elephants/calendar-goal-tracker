/**
 * ---
 * file: src/Triggers.js
 * workflow:
 *   invocation: "Entry points registered in appsscript.json (addOns.calendar.homepageTrigger / eventOpenTrigger)."
 *   steps:
 *     - step: 1
 *       call: "onHomepage(e)"
 *       input: "Calendar add-on event object (Apps Script runtime callback)"
 *       output: "CardService.Card for today, via CodeHelpers.buildHomeCardOrErrorCard_()"
 *     - step: 2
 *       call: "onCalendarEventOpen(e)"
 *       input: "Calendar add-on event object with e.calendar.id and the opened event"
 *       output: "same home card as onHomepage (kept simple: opening any event just surfaces the tracker)"
 * ---
 */

function onHomepage(e) {
  return buildHomeCardOrErrorCard_(todayDateKey_());
}

function onCalendarEventOpen(e) {
  return buildHomeCardOrErrorCard_(todayDateKey_());
}
