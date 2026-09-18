/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
  public design: DesignSettings = new DesignSettings();
  public filtering: FilteringSettings = new FilteringSettings();
  public section1: SectionSettings = new SectionSettings();
  public section2: SectionSettings = new SectionSettings();
  public section3: SectionSettings = new SectionSettings();
  public section4: SectionSettings = new SectionSettings();
  public section5: SectionSettings = new SectionSettings();
}
export class DesignSettings {
  public backColor: string = "#ffffff";
  public slicerBackColor: string = "#ffffff";
  public chips: boolean = true; 

  public labelColor: string = "#000000";
  public labelFontFamily: string = "Arial";
  public labelFontSize: number = 10;
  public labelBold: boolean = false;
  public labelItalic: boolean = false;
  public labelUnderline: boolean = false;

  public slicerTitleColor: string = "#5A6D8C";
  public slicerTitleFontFamily: string = "Arial";
  public slicerTitleFontSize: number = 9;
  public slicerTitleBold: boolean = false;
  public slicerTitleItalic: boolean = false;
  public slicerTitleUnderline: boolean = false;

  public sectionColor: string = "#000000";
  public sectionFontFamily: string = "Arial";
  public sectionFontSize: number = 12;
  public sectionBold: boolean = true;
  public sectionItalic: boolean = false;
  public sectionUnderline: boolean = false;

  public addFilterColor: string = "#000000";
  public addFilterFontFamily: string = "Arial";
  public addFilterFontSize: number = 10;
  public addFilterBold: boolean = false;
  public addFilterItalic: boolean = false;
  public addFilterUnderline: boolean = false;

  public searchColor: string = "#000000";
  public searchFontFamily: string = "Arial";
  public searchFontSize: number = 10;
  public searchBold: boolean = false;
  public searchItalic: boolean = false;
  public searchUnderline: boolean = false;
}

export class FilteringSettings {
  // When on, selecting a value in one field hides the values in the other fields
  // that have no matching data row. Off restores the pre-2.5 behaviour where every
  // field always shows its full list.
  public crossFilter: boolean = true;
}

export class SectionSettings {
  public sectionName: string = "Section";
}
