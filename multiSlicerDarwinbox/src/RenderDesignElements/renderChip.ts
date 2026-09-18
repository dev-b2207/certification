import * as d3 from 'd3';
import { formatData } from '../Functions/designFunctions';
import { IListValue } from '../interfaces';

const MAX_VISIBLE_CHIPS = 3;

function renderHierarchyChips(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  values: IListValue[],
  onChange: (values: IListValue[]) => void
) {
  let fieldLabels: string[] = [];
  const firstWithHierarchy = values.find((v) => v.hierarchyData?.hierarchyGroup?.fields?.length);
  if (firstWithHierarchy) {
    fieldLabels = firstWithHierarchy.hierarchyData.hierarchyGroup.fields.map((f, i) => f.source?.displayName || `Level ${i + 1}`);
  }

  const grouped = new Map<number, IListValue[]>();
  values.forEach((val) => {
    if (!grouped.has(val.level)) {
      grouped.set(val.level, []);
    }
    grouped.get(val.level)!.push(val);
  });

  const groupBox = container.append('div').attr('class', 'chip-group');
  groupBox.append('div').attr('class', 'chip-group-title').style('font-weight', '600').style('margin-bottom', '6px').text('Selected Values');

  grouped.forEach((groupValues, level) => {
    const validValues = groupValues.filter((val) => {
      if (!val.checked || val.hierarchyData?.isBlank) {
        return false;
      }
      if (val.value === null || val.value === undefined || `${val.value}`.trim() === '') {
        return false;
      }
      return true;
    });

    if (validValues.length === 0) {
      return;
    }

    groupBox.append('div').attr('class', 'chip-subgroup-title').style('font-weight', '500').style('font-size', '13px').style('margin', '4px 0 2px').text(fieldLabels[level - 1] || `Level ${level}`);
    const chipArea = groupBox.append('div').attr('class', 'chip-area').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '6px').style('margin-left', '8px');

    validValues.forEach((val, idx) => {
      if (idx >= MAX_VISIBLE_CHIPS) {
        return;
      }
      const chip = chipArea
        .append('div')
        .attr('class', 'chip')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('background', '#f0f2f5')
        .style('border-radius', '16px')
        .style('padding', '2px 8px')
        .style('font-size', '12px')
        .text(val.value);

      chip.append('span').attr('class', 'remove').style('cursor', 'pointer').style('margin-left', '6px').text('×').on('click', (event) => {
        event.stopPropagation();
        onChange([val]);
      });
    });

    if (validValues.length > MAX_VISIBLE_CHIPS) {
      chipArea
        .append('div')
        .attr('class', 'chip more-chip')
        .style('background', '#f0f2f5')
        .style('border-radius', '16px')
        .style('padding', '2px 8px')
        .style('font-size', '12px')
        .text(`+${validValues.length - MAX_VISIBLE_CHIPS} more`);
    }
  });
}

function renderFlatChips(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  selected: IListValue[],
  isDateTime: boolean,
  onChange: (values: IListValue[]) => void
) {
  const wrapper = container.append('div').attr('class', 'chip-wrapper');
  const chipArea = wrapper.append('div').attr('class', 'chip-area');

  function updateChips(values: IListValue[]) {
    chipArea.selectAll('*').remove();
    values.forEach((val, idx) => {
      if (idx >= MAX_VISIBLE_CHIPS || !val.value || `${val.value}`.trim() === '') {
        return;
      }
      const label = formatData(val.formatString, isDateTime ? new Date(val.value) : val.value);
      const chip = chipArea.append('div').attr('class', 'chip').text(label);
      chip.append('span').attr('class', 'remove').text('×').on('click', (event) => {
        event.stopPropagation();
        const newValues = values.filter((v) => v.value !== val.value);
        updateChips(newValues);
        onChange([val]);
      });
    });

    if (values.length > MAX_VISIBLE_CHIPS) {
      chipArea.append('div').attr('class', 'chip more-chip').text(`+${values.length - MAX_VISIBLE_CHIPS} more`);
    }
  }

  updateChips(selected);
}

export function renderChip(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  options: IListValue[] | { parent: IListValue[]; children: IListValue[] }[],
  isDateTime: boolean,
  onChange: (values: IListValue[]) => void
) {
  container.selectAll('*').remove();
  const values = options as IListValue[];
  const isHierarchy = values.some((option) => option.hierarchyData?.isHieararchyStructure);
  if (isHierarchy) {
    renderHierarchyChips(container, values, onChange);
    return;
  }
  renderFlatChips(container, values, isDateTime, onChange);
}
