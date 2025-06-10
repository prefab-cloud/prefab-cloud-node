try {
  if (process.env['PREFAB_SKIP_PEER_DEPENDENCY_CHECK'] !== 'true') {
    require('long');
  }
} catch {
  throw new Error(
    'Prefab requires the "long" package to be in your project. See https://www.npmjs.com/package/long',
  );
}

export {};
