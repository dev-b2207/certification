import * as d3 from 'd3';
import { addLabelFormatting } from '../../Functions/designFunctions';
import { IRelativeDateSetting, ISlicer } from '../../interfaces';
import { Visual } from '../../visual';
import { applyRelativeSelection, formatDate } from './renderDate';
function createRelativeTypeOption(relativeDateSetting: IRelativeDateSetting) {
  const possibleOptions = [
    { key: 'showLast', value: 'In Last' },
    { key: 'showNext', value: 'In Next' },
    { key: 'showThis', value: 'In This' },
    { key: 'showBefore', value: 'Is Before' },
    { key: 'showAfter', value: 'Is After' },
    { key: 'showBetween', value: 'Is Between' },
  ];
  return possibleOptions.filter((option) => relativeDateSetting[option.key as keyof IRelativeDateSetting]).map((option) => option.value);
}
function createRelativeRangeOption(relativeDateSetting: IRelativeDateSetting) {
  const possibleOptions = [
    { key: 'days', value: 'Days' },
    { key: 'weeks', value: 'Weeks' },
    { key: 'months', value: 'Months' },
  //  { key: 'quarters', value: 'Quarters' },
    { key: 'years', value: 'Years' },
  ];
  const options = [
    'Select',
    ...possibleOptions.filter((option) => relativeDateSetting[option.key as keyof IRelativeDateSetting]).map((option) => option.value),
  ];
  return options;
}
export function getInclusionLabel(durationType: string): string {
  switch (durationType) {
    case 'Days':
      return 'Include Today';
    case 'Weeks':
      return 'Include Current Week';
    case 'Months':
      return 'Include Current Month';
    case 'Years':
      return 'Include Current Year';
    default:
      return 'Include Today';
  }
}

function setupDateTypeDropdown(
  self: Visual,
  relativeDateContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  dateSlicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  slicer: ISlicer,
  relativeDateSetting: IRelativeDateSetting,
  minDate: string,
  maxDate: string
) {
  const dateTypeContainter = relativeDateContainer
    .append('div')
    .classed('dateTypeContainer', true)
    .style('position', 'relative')
    .style('display', 'inline-block');

  const dateTypeSelect = dateTypeContainter
    .append('div')
    .classed('dateTypeSelect', true)
    .classed('slicerDropdowns', true)
    .classed('relativeSelect', true)
    .text(relativeDateSetting.dateType)
    .style('background-color', '#ffffff');

  dateTypeSelect.style('padding-right', '20px').style('box-sizing', 'border-box');
  addLabelFormatting(self, dateTypeSelect, 'label', true);

  const dropdownIcon = dateTypeContainter.append('i').classed('dropdownIcon', true).classed('bi bi-chevron-down', true).style('font-size', '9px').style('color', '#555');
  dropdownIcon
    .style('position', 'absolute')
    .style('right', '6px')
    .style('top', '50%')
    .style('transform', 'translateY(-50%)')
    .style('font-size', '12px')
    .style('color', '#555')
    .style('pointer-events', 'none');

  const dateTypeDropdownList = dateTypeContainter.append('div').attr('class', 'relativeDropdownList').style('display', 'none');
  const updateDateInputVisibility = (selectedDateType: string) => {
    const startDateInput = dateSlicerContainer.select('.startDateInput');
    const endDateInput = dateSlicerContainer.select('.endDateInput');
    startDateInput.style('display', ['Is After', 'Is Between'].includes(selectedDateType) ? 'inline-block' : 'none');
    endDateInput.style('display', ['Is Before', 'Is Between'].includes(selectedDateType) ? 'inline-block' : 'none');
  };

  const toggleDateTypeDropdown = () => {
    const isOpening = dateTypeDropdownList.style('display') === 'none';
    dateTypeDropdownList.style('display', isOpening ? 'block' : 'none');
    dropdownIcon.classed('bi bi-chevron-down', !isOpening).classed('bi bi-chevron-up', isOpening);
    updateDateInputVisibility(dateTypeSelect.text());
    applyRelativeSelection(self, dateSlicerContainer, slicer.slicerSetting, minDate, maxDate);
  };

  dateTypeSelect.on('click', toggleDateTypeDropdown);
  dateTypeDropdownList
    .selectAll('div')
    .data(createRelativeTypeOption(relativeDateSetting))
    .enter()
    .append('div')
    .attr('class', 'relativeDropdownItem')
    .text((d) => d)
    .on('click', (_, d) => {
      dateTypeSelect.text(d);
      updateDateInputVisibility(d);
      toggleDateTypeDropdown();
    });
  addLabelFormatting(self, dateTypeDropdownList, 'label', true);
}

