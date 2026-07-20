/**
 * ================================================================
 * RepositoryReadyCoordinator.js — Repository Ready Coordination Layer
 * نظام الحسام للمحاماة
 * ================================================================
 * V10 — Offline First Architecture
 * PHASE 13.3D — PART 2A — Repository Ready Coordination Layer
 * (extended, additive-only, by PART 2C — Entity Runtime Refresh — see
 * §8 near the bottom of this file. Sections 1-7 below are byte-for-byte
 * unchanged from PART 2A.)
 *
 * WHAT THIS FILE IS
 *   A thin, additive, event-driven layer that lets the UI (or any other
 *   consumer) discover *when* an entity's Repository has finished its
 *   open() lifecycle (Repository Contract §11: Create -> Open -> Ready),
 *   without needing to know each entity module's own private global
 *   variable name, and without polling.
 *
 *   It does this by observing the readiness Promises every entity module
 *   already creates and exposes today, by an existing, consistent naming
 *   convention — `<entityKey>RepositoryReadyPromise` — the exact same
 *   convention settings.js's `_persistEntityViaRepository()` already
 *   relies on (see js/modules/settings.js, "PHASE 13.2 — LEGACY STORAGE
 *   CLEANUP" section). This file introduces no new readiness mechanism
 *   inside Repository.js or any entity module; it only listens to what
 *   already exists and re-broadcasts it in a uniform, discoverable way.
 *
 * WHAT THIS FILE IS NOT
 *   - It is NOT a replacement for `ensure<Entity>RepositoryReady()`.
 *     Every module's own write paths keep awaiting their own function
 *     exactly as before — untouched, unwrapped, unaffected.
 *   - It does NOT call Repository.prototype.open() itself, and does NOT
 *     construct, wrap, or monkey-patch any Repository instance or
 *     prototype method. It only attaches `.then()` observers to Promises
 *     that already exist by the time this file runs.
 *   - It does NOT poll. There is no `setInterval`, no `setTimeout` retry
 *     loop, and no busy-wait anywhere in this file. Readiness is only
 *     ever observed through Promise resolution (a native JS microtask —
 *     the browser/Node engine notifies this code; this code never asks).
 *   - It does NOT reload the page, and does NOT touch the DOM directly
 *     (no `document.getElementById`, no innerHTML, no style mutation).
 *     The only DOM interaction is dispatching plain, informational
 *     `CustomEvent`s on `document` — an emission, not a mutation.
 *   - It does NOT modify Repository.js. Zero lines of Repository.js were
 *     changed for this phase; the "one small additive change inside
 *     Repository.js if absolutely required" option in this phase's brief
 *     was evaluated and found unnecessary, because every entity module
 *     already exposes a ready Promise by convention (see
 *     RepositoryReadyCoordinator_Report.md §2 "Design Decision").
 *
 * PUBLIC API
 *   getRepositoryReadyCoordinator()      -> the shared singleton instance
 *   coordinator.isReady(entityKey)       -> boolean, synchronous, no I/O
 *   coordinator.isAllReady()             -> boolean, synchronous, no I/O
 *   coordinator.getReadyEntities()       -> string[], synchronous snapshot
 *   coordinator.onReady(entityKey, fn)   -> fn(entityKey) once that entity
 *                                            becomes ready (or on next
 *                                            microtask if already ready)
 *   coordinator.onAllReady(fn)           -> fn() once every known entity
 *                                            is ready (or on next
 *                                            microtask if already all-ready)
 *   coordinator.whenReady(entityKey)     -> Promise<void>
 *   coordinator.whenAllReady()           -> Promise<void>
 *
 *   DOM events (dispatched on `document`, when a DOM is present):
 *     'repository:ready'    detail: { entityKey }
 *     'repository:allReady' detail: { entityKeys: string[] }
 *
 * Load order: additive file. Must load AFTER every entity module that
 * creates a `<entityKey>RepositoryReadyPromise` global (cases.js,
 * clients.js, sessions.js, tasks.js, documents.js, fees.js, library.js,
 * templates.js, children.js) — see index.html wiring note at this file's
 * <script> tag. Safe to omit from any page/harness that doesn't load
 * those modules: entities whose ready Promise never appears simply never
 * fire ready (no crash, no fallback timer — see "It does NOT poll" above).
 * ================================================================
 */

