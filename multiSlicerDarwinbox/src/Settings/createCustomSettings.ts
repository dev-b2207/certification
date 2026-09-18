import { isNil } from 'lodash';
import {
  DateType,
  DurationType,
  ICustomSettings,
  IHierarchyGroup,
  INumberSetting,
  ITimeSetting,
  IRelativeDateSetting,
  ISlicerSetting,
  ISlicerVisibility,
  NumberForceSelectType,
  NumberType,
  SlicerType,
  TextForceSelectType,
  TimeCondition,
} from '../interfaces';
import { Visual } from '../visual';
import { getValue } from './objectEnumerationUtility';

export function getSlicerLabel(displayName: string, expr, query: string, isHierarchy: boolean) {
  //

  return isHierarchy ? expr?.arg?.hierarchy || query.split('.')[1] : displayName;
}

function createSlicerSetting(self: Visual, sectionIndex: number, hierarchyGroups: IHierarchyGroup[]) {
  const objectName = `section${sectionIndex}`;
  const sectionFields = self.options.dataViews[0].metadata.columns.filter((el) => el.roles[objectName]);
  const slicerSettings: ISlicerSetting[] = [];
  const parentHierarchies = hierarchyGroups.map((el) => el.fields[0]).map((el) => el.source.queryName);

  sectionFields.forEach((field) => {
    const objects = field.objects;
    const query = field.queryName;
    const isParentHierarchy = parentHierarchies.includes(field.queryName);
    if (field.expr['kind'] === 7 && !parentHierarchies.includes(field.queryName)) {
      return;
    }

    const defaultSlicerType = field.type.dateTime ? SlicerType.dateRange : field.type.numeric ? SlicerType.numeric : SlicerType.dropdown;
    const slicerType = getValue<SlicerType>(objects, objectName, 'slicerType', defaultSlicerType);
    const singleSelect = getValue<boolean>(objects, objectName, 'singleSelect', false);
    const selectAll = getValue<boolean>(objects, objectName, 'selectAll', true) && !singleSelect;
    const search = getValue<boolean>(objects, objectName, 'search', false);
    const forceSelect = isParentHierarchy ? false : getValue<boolean>(objects, objectName, 'forceSelect', false);
    const textForceSelectType = getValue<TextForceSelectType>(objects, objectName, 'textForceSelectType', TextForceSelectType.first);
    const numberForceSelectType = getValue<NumberForceSelectType>(objects, objectName, 'numberForceSelectType', NumberForceSelectType.min);

    const hieararchyState = JSON.parse(getValue<string>(objects, objectName, 'hieararchyState', '[]'));

    const relativeDate = getValue<boolean>(objects, objectName, 'relativeDate', false);
    const isCurrent = getValue<boolean>(objects, objectName, 'isCurrent', false);
    const dateType = getValue<DateType>(objects, objectName, 'dateType', 'In Last');
    const duration = getValue<number>(objects, objectName, 'duration', 1);
    const durationType = getValue<DurationType>(objects, objectName, 'durationType', 'Days');
    const isIncluded = getValue<boolean>(objects, objectName, 'isIncluded', true);

    const showLast = getValue<boolean>(objects, objectName, 'showLast', true);
    const showNext = getValue<boolean>(objects, objectName, 'showNext', true);
    const showThis = getValue<boolean>(objects, objectName, 'showThis', true);
    const showBefore = getValue<boolean>(objects, objectName, 'showBefore', true);
    const showAfter = getValue<boolean>(objects, objectName, 'showAfter', true);
    const showBetween = getValue<boolean>(objects, objectName, 'showBetween', true);
    const days = getValue<boolean>(objects, objectName, 'days', true);
    const weeks = getValue<boolean>(objects, objectName, 'weeks', true);
    const months = getValue<boolean>(objects, objectName, 'months', true);
   // const quarters = getValue<boolean>(objects, objectName, 'quarters', true);
    const years = getValue<boolean>(objects, objectName, 'years', true);
    const singleDate = getValue<Date>(objects, objectName, 'singleDate', null);
    const fromDate = getValue<Date>(objects, objectName, 'fromDate', null);
    const toDate = getValue<Date>(objects, objectName, 'toDate', null);

    const relativeDateSetting: IRelativeDateSetting = {
      isCurrent,
      dateType,
      duration,
      durationType,
      isIncluded,
      singleDate,
      fromDate,
      toDate,
      showLast,
      showNext,
      showThis,
      showBefore,
      showAfter,
      showBetween,
      days,
      weeks,
      months,
     // quarters,
      years,
    };

    const numberType = getValue<NumberType>(objects, objectName, 'numberType', 'Is less than');
    const value = getValue<number>(objects, objectName, 'value', 0);
    const decimal = getValue<number>(objects, objectName, 'decimal', 0);
    const numberSetting: INumberSetting = {
      numberType,
      value,
      decimal,
    };

    const timeCondition = getValue<TimeCondition>(objects, objectName, 'timeCondition', 'Is');

    const timeSetting: ITimeSetting = {
      timeCondition,
    };

    const slider = getValue<boolean>(objects, objectName, 'slider', true);

    slicerSettings.push({
      objectName,
      slicerType,
      singleSelect,
      selectAll,
      search,
      forceSelect,
      textForceSelectType,
      numberForceSelectType,
      relativeDate,
      relativeDateSetting,
      numberSetting,
      timeSetting,
      isNumeric: field.type.numeric,
      isHierarchy: isParentHierarchy,
      label: getSlicerLabel(field.displayName, field.expr, query, isParentHierarchy),
      query,
      hieararchyState,
      slider,
    });
  });
  return slicerSettings;
}

export function createCustomSettings(self: Visual, hierarchyGroups: IHierarchyGroup[]): ICustomSettings {
  const dataView = self.options.dataViews[0];
  const options = dataView.metadata.objects;

  const slicerVisibilityValue = getValue<string>(options, `saveState`, 'slicerVisibility', undefined);
  const slicerVisibility: ISlicerVisibility[] = isNil(slicerVisibilityValue) ? [] : JSON.parse(slicerVisibilityValue);

  return {
    section1: { slicerSettings: createSlicerSetting(self, 1, hierarchyGroups) },
    section2: { slicerSettings: createSlicerSetting(self, 2, hierarchyGroups) },
    section3: { slicerSettings: createSlicerSetting(self, 3, hierarchyGroups) },
    section4: { slicerSettings: createSlicerSetting(self, 4, hierarchyGroups) },
    section5: { slicerSettings: createSlicerSetting(self, 5, hierarchyGroups) },
    saveState: { slicerVisibility },
  };
}
