/**
 * Pure row-mask maths behind cross-filtering. Deliberately free of d3, Power BI and DOM
 * imports so the logic can be reasoned about and unit tested on its own.
 *
 * A "mask" is one byte per row of the dataView: 1 if the row is permitted, 0 if not.
 */

export interface IRowSelection {
  /** Identifies the slicer this selection came from. */
  key: string;
  /** Row indexes of the dataView this selection permits. */
  indexes: number[];
}

export interface IAllowedMasks {
  /** For a slicer with a selection: the rows permitted by every OTHER slicer. */
  allowedBySlicer: Map<string, Uint8Array>;
  /** For a slicer with no selection: the rows permitted by all slicers. */
  allowedForUnselected: Uint8Array;
}

export function createFullMask(rowCount: number): Uint8Array {
  const mask = new Uint8Array(rowCount);
  mask.fill(1);
  return mask;
}

export function intersectMasks(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.length);
  for (let index = 0; index < first.length; index++) {
    result[index] = first[index] & second[index];
  }
  return result;
}

/** One mask per slicer: the union of the rows its selected values occupy. */
export function buildSlicerMasks(selections: IRowSelection[], rowCount: number): Map<string, Uint8Array> {
  const masks = new Map<string, Uint8Array>();

  selections.forEach((selection) => {
    let mask = masks.get(selection.key);
    if (!mask) {
      mask = new Uint8Array(rowCount);
      masks.set(selection.key, mask);
    }
    selection.indexes.forEach((rowIndex) => {
      if (rowIndex >= 0 && rowIndex < rowCount) {
        mask[rowIndex] = 1;
      }
    });
  });

  return masks;
}

/**
 * The rows each slicer is allowed to show, excluding its own contribution.
 *
 * Prefix and suffix intersections mean the whole set costs two passes over the masks
 * instead of one pass per slicer: about 2 x fields x rows byte operations, which stays
 * inside a frame even at the 30,000 row cap declared in capabilities.json.
 */
export function buildAllowedMasks(masks: Map<string, Uint8Array>, rowCount: number): IAllowedMasks {
  const keys = Array.from(masks.keys());
  const count = keys.length;
  const prefix: Uint8Array[] = new Array(count + 1);
  const suffix: Uint8Array[] = new Array(count + 1);

  prefix[0] = createFullMask(rowCount);
  suffix[count] = createFullMask(rowCount);

  for (let index = 0; index < count; index++) {
    prefix[index + 1] = intersectMasks(prefix[index], masks.get(keys[index]));
  }
  for (let index = count - 1; index >= 0; index--) {
    suffix[index] = intersectMasks(suffix[index + 1], masks.get(keys[index]));
  }

  const allowedBySlicer = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index++) {
    allowedBySlicer.set(keys[index], intersectMasks(prefix[index], suffix[index + 1]));
  }

  return { allowedBySlicer, allowedForUnselected: prefix[count] };
}

/** True when at least one of the value's rows survives the mask. */
export function hasReachableRow(indexes: number[], allowed: Uint8Array): boolean {
  for (let position = 0; position < indexes.length; position++) {
    const rowIndex = indexes[position];
    if (rowIndex >= 0 && rowIndex < allowed.length && allowed[rowIndex] === 1) {
      return true;
    }
  }
  return false;
}
