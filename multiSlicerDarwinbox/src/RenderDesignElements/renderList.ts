import { select, selectAll, Selection } from "d3";
import { every, isEmpty, isNil } from "lodash";
import { addLabelFormatting, formatData } from "../Functions/designFunctions";
import { CROSS_FILTER_HIDDEN_CLASS } from "../Functions/Filter/crossFilter";
import { IListValue, ISlicer } from "../interfaces";
import { Visual } from "../visual";


export function getDropdownLabel(slicer: ISlicer) {
  const numberOfSelectedItems = slicer.values.filter((el) => el.checked).length;
  return numberOfSelectedItems === 0 || numberOfSelectedItems === slicer.values.length
    ? "All"
    : numberOfSelectedItems > 1
    ? "Multiple Selections"
    : isNil(slicer.values.find((el) => el.checked).value) || isEmpty(slicer.values.find((el) => el.checked).value)
    ? "(Blank)"
    : slicer.values.find((el) => el.checked).value;
}

function setHierarchyCollapseAndBlank(checkboxDivs: Selection<HTMLDivElement, IListValue, HTMLDivElement, unknown>) {
  let shouldHide = false;
  let registeredLevel = 1;

  checkboxDivs.each(function () {
    select(this).classed("hidden", false);
  });

  checkboxDivs.each(function (d: IListValue) {
    if (d.hierarchyData.isBlank) {
      select(this).classed("hidden", true);
      return;
    }

    if (d.level <= registeredLevel) {
      shouldHide = false;
    }
    if (shouldHide) {
      select(this).classed("hidden", true);
    }
    if (!shouldHide) {
      shouldHide = d.hierarchyData.collapsed;
      registeredLevel = d.level;
    }
    select(this)
      .select(".navigationIcon")
      .classed("bi bi-caret-down-fill", d.hierarchyData.collapsed ? true : false)
      .classed("bi bi-caret-up-fill", !d.hierarchyData.collapsed ? true : false);
  });
}

function setupHierarchyNavigation(
  self: Visual,
  slicer: ISlicer,
  checkboxDivs: Selection<HTMLDivElement, IListValue, HTMLDivElement, unknown>
): void {
  if (!slicer.isHierarchy) {
    return;
  }

  const slicerSetting = slicer.slicerSetting;
  checkboxDivs
    .append("i")
    .classed("navigationIcon", true)
    .classed("hidden", (d) => d.hierarchyData.isLeaf)
    .on("click", (e, d: IListValue) => {
      const hieararchyState = slicerSetting.hieararchyState;
      const index = hieararchyState.findIndex((el) => el === d.uid);
      if (index === -1) {
        hieararchyState.push(d.uid);
      } else {
        hieararchyState.splice(index, 1);
      }
      d.hierarchyData.collapsed = index !== -1;

      const payload = {
        objectName: slicerSetting.objectName,
        selector: { metadata: slicerSetting.query },
        properties: { hieararchyState: JSON.stringify(hieararchyState) },
      };
      const instanceIndex = self.hierarchyStateInstance.findIndex((el) => el.selector["metadata"] === slicerSetting.query);
      if (instanceIndex === -1) {
        self.hierarchyStateInstance.push(payload);
      } else {
        self.hierarchyStateInstance[instanceIndex] = payload;
      }
      setHierarchyCollapseAndBlank(checkboxDivs);
    });

  setHierarchyCollapseAndBlank(checkboxDivs);
}

