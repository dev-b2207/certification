'use strict';
import { BaseType, select, selectAll, Selection } from 'd3';
import { some } from 'lodash';
import powerbi from 'powerbi-visuals-api';
import { checkParent } from '../src/Functions/hierarchyFunctions';
import '../style/visual.less';
import { addLabelFormatting, formatData } from './Functions/designFunctions';
import { applyFilter, clearJSONFilter, getSelectedDataFromUI, removeFilter } from './Functions/Filter/applyFilter';
import { applyCrossFilter, cancelScheduledCrossFilter, CROSS_FILTER_HIDDEN_CLASS, scheduleCrossFilter } from './Functions/Filter/crossFilter';
import { visualTransform } from './Functions/visualTransform';
import { ICustomSettings, IListValue, IViewModel, SlicerType } from './interfaces';
import { handleAddFilter, hideFilterList } from './RenderDesignElements/addFilter';
import { renderDateSlicer } from './RenderDesignElements/DateSlicer/renderDate';
import { renderChip } from './RenderDesignElements/renderChip';
import { getDropdownLabel, renderListSlicer } from './RenderDesignElements/renderList';
import { renderNumberSlicer } from './RenderDesignElements/renderNumber';
import { renderTimeSlicer } from './RenderDesignElements/renderTimePicker';
import { getDesignCard, getFilteringCard, getSectionCard } from './Settings/createFormattingCard';
import { VisualSettings } from './Settings/settings';
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import FormattingModel = powerbi.visuals.FormattingModel;
import FormattingCard = powerbi.visuals.FormattingCard;

//renderChipDropdown,

export class Visual implements IVisual {
  private target: HTMLElement;
  public visualSettings: VisualSettings;
  public host: IVisualHost;
  public options: VisualUpdateOptions;
  public body: Selection<HTMLElement, unknown, null, BaseType>;
  public selectionManager: powerbi.extensibility.ISelectionManager;
  public viewModel: IViewModel;
  public header: Selection<HTMLElement, unknown, null, BaseType>;
  public visualDiv: Selection<HTMLElement, unknown, null, BaseType>;
  public footer: Selection<HTMLElement, unknown, null, BaseType>;
  public searchInput: Selection<HTMLElement, unknown, null, BaseType>;
  public addFilter: Selection<HTMLElement, unknown, null, BaseType>;
  public applyAll: Selection<HTMLElement, unknown, null, BaseType>;
  public cancel: Selection<HTMLElement, unknown, null, BaseType>;
  public reset: Selection<HTMLElement, unknown, null, BaseType>;
  public closeIcon: Selection<HTMLElement, unknown, null, BaseType>;
  public customSettings: ICustomSettings;
  public filterList: Selection<HTMLElement, unknown, null, BaseType>;
  public relativeSettingInstance: VisualObjectInstance[] = [];
  public numberSettingInstance: VisualObjectInstance[] = [];
  public timeSettingInstance: VisualObjectInstance[] = [];
  public hierarchyStateInstance: VisualObjectInstance[] = [];
  public applyDefaultFiltering: boolean = false;
  /**
   * Query names of numeric and time slicers the user has actually interacted with.
   * Those two types only join the applied filter once they are in here, because their
   * default state is a real condition ("Is less than <data max>", "Is <00:00:00>") that
   * would otherwise silently narrow the whole report. Held on the instance rather than
   * in the DOM so it survives the re-render that follows Apply, before the host has
   * come back with the updated jsonFilters.
   */
  public touchedSlicers: Set<string> = new Set<string>();
  public testDiv;
  private events: powerbi.extensibility.IVisualEventService;
  private injectedStyle: Selection<HTMLStyleElement, unknown, null, undefined>;
  private outsideClickHandler: (event: MouseEvent) => void;
  private contextMenuTimer: number = null;
  // public numberSlicerState: {
  //   condition: string;
  //   values: number[];
  //   target: {
  //     table: string;
  //     column: string;
  //   };
  // };

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.target = options.element;
    this.events = options.host.eventService;
    this.setupContextMenu();
    this.selectionManager = options.host.createSelectionManager();