(function (root) {
  'use strict';

  // ================================================================
  // 1. Known entity keys — Data_Schema_Specification_Report_PHASE4_V10.md
  //    / IndexedDBSchema.js's entity list, minus "settings" (no
  //    Repository exists for settings — see NEXT_PHASE.md / PROJECT_STATE.md
  //    Module Status table, "dashboard/calendar/settings: No (by design)").
  // ================================================================
  var DEFAULT_ENTITY_KEYS = Object.freeze([
    'cases', 'clients', 'sessions', 'tasks', 'documents',
    'fees', 'library', 'templates', 'children'
  ]);

  var EVENT_ENTITY_READY = 'repository:ready';
  var EVENT_ALL_READY = 'repository:allReady';

  // ----------------------------------------------------------------
  // 2. DOM event helpers — best-effort only. In any environment with no
  //    `document` (Node harnesses, non-browser embedding) these simply
  //    no-op; the callback/Promise API above remains fully functional
  //    either way, so no consumer is required to use DOM events.
  // ----------------------------------------------------------------

  function getEventTarget() {
    return (typeof document !== 'undefined' && document && typeof document.dispatchEvent === 'function')
      ? document
      : null;
  }

  function makeEvent(name, detail) {
    if (typeof CustomEvent === 'function') {
      try { return new CustomEvent(name, { detail: detail }); } catch (e) { /* fall through */ }
    }
    if (typeof document !== 'undefined' && document && typeof document.createEvent === 'function') {
      try {
        var ev = document.createEvent('CustomEvent');
        ev.initCustomEvent(name, false, false, detail);
        return ev;
      } catch (e) { /* fall through */ }
    }
    return null;
  }

  function dispatch(name, detail) {
    var target = getEventTarget();
    if (!target) return;
    var evt = makeEvent(name, detail);
    if (evt) target.dispatchEvent(evt);
  }

  function safeInvoke(fn, arg) {
    try { fn(arg); } catch (e) {
      // A misbehaving subscriber must never break readiness notification
      // for any other subscriber, or for the all-ready aggregation below.
      if (typeof console !== 'undefined' && console.error) {
        console.error('RepositoryReadyCoordinator: subscriber callback threw:', e);
      }
    }
  }

  // ================================================================
  // 3. Coordinator
  // ================================================================

  /**
   * @param {string[]} [entityKeys] - defaults to DEFAULT_ENTITY_KEYS.
   *   Exposed as a constructor (not just the singleton) so a test
   *   harness can build an isolated instance against a fake global
   *   object instead of sharing process-wide state.
   * @param {Object} [globalObj] - the object on which
   *   `<entityKey>RepositoryReadyPromise` globals are looked up.
   *   Defaults to the detected root (window/globalThis). Overridable
   *   purely for test isolation.
   */
  function RepositoryReadyCoordinator(entityKeys, globalObj) {
    this._entityKeys = Array.isArray(entityKeys) && entityKeys.length
      ? entityKeys.slice()
      : DEFAULT_ENTITY_KEYS.slice();
    this._global = globalObj || root;

    /** @private entityKey -> boolean */
    this._readyState = {};
    /** @private entityKey -> Array<function> */
    this._readyCallbacks = {};
    /** @private Array<function> */
    this._allReadyCallbacks = [];
    this._allReadyFired = false;

    this._entityKeys.forEach(function (k) {
      this._readyState[k] = false;
      this._readyCallbacks[k] = [];
    }, this);

    this._watch();
  }

  /**
   * Attaches a `.then()` observer to each entity's existing ready
   * Promise, exactly once, at construction time. This is the ONLY place
   * this file reads from the outside world, and it reads via Promise
   * subscription (push, event-driven), never via re-checking on a timer.
   * @private
   */
  RepositoryReadyCoordinator.prototype._watch = function () {
    var self = this;
    this._entityKeys.forEach(function (entityKey) {
      var readyPromise = self._global ? self._global[entityKey + 'RepositoryReadyPromise'] : undefined;
      if (readyPromise && typeof readyPromise.then === 'function') {
        readyPromise.then(function () {
          self._markReady(entityKey);
        }).catch(function () {
          // The owning module's own ready Promise (cases.js, clients.js,
          // etc.) already logs and swallows open() failures internally
          // (see each module's "Surface the failure without throwing"
          // comment) — its Promise therefore resolves even on failure.
          // This .catch is defensive only, for a future module that
          // might propagate a rejection instead; it deliberately does
          // NOT mark the entity ready, and does NOT retry.
        });
      }
      // If the Promise global doesn't exist at construction time (e.g.
      // this module wasn't loaded on this page, or the coordinator was
      // constructed before that module ran), this entity simply never
      // becomes ready through this coordinator. No fallback poll/timer
      // is installed — this is intentional (event-driven only, per this
      // phase's requirements), and matches how `ensure<Entity>
      // RepositoryReady()` already behaves when its own module isn't
      // loaded (a ReferenceError at the call site, not a silent retry).
    });
  };

  /** @private */
  RepositoryReadyCoordinator.prototype._markReady = function (entityKey) {
    if (!Object.prototype.hasOwnProperty.call(this._readyState, entityKey)) return;
    if (this._readyState[entityKey]) return; // idempotent — open() can only settle once anyway
    this._readyState[entityKey] = true;

    dispatch(EVENT_ENTITY_READY, { entityKey: entityKey });

    var callbacks = this._readyCallbacks[entityKey] || [];
    this._readyCallbacks[entityKey] = [];
    callbacks.forEach(function (fn) { safeInvoke(fn, entityKey); });

    this._checkAllReady();
  };

  /** @private */
  RepositoryReadyCoordinator.prototype._checkAllReady = function () {
    if (this._allReadyFired) return;
    var self = this;
    var allReady = this._entityKeys.every(function (k) { return self._readyState[k]; });
    if (!allReady) return;
    this._allReadyFired = true;

    dispatch(EVENT_ALL_READY, { entityKeys: this._entityKeys.slice() });

    var callbacks = this._allReadyCallbacks;
    this._allReadyCallbacks = [];
    callbacks.forEach(function (fn) { safeInvoke(fn); });
  };

  // ----------------------------------------------------------------
  // 4. Public query API — all synchronous, no I/O, safe to call anytime.
  // ----------------------------------------------------------------

  RepositoryReadyCoordinator.prototype.isReady = function (entityKey) {
    return !!this._readyState[entityKey];
  };

  RepositoryReadyCoordinator.prototype.isAllReady = function () {
    return this._allReadyFired;
  };

  RepositoryReadyCoordinator.prototype.getEntityKeys = function () {
    return this._entityKeys.slice();
  };

  RepositoryReadyCoordinator.prototype.getReadyEntities = function () {
    var self = this;
    return this._entityKeys.filter(function (k) { return self._readyState[k]; });
  };

  // ----------------------------------------------------------------
  // 5. Public subscription API — event-driven, no polling.
  // ----------------------------------------------------------------

  /**
   * @param {string} entityKey
   * @param {function(string)} callback - invoked with entityKey once ready.
   *   If already ready, invoked on the next microtask (never
   *   synchronously) so callers get one consistent async contract
   *   regardless of ordering.
   */
  RepositoryReadyCoordinator.prototype.onReady = function (entityKey, callback) {
    if (typeof callback !== 'function') return;
    if (this._readyState[entityKey]) {
      Promise.resolve().then(function () { safeInvoke(callback, entityKey); });
      return;
    }
    if (!this._readyCallbacks[entityKey]) this._readyCallbacks[entityKey] = [];
    this._readyCallbacks[entityKey].push(callback);
  };

  /**
   * @param {function()} callback - invoked once every known entity is ready.
   */
  RepositoryReadyCoordinator.prototype.onAllReady = function (callback) {
    if (typeof callback !== 'function') return;
    if (this._allReadyFired) {
      Promise.resolve().then(function () { safeInvoke(callback); });
      return;
    }
    this._allReadyCallbacks.push(callback);
  };

  /** @returns {Promise<void>} resolves once entityKey is ready. */
  RepositoryReadyCoordinator.prototype.whenReady = function (entityKey) {
    var self = this;
    if (this._readyState[entityKey]) return Promise.resolve();
    return new Promise(function (resolve) {
      self.onReady(entityKey, function () { resolve(); });
    });
  };

  /** @returns {Promise<void>} resolves once every known entity is ready. */
  RepositoryReadyCoordinator.prototype.whenAllReady = function () {
    var self = this;
    if (this._allReadyFired) return Promise.resolve();
    return new Promise(function (resolve) {
      self.onAllReady(resolve);
    });
  };

  // ================================================================
  // 6. Singleton — mirrors the shared-instance pattern already used by
  //    this project's other core/*.js services (one DatabaseService,
  //    one MigrationBootstrap); the UI never needs to construct its own.
  //    The constructor stays exported too, for tests that need isolation.
  // ================================================================

  var singleton = null;
  function getRepositoryReadyCoordinator() {
    if (!singleton) singleton = new RepositoryReadyCoordinator();
    return singleton;
  }

  // ================================================================
  // 7. Exports — same dual CommonJS/browser-global pattern as every
  //    other file under js/core/.
  // ================================================================

  var api = {
    RepositoryReadyCoordinator: RepositoryReadyCoordinator,
    getRepositoryReadyCoordinator: getRepositoryReadyCoordinator,
    REPOSITORY_READY_EVENT: EVENT_ENTITY_READY,
    REPOSITORY_ALL_READY_EVENT: EVENT_ALL_READY,
    DEFAULT_ENTITY_KEYS: DEFAULT_ENTITY_KEYS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.RepositoryReadyCoordinator = RepositoryReadyCoordinator;
    root.getRepositoryReadyCoordinator = getRepositoryReadyCoordinator;
    root.REPOSITORY_READY_EVENT = EVENT_ENTITY_READY;
    root.REPOSITORY_ALL_READY_EVENT = EVENT_ALL_READY;
    // Auto-instantiate the shared instance, exactly like the other
    // core/*.js singletons this project already wires this way. Safe
    // only because index.html loads this file LAST (see wiring note in
    // this file's header) — every `<entityKey>RepositoryReadyPromise`
    // global this constructor reads already exists by then.
    root.repositoryReadyCoordinator = getRepositoryReadyCoordinator();
  }

  // ================================================================
  // 8. PHASE 13.3D — PART 2C — Entity Runtime Refresh (additive)
  // ----------------------------------------------------------------
  // THE RACE THIS CLOSES
  //   Every render<Entity>() function (renderCases(), renderClients(),
  //   ... renderChildren(), one per entity in DEFAULT_ENTITY_KEYS)
  //   already guards itself on `<entity>Repository.isReady()` and
  //   returns immediately — doing no painting — when it isn't ready yet
  //   (see each module's own "Defensive only" comment above that
  //   guard). That guard is correct and is left untouched.
  //
  //   The gap: index.html's navigate(page) calls render<Entity>() ONCE,
  //   at the moment of the page switch. If the user switches to an
  //   entity's page before that entity's Repository.open() has resolved
  //   (a real possibility on a slow first IndexedDB open, a large
  //   migration, or slow disk), that one call no-ops and nothing was
  //   ever wired to try again — the page stays blank until the user
  //   happens to trigger some other render themselves (typing a search
  //   term, changing a filter). That silent blank page is the
  //   "remaining runtime race" PART 2C closes.
  //
  // THE FIX
  //   Purely additive, and purely a consumer of this file's own public
  //   onReady() API from §5 above — no new mechanism is introduced. For
  //   each known entity, subscribe once. If the user is on that
  //   entity's page at the moment readiness fires
  //   (`root.currentPage === entityKey` — the same global index.html's
  //   own navigate() already reads/writes), call that entity's
  //   already-existing, already-exported render<Entity>() global
  //   function — now succeeding, since isReady() is true by
  //   construction of onReady() (§5). If the user is elsewhere, do
  //   nothing: navigate()'s own existing render<Entity>() call already
  //   renders correctly the moment they do visit, because isReady() is
  //   true by then. Still event-driven only: onReady()'s callback is
  //   invoked exactly once per entity by _markReady() (§3), which is
  //   itself idempotent — so this section's auto-render can fire at
  //   most once per entity from that guarantee alone. The
  //   `_alreadyAutoRendered` flag below is a second, defensive layer
  //   directly inside this section, so it can never call a page's
  //   render function twice even if that upstream guarantee were ever
  //   weakened.
  //
  // WHY THIS LIVES HERE, NOT IN A NEW FILE / NEW <script> TAG
  //   This wiring must run strictly after every entity module (it needs
  //   each render<Entity>() global to already exist) — which is exactly
  //   why this file is already loaded dead last on the page (see the
  //   "Load order" note at the top of this file). A new, separate
  //   `<script>` tag placed after this one would satisfy that same
  //   ordering, but would also break this project's existing PART 2A
  //   regression check that RepositoryReadyCoordinator.js is the LAST
  //   script tag on the page (js/tests/verify_repository_ready_
  //   coordinator.js, check "[Wiring] ... is the LAST <script> tag on
  //   the page") — a check PART 2C's brief requires stay green ("Keep
  //   backward compatibility", full regression suite must still pass).
  //   Appending here, inside the one file already guaranteed to run
  //   last, needs no new <script> tag and leaves index.html's <script>
  //   list — and every other line of index.html — byte-for-byte
  //   untouched.
  //
  // WHAT THIS SECTION DELIBERATELY DOES NOT DO
  //   - Does not render entities the user isn't currently viewing.
  //     Rendering hidden pages here too would be wasted work, not
  //     race-closing — navigate()'s pre-existing call already handles
  //     them correctly the moment the user actually visits.
  //   - Does not poll, does not set a timer, does not reload the page,
  //     does not touch the DOM directly (it only *calls* each module's
  //     own global render<Entity>() function, exactly as navigate()
  //     itself already does).
  //   - Does not modify Repository.js, DatabaseService.js, any Adapter,
  //     MigrationService/MigrationBootstrap, any Repository factory, or
  //     any entity module.
  //   - Never throws out of this section in a way that could block
  //     other entities' subscriptions: any render<Entity>() failure is
  //     already caught by this file's own safeInvoke() (§2), exactly
  //     like every other onReady() subscriber.
  // ================================================================
  var ENTITY_RENDER_FN = Object.freeze({
    cases: 'renderCases',
    clients: 'renderClients',
    sessions: 'renderSessions',
    tasks: 'renderTasks',
    documents: 'renderDocuments',
    fees: 'renderFees',
    library: 'renderLibrary',
    templates: 'renderTemplates',
    children: 'renderChildren'
  });

  if (root && root.repositoryReadyCoordinator) {
    var _alreadyAutoRendered = {};
    DEFAULT_ENTITY_KEYS.forEach(function (entityKey) {
      _alreadyAutoRendered[entityKey] = false;
      root.repositoryReadyCoordinator.onReady(entityKey, function () {
        if (_alreadyAutoRendered[entityKey]) return; // exactly once, ever
        _alreadyAutoRendered[entityKey] = true;

        // Elsewhere on the app right now? navigate()'s own existing
        // render<Entity>() call already renders correctly once the user
        // arrives (isReady() is true by then) — nothing to do here.
        var onThisPageNow = (typeof root.currentPage !== 'undefined') && root.currentPage === entityKey;
        if (!onThisPageNow) return;

        var fnName = ENTITY_RENDER_FN[entityKey];
        var renderFn = fnName ? root[fnName] : undefined;
        if (typeof renderFn === 'function') {
          renderFn();
        }
        // A missing/renamed render<Entity>() global is intentionally
        // silent here (e.g. a Node harness or a stripped-down page with
        // only some modules loaded) — this section must never throw
        // just because one page's render function isn't present.
      });
    });
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
