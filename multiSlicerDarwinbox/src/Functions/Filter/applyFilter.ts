import * as d3 from 'd3';
import { max, min, select, selectAll } from 'd3';
import moment from 'moment';
import { flatten, intersection, isEmpty, isNil, uniqBy } from 'lodash';
import { FilterType, ITupleFilter } from 'powerbi-models';
import { IListValue, ISelectedData, ISlicer, ITarget } from '../../interfaces';
import { setStartTime, TimeConditionEnum } from '../../RenderDesignElements/renderTimePicker';
import { Visual } from '../../visual';
import { getTarget, getTargetColumnName, saveSetting, untilde } from '../visualTransform';
import FilterAction = powerbi.FilterAction;

// Import NumericCondition enum from renderNumber
enum NumericCondition {
  IsLessThan = 'Is less than',
  IsLessThanOrEqual = 'Is less than or equal to',
  IsGreaterThan = 'Is greater than',
  IsGreaterThanOrEqual = 'Is greater than or equal to',
  IsBetweenIncluding = 'Is Between (including end values)',
  IsBetweenExcluding = 'Is Between (excluding end values)',
}

export function clearJSONFilter(self: Visual) {
  self.host.applyJsonFilter(undefined, 'general', 'filter', FilterAction.merge);
}

export function removeFilter(self: Visual, slicer: ISlicer) {
  slicer.show = false;
  const slicerStateIndex = self.customSettings.saveState.slicerVisibility.findIndex((el) => el.query === slicer.query);
  self.customSettings.saveState.slicerVisibility.splice(slicerStateIndex, 1);
  saveSetting(self, 'saveState', 'slicerVisibility', JSON.stringify(self.customSettings.saveState.slicerVisibility));

  const selectedData = getSelectedDataFromUI();

  if (selectedData.length > 0) {
    applyFilter(self, getSelectedDataFromUI());
  } else {
    clearJSONFilter(self);
  }
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function toHHMMSS(value: any): string {
  if (!value) return null;
  // Power BI time columns arrive as Date objects or ISO strings.
  // Always extract via UTC to avoid local-timezone offset shifting the time.
  const d = value instanceof Date ? value : new Date(value);
  if (!isNaN(d.getTime())) {
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }
  // Already a plain HH:MM:SS string — return as-is
  return String(value);
}

function toSeconds(timeValue: any): number {
  const normalized = toHHMMSS(timeValue);
  const [h, m, s] = normalized.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function collectListSelectedData(selectedData: ISelectedData[]) {
  selectAll('.checkboxList')
    .nodes()
    .forEach((listNode) => {
      const listData = select(listNode).data()[0] as ISlicer;
      select(listNode)
        .selectAll('.checkboxDiv')
        .nodes()
        .filter((checkboxNode) => select(checkboxNode).select('input').property('checked') && listData.show)
        .forEach((node) => {
          const datapoint = select(node).data()[0] as IListValue;
          if (datapoint.isSelectAll) {
            return;
          }

          if (datapoint.hierarchyData.isHieararchyStructure) {
            if (datapoint.hierarchyData.isLeaf && !isNil(datapoint.value)) {
              const targets = datapoint.hierarchyData.hierarchyGroup.fields.map((el) => getTarget(el));
              const values = untilde(datapoint.uid).split('|');
              values.shift();
              selectedData.push({
                targets,
                values,
                indexes: datapoint.indexes,
                isDateTime: false,
                uid: datapoint.uid,
                slicerQuery: listData.query,
              });
            }
            return;
          }

          selectedData.push({
            targets: [datapoint.target],
            values: [datapoint.value],
            indexes: datapoint.indexes,
            isDateTime: false,
            uid: datapoint.uid,
            slicerQuery: listData.query,
          });
        });
    });
}

function collectDateTimeSelectedData(selectedData: ISelectedData[], silent: boolean) {
  selectAll('.dateSlicerContainer,.timeSlicerContainer')
    .nodes()
    .forEach((node) => {
      const slicerData = select(node).data()[0] as ISlicer;
      const isTime = select(node).attr('type') === 'time';
      const condition = select(node).attr('condition');
      const isRelativeDate = slicerData.slicerSetting.relativeDate;

      if (!slicerData.show) {
        return;
      }

      // A time slicer only constrains the report once the user has actually set a
      // condition or a time. Without this it contributes its default state to the tuple
      // filter and every downstream visual comes back empty.
      if (isTime && select(node).attr('dateSelectionMade') !== 'true') {
        return;
      }

      const target: ITarget = { table: select(node).attr('table'), column: select(node).attr('column') };
      let startDateTime: any = select(node).attr('startDate');
      let endDateTime: any = select(node).attr('endDate');
      const minDate = min(slicerData.values.map((el) => new Date(el.value)));
      const maxDate = max(slicerData.values.map((el) => new Date(el.value)));

      if (!isTime) {
        startDateTime = moment(startDateTime).toDate();
        endDateTime = moment(endDateTime).toDate();
        startDateTime.setHours(0, 0, 0, 0);
        endDateTime.setHours(0, 0, 0, 0);
        minDate.setHours(0, 0, 0, 0);
        maxDate.setHours(0, 0, 0, 0);
      }

      const dateType = !isTime && isRelativeDate ? select(node).select('.dateTypeSelect').text() : null;
      const durationType = !isTime && isRelativeDate ? select(node).select('.durationTypeSelect').text() : null;
      const isCalculatedRelativeDate = ['In Last', 'In Next', 'In This'].includes(dateType);

      if (!isTime) {
        if (isRelativeDate && durationType === 'Select' && isCalculatedRelativeDate) {
          return;
        }
        if (!isRelativeDate && startDateTime.getTime() === minDate.getTime() && endDateTime.getTime() === maxDate.getTime()) {
          return;
        }
      }

      const selectedDates = slicerData.values.filter((el) => {
        const dataDate = new Date(el.value);
        dataDate.setHours(0, 0, 0, 0);
        if (isTime) {
          const startSeconds = startDateTime ? toSeconds(startDateTime) : null;

          const endSeconds = endDateTime ? toSeconds(endDateTime) : null;
          // Cross-filter recomputes call this collector purely to read the current
          // selection, so they must not push the time picker's module state around.
          if (!silent) {
            setStartTime(startDateTime, endDateTime);
          }

          const sec = el.value ? toSeconds(el.value) : null;

          switch (condition) {
            case TimeConditionEnum.IsGreaterThan:
              return sec > startSeconds;

            case TimeConditionEnum.IsLessThan:
              return sec < endSeconds;

            case TimeConditionEnum.IsNot:
              return sec !== startSeconds;

            case TimeConditionEnum.IsEmpty:
              return isNil(el.value) || isEmpty(el.value);

            case TimeConditionEnum.IsNotEmpty:
              return !isNil(el.value) && !isEmpty(el.value);

            default:
              return sec >= startSeconds && sec <= endSeconds;
          }
        }
        return dataDate.getTime() >= startDateTime.getTime() && dataDate.getTime() <= endDateTime.getTime();
      });

      if (isTime && condition === TimeConditionEnum.IsNot) {
        startDateTime = `IsNot${startDateTime}`;
        endDateTime = `IsNot${endDateTime}`;
      }

      // For strict time conditions (IsGreaterThan / IsLessThan), skip pushing the
      // boundary value as a sentinel — it would otherwise leak into the filter and
      // include the exact boundary time in results, defeating the strict comparison.
      const isStrictTimeBound = isTime && (condition === TimeConditionEnum.IsGreaterThan || condition === TimeConditionEnum.IsLessThan);

      // No data in the selected range — push a sentinel to force an empty filter result
      if (selectedDates.length === 0 && (!isRelativeDate || isCalculatedRelativeDate) && (!isTime || isStrictTimeBound)) {
        selectedData.push({
          targets: [target],
          values: [new Date('1900-01-01T00:00:00')],
          indexes: [],
          isDateTime: true,
          uid: 'no-data-sentinel',
          slicerQuery: slicerData.query,
        });
        return;
      }

      if (!isCalculatedRelativeDate && !isStrictTimeBound) {
        selectedData.push({
          targets: [target],
          values: [startDateTime],
          indexes: [],
          isDateTime: true,
          uid: `${startDateTime}`,
          slicerQuery: slicerData.query,
        });
      }
      selectedDates.forEach((datapoint) => {
        selectedData.push({
          targets: [target],
          values: [datapoint.value],
          indexes: datapoint.indexes,
          isDateTime: true,
          uid: datapoint.uid,
          slicerQuery: slicerData.query,
        });
      });
      if (!isCalculatedRelativeDate && !isStrictTimeBound) {
        selectedData.push({
          targets: [target],
          values: [endDateTime],
          indexes: [],
          isDateTime: true,
          uid: `${endDateTime}`,
          slicerQuery: slicerData.query,
        });
      }
    });
}

function collectNumericSelectedData(selectedData: ISelectedData[]) {
  selectAll('.numberSlicerContainer')
    .nodes()
    .forEach((node) => {
      const slicerData = select(node).data()[0] as ISlicer;
      if (!slicerData.show) {
        return;
      }

      // Same rule as the time slicer: an untouched numeric field must not join the
      // filter. Its default condition is "Is less than" seeded with the data maximum,
      // which silently excluded every row holding that maximum from the whole report.
      if (select(node).attr('userModified') !== 'true') {
        return;
      }

      const condition = select(node).attr('condition');
      const ignoreMin = condition === NumericCondition.IsGreaterThan || condition === NumericCondition.IsBetweenExcluding;
      const ignoreMax = condition === NumericCondition.IsLessThan || condition === NumericCondition.IsBetweenExcluding;
      const minValue = Number(select(node).attr('minValue')) + (ignoreMin ? 0.000001 : 0);
      const maxValue = Number(select(node).attr('maxValue')) - (ignoreMax ? 0.000001 : 0);

      if (isNaN(minValue) || isNaN(maxValue)) {
        return;
      }

      const target: ITarget = { table: select(node).attr('table'), column: select(node).attr('column') };
      const dataMin = d3.min(slicerData.values.map((el) => Number(el.value)));
      const dataMax = d3.max(slicerData.values.map((el) => Number(el.value)));
      if (minValue === dataMin && maxValue === dataMax) {
        return;
      }

      selectedData.push({
        targets: [target],
        values: [minValue],
        indexes: [],
        isDateTime: false,
        uid: `${minValue}`,
        slicerQuery: slicerData.query,
      });
      slicerData.values
        .filter((el) => Number(el.value) >= minValue && Number(el.value) <= maxValue)
        .forEach((datapoint) => {
          selectedData.push({
            targets: [target],
            values: [datapoint.value],
            indexes: datapoint.indexes,
            isDateTime: false,
            uid: datapoint.uid,
            slicerQuery: slicerData.query,
          });
        });
      selectedData.push({
        targets: [target],
        values: [maxValue],
        indexes: [],
        isDateTime: false,
        uid: `${maxValue}`,
        slicerQuery: slicerData.query,
      });
    });
}

export interface ISelectionReadOptions {
  /**
   * Read the current selection without touching any renderer state. Used by the
   * cross-filter recompute, which runs on every interaction and must stay side-effect free.
   */
  silent?: boolean;
}

export function getSelectedDataFromUI(options?: ISelectionReadOptions) {
  const selectedData: ISelectedData[] = [];
  collectListSelectedData(selectedData);
  collectDateTimeSelectedData(selectedData, options?.silent === true);
  collectNumericSelectedData(selectedData);
  return selectedData;
}

export function applyFilter(self: Visual, selectedData: ISelectedData[]) {
  const target: ITarget[] = uniqBy(flatten(selectedData.map((el) => el.targets)), (el) => `${el.table}|${el.column}`);
  //Return if no target found
  if (target.length === 0) {
    return;
  }

  const values = [];
  const categorical = self.options.dataViews[0].categorical;
  const allIndexesByTarget = target.map((targetData) =>
    flatten(
      selectedData
        .filter((el) => {
          return el.targets.some((elTarget) => `${elTarget.table}|${elTarget.column}` === `${targetData.table}|${targetData.column}`);
        })
        .map((el) => el.indexes)
    )
  );

  const commonIndexes = allIndexesByTarget.length > 0 ? allIndexesByTarget.reduce((common, currentArray) => intersection(common, currentArray)) : [];

  commonIndexes.forEach((index) => {
    const tupleValue = [];
    target.forEach((targetData) => {
      const categoryField = categorical.categories.find((category) => {
        return getTargetColumnName(category) === targetData.column;
      });
      tupleValue.push({
        value: categoryField.values[index],
      });
    });
    const exists = values.findIndex((value) => value.map((el) => el.value).join('|') === tupleValue.map((el) => el.value).join('|')) !== -1;
    if (!exists) {
      values.push(tupleValue);
    }
  });

  addDummyData(self, selectedData, target, values);

  const filter: ITupleFilter = {
    $schema: 'https://powerbi.com/product/schema#tuple',
    filterType: FilterType.Tuple,
    operator: 'In',
    target: target,
    values: values,
  };

  if (values.length > 0) {
    self.host.applyJsonFilter(filter, 'general', 'filter', FilterAction.merge);
  }

  if (self.relativeSettingInstance.length > 0) {
    self.host.persistProperties({
      merge: self.relativeSettingInstance,
    });
  }

  if (self.numberSettingInstance.length > 0) {
    self.host.persistProperties({
      merge: self.numberSettingInstance,
    });
  }
  if (self.hierarchyStateInstance.length > 0) {
    self.host.persistProperties({
      merge: self.hierarchyStateInstance,
    });
  }

  if (self.timeSettingInstance.length > 0) {
    self.host.persistProperties({
      merge: self.timeSettingInstance,
    });
  }
}

//Add Filter even if data doesnt exist
export function addDummyData(self: Visual, selectedData: ISelectedData[], target: ITarget[], values: { value: string }[][]) {
  selectedData.forEach((data) => {
    const selectedTargets = data.targets;
    const searchValues = data.values;
    const targetIndexes = selectedTargets.map((el) =>
      target.findIndex((elTarget) => `${elTarget.table}|${elTarget.column}` === `${el.table}|${el.column}`)
    );

    const exists = values
      .map((valueEl) => targetIndexes.map((targetIndex) => valueEl[targetIndex]))
      .some(
        (valueEl) =>
          valueEl
            .map((el) => el.value)
            .filter((el) => !isNil(el))
            .join('|') === searchValues.join('|')
      );

    // const exists = values.map((el) => targetIndexes.map((targetIndex) => el[targetIndex]));
    if (!exists) {
      //!Need to add an exist logic to avoid adding unnecessary duplicates
      const dummyValue = target.map((elTarget, index) => {
        const isDateTime = self.options.dataViews[0].categorical.categories.find((cat) => getTargetColumnName(cat) === elTarget.column).source.type
          .dateTime;
        return targetIndexes.includes(index)
          ? { value: searchValues[targetIndexes.findIndex((targetIndex) => targetIndex === index)] || null }
          : { value: isDateTime ? new Date('9999-12-31') : null };
      });
      values.push(dummyValue);
    }
  });
}
