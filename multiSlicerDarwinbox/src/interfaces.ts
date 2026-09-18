import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

export interface IViewModel {
  sections: ISection[];
  allValues: any[][];
}

export enum SlicerType {
  dropdown = "dropdown",
  list = "list",
  dateRange = "dateRange",
  numeric = "numeric",
  time = "time",
}

export enum NumberForceSelectType {
  min = "min",
  max = "max",
}

export enum TextForceSelectType {
  first = "first",
  last = "last",
}

export enum DatePeriod {
  last = "In Last",
  this = "In This",
  next = "In Next",
  before = "Is Before",
  after = "Is After",
  between = "Is Between",
}

export enum DateRange {
  week = "week",
  month = "month",
  //quarter = "quarter",
  year = "year",
}

export interface ISection {
  name: string;
  sectionIndex: number;
  slicers: ISlicer[];
  sectionSetting: ISectionSetting;
}
export interface ISlicer {
  // tableName: string;
  target: ITarget;
  displayName: string;
  type: SlicerType;
  values: IListValue[];
  slicerSetting: ISlicerSetting;
  sectionIndex: number;
  isHierarchy: boolean;
  isDateTime: boolean;
  isNumeric: boolean;
  min: number;
  max: number;
  show: boolean;
  query: string;
}

export interface IListValue {
  value: any;
  checked: boolean;
  level: number;
  isSelectAll: boolean;
  indexes: number[];
  uid: string;
  hierarchyData: IHierarchyData;
  // field: DataViewCategoryColumn;
  target: ITarget;
  formatString: string;
}

export interface IHierarchyData {
  isHieararchyStructure: boolean;
  collapsed: boolean;
  isLeaf: boolean;
  isBlank: boolean;
  hierarchyGroup: IHierarchyGroup;
}

export interface ITarget {
  table: string;
  column: string;
}

export interface ISelectedData {
  // field: string;
  targets: ITarget[]; //Multiple for hierarchy data
  indexes: number[];
  values: any[]; //Multiple for hierarchy data
  uid: string;
  isDateTime: boolean;
  //queryName of the slicer this selection came from, used to group selections per slicer for cross-filtering
  slicerQuery?: string;
}

export interface ICustomSettings {
  section1: ISectionSetting;
  section2: ISectionSetting;
  section3: ISectionSetting;
  section4: ISectionSetting;
  section5: ISectionSetting;
  saveState: ISaveState;
}

export interface ISectionSetting {
  slicerSettings: ISlicerSetting[];
}

export interface ISlicerVisibility {
  sectionIndex: number;
  label: string;
  query: string;
}

export interface ISaveState {
  slicerVisibility: ISlicerVisibility[];
}

export interface ISlicerSetting {
  slicerType: SlicerType;
  singleSelect: boolean;
  selectAll: boolean;
  search: boolean;
  forceSelect: boolean;
  textForceSelectType: TextForceSelectType;
  numberForceSelectType: NumberForceSelectType;
  relativeDate: boolean;
  relativeDateSetting: IRelativeDateSetting;
  numberSetting: INumberSetting;
  timeSetting: ITimeSetting;
  isNumeric: boolean;
  isHierarchy: boolean;
  hieararchyState: string[];
  objectName: string;
  label: string;
  query: string;
  slider: boolean;
}

export type NumberType = | "Is less than" | "Is less than or equal to" | "Is greater than" | "Is greater than or equal to" | "Is Between (including end values)" | "Is Between (excluding end values)";
export type DateType = "In Last" | "In Next" | "In This" | "Is Between" | "Is Before" | "Is After";
export type DurationType = "Select" | "Days" | "Weeks" | "Months" | "Years";
export type TimeCondition = | "Is" | "Is not" | "Is greater than" | "Is less than" | "Is between" | "Is empty" | "Is not empty";

export interface INumberSetting {
  numberType: NumberType;
  value: number;
  decimal: number;
}

export interface ITimeSetting {
  timeCondition: TimeCondition;
}

export interface IRelativeDateSetting {
  dateType: DateType;
  duration: number;
  durationType: DurationType;
  isIncluded: boolean;
  singleDate: Date;
  fromDate: Date;
  toDate: Date;
  isCurrent: boolean;
  showLast: boolean;
  showNext: boolean;
  showThis: boolean;
  showBefore: boolean;
  showAfter: boolean;
  showBetween: boolean;
  days: boolean;
  weeks: boolean;
  months: boolean;
  //quarters: boolean;
  years: boolean;
}

export interface IHierarchyGroup {
  query: string;
  fields: DataViewCategoryColumn[];
}
