import { select } from 'd3';
import * as d3 from 'd3-selection';
import { addLabelFormatting } from '../Functions/designFunctions';
import { calculateTimeRange } from '../Functions/timeFunction';
import { ISlicer, ISlicerSetting, TimeCondition } from '../interfaces';
import { Visual } from '../visual';

// Enum for time conditions
export enum TimeConditionEnum {
  Is = 'Is',
  IsNot = 'Is not',
  IsGreaterThan = 'Is greater than',
  IsLessThan = 'Is less than',
  IsBetween = 'Is between',
  IsEmpty = 'Is empty',
  IsNotEmpty = 'Is not empty',
}

const conditionOptions = [
  TimeConditionEnum.Is,
  TimeConditionEnum.IsNot,
  TimeConditionEnum.IsGreaterThan,
  TimeConditionEnum.IsLessThan,
  TimeConditionEnum.IsBetween,
  TimeConditionEnum.IsEmpty,
  TimeConditionEnum.IsNotEmpty,
];
let startTime = '00:00:00';
let endTime = '23:59:59';

export function setStartTime(startValue: string, endValue: string) {
  startTime = startValue || '00:00:00';
  endTime = endValue || '23:59:59';
}

// Helper arrays for condition checking
const noTimeConditions = [TimeConditionEnum.IsEmpty, TimeConditionEnum.IsNotEmpty];

// Helper to apply selection
function updateTime(self: Visual, timeSlicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>, slicer: ISlicer) {
  const fromVal = select('.fromTimeInput').property('value') || '00:00:00';
  const toVal = select('.toTimeInput').property('value') || '23:59:59';
  const condition = timeSlicerContainer.attr('condition') || TimeConditionEnum.Is;

  const timeRange = calculateTimeRange(condition as TimeCondition, fromVal, toVal);

  if (timeRange) {
    timeSlicerContainer.attr('startDate', timeRange.startTime);
    timeSlicerContainer.attr('endDate', timeRange.endTime);
  } else {
    timeSlicerContainer.attr('startDate', null);
    timeSlicerContainer.attr('endDate', null);
  }

  applyTimeSelection(self, timeSlicerContainer, slicer.slicerSetting);
}
export function timePickerExactTime(startTime: string, endTime: string) {
  startTime = startTime || '00:00:00';
  endTime = endTime || '23:59:59';
  return { startTime, endTime };
}