function setupDurationAndInclusionControls(
  self: Visual,
  relativeDateContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  dateSlicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  slicer: ISlicer,
  relativeDateSetting: IRelativeDateSetting,
  minDate: string,
  maxDate: string
) {
  const dateType = relativeDateSetting.dateType;
  const durationInput = relativeDateContainer
    .append('input')
    .on('change', () => applyRelativeSelection(self, dateSlicerContainer, slicer.slicerSetting, minDate, maxDate))
    .attr('id', 'duration')
    .attr('type', 'number')
    .classed('slicerInputs', true)
    .attr('value', relativeDateSetting.duration)
    .style('width', '60px')
    .style('display', ['In Last', 'In Next'].includes(dateType) ? 'inline-block' : 'none');
  addLabelFormatting(self, durationInput, 'label', true);

  const durationTypeContainter = relativeDateContainer
    .append('div')
    .classed('durationTypeContainer', true)
    .style('position', 'relative')
    .style('display', ['In This', 'In Last', 'In Next'].includes(dateType) ? 'inline-block' : 'none');
  const durationTypeSelect = durationTypeContainter
    .append('div')
    .classed('durationTypeSelect', true)
    .classed('slicerDropdowns', true)
    .classed('relativeSelect', true)
    .text(relativeDateSetting.durationType)
    .style('background-color', '#ffffff');

  durationTypeSelect.style('padding-right', '20px').style('box-sizing', 'border-box');
  addLabelFormatting(self, durationTypeSelect, 'label', true);
  const durationDropdownIcon = durationTypeContainter.append('i').classed('dropdownIcon', true).classed('bi bi-chevron-down', true).style('font-size', '9px').style('color', '#555');
  durationDropdownIcon
    .style('position', 'absolute')
    .style('right', '6px')
    .style('top', '50%')
    .style('transform', 'translateY(-50%)')
    .style('font-size', '12px')
    .style('color', '#555')
    .style('pointer-events', 'none');
  const durationTypeDropdownList = durationTypeContainter.append('div').attr('class', 'relativeDropdownList').style('display', 'none');
  const toggleDurationTypeDropdown = () => {
    const isOpening = durationTypeDropdownList.style('display') === 'none';
    durationTypeDropdownList.style('display', isOpening ? 'block' : 'none');
    durationDropdownIcon.classed('bi bi-chevron-down', !isOpening).classed('bi bi-chevron-up', isOpening);
    applyRelativeSelection(self, dateSlicerContainer, slicer.slicerSetting, minDate, maxDate);
  };

  durationTypeSelect.on('click', toggleDurationTypeDropdown);
  durationTypeDropdownList
    .selectAll('div')
    .data(createRelativeRangeOption(relativeDateSetting))
    .enter()
    .append('div')
    .attr('class', 'relativeDropdownItem')
    .text((d) => d)
    .on('click', (_, d) => {
      durationTypeSelect.text(d);
      toggleDurationTypeDropdown();
    });
  addLabelFormatting(self, durationTypeDropdownList, 'label', true);

  const inclusionContainer = relativeDateContainer
    .append('div')
    .classed('inclusionContainer', true)
    .style('position', 'relative')
    .style('display', ['In Last', 'In Next'].includes(dateType) && !slicer.slicerSetting.relativeDateSetting.isCurrent ? 'inline-block' : 'none');
  const inclusionWrapper = inclusionContainer.append('label').style('cursor', 'pointer').classed('inclusionSelect', true);
  inclusionWrapper
    .append('input')
    .attr('type', 'checkbox')
    .classed('inclusionCheckbox', true)
    .property('checked', !!relativeDateSetting.isIncluded)
    .on('click', function () {
      applyRelativeSelection(self, dateSlicerContainer, slicer.slicerSetting, minDate, maxDate);
    });
  inclusionWrapper.append('span').classed('inclusionLabel', true).style('margin-left', '6px').text(getInclusionLabel(relativeDateSetting.durationType));
}

export function renderRelativeDateUI(
  self: Visual,
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  dateSlicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  slicer: ISlicer
) {
  const minDateValue = new Date(slicer.min);
  const maxDateValue = new Date(slicer.max);
  const minDate = formatDate(minDateValue);
  const maxDate = formatDate(maxDateValue);
  const relativeDateSetting = slicer.slicerSetting.relativeDateSetting;
  const relativeDateContainer = container.append('div').classed('relativeDateContainer', true);
  setupDateTypeDropdown(self, relativeDateContainer, dateSlicerContainer, slicer, relativeDateSetting, minDate, maxDate);
  setupDurationAndInclusionControls(self, relativeDateContainer, dateSlicerContainer, slicer, relativeDateSetting, minDate, maxDate);
}


