/* eslint-disable */
/**
 * Darwinbox-shaped test data: text fields, a hierarchy, a date, a numeric and a time
 * column, plus deliberately awful values for the bad-data test case.
 */
const BUSINESS_UNITS = ['Sales', 'Engineering', 'Human Resources', 'Finance'];
const DEPARTMENTS = {
  Sales: ['Inside Sales', 'Field Sales', 'Sales Operations'],
  Engineering: ['Platform', 'Data', 'Mobile'],
  'Human Resources': ['Talent Acquisition', 'HR Operations'],
  Finance: ['Payroll', 'Controlling'],
};
const LOCATIONS = ['Hyderabad', 'Bengaluru', 'Mumbai', 'Pune', 'Gurugram'];
const GRADES = ['G1', 'G2', 'G3', 'G4'];
const REGIONS = { Hyderabad: 'South', Bengaluru: 'South', Mumbai: 'West', Pune: 'West', Gurugram: 'North' };

function buildStandardSpec(rowCount) {
  rowCount = rowCount || 120;
  const columns = [
    { name: 'Business Unit', section: 1, type: 'text' },
    { name: 'Department', section: 1, type: 'text' },
    { name: 'Location', section: 2, type: 'text' },
    { name: 'Grade', section: 2, type: 'text' },
    { name: 'Date of Joining', section: 3, type: 'date' },
    { name: 'Annual CTC', section: 3, type: 'number', format: '#,0' },
  ];

  const rows = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (let i = 0; i < rowCount; i++) {
    const bu = BUSINESS_UNITS[Math.floor(rand() * BUSINESS_UNITS.length)];
    const dept = DEPARTMENTS[bu][Math.floor(rand() * DEPARTMENTS[bu].length)];
    const loc = LOCATIONS[Math.floor(rand() * LOCATIONS.length)];
    const grade = GRADES[Math.floor(rand() * GRADES.length)];
    const doj = new Date(2021 + Math.floor(rand() * 5), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28));
    const ctc = 400000 + Math.floor(rand() * 40) * 50000;
    rows.push([bu, dept, loc, grade, doj, ctc]);
  }
  return { table: 'Employee', columns: columns, rows: rows };
}

/** Business Unit > Department > Location as a real Power BI hierarchy. */
function buildHierarchySpec() {
  const columns = [
    { name: 'BU', section: 1, type: 'text', hierarchyGroup: 'OrgHierarchy' },
    { name: 'Dept', section: 1, type: 'text', hierarchyGroup: 'OrgHierarchy' },
    { name: 'City', section: 1, type: 'text', hierarchyGroup: 'OrgHierarchy' },
    { name: 'Grade', section: 2, type: 'text' },
  ];
  const rows = [];
  BUSINESS_UNITS.forEach((bu) => {
    DEPARTMENTS[bu].forEach((dept, di) => {
      LOCATIONS.slice(0, 2 + (di % 2)).forEach((city, ci) => {
        rows.push([bu, dept, city, GRADES[(di + ci) % GRADES.length]]);
      });
    });
  });
  return { table: 'Employee', columns: columns, rows: rows };
}

/** Nulls, blanks, Infinity, negatives, wrong types, duplicate labels across parents. */
function buildBadDataSpec() {
  const columns = [
    { name: 'Business Unit', section: 1, type: 'text' },
    { name: 'Department', section: 1, type: 'text' },
    { name: 'Date of Joining', section: 2, type: 'date' },
    { name: 'Annual CTC', section: 2, type: 'number' },
  ];
  const rows = [
    ['Sales', 'Inside Sales', new Date(2022, 3, 12), 500000],
    [null, null, null, null],
    ['', '', new Date(2023, 0, 1), 0],
    ['Engineering', 'Platform', new Date(1899, 11, 30), -250000],
    ['Engineering', 'Ops', new Date(2024, 5, 30), Infinity],
    ['Finance', 'Ops', new Date(2025, 8, 15), -Infinity],
    ['Sales', 'Ops', new Date(2020, 1, 29), NaN],
    ['Human Resources', 'HR Operations', new Date(9999, 11, 31), 1e21],
    ['Sales', 'Inside Sales', 'not-a-date', 'not-a-number'],
    ['   ', 'Whitespace', new Date(2022, 6, 4), 123.456789],
  ];
  return { table: 'Employee', columns: columns, rows: rows };
}

function buildSingleRowSpec() {
  return {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Location', section: 1, type: 'text' },
    ],
    rows: [['Sales', 'Hyderabad']],
  };
}

function buildTwoRowSpec() {
  return {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Location', section: 1, type: 'text' },
    ],
    rows: [
      ['Sales', 'Hyderabad'],
      ['Engineering', 'Mumbai'],
    ],
  };
}

/** Wide and deep: the 30,000-row data-reduction ceiling. */
function buildLargeSpec() {
  const spec = buildStandardSpec(30000);
  return spec;
}

module.exports = {
  buildStandardSpec,
  buildHierarchySpec,
  buildBadDataSpec,
  buildSingleRowSpec,
  buildTwoRowSpec,
  buildLargeSpec,
  REGIONS,
};
