import {readFileSync, writeFileSync, renameSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createDemoSystem, OperationError} from './operations.js';

// One process, one local demo owner. This file is not a production database.
export function createStoredDemoSystem(path) {
  let initial = {};
  try {
    initial = JSON.parse(readFileSync(path, 'utf8'));
    if (initial.schemaVersion !== 1 || !Array.isArray(initial.workflows) || !Array.isArray(initial.sources) || !Array.isArray(initial.receipts)) throw new Error('Unsupported state schema.');
    if (initial.workflows.some(w => typeof w.id !== 'string' || !Number.isInteger(w.revision) || !Array.isArray(w.results) || !Array.isArray(w.activity))) throw new Error('Invalid workflow records.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Orbit could not read its local history. The existing file has been preserved.', {cause: error});
  }
  const system = createDemoSystem(initial);
  const snapshot = () => ({schemaVersion: 1, workflows: system.repository.list(), sources: system.marketing.snapshot(), receipts: system.orbitExecutor.snapshot()});
  const restore = data => {
    system.repository.restore(data.workflows);
    system.marketing.restore(data.sources);
    system.orbitExecutor.restore(data.receipts);
  };
  const persist = () => {
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(`${path}.tmp`, JSON.stringify(snapshot(), null, 2), {encoding: 'utf8', mode: 0o600, flush: true});
    renameSync(`${path}.tmp`, path);
  };
  // Persist source and receipt creation before workflow completion. A retry after
  // a failed workflow save can reconcile the same persisted simulated receipt.
  for (const [target, method] of [[system.repository, 'save'], [system.marketing, 'prepare'], [system.marketing, 'mutateSource'], [system.orbitExecutor, 'execute']]) {
    const original = target[method].bind(target);
    target[method] = (...args) => {
      const before = snapshot();
      const result = original(...args);
      try {persist();}
      catch {restore(before); throw new OperationError('PERSISTENCE_FAILED', 'Orbit could not save local history. Your last saved version is preserved.', true);}
      return result;
    };
  }
  system.snapshot = snapshot;
  return system;
}