function renderTimePicker(self: Visual, timeSlicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>, slicer: ISlicer) {
  const condition = timeSlicerContainer.attr('condition') || TimeConditionEnum.Is;

  timeSlicerContainer.selectAll('.timeInputWrapper').remove();

  // function timeToNumber(timeStr) {
  //   const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  //   return hours * 3600 + minutes * 60 + seconds; // total seconds since midnight
  // }

  // const selectedValues = slicer.values.filter((el) => el.checked);
  // const sortedTime = selectedValues
  //   .map((el) => {
  //     return {
  //       value: el.value ? timeToNumber(el.value) : el.value,
  //       display: el.value,
  //     };
  //   })
  //   .sort((a, b) => a.value - b.value);
  // let startTime = sortedTime[0]?.display || '00:00:00';
  // let endTime = sortedTime[sortedTime.length - 1]?.display || '23:59:59';

  // if (condition === TimeConditionEnum.IsNot && slicer.values.length > 0) {
  //   startTime = slicer.values.find((el) => el.value?.includes('IsNot'))?.value?.replaceAll('IsNot', '') || startTime;
  //   endTime = startTime;
  // }
  // console.log(startTime, endTime);

  const timeInput = timeSlicerContainer
    .append('div')
    .attr('class', 'timeInputWrapper')
    .style('display', 'flex')
    .style('gap', '8px')
    .style('width', '85px');

  const fromTimeInput = timeInput
    .append('input')
    .attr('type', 'time')
    .attr('step', '1')
    .classed('timeInput', true)
    .classed('fromTimeInput', true)
    .classed('slicerInputs', true)
    .attr('placeholder', 'From')
    .style('border', '1px solid #ccc')
    .property('value', startTime);

  const toTimeInput = timeInput
    .append('input')
    .attr('type', 'time')
    .attr('step', '1')
    .classed('timeInput', true)
    .classed('toTimeInput', true)
    .classed('slicerInputs', true)
    .attr('placeholder', 'To')
    .style('border', '1px solid #ccc')
    .property('value', endTime);

  // Apply label formatting to time inputs
  addLabelFormatting(self, fromTimeInput, 'label', true);
  addLabelFormatting(self, toTimeInput, 'label', true);

  // const singleTimeConditions = ["Is", "Is not", "Is greater than", "Is less than"];
  // const dualTimeCondition = "Is between";
  const noTimeConditionsArray = noTimeConditions;

  // === Condition handling ===
  switch (condition) {
    case TimeConditionEnum.Is:
    case TimeConditionEnum.IsNot:
    case TimeConditionEnum.IsGreaterThan:
      // only fromTimeInput is used
      fromTimeInput.on('change', () => updateTime(self, timeSlicerContainer, slicer));
      toTimeInput.style('display', 'none').property('disabled', true);
      break;

    case TimeConditionEnum.IsLessThan:
      // only toTimeInput is used
      toTimeInput.on('change', () => updateTime(self, timeSlicerContainer, slicer));
      fromTimeInput.style('display', 'none').property('disabled', true);
      break;

    case TimeConditionEnum.IsBetween: {
      // both from and to, swap if needed
      const swapIfNeeded = () => {
        const fromVal = fromTimeInput.property('value');
        const toVal = toTimeInput.property('value');

        if (fromVal && toVal && fromVal > toVal) {
          fromTimeInput.property('value', toVal);
          toTimeInput.property('value', fromVal);
        }
        updateTime(self, timeSlicerContainer, slicer);
      };
      fromTimeInput.on('change', swapIfNeeded);
      toTimeInput.on('change', swapIfNeeded);
      break;
    }

    default:
      if (noTimeConditionsArray.includes(condition as TimeConditionEnum)) {
        fromTimeInput.style('display', 'none').property('disabled', true);
        toTimeInput.style('display', 'none').property('disabled', true);
      }
      break;
  }
}
export function renderTimeSlicer(self: Visual, slicer: ISlicer, slicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
  function toggleConditionDropdown() {
    const display = conditionDropdownList.style('display');
    const isOpening = display === 'none';

    conditionDropdownList.style('display', isOpening ? 'block' : 'none');

    dropdownIcon.classed('bi bi-chevron-down', !isOpening).classed('bi bi-chevron-up', isOpening);
  }

  slicerContainer.selectAll('.timeSlicerContainer').remove();

  const timeSlicerContainer = slicerContainer
    .append('div')
    .attr('class', 'timeSlicerContainer')
    .style('display', 'flex')
    .style('flex-direction', 'row')
    .style('align-items', 'flex-start')
    .style('gap', '5px')
    .style('flex-wrap', 'wrap')
    .style('width', 'calc(96% - 20px)')
    .attr('table', slicer.target.table)
    .attr('column', slicer.target.column)
    // Left false until the user picks a condition or a time. applyFilter skips an
    // untouched time slicer entirely; without that it contributes its default state and
    // blanks every downstream visual.
    .attr('dateSelectionMade', self.touchedSlicers.has(slicer.query) || slicer.values.some((value) => value.checked) ? 'true' : 'false')
    .attr('condition', slicer.slicerSetting.timeSetting.timeCondition)
    .attr('type', 'time');

  const conditionContainer = timeSlicerContainer.append('div').style('position', 'relative');

  const conditionSelect = conditionContainer
    .append('div')
    .classed('timeConditionSelect', true)
    .classed('slicerDropdowns', true)
    .text(slicer.slicerSetting.timeSetting.timeCondition)
    .on('click', toggleConditionDropdown);

  conditionSelect.style('padding-right', '20px').style('box-sizing', 'border-box');

  addLabelFormatting(self, conditionSelect, 'label', true);

  // **Dropdown icon**
  const dropdownIcon = conditionContainer
    .append('i')
    .classed('dropdownIcon', true)
    .classed('bi bi-chevron-down', true)
    .style('font-size', '9px')
    .style('color', '#555');

  dropdownIcon
    .style('position', 'absolute')
    .style('right', '6px')
    .style('top', '50%')
    .style('transform', 'translateY(-50%)')
    .style('font-size', '12px')
    .style('color', '#555')
    .style('pointer-events', 'none');

  const conditionDropdownList = conditionContainer.append('div').attr('class', 'timeDropdownList').style('display', 'none');

  conditionDropdownList
    .selectAll('div')
    .data(conditionOptions)
    .enter()
    .append('div')
    .attr('class', 'timeDropdownItem')
    .text((d) => d)
    .on('click', (event, d) => {
      conditionSelect.text(d);
      timeSlicerContainer.attr('condition', d);
      toggleConditionDropdown();
      applyTimeSelection(self, timeSlicerContainer, slicer.slicerSetting);
      updateTime(self, timeSlicerContainer, slicer);
      renderTimePicker(self, timeSlicerContainer, slicer);
    });

  addLabelFormatting(self, conditionDropdownList, 'label', true);

  renderTimePicker(self, timeSlicerContainer, slicer);
}

export function applyTimeSelection(self: Visual, timeSlicerContainer, slicerSetting: ISlicerSetting) {
  const timeCondition = timeSlicerContainer.attr('condition') || TimeConditionEnum.Is;

  // Only ever reached from a user interaction, so this is the point the slicer
  // becomes eligible to contribute to the applied filter.
  timeSlicerContainer.attr('dateSelectionMade', true);
  self.touchedSlicers.add(slicerSetting.query);

  const instanceIndex = self.relativeSettingInstance.findIndex((el) => el.selector['metadata'] === slicerSetting.query);
  const relativeProps = { timeCondition };
  if (instanceIndex === -1) {
    self.timeSettingInstance.push({
      objectName: slicerSetting.objectName,
      selector: { metadata: slicerSetting.query },
      properties: relativeProps,
    });
  } else {
    self.timeSettingInstance[instanceIndex].properties = relativeProps;
  }
}
