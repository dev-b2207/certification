import io
import json
import os

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

SRC = '/root/.claude/uploads/8101b043-7e5d-57db-b3a5-f19271da6217/81030852-Test_cases_PowerBI_Custom_Visual.xlsx'
OUT = '/home/claude/work/appsource/Test-results-multiSlicerDarwinbox-2.5.0.1.xlsx'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# Result, Evidence keyed by the leading words of each Microsoft test case.
RESULTS = {
    'Create a Stacked column chart': (
        'Pass',
        'TC1. Mounted with category+value, reduced to three fields, restored to six. No console errors, no exceptions, '
        'rendering events completed normally on every transition.'),
    'Create a Gauge with three measures': (
        'Pass',
        'TC2. Same conversion path exercised with a three-field dataView and back. The visual declares five Grouping '
        'roles only, so measures arrive as additional categories. No errors.'),
    'Make selections in your visual.': (
        'Pass',
        'TC3. Ticked Business Unit = Sales and pressed Apply. Tuple filter target was exactly [Business Unit]; a '
        'downstream consumer saw 30 of 120 rows, matching the 30 Sales rows. NOTE: this case failed before this release '
        'and is fixed in 2.5.0.1 - see the Defects sheet.'),
    'Select elements in other visuals.': (
        'Pass',
        'TC4. Host supplied a dataView narrowed to Engineering. The visual rendered only Engineering values and did not '
        're-broadcast a filter.'),
    'Check min/max dataViewMapping': (
        'Pass',
        'TC5. All five data roles are kind "Grouping" and each accepts any number of fields, so no min/max condition '
        'applies. dataReductionAlgorithm is set to top 30000 on both categories and values.'),
    'Remove all fields in different orders': (
        'Pass',
        'TC6. Three removal orders (reverse, forward, shuffled) down to zero fields, opening the format pane after each '
        'removal. No console errors and no exceptions at any step, including the empty state.'),
    'Open the Format pane with each possible bucket': (
        'Pass',
        'TC7. Format pane built for 0,1,2,3,4,5 and 6 bound fields. No null reference exceptions. With zero fields the '
        'model degrades to the two cards that do not need data (Design, Filtering) rather than throwing.'),
    'Filter data using the Filter pane': (
        'Pass',
        'TC4 covers the mechanism: the visual renders whatever dataView the host supplies. The visual draws no tooltips, '
        'so the tooltip clause does not apply - see the Notes sheet.'),
    'Filter data using a Slicer.': (
        'Pass',
        'Same mechanism as TC4. Verified by supplying a pre-filtered dataView and confirming the rendered values match.'),
    'Filter data using a published visual': (
        'Pass',
        'Same mechanism as TC4. The visual has no cross-highlight path of its own; it re-renders from the supplied '
        'dataView.'),
    'If cross-filtering is supported': (
        'Pass',
        'TC11. Selecting Business Unit narrowed Department from 11 to 4 visible values while Business Unit itself kept '
        'all 5. TC3 confirms the applied filter reaches other visuals.'),
    'Select with Ctrl, Alt, and Shift': (
        'Pass',
        'TC12. Selections made with each modifier held. No unexpected behaviour, no errors. The visual does not bind '
        'modifier keys, so behaviour is identical with and without them.'),
    'Change the View Mode': (
        'Not applicable',
        'The visual has no canvas, no plotted marks and no coordinate mapping - it is a DOM panel of native form '
        'controls. Zoom level cannot desynchronise mouse coordinates. Layout at five viewport sizes verified in TC14.'),
    'Resize your visual.': (
        'Pass',
        'TC14. Five viewports from 160x120 to 1200x300. Correct reflow, no errors, no horizontal bleed at any size.'),
    'Set the report size to the minimum.': (
        'Pass',
        'TC15. At 160x120 the panel still renders with a working vertical scrollbar and no clipped or overlapping '
        'controls.'),
    'Ensure scroll bars work correctly.': (
        'Pass',
        'TC16. Vertical scrolling appears on the slicer area when content exceeds the height and disappears when it does '
        'not. Horizontal overflow measured at 0px in all five viewports. Scrollbars are 8px, styled to match the panel.'),
    'Pin your visual to a Dashboard.': (
        'Manual',
        'Requires the Power BI service. Cannot be exercised in an offline harness. Pinned tiles render a static image '
        'from a normal update() pass, which is covered by TC1/TC14.'),
    'Add multiple versions of your visual to a single report page': (
        'Pass',
        'TC18/TC18b. Two instances, each in its own sandboxed iframe as Power BI renders them: selecting in instance 0 '
        'narrowed only instance 0 (11 to 4) and left instance 1 untouched (11). See the Notes sheet for the '
        'non-sandboxed caveat.'),
    'Add multiple versions of your visual to multiple report pages': (
        'Pass',
        'Same isolation mechanism as the single-page case; each instance owns its own host, dataView and DOM subtree.'),
    'Switch between report pages.': (
        'Pass',
        'TC20. Repeated update() cycles including a resize-only update. Rendering events paired correctly '
        '(started/finished) on every pass with no failures.'),
    'Test Reading view and Edit view': (
        'Pass',
        'TC21. Updates issued in both viewMode/editMode combinations plus a resize-type update. No errors.'),
    'If your visual uses animations': (
        'Not applicable',
        'The visual uses no animation. Elements are added and removed synchronously within update().'),
    'Open the Property pane.': (
        'Pass',
        'TC23. Stress-tested with an empty colour string, font size 0, font size 9999, a 500-character section name, an '
        'empty section name and a script tag as a font family. 7 cards and 44 slices built without error and the script '
        'string was not executed - the visual writes text, never markup.'),
    'Save the report and reopen it.': (
        'Pass',
        'TC24. Selection applied, persisted objects and jsonFilters captured, visual torn down and rebuilt from that '
        'state. Both the format settings and the ticked value were restored.'),
    'Switch pages in the report and then switch back.': (
        'Pass',
        'TC25. Same persistence path as TC24 - settings live in metadata.objects and the selection in jsonFilters, both '
        'replayed by the host on the next update.'),
    'Test all functionality of your visual': (
        'Pass',
        'TC26. All five slicer types rendered and operated: list, dropdown (with chips), date range, numeric condition '
        'and time condition. Hierarchy slicers verified separately in TCH - all 38 nodes of a 3-level hierarchy rendered, '
        'including labels repeated under different parents.'),
    'Test all numeric, date, and character data types': (
        'Pass',
        'TC27. Text, date, numeric and time columns bound simultaneously and rendered together without error.'),
    'Review formatting of tooltip values, axis labels': (
        'Not applicable',
        'The visual has no tooltips, axes or data labels. Value labels in lists are formatted through the Power BI '
        'valueFormatter using the column format string from the model.'),
    'Verify that data labels use the format string.': (
        'Pass',
        'List and dropdown labels are produced by valueFormatter.create({format: column.source.format}), so they follow '
        'the model format string. Numeric and time fields render as condition controls rather than labels.'),
    'Switch automatic formatting on and off': (
        'Not applicable',
        'No tooltips, so there are no tooltip values to format.'),
    'Test data entries with different types of data': (
        'Pass',
        'TC30a/b/c. One row, two rows and 30,000 rows (the declared data reduction ceiling). 30,000 rows across six '
        'fields render in ~150ms and a cross-filter recompute takes 214ms. NOTE: this was 5,124ms before this release - '
        'see the Defects sheet.'),
    'Provide bad data to your visual': (
        'Pass',
        'TC31. null, empty string, whitespace-only, Infinity, -Infinity, NaN, a negative value, 1e21, a date of '
        '9999-12-31, a date of 1899-12-30, a string in a date column and a string in a numeric column. Rendered, '
        'selectable and filterable with no errors; blanks display as "(Blank)".'),
}

