/* eslint-disable */
/**
 * A minimal Power BI host simulator, enough to drive the packaged visual in a browser.
 *
 * It models the four things the Multislicer actually touches:
 *   - a row-oriented table turned into a categorical DataView
 *   - persistProperties() writing back into metadata.objects (settings persistence)
 *   - applyJsonFilter() recorded and replayed as options.jsonFilters (selection restore)
 *   - a "downstream visual" row count so cross-visual filtering can be asserted
 */
(function () {
  window.powerbi = window.powerbi || {};

  const VisualUpdateType = { Data: 2, Resize: 4, ViewMode: 8, Style: 16, ResizeEnd: 32, All: 62 };
  window.VisualUpdateType = VisualUpdateType;

  function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value, dateReplacer), dateReviver);
  }
  function dateReplacer(key, value) {
    return this[key] instanceof Date ? { __date: this[key].toISOString() } : value;
  }
  function dateReviver(key, value) {
    return value && typeof value === 'object' && value.__date ? new Date(value.__date) : value;
  }

  class PbiHostSimulator {
    /**
     * @param {object} spec
     *   columns: [{ name, queryName, section, type: 'text'|'date'|'number'|'time', format?, hierarchyGroup? }]
     *   rows:    [ [v0, v1, ...] ]
     */
    constructor(spec) {
      this.spec = spec;
      this.table = spec.table || 'Employee';
      this.objects = spec.objects ? deepClone(spec.objects) : {};
      this.jsonFilter = undefined;
      this.consoleErrors = [];
      this.renderEvents = [];
      this.persistCount = 0;
      this.contextMenuCount = 0;
      this.filterHistory = [];
    }

    /** Columns grouped into hierarchies get expr.kind 7 and shared identityFields. */
    buildMetadataColumns() {
      const groups = {};
      this.spec.columns.forEach((c) => {
        if (c.hierarchyGroup) {
          groups[c.hierarchyGroup] = groups[c.hierarchyGroup] || [];
          groups[c.hierarchyGroup].push(c);
        }
      });

      return this.spec.columns.map((c, index) => {
        const isHierarchy = !!c.hierarchyGroup;
        const siblings = isHierarchy ? groups[c.hierarchyGroup] : [c];
        const queryName = isHierarchy ? `${this.table}.${c.hierarchyGroup}.${c.name}` : `${this.table}.${c.name}`;
        return {
          displayName: c.name,
          queryName,
          index: siblings.indexOf(c),
          roles: { [`section${c.section}`]: true },
          type: {
            text: c.type === 'text',
            dateTime: c.type === 'date' || c.type === 'time',
            numeric: c.type === 'number',
          },
          format: c.format,
          expr: isHierarchy ? { kind: 7, arg: { hierarchy: c.hierarchyGroup } } : { kind: 2 },
          identityExprs: [{ ref: c.name }],
          objects: this.objects[`__column__${queryName}`],
        };
      });
    }

    buildDataView() {
      const columns = this.buildMetadataColumns();
      const groups = {};
      this.spec.columns.forEach((c, i) => {
        if (c.hierarchyGroup) {
          groups[c.hierarchyGroup] = groups[c.hierarchyGroup] || [];
          groups[c.hierarchyGroup].push({ ref: c.name });
        }
      });

      const categories = columns.map((source, colIndex) => {
        const spec = this.spec.columns[colIndex];
        return {
          source,
          values: this.spec.rows.map((r) => r[colIndex]),
          identityFields: spec.hierarchyGroup ? groups[spec.hierarchyGroup] : [{ ref: spec.name }],
        };
      });

      // Per-column format-pane settings are stored by pbiviz under objects with a
      // metadata selector; the parser reads them off the column itself.
      columns.forEach((col) => {
        col.objects = this.objects[`__column__${col.queryName}`];
      });

      return {
        metadata: { columns, objects: this.objects },
        categorical: { categories },
      };
    }

    createHost() {
      const self = this;
      return {
        eventService: {
          renderingStarted: (o) => self.renderEvents.push('started'),
          renderingFinished: (o) => self.renderEvents.push('finished'),
          renderingFailed: (o, reason) => {
            self.renderEvents.push('failed');
            self.consoleErrors.push(`renderingFailed: ${reason}`);
          },
        },
        createSelectionManager: () => ({
          showContextMenu: () => {
            self.contextMenuCount++;
            return Promise.resolve();
          },
          select: () => Promise.resolve([]),
          clear: () => Promise.resolve(),
          hasSelection: () => false,
          getSelectionIds: () => [],
          registerOnSelectCallback: () => {},
        }),
        applyJsonFilter: (filter, objectName, propertyName, action) => {
          self.jsonFilter = filter;
          self.filterHistory.push(filter ? deepClone(filter) : null);
          if (typeof self.onFilterApplied === 'function') {
            self.onFilterApplied(filter);
          }
        },
        persistProperties: (changes) => {
          self.persistCount++;
          (changes.merge || []).forEach((instance) => {
            const metadataSelector = instance.selector && instance.selector.metadata;
            if (metadataSelector) {
              // Per-column property (slicerType, relative date state, hierarchy state...)
              const key = `__column__${metadataSelector}`;
              self.objects[key] = self.objects[key] || {};
              self.objects[key][instance.objectName] = Object.assign(
                {},
                self.objects[key][instance.objectName],
                instance.properties
              );
            } else {
              self.objects[instance.objectName] = Object.assign({}, self.objects[instance.objectName], instance.properties);
            }
          });
        },
        colorPalette: { getColor: () => ({ value: '#000000' }), isHighContrast: false },
        locale: 'en-US',
        tooltipService: { enabled: () => false, show: () => {}, hide: () => {}, move: () => {} },
        launchUrl: () => {},
        refreshHostData: () => {},
        displayWarningIcon: () => {},
      };
    }

    /** Rows a downstream visual would still see, given the filter this visual applied. */
    downstreamRowCount() {
      if (!this.jsonFilter || !this.jsonFilter.values || this.jsonFilter.values.length === 0) {
        return this.spec.rows.length;
      }
      const targets = Array.isArray(this.jsonFilter.target) ? this.jsonFilter.target : [this.jsonFilter.target];
      const colIndexes = targets.map((t) =>
        this.spec.columns.findIndex((c) => (c.hierarchyGroup ? c.name : c.name) === t.column)
      );
      const allowed = new Set(
        this.jsonFilter.values.map((tuple) =>
          tuple.map((cell) => (cell.value instanceof Date ? cell.value.toISOString() : `${cell.value}`)).join('|~|')
        )
      );
      return this.spec.rows.filter((row) => {
        const key = colIndexes
          .map((ci) => {
            const v = ci === -1 ? null : row[ci];
            return v instanceof Date ? v.toISOString() : `${v}`;
          })
          .join('|~|');
        return allowed.has(key);
      }).length;
    }
  }

  window.PbiHostSimulator = PbiHostSimulator;
})();
