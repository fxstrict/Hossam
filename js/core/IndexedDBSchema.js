/**
 * ================================================================
 * IndexedDBSchema.js — Database Schema Definition | نظام الحسام للمحاماة
 * ================================================================
 * PHASE 13.3A — IndexedDB Foundation — Database Engine Core
 *
 * WHAT THIS FILE IS
 *   A pure, declarative description of the future IndexedDB database:
 *   its name, its version, and the object stores + indexes each version
 *   introduces. No code here ever calls `indexedDB.open()` or touches a
 *   real `IDBDatabase`/`IDBTransaction` — this file only describes the
 *   shape those future calls (IndexedDBEngine.js, IndexedDBVersion.js)
 *   will apply.
 *
 * WHAT THIS FILE IS NOT
 *   - It does not open, upgrade, or migrate anything.
 *   - It does not read or write LocalStorage or IndexedDB.
 *   - It does not modify Repository.js, StorageAdapter.js,
 *     LocalStorageAdapter.js, DatabaseService.js, or any Repository.
 *
 * Primary keys: every store's `keyPath` matches that entity's actual
 * Repository `idField` (e.g. `رقم_القضية` for `cases`, `رقم_الموكل` for
 * `clients`, ... `id` only for `library`/`templates`/`settings`/
 * `metadata`, which really do use `id`) — no new ids are generated
 * here, matching the Phase 13.3A "preserve current Repository IDs"
 * requirement. See `IndexedDB_KeyPath_Audit.md` (PHASE 13.3A-HOTFIX)
 * for the full per-store audit that produced this mapping.
 * ================================================================
 */

(function (root) {
  'use strict';

  var DB_NAME = 'HossamLawOffice';
  var DB_VERSION = 1;

  // ----------------------------------------------------------------
  // Index definitions per store. Only indexes an existing Repository/
  // Module actually filters, sorts, or looks up by are declared — no
  // speculative over-indexing (per Phase 13.3A "DO NOT over-index").
  // `unique: false` everywhere: uniqueness is a Repository-level
  // concern (id already is the keyPath and is implicitly unique),
  // not something this storage layer enforces on secondary fields.
  // ----------------------------------------------------------------

  var COMMON_AUDIT_INDEXES = [
    { name: 'createdAt', keyPath: 'createdAt', unique: false },
    { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
  ];

  /**
   * STORE_DEFINITIONS — one entry per object store.
   * Shape: { name, keyPath, autoIncrement, indexes: [{name, keyPath, unique, multiEntry?}] }
   */
  var STORE_DEFINITIONS = [
    {
      name: 'cases',
      keyPath: 'رقم_القضية',
      autoIncrement: false,
      indexes: [
        { name: 'code', keyPath: 'code', unique: false },
        { name: 'clientId', keyPath: 'clientId', unique: false },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'searchText', keyPath: 'searchText', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'clients',
      keyPath: 'رقم_الموكل',
      autoIncrement: false,
      indexes: [
        { name: 'code', keyPath: 'code', unique: false },
        { name: 'name', keyPath: 'name', unique: false },
        { name: 'searchText', keyPath: 'searchText', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'sessions',
      keyPath: 'رقم_الجلسة',
      autoIncrement: false,
      indexes: [
        { name: 'caseId', keyPath: 'caseId', unique: false },
        { name: 'clientId', keyPath: 'clientId', unique: false },
        { name: 'sessionDate', keyPath: 'sessionDate', unique: false },
        { name: 'status', keyPath: 'status', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'documents',
      keyPath: 'رقم_المستند',
      autoIncrement: false,
      indexes: [
        { name: 'caseId', keyPath: 'caseId', unique: false },
        { name: 'clientId', keyPath: 'clientId', unique: false },
        { name: 'name', keyPath: 'name', unique: false },
        { name: 'searchText', keyPath: 'searchText', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'tasks',
      keyPath: 'رقم_المهمة',
      autoIncrement: false,
      indexes: [
        { name: 'caseId', keyPath: 'caseId', unique: false },
        { name: 'clientId', keyPath: 'clientId', unique: false },
        { name: 'status', keyPath: 'status', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'children',
      keyPath: 'رقم_الطفل',
      autoIncrement: false,
      indexes: [
        { name: 'caseId', keyPath: 'caseId', unique: false },
        { name: 'clientId', keyPath: 'clientId', unique: false },
        { name: 'name', keyPath: 'name', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'fees',
      keyPath: 'رقم_العملية',
      autoIncrement: false,
      indexes: [
        { name: 'caseId', keyPath: 'caseId', unique: false },
        { name: 'clientId', keyPath: 'clientId', unique: false },
        { name: 'status', keyPath: 'status', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'library',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'name', keyPath: 'name', unique: false },
        { name: 'searchText', keyPath: 'searchText', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'templates',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'name', keyPath: 'name', unique: false },
        { name: 'code', keyPath: 'code', unique: false }
      ].concat(COMMON_AUDIT_INDEXES)
    },
    {
      name: 'settings',
      keyPath: 'id',
      autoIncrement: false,
      // Settings is a small, singleton-ish store — audit indexes are
      // sufficient; no secondary lookup fields exist for it today.
      indexes: COMMON_AUDIT_INDEXES.slice()
    },
    {
      name: 'metadata',
      keyPath: 'id',
      autoIncrement: false,
      // Engine bookkeeping store (schema version markers, future
      // migration checkpoints). No secondary indexes needed.
      indexes: []
    }
  ];

  /**
   * SCHEMA_VERSIONS — ordered upgrade steps. Version 1 is the only
   * version this phase defines: create every store above, with its
   * indexes, from nothing. A future migration phase appends further
   * entries here (e.g. version 2 adding a new index) — IndexedDBVersion.js
   * is written to walk this list, never to hardcode version 1 alone.
   */
  var SCHEMA_VERSIONS = [
    {
      version: 1,
      description: 'Initial HossamLawOffice schema — all Phase 13.3A object stores and indexes.',
      stores: STORE_DEFINITIONS
    }
  ];

  /** getStoreNames() -> string[] — every store name the current (latest) schema version defines. */
  function getStoreNames() {
    return STORE_DEFINITIONS.map(function (s) { return s.name; });
  }

  /** getStoreDefinition(name) -> store definition object | null */
  function getStoreDefinition(name) {
    for (var i = 0; i < STORE_DEFINITIONS.length; i++) {
      if (STORE_DEFINITIONS[i].name === name) { return STORE_DEFINITIONS[i]; }
    }
    return null;
  }

  /** getSchemaVersionStep(version) -> the SCHEMA_VERSIONS entry for that version, or null. */
  function getSchemaVersionStep(version) {
    for (var i = 0; i < SCHEMA_VERSIONS.length; i++) {
      if (SCHEMA_VERSIONS[i].version === version) { return SCHEMA_VERSIONS[i]; }
    }
    return null;
  }

  var api = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORE_DEFINITIONS: STORE_DEFINITIONS,
    SCHEMA_VERSIONS: SCHEMA_VERSIONS,
    getStoreNames: getStoreNames,
    getStoreDefinition: getStoreDefinition,
    getSchemaVersionStep: getSchemaVersionStep
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.IndexedDBSchema = api;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
