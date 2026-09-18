import { select, selectAll } from 'd3';
import { IListValue, ISelectedData, ISlicer } from '../../interfaces';
import { Visual } from '../../visual';
import { getSelectedDataFromUI } from './applyFilter';
import { buildAllowedMasks, buildSlicerMasks, hasReachableRow, IRowSelection } from './crossFilterMath';

/**
 * Cross-filtering between the fields inside this visual.
 *
 * Power BI never applies a visual's own JSON filter back to that visual's dataView, so
 * every field in the slicer always receives the full row set. Without the work below,
 * ticking "Sales" in Business Unit leaves every Department and Location on screen,
 * including the ones that have no Sales rows at all.
 *
 * The dataView is row aligned - categories[n].values[i] is column n of row i - and
 * visualTransform() already records, on every list value, the row indexes that value
 * occupies. So each slicer's current selection can be expressed as a bitmask over rows,
 * and a value in some other slicer is reachable exactly when at least one of its own
 * rows survives the intersection of all the other slicers' masks.
 *
 * A slicer is never evaluated against its own mask, which is what stops the list you are
 * clicking in from collapsing to the one value you just ticked.
 */

/** Applied to a checkbox row that has no reachable data row left. */
export const CROSS_FILTER_HIDDEN_CLASS = 'crossFilteredOut';

/** Coalesces the burst of change/pointerup events a single interaction produces. */
const RECOMPUTE_DELAY_MS = 30;

let pendingRecompute: number = null;

function getRowCount(self: Visual): number {
  const categories = self.options?.dataViews?.[0]?.categorical?.categories;
  if (!categories || categories.length === 0) {
    return 0;
  }
  return categories.reduce((longest, category) => Math.max(longest, category.values?.length ?? 0), 0);
}

/**
 * Selections are grouped by the slicer they came from. A hierarchy slicer spans several
 * columns, so its target list is the fallback key when no query name was recorded.
 */
function toRowSelection(selection: ISelectedData): IRowSelection {
  return {
    key: selection.slicerQuery || selection.targets.map((target) => `${target.table}|${target.column}`).join('||'),
    indexes: selection.indexes,
  };
}

function clearCrossFilterClasses(): void {
  selectAll(`.${CROSS_FILTER_HIDDEN_CLASS}`).classed(CROSS_FILTER_HIDDEN_CLASS, false);
}

/**
 * Recomputes which checkbox rows are still reachable and hides the rest.
 *
 * Only list and dropdown slicers are narrowed. Date, numeric and time slicers contribute
 * their selection as a constraint but are left alone, because narrowing one of those
 * means moving its bounds rather than hiding a row.
 */
export function applyCrossFilter(self: Visual): void {
  if (!self.visualSettings?.filtering?.crossFilter) {
    clearCrossFilterClasses();
    return;
  }

  const rowCount = getRowCount(self);
  if (rowCount === 0) {
    clearCrossFilterClasses();
    return;
  }

  const selectedData = getSelectedDataFromUI({ silent: true });
  const masks = buildSlicerMasks(selectedData.map(toRowSelection), rowCount);
  if (masks.size === 0) {
    clearCrossFilterClasses();
    return;
  }

  const { allowedBySlicer, allowedForUnselected } = buildAllowedMasks(masks, rowCount);

  selectAll('.checkboxList')
    .nodes()
    .forEach((listNode) => {
      const slicer = select(listNode).data()[0] as ISlicer;
      if (!slicer) {
        return;
      }

      const allowed = allowedBySlicer.get(slicer.query) ?? allowedForUnselected;

      select(listNode)
        .selectAll('.checkboxDiv')
        .each(function (value: IListValue) {
          const row = select(this as HTMLElement);
          const isChecked = row.select('input.checkbox').property('checked') === true;
          // A ticked value always stays on screen, so a selection can never disappear
          // out from under the user even once it stops being reachable.
          const keep = value.isSelectAll || isChecked || hasReachableRow(value.indexes, allowed);
          row.classed(CROSS_FILTER_HIDDEN_CLASS, !keep);
        });
    });
}

/** Debounced entry point for DOM event handlers. */
export function scheduleCrossFilter(self: Visual): void {
  if (pendingRecompute !== null) {
    return;
  }
  pendingRecompute = window.setTimeout(() => {
    pendingRecompute = null;
    applyCrossFilter(self);
  }, RECOMPUTE_DELAY_MS);
}

export function cancelScheduledCrossFilter(): void {
  if (pendingRecompute !== null) {
    window.clearTimeout(pendingRecompute);
    pendingRecompute = null;
  }
}
