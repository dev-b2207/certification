import { IHierarchyGroup, ISlicerSetting, IListValue } from "../interfaces";
import { Visual } from "../visual";
import { getFilteredValues, getTarget, untilde } from "./visualTransform";
import { getHierarchyPathIndexes } from "./rowIndex";
import { isNil, isEmpty, every, some } from "lodash";

export function getHieararchyFilteredValues(self: Visual, hierarchyGroup: IHierarchyGroup) {
  const hieararchyFilteredValues = hierarchyGroup.fields.map((el) => {
    return getFilteredValues(self, el, false);
  });
  let hierarchyFilteredUIDs = [];
  if (!isNil(hieararchyFilteredValues[0])) {
    hierarchyFilteredUIDs = hieararchyFilteredValues[0].map(
      (el, valIndex) => `|${hieararchyFilteredValues.map((row) => `${row[valIndex]}`).join("|")}`
    );
  }
  return hierarchyFilteredUIDs;
}

export function buildTree(
  self: Visual,
  data: any[][],
  hierarchyGroup: IHierarchyGroup,
  hierarchyFilteredUIDs: string[],
  slicerSetting: ISlicerSetting,
  level: number,
  listValues: IListValue[],
  parentValue: string
) {
  if (level - 1 >= data.length) {
    return [];
  }
  const category = hierarchyGroup.fields[level - 1];

  const categories = hierarchyGroup.fields.filter((el, index) => index < level);

  const uniqueValues = Array.from(new Set(data[level - 1]));

  uniqueValues.forEach((uniqValue) => {
    const value = `${uniqValue}`;
    const indices = data[level - 1].map((v, i) => (`${v}` === `${value}` ? i : -1)).filter((i) => i !== -1);
    const childrenData = data.map((arr) => indices.map((i) => arr[i]));

    const uid = `${parentValue}|${value ? `${value}` : ""}~`;

    const collapsed = isNil(slicerSetting.hieararchyState.find((el) => el === uid));

    const isBlank = isNil(uniqValue) || isEmpty(value);

    const uidUnTilde = untilde(uid);

    // Rows matching this node's full path. Indexed once per depth rather than
    // rebuilt for every node, which is what made deep hierarchies on large models slow.
    const allIndexes = getHierarchyPathIndexes(
      hierarchyGroup.fields[0].values,
      categories.map((cat) => cat.values),
      uidUnTilde
    );

    listValues.push({
      value: isBlank ? uniqValue : value,
      checked: false,
      indexes: allIndexes,
      level: level,
      isSelectAll: false,
      uid,
      target: getTarget(category),
      formatString: category.source.format,
      hierarchyData: {
        collapsed,
        isLeaf: level === data.length,
        isHieararchyStructure: true,
        isBlank,
        hierarchyGroup,
      },
    });
    buildTree(self, childrenData, hierarchyGroup, hierarchyFilteredUIDs, slicerSetting, level + 1, listValues, uid);
  });
}

export function findAndCheckLeaf(self: Visual, hierarchyGroup: IHierarchyGroup, listValues: IListValue[]) {
  const hierarchyFilteredUIDs = getHieararchyFilteredValues(self, hierarchyGroup);
  //Set IsLeaf and Checked
  listValues.forEach((listValue) => {
    listValue.hierarchyData.isLeaf =
      listValues
        .filter((el) => !el.hierarchyData.isBlank)
        .map((el) => el.uid)
        .filter((el) => el.includes(listValue.uid)).length <= 1;
    if (listValue.hierarchyData.isLeaf) {
      const uidUnTilde = untilde(listValue.uid);

      listValue.checked =
        hierarchyFilteredUIDs.findIndex(
          (el) =>
            el
              .split("|")
              .filter((_id, index) => index <= listValue.level)
              .join("|") === uidUnTilde
        ) !== -1;
    }
  });
}

export function checkParent(listValues: IListValue[]) {
  listValues.forEach((listValue) => {
    if (!listValue.hierarchyData.isLeaf && !listValue.hierarchyData.isBlank) {
      listValue.checked = false;
      const children = listValues.filter(
        (el) => el.hierarchyData.isLeaf && el.uid.includes(listValue.uid) && !el.hierarchyData.isBlank && el.uid !== listValue.uid
      );
      const allChildrendChecked = every(children, (el) => el.checked) && children.length > 0;
      const someChildrendChecked = some(children, (el) => el.checked) && children.length > 0;
      if (allChildrendChecked) {
        listValue.checked = true;
      } else if (someChildrendChecked) {
        listValue.checked = undefined;
      }
    }
  });
}
