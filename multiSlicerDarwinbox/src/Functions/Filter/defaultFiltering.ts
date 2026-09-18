import { min, max } from "d3";
import { ISection, ISelectedData, SlicerType, NumberForceSelectType, TextForceSelectType } from "../../interfaces";
import { Visual } from "../../visual";
export function enforceDefaultFiltering(self: Visual, sections: ISection[]) {
  self.applyDefaultFiltering = false;
  const defaultSelectedData: ISelectedData[] = [];
  sections.forEach((section) => {
    section.slicers
      .filter((slicer) => (slicer.type === SlicerType.list || slicer.type === SlicerType.dropdown) && slicer.show)
      .forEach((slicer) => {
        const slicerSetting = slicer.slicerSetting;
        const forceSelectEnabled = slicerSetting.forceSelect;
        const isNumeric = slicer.slicerSetting.isNumeric;
        const slicerValues = slicer.values.filter((el) => !el.isSelectAll && el.level === 1);
        const hasSelection = slicerValues.find((el) => el.checked);
        if (hasSelection || !forceSelectEnabled) {
          return;
        }

        slicerValues.forEach((slicerValue, index) => {
          const defaultValueIndex =
            forceSelectEnabled && (slicerSetting.slicerType === SlicerType.list || slicerSetting.slicerType === SlicerType.dropdown)
              ? isNumeric
                ? slicerSetting.numberForceSelectType === NumberForceSelectType.min
                  ? slicerValues.findIndex((el) => el.value === min(slicerValues.map((el) => el.value)))
                  : slicerValues.findIndex((el) => el.value === max(slicerValues.map((el) => el.value)))
                : slicerSetting.textForceSelectType === TextForceSelectType.first
                ? 0
                : slicerValues.length - 1
              : -1;
          const isDefault = defaultValueIndex === index;
          if (isDefault) {
            slicerValue.checked = true;
            defaultSelectedData.push({
              targets: [slicer.target],
              indexes: slicerValue.indexes,
              values: [slicerValue.value],
              isDateTime: slicer.isDateTime,
              uid: slicerValue.uid,
            });
          }
        });
      });
  });

  if (defaultSelectedData.length > 0) {
    self.applyDefaultFiltering = true;
    // applyFilter(self, defaultSelectedData);
  }
}