    // One style element for the lifetime of the visual. Appending a new one on every
    // update leaks a tag per render and slows the page down over a long session.
    this.injectedStyle = select(options.element).append('style');

    this.body = select(options.element).classed('body', true).attr('body', true);
    this.header = select(options.element).append('div').classed('header', true);
    this.addFilter = this.header
      .append('button')
      .classed('btn btn-light addFilter', true)
      .on('click', (event: MouseEvent) => {
        event.stopPropagation();
        //handleAddFilter(this);
      })
      .text('+ Add Filter');
    // this.addFilter.append("span").classed("addfilterLabel", true).text("+ Add Filter");

    // Create a wrapper div for search with relative positioning
    const searchWrapper = this.header.append('div').classed('searchWrapper', true).style('position', 'relative').style('display', 'inline-block');

    // Add the search icon (absolute inside wrapper)
    searchWrapper
      .append('i')
      .classed('bi bi-search', true)
      .style('position', 'absolute')
      .style('left', '8px')
      .style('top', '50%')
      .style('transform', 'translateY(-60%)')
      .style('color', '#c4c1c1ff')
      .style('pointer-events', 'none');

    this.searchInput = searchWrapper
      .append('input')
      .attr('class', 'searchInput')
      .attr('type', 'text')
      .attr('placeholder', 'Search...')
      .style('padding-left', '28px'); //.classed("bi bi-search",true)

    this.visualDiv = select(options.element).append('div').classed('visualDiv', true);

    this.filterList = select(options.element).append('div').classed('filterList', true);
    hideFilterList(this);

    this.footer = select(options.element).append('div').classed('footer', true);

    this.reset = this.footer.append('div').classed('reset', true);
    this.reset.append('i').classed('bi bi-arrow-counterclockwise resetIcon', true);
    this.reset.append('span').classed('resetLabel', true).text('Reset');
    this.applyAll = this.footer.append('button').classed('btn btn-primary applyAll', true).text('Apply');
    this.cancel = this.footer.append('button').classed('btn btn-light cancel', true).text('Cancel');

    // Bound once, not per update. The previous per-update binding added a fresh
    // document listener on every render and never removed any of them.
    this.bindOutsideClickHandler();

