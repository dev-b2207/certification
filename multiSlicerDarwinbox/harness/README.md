# Test harness

Runs the packaged `.pbiviz` in headless Chromium against a Power BI host simulator, so the
Microsoft submission test cases can be executed without Power BI Desktop.

    npm install playwright
    node run-tests.js            # the 32 submission test cases
    node debug-untouched.js      # each slicer type abstains when untouched
    node debug-touched.js        # ...and still filters once used
    node debug-multi-and-perf.js # iframe isolation + render cost by row count
    node shoot.js                # regenerate the AppSource screenshots
    node make-icons.js           # regenerate the icon and store logo

`visual.js` and `visual.css` are extracted from `dist/*.pbiviz`; re-extract them after a
rebuild so the harness tests the package you are actually shipping.