function bindCheckboxChangeHandler(
  checkboxDivs: Selection<HTMLDivElement, IListValue, HTMLDivElement, unknown>,
  slicer: ISlicer
): void {
  const slicerSetting = slicer.slicerSetting;
  const forceSelectEnabled = slicer.isHierarchy ? false : slicerSetting.forceSelect;

  checkboxDivs
    .append("input")
    .attr("type", "checkbox")
    .attr("class", "checkbox")
    .attr("id", (d) => `checkbox-${slicer.displayName}-${d.uid}`)
    .property("checked", (d) => d.checked)
    .property("indeterminate", (d) => d.checked === undefined)
    .on("change", (e, d) => {
      d.checked = !d.checked;

      if (slicerSetting.singleSelect && !slicer.isHierarchy) {
        const wasChecked = select(e.target).property("checked");
        checkboxDivs.selectAll(".checkbox").property("checked", false);
        select(e.target).property("checked", forceSelectEnabled ? true : wasChecked);
      }
      d.checked = select(e.target).property("checked");

      if (d.isSelectAll) {
        const isChecked = select(e.target).property("checked");
        // Skip rows hidden by cross-filtering so Select All cannot reintroduce
        // combinations that have no data. No row carries the class when the
        // Filtering toggle is off, so this is a no-op in that mode.
        checkboxDivs.each(function (rowData: IListValue) {
          const row = select(this);
          if (row.classed(CROSS_FILTER_HIDDEN_CLASS)) {
            return;
          }
          rowData.checked = isChecked;
          row.select("input").property("checked", isChecked);
        });
      } else {
        const selectAllCheckbox = checkboxDivs.nodes().find((el) => select(el).attr("isSelectAll") === "true");
        if (!isNil(selectAllCheckbox)) {
          const checkboxes = checkboxDivs.nodes().filter((el) => select(el).attr("isSelectAll") !== "true");
          const checkedArray = selectAll(checkboxes).select("input").nodes().map((el) => select(el).property("checked"));
          select(selectAllCheckbox).select("input").property("checked", every(checkedArray));
        }
      }

      if (d.hierarchyData.isHieararchyStructure) {
        const selectedUID = d.uid;
        checkboxDivs
          .selectAll(".checkbox")
          .nodes()
          .filter((el) => (select(el).data()[0] as IListValue)?.uid?.includes(selectedUID) || false)
          .filter((el) => !select((el as HTMLElement).closest(".checkboxDiv") as HTMLElement).classed(CROSS_FILTER_HIDDEN_CLASS))
          .forEach((el) => select(el).property("checked", d.checked));
      }
    });
}

// Normalise text for search: lowercase, replace common separators with spaces
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\/\-_.,()[\]{};:'"!@#$%^&*+=<>?`~\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// All space-separated tokens must appear somewhere in the label (AND logic)
function matchesSearch(label: string, rawInput: string): boolean {
  if (!rawInput || rawInput.trim() === '') return true;
  const normalizedLabel = normalizeSearchText(label);
  const tokens = normalizeSearchText(rawInput).split(' ').filter((t) => t.length > 0);
  return tokens.every((token) => normalizedLabel.includes(token));
}

function bindListSearchHandler(
  listSearchInput: Selection<HTMLInputElement, unknown, null, undefined>,
  checkboxDivs: Selection<HTMLDivElement, IListValue, HTMLDivElement, unknown>,
  selectAllSearchContainer: Selection<HTMLDivElement, unknown, null, undefined>,
  selectAllSearchCheckbox: Selection<HTMLInputElement, unknown, null, undefined>
): void {
  listSearchInput.on("keyup", (e) => {
    const input = select(e.target).property("value");
    let visibleCount = 0;

    checkboxDivs.each(function () {
      const element = select(this);
      const label = `${element.attr("label")}`;
      const rawValue = `${element.attr("rawValue")}`;
      const isBlank = element.attr("isBlank") === "true";
      const shouldShow = !isBlank && (matchesSearch(label, input) || matchesSearch(rawValue, input));
      element.classed("hidden", !shouldShow);
      if (shouldShow) {
        visibleCount++;
      }
    });

    if (input && visibleCount > 0) {
      selectAllSearchContainer.style("display", "flex");
    } else {
      selectAllSearchContainer.style("display", "none");
      selectAllSearchCheckbox.property("checked", false);
    }
  });
}

