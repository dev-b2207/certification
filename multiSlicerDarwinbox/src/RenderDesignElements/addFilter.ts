import { select, selectAll } from "d3";
import { Visual } from "../visual";
import { ISlicer } from "../interfaces";
import { saveSetting } from "../Functions/visualTransform";
import { addLabelFormatting } from "../Functions/designFunctions";

export function handleAddFilter(self: Visual) {
  const designSettings = self.visualSettings.design;
  self.addFilter
    .style("font-size", `${designSettings.addFilterFontSize}pt`)
    .style("font-family", designSettings.addFilterFontFamily, 'important')
    .style("font-weight", designSettings.addFilterBold ? "bold" : "normal")
    .style("font-style", designSettings.addFilterItalic ? "italic" : "normal")
    .style("text-decoration", designSettings.addFilterUnderline ? "underline" : "none")
    .style("color", designSettings.addFilterColor);

  self.addFilter.on("click", () => {
    showFilterList(self);
  });
}

export function hideFilterList(self: Visual) {
  self.filterList.selectAll("*").remove();
  self.filterList.style("display", "none");
}
export function showFilterList(self: Visual) {
  self.filterList.style("display", "block");
  self.filterList.selectAll("*").remove();

  const filterSearch = self.filterList.append("input").attr("class", "listSearchInput").attr("type", "text").attr("placeholder", "Search...");

  self.viewModel.sections.forEach((section) => {
    const filterListTitle = self.filterList.append("div").text(section.name).classed("filterListTitle", true);
    addLabelFormatting(self, filterListTitle, "section", true);

    section.slicers.forEach((slicer) => {
      const checkboxList = self.filterList.append("div").classed("filterListElement", true).data([slicer]);
      checkboxList
        .append("input")
        .attr("type", "checkbox")
        .attr("class", "checkbox")
        .attr("id", () => `slicerList-${slicer.displayName}}`)
        .property("checked", () => {
          return slicer.show;
        });

      const label = checkboxList
        .append("label")
        .attr("for", () => `slicerList-${slicer.displayName}}`)
        .text(slicer.displayName);

      addLabelFormatting(self, label, "label", true);
    });
    self.filterList.append("hr");
  });

  self.filterList
    .append("button")
    .classed("btn btn-primary saveFilterList", true)
    .text("Save")
    .style("margin-left", "5px")
    .on("click", () => {
      self.customSettings.saveState.slicerVisibility = [];
      selectAll(".filterListElement")
        .filter(function () {
          return select(this).select("input").property("checked");
        })
        .nodes()
        .forEach((node) => {
          const datapoint: ISlicer = select(node).data()[0] as ISlicer;
          self.customSettings.saveState.slicerVisibility.push({
            sectionIndex: datapoint.sectionIndex,
            label: datapoint.displayName,
            query: datapoint.query,
          });
        });
      saveSetting(self, "saveState", "slicerVisibility", JSON.stringify(self.customSettings.saveState.slicerVisibility));
      hideFilterList(self);
    });
  self.filterList
    .append("button")
    .classed("btn btn-light cancelFilterList", true)
    .text("Cancel")
    .on("click", () => {
      hideFilterList(self);
    });
  filterSearch.on("keyup", (e) => {
    const input = select(e.target).property("value").toLowerCase();
    selectAll(".filterListElement").each(function () {
      const slicerData: ISlicer = select(this).data()[0] as ISlicer;
      const label = slicerData.displayName.toLowerCase();
      select(this).classed("hidden", !label.includes(input));
    });
  });
}
