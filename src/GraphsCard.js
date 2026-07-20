/**
 * ---
 * file: src/GraphsCard.js
 * workflow:
 *   invocation: "Called only by ActionHandlers.js's handleOpenGraphsCard/handleUpdateGraphsRange (via CodeHelpers.js's buildGraphsCardForRange_). The only file that touches the Charts/Utilities globals - turns pre-computed ChartData.js series into PNG images and lays out the Graphs card around them."
 *   steps:
 *     - step: 1
 *       call: "buildLineChartImageWidget_(title, dateKeys, seriesList, options)"
 *       input: "title: string, dateKeys: Array<'YYYY-MM-DD'>, seriesList: Array<{ label: string, values: number[] }> (one array-of-values per goal, same length as dateKeys), options: { maxValue?: number } (pins the Y-axis 0..maxValue, used for the 0-100% compliance chart)"
 *       output: "CardService.Image widget: builds a Charts.newLineChart() DataTable from dateKeys/seriesList (each dateKey converted via CodeHelpers.js's dateKeyToDate_ - GraphsCard.js has no requires block, so this and every other cross-file identifier below resolve as Apps Script globals, same as every other CardService file in src/), renders it via Chart.getAs('image/png'), and base64-encodes it into a 'data:image/png;base64,...' URL, since CardService.newImage() needs a URL, not a raw blob, and there is no other Drive/hosting step involved"
 *     - step: 2
 *       call: "buildChartSection_(title, dateKeys, seriesList, emptyMessage, options)"
 *       input: "same as buildLineChartImageWidget_, plus emptyMessage: string"
 *       output: "CardService.CardSection: the chart image widget, or a text paragraph with emptyMessage when seriesList is empty (no goals of that type in range) so Charts is never asked to render a series-less chart"
 *     - step: 3
 *       call: "buildGraphsCard(userFromDateKey, userToDateKeyExclusive, dateKeys, countSeriesList, complianceSeriesList)"
 *       input: "userFromDateKey/userToDateKeyExclusive: 'YYYY-MM-DD' (the selected timeframe, used only to seed the pickers), dateKeys: shared x-axis for both charts, countSeriesList/complianceSeriesList: Array<{ label, values }>"
 *       output: "CardService.Card titled 'Graphs': a timeframe section (This month/Last 30 days/This year preset buttons calling handleUpdateGraphsRange with a preset parameter, plus From/To DatePickers and an Apply range button calling the same handler with formInput instead), then the Cumulative days done section and the Compliance % section"
 * ---
 */

function buildLineChartImageWidget_(title, dateKeys, seriesList, options) {
  var dataTable = Charts.newDataTable().addColumn(Charts.ColumnType.DATE, 'Date');
  seriesList.forEach(function (series) {
    dataTable.addColumn(Charts.ColumnType.NUMBER, series.label);
  });
  dateKeys.forEach(function (dateKey, i) {
    var row = [dateKeyToDate_(dateKey)];
    seriesList.forEach(function (series) {
      row.push(series.values[i]);
    });
    dataTable.addRow(row);
  });

  var chartBuilder = Charts.newLineChart()
    .setDataTable(dataTable.build())
    .setTitle(title)
    .setDimensions(340, 200)
    .setLegendPosition(seriesList.length > 1 ? Charts.Position.BOTTOM : Charts.Position.NONE);

  if (options && typeof options.maxValue === 'number') {
    chartBuilder = chartBuilder.setRange(0, options.maxValue);
  }

  var blob = chartBuilder.build().getAs('image/png');
  var dataUri = 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());

  return CardService.newImage().setImageUrl(dataUri).setAltText(title);
}

function buildChartSection_(title, dateKeys, seriesList, emptyMessage, options) {
  var section = CardService.newCardSection().setHeader('<b>' + title + '</b>');
  if (seriesList.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText(emptyMessage));
  } else {
    section.addWidget(buildLineChartImageWidget_(title, dateKeys, seriesList, options));
  }
  return section;
}

function buildTimeframeSection_(userFromDateKey, userToDateKeyExclusive) {
  var presets = [
    ['This month', 'thisMonth'],
    ['Last 30 days', 'last30'],
    ['This year', 'thisYear']
  ];
  var presetButtons = CardService.newButtonSet();
  presets.forEach(function (preset) {
    var action = CardService.newAction().setFunctionName('handleUpdateGraphsRange').setParameters({ preset: preset[1] });
    presetButtons.addButton(
      CardService.newTextButton()
        .setText(preset[0])
        .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
        .setOnClickAction(action)
    );
  });

  var fromPicker = CardService.newDatePicker()
    .setFieldName('graphFromDate')
    .setTitle('From')
    .setValueInMsSinceEpoch(dateKeyToUtcMs(userFromDateKey));
  var toPicker = CardService.newDatePicker()
    .setFieldName('graphToDate')
    .setTitle('To')
    .setValueInMsSinceEpoch(dateKeyToUtcMs(addDaysToDateKey(userToDateKeyExclusive, -1)));

  var applyAction = CardService.newAction().setFunctionName('handleUpdateGraphsRange');
  var applyButton = CardService.newTextButton()
    .setText('Apply range')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(GOAL_COLOR_PRIMARY)
    .setOnClickAction(applyAction);

  return CardService.newCardSection()
    .setHeader('<b>Timeframe</b>')
    .addWidget(presetButtons)
    .addWidget(fromPicker)
    .addWidget(toPicker)
    .addWidget(applyButton);
}

function buildGraphsCard(userFromDateKey, userToDateKeyExclusive, dateKeys, countSeriesList, complianceSeriesList) {
  var header = CardService.newCardHeader().setTitle('Graphs');
  var timeframeSection = buildTimeframeSection_(userFromDateKey, userToDateKeyExclusive);
  var countSection = buildChartSection_(
    'Cumulative days done',
    dateKeys,
    countSeriesList,
    'No Count-only goals to chart in this range.'
  );
  var complianceSection = buildChartSection_(
    'Compliance %',
    dateKeys,
    complianceSeriesList,
    'No Pass/Fail goals to chart in this range.',
    { maxValue: 100 }
  );

  return CardService.newCardBuilder()
    .setHeader(header)
    .addSection(timeframeSection)
    .addSection(countSection)
    .addSection(complianceSection)
    .build();
}
