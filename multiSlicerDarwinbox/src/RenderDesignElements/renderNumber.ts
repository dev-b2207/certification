import * as d3 from 'd3';
import { addLabelFormatting } from '../Functions/designFunctions';
import { Visual } from '../visual';
import { ISlicer } from '../interfaces';
import { max, min } from 'd3';

// Enum for numeric conditions
enum NumericCondition {
  IsLessThan = 'Is less than',
  IsLessThanOrEqual = 'Is less than or equal to',
  IsGreaterThan = 'Is greater than',
  IsGreaterThanOrEqual = 'Is greater than or equal to',
  IsBetweenIncluding = 'Is Between (including end values)',
  IsBetweenExcluding = 'Is Between (excluding end values)'
}

// Helper arrays for condition checking
const lessThanConditions = [NumericCondition.IsLessThan, NumericCondition.IsLessThanOrEqual];
const greaterThanConditions = [NumericCondition.IsGreaterThan, NumericCondition.IsGreaterThanOrEqual];
const betweenConditions = [NumericCondition.IsBetweenIncluding, NumericCondition.IsBetweenExcluding];


function updateNumberSetting(self: Visual, slicer: ISlicer, condition: string) {
  const instanceIndex = self.numberSettingInstance.findIndex((inst) => inst.selector['metadata'] === slicer.slicerSetting.query);

  const numberSettingProps = { numberType: condition };

  if (instanceIndex === -1) {
    self.numberSettingInstance.push({
      objectName: slicer.slicerSetting.objectName,
      selector: { metadata: slicer.slicerSetting.query },
      properties: numberSettingProps,
    });
  } else {
    self.numberSettingInstance[instanceIndex].properties = numberSettingProps;
  }
}

function updateRangeAttrsAndPreview(numberSlicerContainer: d3.Selection<any, any, any, any>, self: Visual, slicer: ISlicer) {
  const dataMin = slicer.min;
  const dataMax = slicer.max;
  const condition = numberSlicerContainer.attr('condition') || NumericCondition.IsLessThan;

  // Get decimal places from slicer setting
  const decimalPlaces = slicer.slicerSetting.numberSetting.decimal || 2;

  // Get values directly from input elements
  const fromInput = numberSlicerContainer.select('.fromInput');
  const toInput = numberSlicerContainer.select('.toInput');
  
  const fromValue = parseFloat(fromInput.property('value'));
  const toValue = parseFloat(toInput.property('value'));

  let minValue = dataMin;
  let maxValue = dataMax;

  const lessThanConds = lessThanConditions;
  const greaterThanConds = greaterThanConditions;
  const betweenConds = betweenConditions;

  if (lessThanConds.includes(condition as NumericCondition) && !isNaN(toValue)) {
    maxValue = parseFloat(toValue.toFixed(decimalPlaces));
    minValue = dataMin;
  } else if (greaterThanConds.includes(condition as NumericCondition) && !isNaN(fromValue)) {
    minValue = parseFloat(fromValue.toFixed(decimalPlaces));
    maxValue = dataMax;
  } else if (betweenConds.includes(condition as NumericCondition) && !isNaN(fromValue) && !isNaN(toValue)) {
    minValue = parseFloat(Math.min(fromValue, toValue).toFixed(decimalPlaces));
    maxValue = parseFloat(Math.max(fromValue, toValue).toFixed(decimalPlaces));
  }

  numberSlicerContainer.attr('minValue', String(minValue)).attr('maxValue', String(maxValue));

  // Update saved setting with current input values
  let values: number[] = [];
  if (lessThanConds.includes(condition as NumericCondition) && !isNaN(toValue)) {
    values = [parseFloat(toValue.toFixed(decimalPlaces))];
  } else if (greaterThanConds.includes(condition as NumericCondition) && !isNaN(fromValue)) {
    values = [parseFloat(fromValue.toFixed(decimalPlaces))];
  } else if (betweenConds.includes(condition as NumericCondition) && !isNaN(fromValue) && !isNaN(toValue)) {
    values = [parseFloat(fromValue.toFixed(decimalPlaces)), parseFloat(toValue.toFixed(decimalPlaces))];
  }

  if (values.length > 0) {
    updateNumberSetting(self, slicer, condition);
  }
}

