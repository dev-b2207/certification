import { max, min } from 'd3';
import { isNil, uniqBy } from 'lodash';
import { IHierarchyData, IHierarchyGroup, IListValue, ISection, IViewModel, SlicerType } from '../interfaces';
import { createCustomSettings, getSlicerLabel } from '../Settings/createCustomSettings';
import { SectionSettings } from '../Settings/settings';
import { Visual } from '../visual';
import { enforceDefaultFiltering } from './Filter/defaultFiltering';
import { buildTree, checkParent, findAndCheckLeaf, getHieararchyFilteredValues } from './hierarchyFunctions';
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import VisualObjectInstance = powerbi.VisualObjectInstance;
function getSectionIndex(category: DataViewCategoryColumn) {
  const sectionIndexKeys = Object.keys(category.source.roles);
  const key = sectionIndexKeys[0];
  return parseInt(key.match(/\d+$/)[0]);
}

function getGroupQuery(category: DataViewCategoryColumn) {
  return category.source.queryName.substring(0, category.source.queryName.lastIndexOf('.'));
}

// Single-pass, memoised index lookup. See Functions/rowIndex.ts for why.
import { getAllIndexes } from './rowIndex';

export function getTargetColumnName(category: DataViewCategoryColumn) {
  const isHierarchy = category.identityFields?.length > 1 && category.source.expr['kind'] === 7;
  let column = category.source.queryName.split('.').pop();

  const identityFieldMatch = category?.identityFields?.find((el) => el['ref'] === column);
  const identityExprRef = category?.source?.identityExprs?.[0]?.['ref'];
  const hasIdentityExprMatch = identityExprRef === column;

  // Needed to get right field name for first field in hierarchy.
  // Support both identityFields and source.identityExprs references.
  if (isHierarchy && isNil(identityFieldMatch) && !hasIdentityExprMatch) {
    column = identityExprRef || column;
  }

  return column;
}

export function getTarget(category: DataViewCategoryColumn) {
  return {
    table: category.source.queryName.substr(0, category.source.queryName.indexOf('.')),
    column: getTargetColumnName(category),
  };
}

function getCategoryValues(self: Visual, category: DataViewCategoryColumn) {
  const categorical = self.options.dataViews[0].categorical;
  const categories = categorical.categories;

  return category.values.length === 0
    ? categories.find(
        (category) => category.source.queryName.split('.').pop() === category.source.queryName.split('.').pop() && category.values.length > 0
      )?.values || []
    : category.values;
}

export function getFilteredValues(self: Visual, category: DataViewCategoryColumn, getUnique: boolean) {
  const jsonFilters: any = self.options.jsonFilters ? self.options.jsonFilters[0] : undefined;

  const table = category.source.queryName.substr(0, category.source.queryName.indexOf('.'));
  const column = getTargetColumnName(category);
  const singleFieldFiltered = !isNil(jsonFilters) && !Array.isArray(jsonFilters.target);
  const targets = isNil(jsonFilters) ? [] : singleFieldFiltered ? [jsonFilters.target] : jsonFilters.target;
  const targetIndex = isNil(jsonFilters) ? -1 : targets.findIndex((el) => el.table === table && el.column === column);

  return targetIndex !== -1
    ? getUnique
      ? uniqBy(
          jsonFilters.values.map((el) => (singleFieldFiltered ? el : el[targetIndex].value)),
          (el) => el
        )
      : jsonFilters.values.map((el) => (singleFieldFiltered ? el : el[targetIndex].value))
    : [];
}

function getDummyHierarchyData(): IHierarchyData {
  return {
    collapsed: false,
    isLeaf: true,
    isHieararchyStructure: false,
    isBlank: false,
    hierarchyGroup: undefined,
  };
}

