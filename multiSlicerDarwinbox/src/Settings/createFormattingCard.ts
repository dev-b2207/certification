import powerbi from "powerbi-visuals-api";
import { ISectionSetting, SlicerType } from "../interfaces";
import { Visual } from "../visual";
import { createDefaultArray, createSliceSetting, IFontControl, SettingType } from "./formatCardFunctions";
import FormattingCard = powerbi.visuals.FormattingCard;
import FormattingGroup = powerbi.visuals.FormattingGroup;

function createGroup(displayName: string, uid: string, collapsible: boolean = true): FormattingGroup {
  return {
    displayName,
    uid,
    collapsible,
    slices: [],
  };
}

function createFontControl(fontFamily: string, fontSize: number, bold: boolean, italic: boolean, underline: boolean): IFontControl {
  return {
    fontFamily,
    fontSize,
    bold,
    italic,
    underline,
  };
}

function addFontAndColorSlices(
  group: FormattingGroup,
  objectName: string,
  fontPropName: string,
  fontControl: IFontControl,
  colorPropName: string,
  colorValue: string
): void {
  createSliceSetting(group, objectName, fontPropName, "Font Setting", fontControl, undefined, SettingType.fontControl);
  createSliceSetting(group, objectName, colorPropName, "Color", colorValue, undefined, SettingType.color);
}

function getGeneralDesignGroup(self: Visual, objectName: string): FormattingGroup {
  const designSettings = self.visualSettings.design;
  const group = createGroup("", `${objectName}_general`);
  createSliceSetting(group, objectName, "backColor", "Background Color", designSettings.backColor, undefined, SettingType.color);
  createSliceSetting(group, objectName, "slicerBackColor", "Slicer Background Color", designSettings.slicerBackColor, undefined, SettingType.color);
  createSliceSetting(group, objectName, "chips", "Chips", designSettings.chips, undefined, SettingType.boolean);
  return group;
}

function getLabelDesignGroup(self: Visual, objectName: string): FormattingGroup {
  const designSettings = self.visualSettings.design;
  const group = createGroup("Label", `${objectName}_label`);
  const fontControl = createFontControl(
    designSettings.labelFontFamily,
    designSettings.labelFontSize,
    designSettings.labelBold,
    designSettings.labelItalic,
    designSettings.labelUnderline
  );
  addFontAndColorSlices(group, objectName, "labelFontSize", fontControl, "labelColor", designSettings.labelColor);
  return group;
}

function getSlicerTitleDesignGroup(self: Visual, objectName: string): FormattingGroup {
  const designSettings = self.visualSettings.design;
  const group = createGroup("Slicer Title", `${objectName}_slicerTitle`);
  const fontControl = createFontControl(
    designSettings.slicerTitleFontFamily,
    designSettings.slicerTitleFontSize,
    designSettings.slicerTitleBold,
    designSettings.slicerTitleItalic,
    designSettings.slicerTitleUnderline
  );
  addFontAndColorSlices(group, objectName, "slicerTitleFontSize", fontControl, "slicerTitleColor", designSettings.slicerTitleColor);
  return group;
}

function getSectionHeaderDesignGroup(self: Visual, objectName: string): FormattingGroup {
  const designSettings = self.visualSettings.design;
  const group = createGroup("Section Header", `${objectName}_section`);
  const fontControl = createFontControl(
    designSettings.sectionFontFamily,
    designSettings.sectionFontSize,
    designSettings.sectionBold,
    designSettings.sectionItalic,
    designSettings.sectionUnderline
  );
  addFontAndColorSlices(group, objectName, "sectionFontSize", fontControl, "sectionColor", designSettings.sectionColor);
  return group;
}

function getAddFilterDesignGroup(self: Visual, objectName: string): FormattingGroup {
  const designSettings = self.visualSettings.design;
  const group = createGroup("Add Filter", `${objectName}_addFilter`);
  const fontControl = createFontControl(
    designSettings.addFilterFontFamily,
    designSettings.addFilterFontSize,
    designSettings.addFilterBold,
    designSettings.addFilterItalic,
    designSettings.addFilterUnderline
  );
  addFontAndColorSlices(group, objectName, "addFilterFontSize", fontControl, "addFilterColor", designSettings.addFilterColor);
  return group;
}