DEFECTS = [
    ('Every list collapsed to "Select All" when a selection reached no rows',
     'Critical - unusable panel',
     'Fixed in 2.5.0.1',
     'Clicking anywhere in the visual made every option in every section disappear, leaving only '
     '"Select All" and any already-ticked values, so the user could not even see the value they '
     'needed to untick. The date, time and numeric collectors emit boundary values and a "no data" '
     'sentinel carrying no row indexes, so the Power BI tuple filter has the right shape. The '
     'cross-filter treated any slicer that emitted anything as constraining, so a slicer whose range '
     'reached no rows produced an all-zero mask that intersected every other field down to nothing. '
     'Present in both 2.5.0.0 packages.',
     'Mask building now ignores selections carrying no row indexes, and drops any slicer mask that '
     'ends up with no rows set - a field that reaches no rows cannot narrow the others. The applied '
     'Power BI filter is unchanged; only the cross-filter masking was touched. Covered by test case '
     'TCB in the harness suite and three unit checks.'),
    ('Untouched numeric or time field silently filtered the report',
     'Critical - wrong data',
     'Fixed in 2.5.0.1',
     'A numeric field defaults to the condition "Is less than" seeded with the data maximum, and a time field defaults '
     'to "Is". Both joined the applied tuple filter even when the user never touched them. Numeric silently dropped '
     'every row holding the maximum value; time dropped every row. Reproduced at 2 of 3 expected rows (numeric) and '
     '0 of 3 (time).',
     'Numeric and time slicers now contribute to the filter only once the user changes a condition or a value, matching '
     'how the date and list slicers already behaved. The touched state is held on the visual instance so it survives '
     'the re-render that follows Apply, and is restored from the applied filter when a report is reopened. Reset '
     'returns every field to untouched.'),
    ('Main thread froze for ~5 seconds on large models',
     'High - performance',
     'Fixed in 2.5.0.1',
     'Row indexes were built by scanning the whole column once per distinct value and accumulating with array spread, '
     'so cost grew with rows x distinct values. A 30,000-row model with a high-cardinality field (date of joining, '
     'employee code) took 5,124ms per render. Microsoft submission testing requires no application freezing.',
     'Each column is now indexed once per update in a single pass and memoised against the column array; hierarchy '
     'paths are indexed once per depth instead of rebuilt per node. The same 30,000-row model renders in 144ms, a 35x '
     'improvement, with identical output.'),
    ('Fields did not narrow each other',
     'High - usability',
     'Fixed in 2.5.0.1',
     'Power BI never applies a visual\'s own filter back to that visual, so every field always received the full row '
     'set and no selection constrained any other field. Users could pick combinations that returned an empty report.',
     'Cross-filtering computed inside the visual over row-index bitmasks. Controlled by Filtering > Filter other '
     'fields, default on.'),
    ('Style tag and document listener leaked on every update',
     'Medium - performance',
     'Fixed in 2.5.0.1',
     'applyInjectedCSS() appended a new <style> element to document.head on every update(), and the outside-click '
     'handler added a new document listener on every update() without removing the previous one. Both grew without '
     'bound for the life of the session.',
     'One style element created in the constructor and rewritten in place; the click handler bound once and removed in '
     'a new destroy(). Verified: 25 consecutive updates add zero style tags.'),
    ('Errors were swallowed, leaving stale content and a broken format pane',
     'Medium - robustness',
     'Fixed in 2.5.0.1',
     'update() wrapped everything in try/catch and logged to console. A missing dataView or a field removed mid-session '
     'threw, was swallowed, left the previous render on screen, and then made getFormattingModel() throw a null '
     'reference when the pane was opened.',
     'Empty and partial dataViews are handled explicitly, the format pane degrades to the cards it can build, and the '
     'catch reports through the Rendering Events API.'),
]