function populateListValuesForCategory(
  self: Visual,
  category: DataViewCategoryColumn,
  hierarchyGroups: IHierarchyGroup[],
  slicerType: SlicerType,
  slicerSetting,
  isDate: boolean,
  isNumeric: boolean,
  isParentHierarchy: boolean
) {
  const filteredValues = getFilteredValues(self, category, true);
  const categoryValues = getCategoryValues(self, category);
  const isDurationType = ['In Last, In Next, In This'].includes(slicerSetting.relativeDateSetting.dateType);
  const uniqCategoryValues = uniqBy(
    isDate && !isDurationType && slicerType === SlicerType.dateRange
      ? [...categoryValues, ...filteredValues].filter((el) => new Date(el).getTime() < new Date('9999-12-30').getTime())
      : (slicerType === SlicerType.numeric && isNumeric) || slicerType === SlicerType.time
      ? [...categoryValues, ...filteredValues]
      : categoryValues,
    (el) => el
  );

  const listValues: IListValue[] = [];
  const dummyHierarchyData = getDummyHierarchyData();

  if (isParentHierarchy) {
    const groupQuery = getGroupQuery(category);
    const hierarchyGroup = hierarchyGroups.find((group) => group.query === groupQuery);
    const hierarchyFields = hierarchyGroup.fields.map((field) => field.values);
    const hierarchyFilteredUIDs = getHieararchyFilteredValues(self, hierarchyGroup);
    buildTree(self, hierarchyFields, hierarchyGroup, hierarchyFilteredUIDs, slicerSetting, 1, listValues, '');
    findAndCheckLeaf(self, hierarchyGroup, listValues);
    checkParent(listValues);
  } else {
    uniqCategoryValues.forEach((uniqCategoryValue) => {
      if (isDate && isNil(uniqCategoryValue) && slicerType === SlicerType.dateRange) {
        return;
      }
      listValues.push({
        value: uniqCategoryValue,
        uid: uniqCategoryValue,
        checked: filteredValues.findIndex((el) => (isDate ? new Date(el).getTime() === new Date(uniqCategoryValue).getTime() : el === uniqCategoryValue)) !== -1,
        indexes: getAllIndexes(categoryValues, uniqCategoryValue),
        level: 1,
        isSelectAll: false,
        target: getTarget(category),
        hierarchyData: dummyHierarchyData,
        formatString: category.source.format,
      });
    });
  }

  if (slicerType !== SlicerType.dateRange && slicerType !== SlicerType.numeric && slicerType !== SlicerType.time && slicerSetting.selectAll) {
    listValues.unshift({
      value: 'Select All',
      checked: listValues.filter((el) => !el.hierarchyData.isBlank).every((el) => el.checked),
      indexes: [],
      level: 1,
      isSelectAll: true,
      uid: 'Select All',
      target: getTarget(category),
      hierarchyData: dummyHierarchyData,
      formatString: category.source.format,
    });
  }

  const minValue = isNumeric
    ? min(listValues.filter((el) => !el.isSelectAll).map((el) => el.value))
    : isDate
    ? slicerSetting.relativeDate
      ? min(listValues.map((el) => new Date(el.value)))
      : min(categoryValues.map((el) => new Date(`${el}`)))
    : undefined;
  const maxValue = isNumeric
    ? max(listValues.filter((el) => !el.isSelectAll).map((el) => el.value))
    : isDate
    ? slicerSetting.relativeDate
      ? max(listValues.map((el) => new Date(el.value)))
      : max(categoryValues.map((el) => new Date(`${el}`)))
    : undefined;

  return { listValues, minValue, maxValue };
}

