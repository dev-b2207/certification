import { isEmpty, isObject } from "lodash";
import powerbi from "powerbi-visuals-api";
import Selector = powerbi.data.Selector;
import FormattingCard = powerbi.visuals.FormattingCard;
import FormattingGroup = powerbi.visuals.FormattingGroup;
import FormattingComponent = powerbi.visuals.FormattingComponent;
import AlignmentGroupMode = powerbi.visuals.AlignmentGroupMode;
import FormattingSlice = powerbi.visuals.FormattingSlice;
export interface IDefaultSetting {
  objectName: string;
  propertyName: string;
}
export function createDefaultArray(settings: object, objectLabel: string): IDefaultSetting[] {
  const defaultArray = Object.keys(settings).map((prop) => {
    return {
      objectName: objectLabel,
      propertyName: prop,
    };
  });
  return defaultArray;
}

export const enum SettingType {
  string = "string",
  color = "color",
  boolean = "boolean",
  number = "number",
  dropdown = "dropdown",
  fontControl = "fontControl",
  fontControlCategoryText = "fontControlCategoryText",
  alignment = "alignment",
}

export interface IFontControl {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}
export function createCard(objectSetting: object, objectName: string, displayName: string): FormattingCard {
  return {
    displayName: displayName,
    uid: `${objectName}_uid`,
    groups: [],
    revertToDefaultDescriptors: createDefaultArray(objectSetting, objectName),
  };
}

export function createGroup(objectName: string): FormattingGroup {
  return {
    displayName: "",
    uid: `${objectName}_group_uid`,
    slices: [],
    collapsible: false,
  };
}

export function createSliceSetting(
  groupSetting: FormattingGroup,
  objectName: string,
  propertyName: string,
  displayName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined,
  settingType: SettingType,
) {
  let slice: FormattingSlice;

  switch (settingType) {
    case "boolean":
      slice = createBooleanSlice(objectName, propertyName, value, selector);
      break;
    case "number":
      slice = createNumberSlice(objectName, propertyName, value, selector);
      break;
    case "color":
      slice = createColorSlice(objectName, propertyName, value, selector);
      break;
    case "dropdown":
      slice = createDropdownSlice(objectName, propertyName, value, selector);
      break;
    case "fontControl":
      slice = createFontControlSlice(objectName, propertyName, value);
      break;
    case "fontControlCategoryText":
      slice = createFontControlCategoryTextSlice(objectName, propertyName, value);
      break;
    case "alignment":
      slice = createAlignmentSlice(objectName, propertyName, value, selector);
      break;
    default:
      slice = createTextInputSlice(objectName, propertyName, value, selector);
  }
  if (!isEmpty(displayName)) {
    slice.displayName = displayName;
  }
  if (isObject(groupSetting.slices) && slice !== undefined) {
    groupSetting.slices.push(slice);
  }
  return slice;
}

function createFontControlSlice(objectName: string, propertyName: string, value: string | boolean | number | IFontControl): FormattingSlice {
  const precedingProperty = propertyName.replace("FontSize", "");

  return {
    uid: `${objectName}_${propertyName}`,
    displayName: "Font Settings",
    control: {
      type: FormattingComponent.FontControl,
      properties: {
        fontFamily: {
          descriptor: {
            objectName: `${objectName}`,
            propertyName: precedingProperty + "FontFamily",
          },
          value: <string>(<IFontControl>value).fontFamily,
        },
        fontSize: {
          options: {
            minValue: {
              value: 8,
              type: powerbi.visuals.ValidatorType.Min,
            },
            maxValue: {
              value: 60,
              type: powerbi.visuals.ValidatorType.Max,
            },
          },
          descriptor: {
            objectName: `${objectName}`,
            propertyName: `${propertyName}`,
          },
          value: <number>(<IFontControl>value).fontSize,
        },

        bold: {
          descriptor: {
            objectName: `${objectName}`,
            propertyName: precedingProperty + "Bold",
          },
          value: <boolean>(<IFontControl>value).bold,
        },
        italic: {
          descriptor: {
            objectName: `${objectName}`,
            propertyName: precedingProperty + "Italic",
          },
          value: <boolean>(<IFontControl>value).italic,
        },
        underline: {
          descriptor: {
            objectName: `${objectName}`,
            propertyName: precedingProperty + "Underline",
          },
          value: <boolean>(<IFontControl>value).underline,
        },
      },
    },
  };
}

function createFontControlCategoryTextSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl
): FormattingSlice {
  return {
    uid: `${objectName}_${propertyName}`,
    displayName: "Font Settings",
    control: {
      type: FormattingComponent.FontControl,
      properties: {
        fontFamily: {
          descriptor: {
            objectName: "taskLabels",
            propertyName: "catTextFontFamily",
          },
          value: <string>(<IFontControl>value).fontFamily,
        },
        fontSize: {
          options: {
            minValue: {
              value: 8,
              type: powerbi.visuals.ValidatorType.Min,
            },
            maxValue: {
              value: 60,
              type: powerbi.visuals.ValidatorType.Max,
            },
          },
          descriptor: {
            objectName: "taskLabels",
            propertyName: `${propertyName}`,
          },
          value: <number>(<IFontControl>value).fontSize,
        },

        bold: {
          descriptor: {
            objectName: "taskLabels",
            propertyName: "catTextFontBold",
          },
          value: <boolean>(<IFontControl>value).bold,
        },
        italic: {
          descriptor: {
            objectName: "taskLabels",
            propertyName: "catTextFontItalic",
          },
          value: <boolean>(<IFontControl>value).italic,
        },
        underline: {
          descriptor: {
            objectName: "taskLabels",
            propertyName: "catTextFontUnderline",
          },
          value: <boolean>(<IFontControl>value).underline,
        },
      },
    },
  };
}

function createAlignmentSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined
): FormattingSlice {
  return {
    uid: `${objectName}_${propertyName}`,
    control: {
      type: FormattingComponent.AlignmentGroup,
      properties: {
        mode: AlignmentGroupMode.Horizonal,
        descriptor: {
          objectName,
          propertyName,
          selector,
        },
        value: <string>value,
      },
    },
  };
}

function createBooleanSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined
): FormattingSlice {
  return {
    uid: `${objectName}_${propertyName}`,
    control: {
      type: FormattingComponent.ToggleSwitch,
      properties: {
        descriptor: {
          objectName,
          propertyName,
          selector,
        },
        value: <boolean>value,
      },
    },
  };
}

function createNumberSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined,
): FormattingSlice {
  const slice: FormattingSlice = {
    uid: `${objectName}_${propertyName}`,
    control: {
      type: FormattingComponent.NumUpDown,
      properties: {
        descriptor: {
          objectName,
          propertyName,
          selector,
        },
        value: <number>value,options:  {
          minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
        }
        
      },
    },
  };

 

  return slice;
}

function createColorSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined
): FormattingSlice {
  return {
    uid: `${objectName}_${propertyName}`,
    control: {
      type: FormattingComponent.ColorPicker,
      properties: {
        descriptor: {
          objectName,
          propertyName,
          selector,
        },
        value: {
          value: <string>value,
        },
      },
    },
  };
}

function createDropdownSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined
): FormattingSlice {
  return {
    uid: `${objectName}_${propertyName}`,
    control: {
      type: FormattingComponent.Dropdown,
      properties: {
        descriptor: {
          objectName,
          propertyName,
          selector,
        },
        value: <number>value,
      },
    },
  };
}

function createTextInputSlice(
  objectName: string,
  propertyName: string,
  value: string | boolean | number | IFontControl,
  selector: Selector | undefined
): FormattingSlice {
  return {
    uid: `${objectName}_${propertyName}`,
    control: {
      type: FormattingComponent.TextInput,
      properties: {
        placeholder: "",
        descriptor: {
          objectName,
          propertyName,
          selector,
        },
        value: <string>value,
      },
    },
  };
}