NOTES = [
    ('Tooltips', 'The visual draws no tooltips, axes or data labels, so the four tooltip-related test cases do not '
                 'apply. Value labels use the model format string via the Power BI valueFormatter.'),
    ('View mode / mouse coordinates',
     'The visual is a DOM panel of native form controls with no canvas or plotted marks, so there is no coordinate '
     'mapping that page zoom could desynchronise. Layout is verified at five viewport sizes instead.'),
    ('Multiple instances, non-sandboxed hosts',
     'Power BI renders each custom visual in its own sandboxed iframe, and instances are fully isolated in that layout '
     '(verified). The visual does use document-wide selectors internally, so two instances sharing a single document '
     'would share state. This is only reachable if visual sandboxing is disabled at tenant level, and is recorded as a '
     'known issue in CLAUDE.md.'),
    ('Dashboard pinning', 'Requires the Power BI service and cannot be exercised offline. A pinned tile is a static '
                          'image produced by a normal update() pass, which is covered by the rendering tests.'),
    ('How these results were produced',
     'The packaged 2.5.0.1 .pbiviz was loaded into a headless Chromium harness against a Power BI host simulator that '
     'models the categorical dataView, persistProperties, applyJsonFilter and the host-driven update that follows a '
     'filter. Every console error, page error and unhandled rejection was captured; the full run produced none. The '
     'harness is included in the source zip under harness/ so the run can be repeated.'),
    ('Still to be done by Darwinbox',
     'Replace the placeholder supportUrl and gitHubUrl in pbiviz.json, supply a privacy policy URL, publish a '
     'single-visual public repo with a lowercase "certification" branch, and build the sample .pbix in Power BI '
     'Desktop. See SUBMISSION-CHECKLIST.md.'),
]

