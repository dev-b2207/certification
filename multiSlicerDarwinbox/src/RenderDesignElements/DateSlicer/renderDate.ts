import { max, min, Selection } from 'd3';
import { isNil } from 'lodash';
import moment from 'moment';
import noUiSlider from 'nouislider';
import { calculateRelativeDates } from '../../Functions/dateFunctions';
import { addLabelFormatting } from '../../Functions/designFunctions';
import { ISlicer, ISlicerSetting } from '../../interfaces';
import { Visual } from '../../visual';
import { getInclusionLabel, renderRelativeDateUI } from './renderRelativeDate';

function timestamp(str) {
  return new Date(str).getTime();
}

// Convert timestamp to date string
export function formatDate(date) {
  return moment(date).format('YYYY-MM-DD');
}

export function applyRelativeSelection(
  self: Visual,
  dateSlicerContainer: Selection<HTMLDivElement, any, null, undefined>,
  slicerSetting: ISlicerSetting,
  minDate: string,
  maxDate: string
) {
  const dateType = dateSlicerContainer.select('.dateTypeSelect').text();
  const isCurrent = slicerSetting.relativeDateSetting.isCurrent;
  const isIncluded = dateSlicerContainer.select('.inclusionCheckbox').property('checked');
  const duration = parseInt(dateSlicerContainer.select('#duration').property('value'));
  const durationType = dateSlicerContainer.select('.durationTypeSelect').text();
  const isRelative = slicerSetting.relativeDate;

  dateSlicerContainer.select('#duration').style('display', null);
  dateSlicerContainer.select('.durationTypeContainer').style('display', null);
  dateSlicerContainer.select('.inclusionContainer').style('display', null);

  const labelText = getInclusionLabel(durationType);
  dateSlicerContainer.select('.inclusionLabel').text(labelText);

  dateSlicerContainer
    .select('.startDateInput')
    .style('display', 'none')
    .attr('min', isRelative ? null : minDate)
    .attr('max', isRelative ? null : maxDate);
  dateSlicerContainer
    .select('.endDateInput')
    .style('display', 'none')
    .attr('min', isRelative ? null : minDate)
    .attr('max', isRelative ? null : maxDate);

  const isAfter = dateType === 'Is After';
  const isBefore = dateType === 'Is Before';
  let startDate: Date = isBefore ? new Date(minDate) : new Date(dateSlicerContainer.attr('startDate'));
  let endDate: Date = isAfter ? new Date(maxDate) : new Date(dateSlicerContainer.attr('endDate'));

  if (dateType === 'In This') {
    dateSlicerContainer.select('#duration').style('display', 'none');
    dateSlicerContainer.select('.durationTypeContainer').style('display', null);
    dateSlicerContainer.select('.inclusionContainer').style('display', 'none');
  } else if (dateType === 'In Next' || dateType === 'In Last') {
    dateSlicerContainer.select('#duration').attr('display', null);
    dateSlicerContainer.select('.durationTypeContainer').style('display', null);
    dateSlicerContainer.select('.inclusionContainer').style('display', slicerSetting.relativeDateSetting.isCurrent ? 'none' : null);
  }
  if (dateType === 'Is Before') {
    dateSlicerContainer.select('#duration').style('display', 'none');
    dateSlicerContainer.select('.durationTypeContainer').style('display', 'none');
    dateSlicerContainer.select('.inclusionContainer').style('display', 'none');
    dateSlicerContainer.select('.startDateInput').style('display', 'none');
    dateSlicerContainer.select('.endDateInput').style('display', null);
  } else if (dateType === 'Is After') {
    dateSlicerContainer.select('#duration').style('display', 'none');
    dateSlicerContainer.select('.durationTypeContainer').style('display', 'none');
    dateSlicerContainer.select('.inclusionContainer').style('display', 'none');
    dateSlicerContainer.select('.startDateInput').style('display', null);
    dateSlicerContainer.select('.endDateInput').style('display', 'none');
  } else if (dateType === 'Is Between') {
    dateSlicerContainer.select('#duration').style('display', 'none');
    dateSlicerContainer.select('.durationTypeContainer').style('display', 'none');
    dateSlicerContainer.select('.inclusionContainer').style('display', 'none');
    dateSlicerContainer.select('.startDateInput').style('display', null);
    dateSlicerContainer.select('.endDateInput').style('display', null);
  }

  if (slicerSetting.relativeDateSetting.isCurrent) {
    dateSlicerContainer.select('.inclusionContainer').style('display', 'none');
  }

  const relStartEnd = calculateRelativeDates(dateType as any, duration, durationType as any, isCurrent, isIncluded);

  if (!isNil(relStartEnd)) {
    startDate = relStartEnd.startDate;
    endDate = relStartEnd.endDate;

    dateSlicerContainer.attr('startDate', formatDate(startDate));
    dateSlicerContainer.attr('endDate', formatDate(endDate));

    const selectionMade = ['In Last', 'In Next', 'In This'].includes(dateType) ? durationType !== 'Select' : true;
    dateSlicerContainer.attr('dateSelectionMade', selectionMade);
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  dateSlicerContainer.attr('startDate', formatDate(startDate));
  dateSlicerContainer.attr('endDate', formatDate(endDate));

  const instanceIndex = self.relativeSettingInstance.findIndex((el) => el.selector['metadata'] === slicerSetting.query);
  const relativeProps = { dateType, duration, durationType, isIncluded };
  if (instanceIndex === -1) {
    self.relativeSettingInstance.push({
      objectName: slicerSetting.objectName,
      selector: { metadata: slicerSetting.query },
      properties: relativeProps,
    });
  } else {
    self.relativeSettingInstance[instanceIndex].properties = relativeProps;
  }
}

function getInitialDateRange(slicer: ISlicer, minDateValue: Date, maxDateValue: Date, minDate: string, maxDate: string) {
  const isRelative = slicer.slicerSetting.relativeDate;
  const selectedDates = slicer.values.filter((el) => el.checked);
  let startDate = minDate;
  let endDate = maxDate;

  if (selectedDates.length > 0) {
    const startDateValue = new Date(min(selectedDates.map((el) => new Date(el.value))));
    const endDateValue = new Date(max(selectedDates.map((el) => new Date(el.value))));
    startDate = formatDate(isRelative ? startDateValue : startDateValue.getTime() < minDateValue.getTime() ? minDateValue : startDateValue);
    endDate = formatDate(isRelative ? endDateValue : endDateValue.getTime() > maxDateValue.getTime() ? maxDateValue : endDateValue);
  }

  return { startDate, endDate };
}

function renderRelativeDateInputs(
  self: Visual,
  container: Selection<HTMLDivElement, unknown, null, undefined>,
  dateSlicerContainer: Selection<HTMLDivElement, any, null, undefined>,
  slicer: ISlicer,
  minDate: string,
  maxDate: string,
  startDate: string,
  endDate: string
) {
  const dateType = slicer.slicerSetting.relativeDateSetting.dateType;
  const relativeDateSetting = slicer.slicerSetting.relativeDateSetting;
  const relStartEnd = calculateRelativeDates(
    relativeDateSetting.dateType,
    relativeDateSetting.duration,
    relativeDateSetting.durationType,
    relativeDateSetting.isCurrent,
    relativeDateSetting.isIncluded
  );

  let startDateValue = startDate;
  let endDateValue = endDate;
  if (relStartEnd) {
    startDateValue = formatDate(relStartEnd.startDate);
    endDateValue = formatDate(relStartEnd.endDate);
  }

  renderRelativeDateUI(self, container, dateSlicerContainer, slicer);
  const relativeContainer = container.select('.relativeDateContainer');
  const startDateInput = relativeContainer
    .append('input')
    .classed('startDateInput', true)
    .classed('dateInput', true)
    .classed('slicerInputs', true)
    .attr('type', 'date')
    .attr('value', startDateValue)
    .attr('min', minDate)
    .attr('max', maxDate)
    .style('display', ['Is After', 'Is Between'].includes(dateType) ? 'inline-block' : 'none');
  addLabelFormatting(self, startDateInput, 'label', false);

  const endDateInput = relativeContainer
    .append('input')
    .classed('endDateInput', true)
    .classed('dateInput', true)
    .classed('slicerInputs', true)
    .attr('type', 'date')
    .attr('value', endDateValue)
    .attr('min', minDate)
    .attr('max', maxDate)
    .style('display', ['Is Before', 'Is Between'].includes(dateType) ? 'inline-block' : 'none');
  addLabelFormatting(self, endDateInput, 'label', false);
}

function renderAbsoluteDateInputs(
  self: Visual,
  container: Selection<HTMLDivElement, unknown, null, undefined>,
  minDate: string,
  maxDate: string,
  startDate: string,
  endDate: string
) {
  const startDateInput = container
    .append('input')
    .classed('startDateInput', true)
    .classed('dateInput', true)
    .classed('slicerInputs', true)
    .attr('type', 'date')
    .attr('value', startDate)
    .attr('min', minDate)
    .attr('max', maxDate)
    .style('display', 'inline-block')
    .style('margin', '5px');
  addLabelFormatting(self, startDateInput, 'label', false);
  const endDateInput = container
    .append('input')
    .classed('endDateInput', true)
    .classed('dateInput', true)
    .classed('slicerInputs', true)
    .attr('type', 'date')
    .attr('value', endDate)
    .attr('min', minDate)
    .attr('max', maxDate)
    .style('display', 'inline-block')
    .style('margin', '5px');
  addLabelFormatting(self, endDateInput, 'label', false);
}

function bindDateInputHandlers(
  self: Visual,
  slicer: ISlicer,
  container: Selection<HTMLDivElement, unknown, null, undefined>,
  dateSlicerContainer: Selection<HTMLDivElement, any, null, undefined>,
  minDate: string,
  maxDate: string,
  startDate: string,
  endDate: string
) {
  if (slicer.slicerSetting.relativeDate) {
    container.select('.startDateInput').on('change', () => {
      dateSlicerContainer.attr('startDate', container.select('.startDateInput').property('value'));
      dateSlicerContainer.attr('dateSelectionMade', true);
      applyRelativeSelection(self, dateSlicerContainer, slicer.slicerSetting, minDate, maxDate);
    });
    container.select('.endDateInput').on('change', () => {
      dateSlicerContainer.attr('endDate', container.select('.endDateInput').property('value'));
      dateSlicerContainer.attr('dateSelectionMade', true);
      applyRelativeSelection(self, dateSlicerContainer, slicer.slicerSetting, minDate, maxDate);
    });
    return;
  }

  if (slicer.slicerSetting.slider) {
    const sliderDiv = dateSlicerContainer.append('div').classed('slider', true).attr('id', 'slider');
    noUiSlider.create(sliderDiv.node(), {
      start: [timestamp(startDate), timestamp(endDate)],
      connect: true,
      range: { min: timestamp(minDate), max: timestamp(maxDate) },
      step: 24 * 60 * 60 * 1000,
      margin: 5,
      behaviour: 'tap-drag',
    });
  }

  container.select('.startDateInput').on('change', () => {
    dateSlicerContainer.attr('dateSelectionMade', true);
    dateSlicerContainer.attr('startDate', container.select('.startDateInput').property('value'));
    if (slicer.slicerSetting.slider) {
      const dateSlider = dateSlicerContainer.select('.slider').node() as any;
      if (dateSlider && dateSlider.noUiSlider) {
        dateSlider.noUiSlider.set([timestamp(container.select('.startDateInput').property('value')), null]);
      }
    }
  });

  container.select('.endDateInput').on('change', () => {
    dateSlicerContainer.attr('dateSelectionMade', true);
    dateSlicerContainer.attr('endDate', container.select('.endDateInput').property('value'));
    if (slicer.slicerSetting.slider) {
      const dateSlider = dateSlicerContainer.select('.slider').node() as any;
      if (dateSlider && dateSlider.noUiSlider) {
        dateSlider.noUiSlider.set([null, timestamp(container.select('.endDateInput').property('value'))]);
      }
    }
  });

  if (slicer.slicerSetting.slider) {
    const dateSlider = dateSlicerContainer.select('.slider').node() as any;
    if (dateSlider && dateSlider.noUiSlider) {
      dateSlider.noUiSlider.on('set', function (values, handle) {
        dateSlicerContainer.attr('dateSelectionMade', true);
        if (handle === 0) {
          dateSlicerContainer.attr('startDate', formatDate(parseInt(`${values[0]}`)));
          container.select('.startDateInput').attr('value', formatDate(parseInt(`${values[0]}`)));
        } else {
          dateSlicerContainer.attr('endDate', formatDate(parseInt(`${values[1]}`)));
          container.select('.endDateInput').attr('value', formatDate(parseInt(`${values[1]}`)));
        }
      });
    }
  }
}

export function renderDateSlicer(self: Visual, slicer: ISlicer, slicerContainer: Selection<HTMLDivElement, unknown, null, undefined>) {
  const minDateValue = new Date(slicer.min);
  const maxDateValue = new Date(slicer.max);
  const minDate = formatDate(minDateValue);
  const maxDate = formatDate(maxDateValue);
  const { startDate, endDate } = getInitialDateRange(slicer, minDateValue, maxDateValue, minDate, maxDate);

  const dateSlicerContainer = slicerContainer
    .append('div')
    .classed('dateSlicerContainer', true)
    .data([slicer])
    .attr('startDate', startDate)
    .attr('endDate', endDate)
    .attr('table', slicer.target.table)
    .attr('column', slicer.target.column)
    // .style("background", designSettings.slicerBackColor)
    .attr('dateSelectionMade', false);

  const container = dateSlicerContainer.append('div');
  if (slicer.slicerSetting.relativeDate) {
    renderRelativeDateInputs(self, container, dateSlicerContainer, slicer, minDate, maxDate, startDate, endDate);
  } else {
    renderAbsoluteDateInputs(self, container, minDate, maxDate, startDate, endDate);
  }

  bindDateInputHandlers(self, slicer, container, dateSlicerContainer, minDate, maxDate, startDate, endDate);
}