function addSlicerForCategory(
  self: Visual,
  category: DataViewCategoryColumn,
  sections: ISection[],
  hierarchyGroups: IHierarchyGroup[],
  parentHierarchies: string[]
) {
  const isParentHierarchy = parentHierarchies.includes(category.source.queryName);
  if (category.source.expr['kind'] === 7 && !isParentHierarchy) {
    return;
  }

  const isDate = category.source.type.dateTime;
  const isNumeric = category.source.type.numeric;
  const isHierarchy = isParentHierarchy;
  const sectionIndex = getSectionIndex(category);
  const section = sections.find((el) => el.sectionIndex === sectionIndex);
  const slicerLabel = getSlicerLabel(category.source.displayName, category.source.expr, category.source.queryName, isHierarchy);
  const slicerSetting = section.sectionSetting.slicerSettings.find((el) => el.label === slicerLabel);
  const slicerType = isNumeric ? SlicerType.numeric : slicerSetting.slicerType;
  const showSlicer = !isNil(self.customSettings.saveState.slicerVisibility.find((el) => el.query === category.source.queryName));

  let listValues: IListValue[] = [];
  let minValue: number = undefined;
  let maxValue: number = undefined;
  if (showSlicer) {
    const populated = populateListValuesForCategory(self, category, hierarchyGroups, slicerType, slicerSetting, isDate, isNumeric, isParentHierarchy);
    listValues = populated.listValues;
    minValue = populated.minValue;
    maxValue = populated.maxValue;
  }

  section.slicers.push({
    displayName: getSlicerLabel(slicerLabel, category.source.expr, category.source.queryName, isHierarchy),
    type: slicerSetting.slicerType,
    values: listValues,
    slicerSetting,
    min: minValue,
    max: maxValue,
    show: showSlicer,
    query: category.source.queryName,
    sectionIndex,
    isHierarchy,
    target: getTarget(category),
    isDateTime: category.source.type.dateTime,
    isNumeric,
  });
}

export function visualTransform(self: Visual): IViewModel {
  const categorical = self.options.dataViews[0].categorical;
  const categories = categorical.categories;
  const hierarchyCategories = categorical.categories.filter((el) => el.source.expr['kind'] === 7);
  const hierarchyGroups: IHierarchyGroup[] = [];

  hierarchyCategories.forEach((el) => {
    el.values = getCategoryValues(self, el);
    const groupQuery = getGroupQuery(el);
    const hiearchyGroupIndex = hierarchyGroups.findIndex((hiearchyGroup) => hiearchyGroup.query === groupQuery);
    if (hiearchyGroupIndex === -1) {
      hierarchyGroups.push({
        query: groupQuery,
        fields: [el],
      });
    } else {
      hierarchyGroups[hiearchyGroupIndex].fields.push(el);
    }
  });

  const parentHierarchies = hierarchyGroups.map((el) => el.fields[0]).map((el) => el.source.queryName);
  self.customSettings = createCustomSettings(self, hierarchyGroups);

  const sections: ISection[] = uniqBy(categorical.categories, (el) => getSectionIndex(el)).map((el) => {
    const sectionIndex = getSectionIndex(el);
    const customSectionSetting = self.customSettings[`section${sectionIndex}`];
    const sectionSetting = self.visualSettings[`section${sectionIndex}`] as SectionSettings;

    const section: ISection = {
      name: sectionSetting.sectionName,
      sectionIndex: sectionIndex,
      slicers: [],
      sectionSetting: customSectionSetting,
    };
    return section;
  });

  categories.forEach((category) => addSlicerForCategory(self, category, sections, hierarchyGroups, parentHierarchies));

  enforceDefaultFiltering(self, sections);

  const allValues = categories[0].values.map((category, index) => {
    return categories.map((el) => el.values[index]);
  });

  return {
    sections,
    allValues,
  };
}

export function saveSetting(self: Visual, objectName: string, property: string, value) {
  const visualStateInstance: VisualObjectInstance = {
    objectName: objectName,
    selector: undefined,
    properties: {
      [`${property}`]: value,
    },
  };

  const instances = [visualStateInstance];

  self.host.persistProperties({
    merge: instances,
  });
}

//Remove tildes for operations like finding parents or labels from id
export function untilde(text: string) {
  return text.replace(/~/g, '');
}