function renderNumberCondition(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, self: Visual, slicer: ISlicer) {
  const condition = container.attr('condition') || NumericCondition.IsLessThan;

  const selectedValues = slicer.values.filter((d) => d.checked);

  const numberStart = selectedValues.length > 0 ? min(selectedValues.map((el) => el.value)) : slicer.min;
  const numberEnd = selectedValues.length > 0 ? max(selectedValues.map((el) => el.value)) : slicer.max;

  container.selectAll('.numberInputWrapper').remove();

  const wrapper = container.append('div').attr('class', 'numberInputWrapper').style('display', 'flex').style('gap', '5px');

  // Get decimal places from slicer setting
  const decimalPlaces = slicer.slicerSetting.numberSetting.decimal; 
  const stepValue = Math.pow(10, -decimalPlaces); 

  // Always create both inputs
  const fromInput = wrapper
    .append('input')
    .attr('type', 'number')
    .attr('step', stepValue)
    .attr('placeholder', 'From')
    .classed('numberInput', true)
    .classed('slicerInputs', true)
    .classed('fromInput', true)
    .property('value', numberStart.toFixed(decimalPlaces));

  const toInput = wrapper
    .append('input')
    .attr('type', 'number')
    .attr('step', stepValue)
    .attr('placeholder', 'To')
    .classed('numberInput', true)
    .classed('slicerInputs', true)
    .classed('toInput', true)
    .property('value', numberEnd.toFixed(decimalPlaces));

  // Apply label formatting to number inputs
  addLabelFormatting(self, fromInput, 'label', true);
  addLabelFormatting(self, toInput, 'label', true);

  // Show/hide inputs based on condition
  const lessThanConds = lessThanConditions;
  const greaterThanConds = greaterThanConditions;
  const betweenConds = betweenConditions;

  if (lessThanConds.includes(condition as NumericCondition)) {
    fromInput.style('display', 'none');
    toInput.style('display', 'inline-block');
  } else if (greaterThanConds.includes(condition as NumericCondition)) {
    fromInput.style('display', 'inline-block');
    toInput.style('display', 'none');
  } else if (betweenConds.includes(condition as NumericCondition)) {
    fromInput.style('display', 'inline-block');
    toInput.style('display', 'inline-block');
  }

  // Handle input changes
  const applyChanges = () => {
    let values: number[] = [];
    
    if (lessThanConds.includes(condition as NumericCondition)) {
      const toVal = parseFloat(toInput.property('value'));
      if (!isNaN(toVal)) {
        values = [toVal];
        // Update the input display to maintain decimal formatting
        toInput.property('value', toVal.toFixed(decimalPlaces));
      }
    } else if (greaterThanConds.includes(condition as NumericCondition)) {
      const fromVal = parseFloat(fromInput.property('value'));
      if (!isNaN(fromVal)) {
        values = [fromVal];
        // Update the input display to maintain decimal formatting
        fromInput.property('value', fromVal.toFixed(decimalPlaces));
      }
    } else if (betweenConds.includes(condition as NumericCondition)) {
      const fromVal = parseFloat(fromInput.property('value'));
      const toVal = parseFloat(toInput.property('value'));
      if (!isNaN(fromVal) && !isNaN(toVal)) {
        values = [fromVal, toVal];
        // Update both input displays to maintain decimal formatting
        fromInput.property('value', fromVal.toFixed(decimalPlaces));
        toInput.property('value', toVal.toFixed(decimalPlaces));
      }
    }

    if (values.length > 0) {
      container.attr('userModified', 'true');
      self.touchedSlicers.add(slicer.query);
      updateNumberSetting(self, slicer, condition);
      updateRangeAttrsAndPreview(container, self, slicer);
    }
  };

  fromInput.on('change', applyChanges);
  toInput.on('change', applyChanges);
}

export function renderNumberSlicer(self: Visual, slicer: ISlicer, slicerContainer: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
  function toggleConditionDropdown() {
    const display = conditionDropdownList.style('display');
    const isOpening = display === 'none';

    conditionDropdownList.style('display', isOpening ? 'block' : 'none');

    dropdownIcon.classed('bi bi-chevron-down', !isOpening).classed('bi bi-chevron-up', isOpening);
  }

  slicerContainer.selectAll('.numberSlicerContainer').remove();

  const numberSlicerContainer = slicerContainer
    .append('div')
    .classed('numberSlicerContainer', true)
    .data([slicer])
    .attr('table', slicer.target.table)
    .attr('column', slicer.target.column);

  const initialCondition = slicer.slicerSetting.numberSetting.numberType;

  const conditionRow = numberSlicerContainer.append('div').classed('conditionRowNumber', true);

  const conditionContainer = conditionRow.append('div').style('position', 'relative');
  //.style("margin-bottom", "5px");

  const conditionSelect = conditionContainer
    .append('div')
    .classed('numberConditionSelect', true)
    .classed('slicerDropdowns', true)
    .text(initialCondition as any)
    .on('click', toggleConditionDropdown);
  //.text(initialCondition)

  conditionSelect.style('padding-right', '20px').style('box-sizing', 'border-box');

  addLabelFormatting(self, conditionSelect, 'label', true);

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

  const conditionDropdownList = conditionContainer.append('div').attr('class', 'numberDropdownList').style('display', 'none');

  //.style("padding", "4px");

  const conditionOptions = [
    NumericCondition.IsLessThan,
    NumericCondition.IsLessThanOrEqual,
    NumericCondition.IsGreaterThan,
    NumericCondition.IsGreaterThanOrEqual,
    NumericCondition.IsBetweenIncluding,
    NumericCondition.IsBetweenExcluding,
  ];

  conditionDropdownList
    .selectAll('div')
    .data(conditionOptions)
    .enter()
    .append('div')
    .attr('class', 'relativeDropdownItem')
    .text((d) => d)
    .on('click', (event, d) => {
      conditionSelect.text(d);
      numberSlicerContainer.attr('condition', d);
      numberSlicerContainer.attr('userModified', 'true');
      self.touchedSlicers.add(slicer.query);
      updateNumberSetting(self, slicer, d);

      toggleConditionDropdown();
      renderNumberCondition(numberSlicerContainer, self, slicer);
      updateRangeAttrsAndPreview(numberSlicerContainer, self, slicer);
    });

  addLabelFormatting(self, conditionDropdownList, 'label', true);

  numberSlicerContainer.attr('condition', initialCondition as any);

  // A slicer the user has already used, or one that is already part of the applied
  // filter, counts as touched - so a re-render (Apply, resize, bookmark, reopen) never
  // silently drops the user's selection.
  if (self.touchedSlicers.has(slicer.query) || slicer.values.some((value) => value.checked)) {
    numberSlicerContainer.attr('userModified', 'true');
    self.touchedSlicers.add(slicer.query);
  }

  renderNumberCondition(numberSlicerContainer, self, slicer);

  updateRangeAttrsAndPreview(numberSlicerContainer, self, slicer);
}
