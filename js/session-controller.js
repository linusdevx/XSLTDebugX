// Coordinates Quick Playground drafts with the IndexedDB workspace store.

(function () {
  'use strict';

  class SessionController {
    constructor(store) {
      this.store = store;
      this.saveChain = Promise.resolve();
      this.saveGeneration = 0;
      this.restoring = false;
      this.activeSessions = { xslt: null, xpath: null };
      this.temporaryModes = new Set();
      this.temporaryTitles = { xslt: null, xpath: null };
      this.pendingConflicts = { xslt: null, xpath: null };
      this.sourceMetadata = {
        xslt: { runOptions: {} },
        xpath: { namespaces: {}, evaluatorOptions: {} },
      };
    }

    _cloneMetadata(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      try { return structuredClone(value); }
      catch (_) { return {}; }
    }

    setSourceMetadata(type, source = {}) {
      if (type === 'xslt') {
        this.sourceMetadata.xslt = { runOptions: this._cloneMetadata(source.runOptions) };
      } else if (type === 'xpath') {
        this.sourceMetadata.xpath = {
          namespaces: this._cloneMetadata(source.namespaces),
          evaluatorOptions: this._cloneMetadata(source.evaluatorOptions),
        };
      }
    }

    resetSourceMetadata(type) {
      this.setSourceMetadata(type, {});
    }

    _applySource(type, source) {
      if (!source) return;
      this.setSourceMetadata(type, source);
      if (type === 'xslt') {
        setRuntimeProfile(source.runtimeProfile, { save: false, log: false });
        _withSuppress(['save', 'validation'], () => xmlModelXslt?.setValue(source.xml ?? ''));
        _withSuppress(['save', 'validation'], () => eds.xslt?.setValue(source.xslt ?? ''));
        kvData = { headers: [], properties: [] };
        kvIdSeq = 0;
        for (const row of source.headers || []) {
          kvData.headers.push({ id: ++kvIdSeq, name: row.name, value: row.value });
        }
        for (const row of source.properties || []) {
          kvData.properties.push({ id: ++kvIdSeq, name: row.name, value: row.value });
        }
        renderKV('headers');
        renderKV('properties');
        return;
      }
      _withSuppress(['save', 'validation'], () => xmlModelXpath?.setValue(source.xml ?? ''));
      if (typeof _syncXPathInput === 'function') _syncXPathInput(source.expression ?? '');
      else {
        const input = document.getElementById('xpathInput');
        if (input) input.value = source.expression ?? '';
      }
    }

    _defaultSource(type) {
      if (type === 'xpath') {
        return {
          xml: EXAMPLES.xpathNavigation.xml,
          expression: EXAMPLES.xpathNavigation.xpathExpr ?? '',
          namespaces: {}, evaluatorOptions: {},
        };
      }
      return {
        xml: EXAMPLES.identityTransform.xml,
        xslt: EXAMPLES.identityTransform.xslt,
        headers: [], properties: [], runtimeProfile, runOptions: {},
      };
    }

    _clearDerivedState(type) {
      if (type === 'xpath') {
        if (typeof clearXPathResults === 'function') clearXPathResults();
        if (typeof clearXPathHighlights === 'function') clearXPathHighlights();
        return;
      }
      _resetOutputPane('xml', 'output.xml');
      renderOutputKV({}, {});
      if (typeof clearAllMarkers === 'function') clearAllMarkers();
    }

    serializeDrafts() {
      return {
        xslt: {
          id: 'draft-xslt', type: 'xslt', origin: 'quick-playground',
          source: {
            xml: xmlModelXslt?.getValue() ?? '',
            xslt: eds.xslt?.getValue() ?? '',
            headers: kvData.headers.map(row => ({ name: row.name, value: row.value })),
            properties: kvData.properties.map(row => ({ name: row.name, value: row.value })),
            runtimeProfile,
            runOptions: this._cloneMetadata(this.sourceMetadata.xslt.runOptions),
          },
        },
        xpath: {
          id: 'draft-xpath', type: 'xpath', origin: 'quick-playground',
          source: {
            xml: xmlModelXpath?.getValue() ?? '',
            expression: document.getElementById('xpathInput')?.value ?? '',
            namespaces: this._cloneMetadata(this.sourceMetadata.xpath.namespaces),
            evaluatorOptions: this._cloneMetadata(this.sourceMetadata.xpath.evaluatorOptions),
          },
        },
        activeMode: modeManager.isXpath ? 'XPATH' : 'XSLT',
      };
    }

    saveQuickDrafts(options = {}) {
      if (this.restoring) return Promise.resolve();
      const snapshot = this.serializeDrafts();
      const requestedTypes = Array.isArray(options.types) && options.types.length
        ? options.types.filter(type => type === 'xslt' || type === 'xpath')
        : [snapshot.activeMode === 'XPATH' ? 'xpath' : 'xslt'];
      const generation = ++this.saveGeneration;
      setSaveIndicator('saving');
      const operation = async () => {
        await this.store.init();
        const saves = [this.store.setSetting('activeMode', snapshot.activeMode)];
        for (const type of requestedTypes) {
          if (this.temporaryModes.has(type)) continue;
          const active = this.activeSessions[type];
          if (active) {
            saves.push(
              this.store.updateSession(active.id, active.revision, { source: snapshot[type].source })
                .then(updated => {
                  this.activeSessions[type] = updated;
                  this.pendingConflicts[type] = null;
                })
                .catch(error => {
                  if (error?.code === 'CONFLICT') {
                    this.pendingConflicts[type] = { record: active, source: snapshot[type].source };
                  }
                  throw error;
                }),
            );
          } else {
            saves.push(this.store.putDraft(snapshot[type]));
          }
        }
        await Promise.all(saves);
        if (generation === this.saveGeneration) {
          setSaveIndicator(this.temporaryModes.has(modeManager.isXpath ? 'xpath' : 'xslt') ? 'temporary' : 'saved');
        }
      };
      this.saveChain = this.saveChain.catch(() => {}).then(operation);
      return this.saveChain.catch(error => {
        if (generation === this.saveGeneration) {
          if (error?.code === 'CONFLICT') {
            setSaveIndicator('conflict', error);
            if (typeof openSessionConflictDialog === 'function') openSessionConflictDialog();
          } else {
            setSaveIndicator('failed', error);
          }
        }
        throw error;
      });
    }

    persistModeSelection(mode) {
      const normalized = mode === 'XPATH' ? 'XPATH' : 'XSLT';
      this.saveChain = this.saveChain.catch(() => {}).then(async () => {
        await this.store.init();
        await this.store.setSetting('activeMode', normalized);
      });
      return this.saveChain;
    }

    async restoreQuickDrafts(options = {}) {
      const clearSelection = options.clearSelection !== false;
      this.restoring = true;
      this.activeSessions = { xslt: null, xpath: null };
      this.temporaryModes.clear();
      this.temporaryTitles = { xslt: null, xpath: null };
      this.pendingConflicts = { xslt: null, xpath: null };
      try {
        await this.store.init();
        const [xsltDraft, xpathDraft, activeMode] = await Promise.all([
          this.store.getDraft('draft-xslt'),
          this.store.getDraft('draft-xpath'),
          this.store.getSetting('activeMode', 'XSLT'),
        ]);
        if (clearSelection) {
          await Promise.all([
            this.store.setSetting('activeSession:xslt', null),
            this.store.setSetting('activeSession:xpath', null),
          ]);
        }
        if (xsltDraft) this._applySource('xslt', xsltDraft.source);
        if (xpathDraft) this._applySource('xpath', xpathDraft.source);
        if (activeMode === 'XPATH' && !modeManager.isXpath) {
          modeManager.setMode('XPATH');
        } else if (activeMode === 'XSLT' && !modeManager.isXslt) {
          modeManager.setMode('XSLT');
        }
        renderOutputKV({}, {});
        if (typeof updateXMLValidationBadge === 'function') updateXMLValidationBadge();
        setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
        if (xsltDraft || xpathDraft) {
          this._updateCurrentItemLabel();
          setSaveIndicator('saved');
          clog(`Quick Playground restored · ${activeMode === 'XPATH' ? 'XPath' : 'XSLT'} mode ✓`, 'success');
          return true;
        }
        setSaveIndicator('idle');
        this._updateCurrentItemLabel();
        return false;
      } catch (error) {
        setSaveIndicator('failed', error);
        clog(`Workspace storage unavailable — edits remain temporary: ${error.message}`, 'error');
        return false;
      } finally {
        this.restoring = false;
      }
    }

    async clearCurrentDraft() {
      await this.saveChain.catch(() => {});
      await this.store.init();
      const type = modeManager.isXpath ? 'xpath' : 'xslt';
      if (this.temporaryModes.has(type)) {
        setSaveIndicator('temporary');
        return;
      }
      const active = this.activeSessions[type];
      if (active) {
        const source = this.serializeDrafts()[type].source;
        const updated = await this.store.updateSession(active.id, active.revision, { source });
        this.activeSessions[type] = updated;
        setSaveIndicator('saved');
        if (typeof refreshExplorer === 'function') void refreshExplorer();
        return;
      }
      await this.store.deleteDraft(`draft-${type}`);
      setSaveIndicator('idle');
    }

    beginTemporary(type, title = 'Temporary session') {
      this.activeSessions[type] = null;
      this.pendingConflicts[type] = null;
      this.temporaryModes.add(type);
      this.temporaryTitles[type] = title;
      this._clearDerivedState(type);
      setSaveIndicator('temporary');
      this._updateCurrentItemLabel();
      void this.store.setSetting(`activeSession:${type}`, null).catch(() => {});
    }

    activateNamedSession(record) {
      if (!record || (record.type !== 'xslt' && record.type !== 'xpath')) {
        throw new Error('A valid saved session is required.');
      }
      this.activeSessions[record.type] = record;
      this.pendingConflicts[record.type] = null;
      this.temporaryModes.delete(record.type);
      this.temporaryTitles[record.type] = null;
      this.setSourceMetadata(record.type, record.source);
      setSaveIndicator('saved');
      this._updateCurrentItemLabel();
      void this.store.setSetting(`activeSession:${record.type}`, record.id).catch(() => {});
      if (typeof refreshExplorer === 'function') void refreshExplorer();
    }

    async restoreSession(record) {
      if (!record) throw new Error('Session was not found.');
      await flushPendingSave();
      record = await this.store.markSessionOpened(record.id);
      if (!record) throw new Error('Session was not found.');
      this.restoring = true;
      try {
        const mode = record.type === 'xpath' ? 'XPATH' : 'XSLT';
        if (modeManager.mode !== mode) modeManager.setMode(mode);
        this._clearDerivedState(record.type);
        this._applySource(record.type, record.source);
        this.activeSessions[record.type] = record;
        this.pendingConflicts[record.type] = null;
        this.temporaryModes.delete(record.type);
        this.temporaryTitles[record.type] = null;
        await this.store.setSetting('activeMode', mode);
        await this.store.setSetting(`activeSession:${record.type}`, record.id);
        setSaveIndicator('saved');
        this._updateCurrentItemLabel();
        setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
        clog(`Opened ${record.type === 'xpath' ? 'XPath query' : 'XSLT mapping'} “${record.title}” ✓`, 'success');
      } finally {
        this.restoring = false;
      }
    }

    getCurrentSession() {
      return this.activeSessions[modeManager.isXpath ? 'xpath' : 'xslt'];
    }

    getTemporaryTitle(type = modeManager.isXpath ? 'xpath' : 'xslt') {
      return this.temporaryTitles[type];
    }

    async syncCurrentPersistenceIndicator() {
      const type = modeManager.isXpath ? 'xpath' : 'xslt';
      const applyKnownState = () => {
        if (this.temporaryModes.has(type)) { setSaveIndicator('temporary'); return true; }
        if (this.pendingConflicts[type]) { setSaveIndicator('conflict'); return true; }
        if (this.activeSessions[type]) { setSaveIndicator('saved'); return true; }
        return false;
      };
      if (applyKnownState()) return;
      try {
        const draft = await this.store.getDraft(`draft-${type}`);
        if ((modeManager.isXpath ? 'xpath' : 'xslt') !== type || applyKnownState()) return;
        setSaveIndicator(draft ? 'saved' : 'idle');
      } catch (error) {
        if ((modeManager.isXpath ? 'xpath' : 'xslt') !== type || applyKnownState()) return;
        setSaveIndicator('failed', error);
      }
    }

    async restoreModeDraft(type) {
      if (type !== 'xslt' && type !== 'xpath') throw new Error('A valid session type is required.');
      await this.saveChain.catch(() => {});
      this.restoring = true;
      try {
        const draft = await this.store.getDraft(`draft-${type}`);
        this.activeSessions[type] = null;
        this.pendingConflicts[type] = null;
        this.temporaryModes.delete(type);
        this.temporaryTitles[type] = null;
        await this.store.setSetting(`activeSession:${type}`, null);
        this._applySource(type, draft?.source || this._defaultSource(type));
        if ((modeManager.isXpath ? 'xpath' : 'xslt') === type) {
          this._clearDerivedState(type);
          this._updateCurrentItemLabel();
          setSaveIndicator(draft ? 'saved' : 'idle');
        }
        return Boolean(draft);
      } finally {
        this.restoring = false;
      }
    }

    handleRemoteTrash(change) {
      const removedIds = new Set(change?.kind === 'session-trashed' ? [change.id] : change?.sessionIds || []);
      for (const type of ['xslt', 'xpath']) {
        const active = this.activeSessions[type];
        if (!active || !removedIds.has(active.id)) continue;
        this.activeSessions[type] = null;
        this.pendingConflicts[type] = null;
        this.temporaryModes.add(type);
        this.temporaryTitles[type] = `${active.title} (Recovered)`;
        void this.store.setSetting(`activeSession:${type}`, null).catch(() => {});
        if ((modeManager.isXpath ? 'xpath' : 'xslt') === type) {
          setSaveIndicator('temporary');
          this._updateCurrentItemLabel();
          showCopyToast('Saved item was removed in another tab. Your editor content is preserved.', 4000, 'error');
        }
      }
    }

    async restoreInitialSession() {
      try {
        await this.store.init();
        const mode = await this.store.getSetting('activeMode', 'XSLT');
        const ids = {
          xslt: await this.store.getSetting('activeSession:xslt', null),
          xpath: await this.store.getSetting('activeSession:xpath', null),
        };
        const [xsltRecord, xpathRecord, xsltDraft, xpathDraft] = await Promise.all([
          ids.xslt ? this.store.getSession(ids.xslt) : null,
          ids.xpath ? this.store.getSession(ids.xpath) : null,
          this.store.getDraft('draft-xslt'),
          this.store.getDraft('draft-xpath'),
        ]);
        const records = { xslt: xsltRecord, xpath: xpathRecord };
        const drafts = { xslt: xsltDraft, xpath: xpathDraft };
        this.restoring = true;
        this.activeSessions = { xslt: null, xpath: null };
        this.temporaryModes.clear();
        this.temporaryTitles = { xslt: null, xpath: null };
        this.pendingConflicts = { xslt: null, xpath: null };
        for (const type of ['xslt', 'xpath']) {
          const record = records[type];
          if (record) {
            this._applySource(type, record.source);
            this.activeSessions[type] = record;
          } else if (drafts[type]) {
            this._applySource(type, drafts[type].source);
          }
          if (ids[type] && !record) await this.store.setSetting(`activeSession:${type}`, null);
        }
        const desiredMode = mode === 'XPATH' ? 'XPATH' : 'XSLT';
        if (modeManager.mode !== desiredMode) {
          modeManager.setMode(desiredMode);
        }
        renderOutputKV({}, {});
        if (typeof updateXMLValidationBadge === 'function') updateXMLValidationBadge();
        this._updateCurrentItemLabel();
        const currentType = desiredMode === 'XPATH' ? 'xpath' : 'xslt';
        this._clearDerivedState(currentType);
        const restored = Boolean(records[currentType] || drafts[currentType]);
        setSaveIndicator(restored ? 'saved' : 'idle');
        setTimeout(() => { eds.xml?.layout(); eds.xslt?.layout(); eds.out?.layout(); }, 50);
        if (restored) clog(`${records[currentType] ? 'Saved item' : 'Quick Playground'} restored · ${desiredMode === 'XPATH' ? 'XPath' : 'XSLT'} mode ✓`, 'success');
        return restored;
      } catch (error) {
        clog(`Could not restore the last saved item: ${error.message}`, 'warn');
        return this.restoreQuickDrafts();
      } finally {
        this.restoring = false;
      }
    }

    async resolveConflictReload() {
      const type = modeManager.isXpath ? 'xpath' : 'xslt';
      const conflict = this.pendingConflicts[type];
      if (!conflict) return;
      const latest = await this.store.getSession(conflict.record.id);
      if (!latest) throw new Error('The saved item no longer exists.');
      this.pendingConflicts[type] = null;
      // The rejected compare-and-set remains at the tail of saveChain. The
      // user's explicit conflict choice resolves that failure and starts a
      // fresh persistence chain before restoreSession flushes it.
      if (typeof cancelPendingSave === 'function') cancelPendingSave();
      this.saveChain = Promise.resolve();
      await this.restoreSession(latest);
    }

    async resolveConflictCopy(title) {
      const type = modeManager.isXpath ? 'xpath' : 'xslt';
      const conflict = this.pendingConflicts[type];
      if (!conflict) return null;
      const copy = await this.store.createSession({
        type,
        workspaceId: conflict.record.workspaceId,
        folderId: conflict.record.folderId,
        title,
        source: conflict.source,
      });
      this.pendingConflicts[type] = null;
      if (typeof cancelPendingSave === 'function') cancelPendingSave();
      this.saveChain = Promise.resolve();
      this.activateNamedSession(copy);
      await this.store.setSetting(`activeSession:${type}`, copy.id);
      return copy;
    }

    _updateCurrentItemLabel() {
      const current = this.getCurrentSession();
      const label = document.getElementById('currentItemTitle');
      const type = modeManager.isXpath ? 'xpath' : 'xslt';
      if (label) label.textContent = current?.title || (this.temporaryModes.has(type) ? this.temporaryTitles[type] || 'Temporary session' : 'Quick Playground');
      if (typeof syncSessionMenuState === 'function') syncSessionMenuState();
    }
  }

  window.SessionController = SessionController;
  window.sessionController = new SessionController(window.workspaceStore);
}());
