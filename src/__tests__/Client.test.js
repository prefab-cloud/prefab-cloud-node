const Client = require('../Client.js');
const simpleLogger = require('simple-node-logger');

describe('Client', () => {
  let client;

  beforeEach(() => {
    client = new Client('testNamspace', simpleLogger.createSimpleLogger());
  });

  describe('get', () => {
    beforeEach(() => {
      client.handleDelta({
        key: 'test.config',
        value: {
          type: 'string',
          string: 'will pass',
        },
      });
      client.handleDelta({
        key: 'namespaced.config',
        value: {
          type: 'int',
          int: 100,
        },
      });
      client.handleDelta({
        key: 'namespaced.config',
        namespace: 'testNamspace',
        value: {
          type: 'int',
          int: 1000,
        },
      });
    });

    test('resolves a value from the config', () => {
      expect(client.get('test.config')).toEqual('will pass');
    });

    test('prefers namespaced value', () => {
      expect(client.get('namespaced.config')).toEqual(1000);
    });

    test('returns undefined for an unknown value', () => {
      expect(client.get('never.heard.of.it')).toBeUndefined();
    });
  });

  describe('set', () => {
    test('respects overrides', () => {
      client.set('k1', {value: 'valOne', override: true});

      expect(client.set('k1', {value: 'otherVal'})).toBeFalsy();
      expect(client.get('k1')).toEqual('valOne');
    });

    test('returns true if a value was set', () => {
      expect(client.set('k', {value: 'v'})).toBeTruthy();
    });
  });

  describe('delete', () => {
    test('deletes a key', () => {
      client.set('temp', {value: 'val'});

      expect(client.delete('temp')).toBeTruthy();
      expect(client.get('temp')).toBeUndefined();
    });

    test('does not delete an override', () => {
      client.set('temp', {value: 'val', override: true});

      expect(client.delete('temp')).toBeFalsy();
      expect(client.get('temp')).toEqual('val');
    });

    test('does not delete a greater id', () => {
      client.set('temp', {value: 'val', id: 10});

      expect(client.delete('temp', 9)).toBeFalsy();
      expect(client.get('temp')).toEqual('val');
    });
  });

  describe('feature flags', () => {
    test('returns off for missing flag', () => {
      expect(client.featureFlagIsOn('no.such.flag')).toBeFalsy();
    });

    test('returns on for 100% flag', () => {
      client.handleDelta({
        key: 'EVERYONE!',
        value: {
          type: 'feature_flag',
          feature_flag: {
            pct: 1.0,
          },
        },
      });

      expect(client.featureFlagIsOn('EVERYONE!')).toBeTruthy();
    });

    test('returns off for 0% flag', () => {
      client.handleDelta({
        key: 'nobody',
        value: {
          type: 'feature_flag',
          feature_flag: {
            pct: 0,
          },
        },
      });

      expect(client.featureFlagIsOn('nobody')).toBeFalsy();
    });

    describe('for user', () => {
      beforeEach(() => {
        client.handleDelta({
          key: 'somebody',
          value: {
            type: 'feature_flag',
            feature_flag: {
              pct: 0.5,
            },
          },
        });
      });

      test('is stable for the same userKey', () => {
        expect(client.featureFlagIsOn('somebody', 'user1')).toEqual(
          client.featureFlagIsOn('somebody', 'user1')
        );
      });

      test('is different for different users', () => {
        expect(client.featureFlagIsOn('somebody', 'user1')).not.toBe(
          client.featureFlagIsOn('somebody', 'user101')
        );
      });
    });

    describe('whitelisted', () => {
      beforeEach(() => {
        client.handleDelta({
          key: 'whitelisted',
          value: {
            type: 'feature_flag',
            feature_flag: {
              pct: 0,
              whitelisted: ['pookie'],
            },
          },
        });
      });

      test('returns on for whitelisted userKey', () => {
        expect(client.featureFlagIsOn('whitelisted', 'pookie')).toBeTruthy();
      });

      test('returns on for other attributes in the whitelist', () => {
        expect(client.featureFlagIsOn('whitelisted', 'hghjgg', ['pookie'])).toBeTruthy();
      });
    });

    describe('handleDelta', () => {
      beforeEach(() => {
        client.handleDelta({
          id: 2,
          key: 'test.config',
          value: {
            type: 'string',
            string: 'supreme',
          },
        });
      });

      test('gracefully handles delta with no value', () => {
        client.handleDelta({key: 'wheres.the.value'});
      });

      test('does not overwrite a higher id', () => {
        client.handleDelta({
          id: 1,
          key: 'test.config',
          value: {
            type: 'string',
            string: 'not this one',
          },
        });

        expect(client.get('test.config')).toEqual('supreme');
      });

      test('will apply a higher id', () => {
        client.handleDelta({
          id: 10,
          key: 'test.config',
          value: {
            type: 'string',
            string: 'even better',
          },
        });

        expect(client.get('test.config')).toEqual('even better');
      });
    });
  });
});