    // One delegated hook covers every kind of selection change - checkboxes, date and
    // number inputs, time pickers, condition dropdowns and the noUiSlider handles -
    // so the individual renderers do not each need their own cross-filter call.
    const scheduleRecompute = () => scheduleCrossFilter(this);
    options.element.addEventListener('change', scheduleRecompute);
    options.element.addEventListener('pointerup', scheduleRecompute);
  }

  public update(options: VisualUpdateOptions) {
    this.options = options;
    this.events?.renderingStarted(options);

    if (this.options.type === 4) {
      this.events?.renderingFinished(options);
      return;
    }

    if (!this.hasRenderableData(options)) {
      this.renderEmptyState(options);
      this.events?.renderingFinished(options);
      return;
    }

    try {
      this.initializeVisualState(options);
      this.configureSearchInputStyles();
      const slicerContainer = this.renderVisibleSections();
      this.renderSlicers(slicerContainer);
      this.applyInjectedCSS();
      this.applyDefaultFilterIfNeeded();
      this.bindFooterActions(options);
      this.bindRootContextMenu();
      applyCrossFilter(this);
      this.events?.renderingFinished(options);
    } catch (e) {
      this.events?.renderingFailed(options, e instanceof Error ? e.message : `${e}`);
    }
  }

  /**
   * Power BI calls update() before any field is dropped in, and again while fields are
   * being removed. Rendering against a half-populated dataView throws, so those states
   * are handled explicitly rather than caught and swallowed.
   */
  private hasRenderableData(options: VisualUpdateOptions): boolean {
    const categories = options?.dataViews?.[0]?.categorical?.categories;
    return Array.isArray(categories) && categories.length > 0 && Array.isArray(categories[0]?.values);
  }

  private renderEmptyState(options: VisualUpdateOptions): void {
    cancelScheduledCrossFilter();
    this.viewModel = { sections: [], allValues: [] };
    this.customSettings = undefined;
    this.visualDiv.selectAll('*').remove();
    this.filterList.selectAll('*').remove();
    this.filterList.style('display', 'none');

    // Keep the formatting pane usable even with no fields bound.
    if (options?.dataViews?.[0]) {
      this.visualSettings = VisualSettings.parse<VisualSettings>(options.dataViews[0]);
      this.body.style('background', this.visualSettings.design.backColor);
    }
  }

  public destroy(): void {
    cancelScheduledCrossFilter();
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.contextMenuTimer !== null) {
      window.clearTimeout(this.contextMenuTimer);
      this.contextMenuTimer = null;
    }
  }

  // private isDraftExpired(): boolean {
  //   const expiryDate = new Date('06-30-2026').getTime();
  //   const isPerformanceSupported =
  //     window.performance && window.performance.now && window.performance.timing && window.performance.timing.navigationStart;
  //   const currentTime = isPerformanceSupported ? window.performance.now() + window.performance.timing.navigationStart : Date.now();
  //   return currentTime > expiryDate;
  // }

  // private showExpiryMessage(): void {
  //   this.body.selectAll('*').remove();
  //   this.body.text('This development draft has expired. Please contact contact@datellers.com for further assistance.');
  // }

  private initializeVisualState(options: VisualUpdateOptions): void {
    this.visualSettings = VisualSettings.parse<VisualSettings>(options.dataViews[0]);
    this.body.style('background', this.visualSettings.design.backColor);
    this.visualDiv.selectAll('*').remove();
    this.viewModel = visualTransform(this);
    handleAddFilter(this);
  }

  private configureSearchInputStyles(): void {
    const designSettings = this.visualSettings.design;
    this.searchInput
      .style('font-size', `${designSettings.searchFontSize}pt`)
      .style('font-family', designSettings.searchFontFamily)
      .style('font-weight', designSettings.searchBold ? 'bold' : 'normal')
      .style('font-style', designSettings.searchItalic ? 'italic' : 'normal')
      .style('text-decoration', designSettings.searchUnderline ? 'underline' : 'none')
      .style('color', `${designSettings.searchColor}`)
      .on('keyup', (e) => {
        const input = select(e.target).property('value').toLowerCase();
        selectAll('.slicerContainer').each(function () {
          const element = select(this);
          const slicerLabel = element.attr('slicerLabel').toLowerCase();
          element.classed('hidden', !slicerLabel.includes(input));
        });
      });
  }

  private renderVisibleSections(): Selection<HTMLDivElement, any, any, any> {
    const designSettings = this.visualSettings.design;
    const visibleSections = this.viewModel.sections.filter((section) => some(section.slicers.map((slicer) => slicer.show)));
    const section = this.visualDiv.selectAll('.section').data(visibleSections).enter().append('div').attr('class', 'section');
    const sectionCollapseIcon = section.append('i').classed('toggleIcon', true).attr('isCollapsed', false).classed('bi bi-chevron-up', true);
    const sectionDiv = section.append('div').attr('class', 'sectionDiv');

    sectionDiv
      .attr('class', 'sectionTitle')
      .append('h6')
      .text((d) => `${d.name} (${d.slicers.filter((el) => el.show).length})`)
      .style('margin', '0px')
      .style('font-size', `${designSettings.sectionFontSize}pt`)
      .style('font-family', designSettings.sectionFontFamily)
      .style('font-weight', designSettings.sectionBold ? 'bold' : 'normal')
      .style('font-style', designSettings.sectionItalic ? 'italic' : 'normal')
      .style('text-decoration', designSettings.sectionUnderline ? 'underline' : 'none')
      .style('color', designSettings.sectionColor);

    const slicerDiv = sectionDiv.append('div').classed('slicerDiv', true);
    this.bindSectionCollapse(sectionCollapseIcon);
    return this.renderSlicerContainers(slicerDiv);
  }

  private bindSectionCollapse(sectionCollapseIcon: Selection<HTMLElement, any, any, any>): void {
    sectionCollapseIcon.nodes().forEach((node) => {
      select(node).on('click', () => {
        const wasCollapsed = select(node).attr('isCollapsed') === 'true';
        const isCollapsed = !wasCollapsed;
        select(node).attr('isCollapsed', isCollapsed);
        select(node).classed('bi bi-chevron-down', isCollapsed);
        select(node).classed('bi bi-chevron-up', !isCollapsed);

        const sectionWrapper = select((node as HTMLElement).closest('.section') as HTMLElement);
        sectionWrapper.select('.slicerDiv').style('display', isCollapsed ? 'none' : 'block');
        sectionWrapper.classed('collapsed', isCollapsed).classed('expanded', !isCollapsed);
      });
    });
  }

  private renderSlicerContainers(slicerDiv: Selection<HTMLDivElement, any, any, any>): Selection<HTMLDivElement, any, any, any> {
    const designSettings = this.visualSettings.design;
    const slicerContainer = slicerDiv
      .selectAll('div')
      .data((d: any) => d.slicers.filter((el) => el.show))
      .enter()
      .append('div')
      .attr('class', 'slicerContainer')
      .attr('slicerLabel', (d: any) => d.displayName);

    const slicerHeaderDiv = slicerContainer.append('div').attr('class', 'slicerHeaderDiv');
    slicerHeaderDiv
      .append('span')
      .text((d: any) => d.displayName)
      .style('font-size', `${designSettings.slicerTitleFontSize}pt`)
      .style('font-family', designSettings.slicerTitleFontFamily)
      .style('font-weight', designSettings.slicerTitleBold ? 'bold' : '500')
      .style('font-style', designSettings.slicerTitleItalic ? 'italic' : 'normal')
      .style('text-decoration', designSettings.slicerTitleUnderline ? 'underline' : 'none')
      .style('color', designSettings.slicerTitleColor);

    slicerHeaderDiv
      .append('span')
      .attr('class', 'bi bi-trash3 closeIcon')
      .on('click', (e, d: any) => removeFilter(this, d));
    return slicerContainer;
  }

  private renderSlicers(slicerContainer: Selection<HTMLDivElement, any, any, any>): void {
    slicerContainer.each((slicer: any, index: number, nodes: any[]) => {
      const container = select<HTMLDivElement, any>(nodes[index] as HTMLDivElement);
      if (slicer.type === SlicerType.dropdown) {
        this.renderDropdownSlicer(slicer, container);
      } else if (slicer.type === SlicerType.list) {
        renderListSlicer(this, slicer, container, false);
      } else if (slicer.type === SlicerType.dateRange) {
        renderDateSlicer(this, slicer, container);
      } else if (slicer.type === SlicerType.numeric) {
        renderNumberSlicer(this, slicer, container);
      } else if (slicer.type === SlicerType.time) {
        renderTimeSlicer(this, slicer, container);
      }
    });
  }

  private renderDropdownSlicer(slicer: any, container: Selection<any, any, any, any>): void {
    const dropdownContainer = container.append('div').classed('dropdown-container', true).style('position', 'relative');
    const dropdownIcon = dropdownContainer.append('i').classed('dropdownIcon', true).classed('bi bi-chevron-down', true);
    const dropdownInput = dropdownContainer.append('div').classed('dropdown-input', true).text(getDropdownLabel(slicer));
    const dropdownList = dropdownContainer.append('div').attr('class', 'dropdownList').style('display', 'none');

    renderListSlicer(this, slicer, dropdownList, true);
    addLabelFormatting(this, dropdownInput, 'label', true);
    this.syncDropdownChips(slicer, dropdownInput, dropdownList);
    this.bindDropdownInputClick(slicer, dropdownInput, dropdownList, dropdownIcon);
  }

  private syncDropdownChips(slicer: any, dropdownInput: Selection<any, any, any, any>, dropdownList: Selection<any, any, any, any>): void {
    const chipsEnabled = this.visualSettings.design.chips;
    const selectedValues = slicer.values.filter((v) => v.checked && !v.isSelectAll);
    dropdownInput.selectAll('*').remove();

    if (selectedValues.length === 0 || selectedValues.length === slicer.values.filter((v) => !v.isSelectAll).length) {
      dropdownInput.text('All');
      return;
    }
    if (selectedValues.length === 1 && !chipsEnabled) {
      const v = selectedValues[0];
      dropdownInput.text(formatData(v.formatString, slicer.isDateTime && !v.isSelectAll ? new Date(v.value) : v.value));
      return;
    }
    if (selectedValues.length > 1 && !chipsEnabled) {
      dropdownInput.text('Multiple Selections');
      return;
    }

    dropdownInput.text('');
    if (!chipsEnabled) {
      return;
    }

    renderChip(dropdownInput, selectedValues, slicer.isDateTime, (removed) => {
      this.handleChipRemoval(removed, slicer, dropdownList);
      this.syncDropdownChips(slicer, dropdownInput, dropdownList);
    });
  }

  private handleChipRemoval(removed: IListValue[], slicer: any, dropdownList: Selection<any, any, any, any>): void {
    removed.forEach((removedValue) => {
      if (removedValue.hierarchyData?.isHieararchyStructure) {
        if (!removedValue.hierarchyData.isLeaf) {
          slicer.values.forEach((value) => {
            if (value.uid.startsWith(removedValue.uid) && value.uid !== removedValue.uid) {
              value.checked = false;
            }
          });
        }

        const target = slicer.values.find((value) => value.uid === removedValue.uid);
        if (target) {
          target.checked = false;
        }

        dropdownList.selectAll('.checkboxDiv').each(function (d: IListValue) {
          if (d.uid === removedValue.uid || (d.uid.startsWith(removedValue.uid) && d.uid !== removedValue.uid)) {
            select(this).select('input.checkbox').property('checked', false);
          }
        });
      } else {
        const target = slicer.values.find((value) => value.value === removedValue.value);
        if (target) {
          target.checked = false;
          dropdownList
            .selectAll('.checkboxDiv')
            .filter((d: IListValue) => d.value === removedValue.value)
            .select('input.checkbox')
            .property('checked', false);
        }
      }
    });

    if (removed.some((value) => value.hierarchyData?.isHieararchyStructure)) {
      checkParent(slicer.values);
    }
    this.syncSelectAllCheckbox(dropdownList, slicer.values);
  }

  private bindDropdownInputClick(
    slicer: any,
    dropdownInput: Selection<any, any, any, any>,
    dropdownList: Selection<any, any, any, any>,
    dropdownIcon: Selection<any, any, any, any>
  ): void {
    dropdownInput.on('click', (event: MouseEvent) => {
      event.stopPropagation();
      const dropdownClosed = dropdownList.style('display') === 'none';
      const display = dropdownClosed ? 'block' : 'none';

      dropdownIcon.classed('bi bi-chevron-down', !dropdownClosed);
      dropdownIcon.classed('bi bi-chevron-up', dropdownClosed);
      selectAll('.dropdownList').style('display', 'none');
      dropdownList.style('display', display);

      dropdownList.selectAll('input.checkbox').on('change.sync', (_e, d: IListValue) => {
        const checkbox = select(_e.currentTarget as HTMLInputElement);
        this.handleDropdownCheckboxChange(checkbox, d, slicer, dropdownList);
        this.syncDropdownChips(slicer, dropdownInput, dropdownList);
      });
    });
  }

  private handleDropdownCheckboxChange(
    checkbox: Selection<any, any, any, any>,
    value: IListValue,
    slicer: any,
    dropdownList: Selection<any, any, any, any>
  ): void {
    if (value.isSelectAll) {
      const isChecked = checkbox.property('checked');
      // Driven off the rendered rows so that values hidden by cross-filtering are not
      // swept back into the selection. With cross-filtering off, no row carries the
      // class and this behaves exactly as before.
      dropdownList.selectAll('.checkboxDiv').each(function (checkboxData: IListValue) {
        const row = select(this as HTMLElement);
        if (checkboxData.isSelectAll || checkboxData.hierarchyData?.isBlank || row.classed(CROSS_FILTER_HIDDEN_CLASS)) {
          return;
        }
        checkboxData.checked = isChecked;
        row.select('input.checkbox').property('checked', isChecked);
      });
      return;
    }

    value.checked = checkbox.property('checked');
    if (value.hierarchyData?.isHieararchyStructure && !value.hierarchyData.isLeaf) {
      const isChecked = value.checked;
      dropdownList.selectAll('.checkboxDiv').each(function (checkboxData: IListValue) {
        const row = select(this as HTMLElement);
        const isDescendant = checkboxData.uid.startsWith(value.uid) && checkboxData.uid !== value.uid;
        if (!isDescendant || checkboxData.hierarchyData?.isBlank || row.classed(CROSS_FILTER_HIDDEN_CLASS)) {
          return;
        }
        checkboxData.checked = isChecked;
        row.select('input.checkbox').property('checked', isChecked);
      });
    }

    if (value.hierarchyData?.isHieararchyStructure) {
      checkParent(slicer.values);
    }
    this.syncSelectAllCheckbox(dropdownList, slicer.values);
  }

  private syncSelectAllCheckbox(dropdownList: Selection<any, any, any, any>, slicerValues: IListValue[]): void {
    const allNonSelectAll = slicerValues.filter((value) => !value.isSelectAll && !value.hierarchyData?.isBlank);
    const allChecked = allNonSelectAll.length > 0 && allNonSelectAll.every((value) => value.checked);
    dropdownList
      .selectAll('.checkboxDiv')
      .filter((d: IListValue) => d.isSelectAll)
      .select('input.checkbox')
      .property('checked', allChecked);
  }

  private applyDefaultFilterIfNeeded(): void {
    if (!this.applyDefaultFiltering) {
      return;
    }
    this.applyDefaultFiltering = false;
    applyFilter(this, getSelectedDataFromUI());
  }

  private bindFooterActions(options: VisualUpdateOptions): void {
    this.applyAll.on('click', () => {
      const selectedData = getSelectedDataFromUI();
      if (selectedData.length > 0) {
        applyFilter(this, selectedData);
      } else {
        clearJSONFilter(this);
      }
      this.update(options);
    });

    this.cancel.on('click', () => {
      this.update(options);
    });

    this.reset.on('click', () => {
      clearJSONFilter(this);
      const defaultInstances = this.buildDefaultResetInstances();
      if (defaultInstances.length > 0) {
        this.host.persistProperties({ merge: defaultInstances });
      }
      this.timeSettingInstance = [];
      this.numberSettingInstance = [];
      this.relativeSettingInstance = [];
      // Reset puts every numeric and time slicer back to untouched, so they stop
      // contributing to the filter just as they did before the user first used them.
      this.touchedSlicers.clear();
    });
  }

  private buildDefaultResetInstances(): VisualObjectInstance[] {
    const defaultInstances: VisualObjectInstance[] = [];
    this.viewModel.sections.forEach((section) => {
      section.slicers.forEach((slicer) => {
        if (slicer.type === SlicerType.dateRange && slicer.slicerSetting.relativeDate) {
          defaultInstances.push({
            objectName: slicer.slicerSetting.objectName,
            selector: { metadata: slicer.slicerSetting.query },
            properties: { dateType: 'In Last', duration: 1, durationType: 'Select', isIncluded: true },
          } as VisualObjectInstance);
        }
        if (slicer.type === SlicerType.numeric) {
          defaultInstances.push({
            objectName: slicer.slicerSetting.objectName,
            selector: { metadata: slicer.slicerSetting.query },
            properties: { numberType: 'Is less than', value: 0 },
          } as VisualObjectInstance);
        }
        if (slicer.type === SlicerType.time) {
          defaultInstances.push({
            objectName: slicer.slicerSetting.objectName,
            selector: { metadata: slicer.slicerSetting.query },
            properties: { timeCondition: 'Is' },
          } as VisualObjectInstance);
        }
      });
    });
    return defaultInstances;
  }

  private bindRootContextMenu(): void {
    select(this.target).on('contextmenu', (event: PointerEvent) => {
      this.selectionManager.showContextMenu({}, { x: event.clientX, y: event.clientY });
      event.preventDefault();
    });
  }

  private bindOutsideClickHandler(): void {
    this.outsideClickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const filterListElement = this.filterList?.node();
      if (filterListElement && !filterListElement.contains(target) && !target.closest('.addFilter')) {
        this.filterList.style('display', 'none');
      }

      this.visualDiv.selectAll('.dropdownList, .relativeDropdownList, .numberConditionDropdownList, .conditionDropdownList').each(function () {
        const dropdown = select(this);
        const parent = (dropdown.node() as HTMLElement | null)?.parentElement;
        if (parent && !parent.contains(target)) {
          dropdown.style('display', 'none');
          select(parent).select('.dropdownIcon').classed('bi bi-chevron-down', true).classed('bi bi-chevron-up', false);
        }
      });
    };
    document.addEventListener('click', this.outsideClickHandler);
  }

  public setupContextMenu(): void {
    // Defer this binding since rootSelection is created in update()
    this.contextMenuTimer = window.setTimeout(() => {
      this.contextMenuTimer = null;
      if (this.body) {
        this.body.on('contextmenu', (event: PointerEvent) => {
          // Show Power BI context menu (empty space or with potential future data point)
          this.selectionManager.showContextMenu(
            {},
            {
              x: event.clientX,
              y: event.clientY,
            }
          );

          // Prevent the default browser context menu
          event.preventDefault();
        });
      }
    }, 0);
  }

  public applyInjectedCSS() {
    const designSettings = this.visualSettings.design;
    this.injectedStyle
      .text(
        `
  .searchInput::placeholder {
     font-size:${designSettings.searchFontSize}pt;
     font-family:${designSettings.searchFontFamily};
     font-weight:${designSettings.searchBold ? 'bold' : 'normal'};
     font-style:${designSettings.searchItalic ? 'italic' : 'normal'};
     text-decoration:${designSettings.searchUnderline ? 'underline' : 'none'};
     color:${designSettings.searchColor};
     opacity:0.6
   }

    .listSearchInput::placeholder {
     font-size:${designSettings.labelFontSize}pt;
     font-family:${designSettings.labelFontFamily};
     font-weight:${designSettings.labelBold ? 'bold' : 'normal'};
     font-style:${designSettings.labelItalic ? 'italic' : 'normal'};
     text-decoration:${designSettings.labelUnderline ? 'underline' : 'none'};
     color:${designSettings.labelColor};
     opacity:0.6
   }
 `
      );
  }

  public getFormattingModel(): FormattingModel {
    const cards: FormattingCard[] = [];

    // The pane can be opened before any field is bound, or while fields are being
    // swapped out. Returning an empty model beats throwing a null reference.
    if (!this.visualSettings) {
      return { cards };
    }
    if (!this.customSettings) {
      cards.push(getDesignCard(this));
      cards.push(getFilteringCard(this));
      return { cards };
    }

    const designCard: FormattingCard = getDesignCard(this);
    const filteringCard: FormattingCard = getFilteringCard(this);
    const section1Card: FormattingCard = getSectionCard(this, 1);
    const section2Card: FormattingCard = getSectionCard(this, 2);
    const section3Card: FormattingCard = getSectionCard(this, 3);
    const section4Card: FormattingCard = getSectionCard(this, 4);
    const section5Card: FormattingCard = getSectionCard(this, 5);
    cards.push(designCard);
    cards.push(filteringCard);
    cards.push(section1Card);
    cards.push(section2Card);
    cards.push(section3Card);
    cards.push(section4Card);
    cards.push(section5Card);

    const formattingModel: FormattingModel = { cards: cards };
    return formattingModel;
  }
}