function getSearchDesignGroup(self: Visual, objectName: string): FormattingGroup {
  const designSettings = self.visualSettings.design;
  const group = createGroup("Search", `${objectName}_search`);
  const fontControl = createFontControl(
    designSettings.searchFontFamily,
    designSettings.searchFontSize,
    designSettings.searchBold,
    designSettings.searchItalic,
    designSettings.searchUnderline
  );
  addFontAndColorSlices(group, objectName, "searchFontSize", fontControl, "searchColor", designSettings.searchColor);
  return group;
}

function getSectionNameGroup(objectName: string, sectionIndex: number, sectionSettings: any): FormattingGroup {
  const group = createGroup("", `${objectName}_section${sectionIndex}`, false);
  createSliceSetting(group, objectName, "sectionName", "Section Name", sectionSettings.sectionName, undefined, SettingType.string);
  return group;
}

function addForceSelectTypeSlice(slicerGroup: FormattingGroup, objectName: string, slicerSetting: any): void {
  if (!slicerSetting.forceSelect) {
    return;
  }

  if (slicerSetting.isNumeric) {
    createSliceSetting(
      slicerGroup,
      objectName,
      "numberForceSelectType",
      "Force Select Type",
      slicerSetting.numberForceSelectType,
      { metadata: slicerSetting.query },
      SettingType.dropdown
    );
    return;
  }

  createSliceSetting(
    slicerGroup,
    objectName,
    "textForceSelectType",
    "Force Select Type",
    slicerSetting.textForceSelectType,
    { metadata: slicerSetting.query },
    SettingType.dropdown
  );
}

function addListLikeSlicerSlices(slicerGroup: FormattingGroup, objectName: string, slicerSetting: any): void {
  createSliceSetting(slicerGroup, objectName, "singleSelect", "Single Select", slicerSetting.singleSelect, { metadata: slicerSetting.query }, SettingType.boolean);
  if (!slicerSetting.singleSelect) {
    createSliceSetting(slicerGroup, objectName, "selectAll", "Show Select All", slicerSetting.selectAll, { metadata: slicerSetting.query }, SettingType.boolean);
  }
  createSliceSetting(slicerGroup, objectName, "search", "Search", slicerSetting.search, { metadata: slicerSetting.query }, SettingType.boolean);
  if (!slicerSetting.isHierarchy) {
    createSliceSetting(slicerGroup, objectName, "forceSelect", "Force Select", slicerSetting.forceSelect, { metadata: slicerSetting.query }, SettingType.boolean);
  }
  addForceSelectTypeSlice(slicerGroup, objectName, slicerSetting);
}

function addDateRangeSlicerSlices(slicerGroup: FormattingGroup, objectName: string, slicerSetting: any): void {
  createSliceSetting(slicerGroup, objectName, "relativeDate", "Relative", slicerSetting.relativeDate, { metadata: slicerSetting.query }, SettingType.boolean);
  if (!slicerSetting.relativeDate) {
    createSliceSetting(slicerGroup, objectName, "slider", "Slider", slicerSetting.slider, { metadata: slicerSetting.query }, SettingType.boolean);
    return;
  }

  const relativeSetting = slicerSetting.relativeDateSetting;
  const calendarSlice = createSliceSetting(
    slicerGroup,
    objectName,
    "isCurrent",
    "Current",
    relativeSetting.isCurrent,
    { metadata: slicerSetting.query },
    SettingType.boolean
  );
  calendarSlice.description = "When the toggle is on, data displays up to the current date. When off, it switches to the calendar year";
  createSliceSetting(slicerGroup, objectName, "showLast", "Show Last", relativeSetting.showLast, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "showNext", "Show Next", relativeSetting.showNext, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "showThis", "Show This", relativeSetting.showThis, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "showBefore", "Show Before", relativeSetting.showBefore, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "showAfter", "Show After", relativeSetting.showAfter, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "showBetween", "Show Between", relativeSetting.showBetween, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "days", "Show Days", relativeSetting.days, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "weeks", "Show Weeks", relativeSetting.weeks, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "months", "Show Months", relativeSetting.months, { metadata: slicerSetting.query }, SettingType.boolean);
  createSliceSetting(slicerGroup, objectName, "years", "Show Years", relativeSetting.years, { metadata: slicerSetting.query }, SettingType.boolean);
}