export function renderListSlicer(self: Visual, slicer: ISlicer, slicerContainer: Selection<HTMLDivElement, unknown, null, undefined>, isDropdown: boolean) {
  const slicerSetting = slicer.slicerSetting;
  const designSettings = self.visualSettings.design;
  const listSearchInput = slicerContainer
    .append("input")
    .style("font-size", `${designSettings.labelFontSize}pt`)
    .style("font-family", designSettings.labelFontFamily)
    .style("font-weight", designSettings.labelBold ? "bold" : "normal")
    .style("font-style", designSettings.labelItalic ? "italic" : "normal")
    .style("text-decoration", designSettings.labelUnderline ? "underline" : "none")
    .style("color", designSettings.labelColor)
    .attr("class", "listSearchInput")
    .style("display", slicerSetting.search ? "block" : "none")
    .attr("type", "text")
    .attr("placeholder", "Search...");

  const selectAllSearchContainer = slicerContainer
    .append("div")
    .attr("class", "selectAllSearchContainer")
    .style("display", "none")
    .style("margin", "5px 0")
    .style("font-size", `${designSettings.labelFontSize}pt`)
    .style("font-family", designSettings.labelFontFamily);

  const selectAllSearchLabel = selectAllSearchContainer.append("label").style("cursor", "pointer").style("display", "flex").style("align-items", "center");
  const selectAllSearchCheckbox = selectAllSearchLabel.append("input").attr("type", "checkbox").attr("class", "selectAllSearchCheckbox");
  selectAllSearchLabel.append("span").text("Select all search results").style("margin-left", "5px");

  const slicerCheckboxList = slicerContainer.append("div").classed("checkboxList", true).style("background", designSettings.slicerBackColor);
  if (!isDropdown) {
    slicerCheckboxList.style("max-height", "300px");
  }

  const checkboxDivs = slicerCheckboxList
    .selectAll("div")
    .data(slicer.values, (d: any) => (d.value ? `${slicer.displayName}-${d.value}}` : ""))
    .enter()
    .append("div")
    .classed("dropdownItem", isDropdown)
    .classed("checkboxDiv", true)
    .attr("field", (d) => d.target.column)
    .attr("label", (d) => {
      if (d.isSelectAll) return 'Select All';
      if (isNil(d.value) || isEmpty(`${d.value}`)) return '(Blank)';
      return formatData(d.formatString, slicer.isDateTime && !d.isSelectAll ? new Date(d.value) : d.value);
    })
    .attr("rawValue", (d) => (d.value !== null && d.value !== undefined ? `${d.value}` : ''))
    .attr("isBlank", (d) => d.hierarchyData.isBlank)
    .attr("isSelectAll", (d) => d.isSelectAll)
    .style("margin-left", (d) => `${10 * d.level - 1 + (d.level > 1 && d.hierarchyData.isLeaf ? 18 : 0)}px`);

  setupHierarchyNavigation(self, slicer, checkboxDivs);
  bindCheckboxChangeHandler(checkboxDivs, slicer);

  const label = checkboxDivs
    .append("label")
    .attr("for", (d) => `checkbox-${slicer.displayName}-${d.uid}`)
    .text((d) => (isNil(d.value) || isEmpty(`${d.value}`) ? "(Blank)" : formatData(d.formatString, slicer.isDateTime && !d.isSelectAll ? new Date(d.value) : d.value)));
  addLabelFormatting(self, label, "label", true);

  selectAllSearchCheckbox.on("change", function () {
    const isChecked = select(this).property("checked");
    checkboxDivs.each(function () {
      const element = select(this);
      if (!element.classed("hidden") && !element.classed(CROSS_FILTER_HIDDEN_CLASS)) {
        const data = element.datum() as IListValue;
        data.checked = isChecked;
        element.select("input.checkbox").property("checked", isChecked);
      }
    });
  });

  bindListSearchHandler(listSearchInput, checkboxDivs, selectAllSearchContainer, selectAllSearchCheckbox);
}
