import { IValueFormatter } from "powerbi-visuals-utils-formattingutils/lib/src/valueFormatter";
import { Visual } from "../visual";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

export function addLabelFormatting(self: Visual, element, fontSizeKey: string, addFontStyle: boolean) {
  const designSettings = self.visualSettings.design;
  element
    .style("font-size", `${designSettings[`${fontSizeKey}FontSize`]}pt`)
    .style("font-family", designSettings[`${fontSizeKey}FontFamily`])
    .style("color", designSettings[`${fontSizeKey}Color`]);

  if (addFontStyle) {
    element
      .style("font-weight", designSettings[`${fontSizeKey}Bold`] ? "bold" : "normal")
      .style("font-style", designSettings[`${fontSizeKey}Italic`] ? "italic" : "normal")
      .style("text-decoration", designSettings[`${fontSizeKey}Underline`] ? "underline" : "none");
  }
}

export function formatData(formatString: string, value: number): string {
  const iValueFormatter: IValueFormatter = valueFormatter.create({
    format: formatString,
  });

  return iValueFormatter.format(value);
}