function addNumericSlicerSlices(slicerGroup: FormattingGroup, objectName: string, slicerSetting: any): void {
  createSliceSetting(slicerGroup, objectName, "decimal", "Decimal Places", slicerSetting.numberSetting.decimal, { metadata: slicerSetting.query }, SettingType.number);
}

function getSlicerGroup(objectName: string, slicerSetting: any): FormattingGroup {
  const slicerGroup = createGroup(slicerSetting.label, `${objectName}_slicer_${slicerSetting.query}`);
  createSliceSetting(
    slicerGroup,
    objectName,
    "slicerType",
    "Slicer Type",
    slicerSetting.slicerType,
    { metadata: slicerSetting.query },
    SettingType.dropdown
  );

  const isListLike = slicerSetting.slicerType !== SlicerType.dateRange && slicerSetting.slicerType !== SlicerType.time && slicerSetting.slicerType !== SlicerType.numeric;
  if (isListLike) {
    addListLikeSlicerSlices(slicerGroup, objectName, slicerSetting);
  } else if (slicerSetting.slicerType === SlicerType.dateRange) {
    addDateRangeSlicerSlices(slicerGroup, objectName, slicerSetting);
  } else if (slicerSetting.slicerType === SlicerType.numeric) {
    addNumericSlicerSlices(slicerGroup, objectName, slicerSetting);
  }
  return slicerGroup;
}

export function getDesignCard(self: Visual): FormattingCard {
  const objectName = `design`;

  const designCard: FormattingCard = {
    displayName: `Design`,
    uid: objectName,
    groups: [],
    revertToDefaultDescriptors: createDefaultArray(self.visualSettings.design, objectName),
  };

  designCard.groups.push(getGeneralDesignGroup(self, objectName));
  designCard.groups.push(getLabelDesignGroup(self, objectName));
  designCard.groups.push(getSlicerTitleDesignGroup(self, objectName));
  designCard.groups.push(getSectionHeaderDesignGroup(self, objectName));
  designCard.groups.push(getAddFilterDesignGroup(self, objectName));
  designCard.groups.push(getSearchDesignGroup(self, objectName));
  return designCard;
}

export function getFilteringCard(self: Visual): FormattingCard {
  const objectName = `filtering`;
  const filteringSettings = self.visualSettings.filtering;

  const filteringCard: FormattingCard = {
    displayName: `Filtering`,
    uid: objectName,
    groups: [],
    revertToDefaultDescriptors: createDefaultArray(filteringSettings, objectName),
  };

  const group = createGroup("", `${objectName}_general`, false);
  const crossFilterSlice = createSliceSetting(
    group,
    objectName,
    "crossFilter",
    "Filter other fields",
    filteringSettings.crossFilter,
    undefined,
    SettingType.boolean
  );
  crossFilterSlice.description =
    "When on, selecting a value in one field hides the values in the other fields that have no matching data. When off, every field always shows its full list.";

  filteringCard.groups.push(group);
  return filteringCard;
}

export function getSectionCard(self: Visual, sectionIndex: number): FormattingCard {
  const sectionSettings = self.visualSettings[`section${sectionIndex}`];
  const objectName = `section${sectionIndex}`;

  const section1Card: FormattingCard = {
    displayName: `Section ${sectionIndex}`,
    uid: objectName,
    groups: [],
    revertToDefaultDescriptors: createDefaultArray(sectionSettings, objectName),
  };

  section1Card.groups.push(getSectionNameGroup(objectName, sectionIndex, sectionSettings));

  (<ISectionSetting>self.customSettings[`section${sectionIndex}`]).slicerSettings.forEach((slicerSetting) => {
    section1Card.groups.push(getSlicerGroup(objectName, slicerSetting));
  });

  return section1Card;
}
