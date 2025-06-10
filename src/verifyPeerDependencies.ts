try {
  await import('long');
} catch {
  throw new Error(
    'Prefab requires the "long" package to be in your project. See https://www.npmjs.com/package/long',
  );
}

export {};