HDR_FILL = PatternFill('solid', fgColor='12386B')
HDR_FONT = Font(color='FFFFFF', bold=True, size=10, name='Segoe UI')
BODY = Font(size=10, name='Segoe UI')
THIN = Side(style='thin', color='D7DBE0')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
STATUS_FILL = {
    'Pass': PatternFill('solid', fgColor='DFEFE5'),
    'Not applicable': PatternFill('solid', fgColor='EDEFF2'),
    'Manual': PatternFill('solid', fgColor='FBF0D9'),
    'Fail': PatternFill('solid', fgColor='F8E3E0'),
}
STATUS_FONT = {
    'Pass': Font(size=10, bold=True, color='1F6046', name='Segoe UI'),
    'Not applicable': Font(size=10, bold=True, color='5A6472', name='Segoe UI'),
    'Manual': Font(size=10, bold=True, color='8A5A00', name='Segoe UI'),
    'Fail': Font(size=10, bold=True, color='9B2C20', name='Segoe UI'),
}


def style_header(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for cell in ws[1]:
        cell.fill = HDR_FILL
        cell.font = HDR_FONT
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = 'A2'


def lookup(test_case):
    for prefix, value in RESULTS.items():
        if test_case.startswith(prefix):
            return value
    return ('Not run', 'No mapping found.')


src = openpyxl.load_workbook(SRC, data_only=True)
src_ws = src['Sheet1']
rows = [(r[0], r[1]) for r in src_ws.iter_rows(min_row=2, values_only=True) if r[0]]

wb = openpyxl.Workbook()

# --- Sheet 1: results ---
ws = wb.active
ws.title = 'Test results'
ws.append(['#', 'Test case (Microsoft)', 'Expected result (Microsoft)', 'Status', 'Evidence'])
for i, (tc, exp) in enumerate(rows, start=1):
    status, evidence = lookup(str(tc).strip())
    ws.append([i, tc, exp, status, evidence])
style_header(ws, [5, 44, 40, 15, 88])
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.font = BODY
        c.border = BORDER
        c.alignment = Alignment(vertical='top', wrap_text=True)
    st = row[3].value
    if st in STATUS_FILL:
        row[3].fill = STATUS_FILL[st]
        row[3].font = STATUS_FONT[st]
        row[3].alignment = Alignment(vertical='top', horizontal='center')

# --- Sheet 2: defects found and fixed ---
ws2 = wb.create_sheet('Defects found')
ws2.append(['Defect', 'Severity', 'Status', 'What was happening', 'What was changed'])
for d in DEFECTS:
    ws2.append(list(d))
style_header(ws2, [46, 22, 18, 74, 74])
for row in ws2.iter_rows(min_row=2):
    for c in row:
        c.font = BODY
        c.border = BORDER
        c.alignment = Alignment(vertical='top', wrap_text=True)
    row[2].fill = STATUS_FILL['Pass']
    row[2].font = STATUS_FONT['Pass']

# --- Sheet 3: notes ---
ws3 = wb.create_sheet('Notes')
ws3.append(['Topic', 'Note'])
for n in NOTES:
    ws3.append(list(n))
style_header(ws3, [34, 118])
for row in ws3.iter_rows(min_row=2):
    for c in row:
        c.font = BODY
        c.border = BORDER
        c.alignment = Alignment(vertical='top', wrap_text=True)

wb.save(OUT)

counts = {}
for tc, _ in rows:
    s = lookup(str(tc).strip())[0]
    counts[s] = counts.get(s, 0) + 1
print('Saved', OUT)
print('Test cases:', len(rows))
for k, v in sorted(counts.items()):
    print(f'  {k}: {v}')
