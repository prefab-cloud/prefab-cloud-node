const PrefabCloudClient = require('../PrefabCloudClient.js');

/* eslint-disable class-methods-use-this */

let configCallback;
let limitCallback;

class mockConfigService {
  constructor() {
    this.$channel = {
      getTarget() {
      },
    };
  }

  GetAllConfig(_params, cb) {
    cb(undefined, {
      deltas: [
        {
          key: 'testKey',
          value: {
            string: 'apiValue',
            type: 'string',
          },
        },
        {
          key: 'value.to.override',
          value: {
            type: 'string',
            string: 'old',
          },
        },
        {
          key: 'intkey',
          value: {
            type: 'int',
            int: "40", //grpc returns strings for ints
          },
        },
        {
          namespace: 'testNamspace',
          key: 'value.to.override.with.namespace',
          value: {
            type: 'string',
            string: 'old',
          },
        },
      ],
    });
  }

  GetConfig() {
    return {
      on: (evt, cb) => {
        if (evt === 'data') {
          configCallback = cb;
        }
      },
    };
  }
}

mockConfigService.service = {

  GetConfig: {
    responseDeserialize: () => ({
      deltas: [
        {
          key: 'testKey',
          value: {
            string: 's3Value',
            type: 'string',
          },
        },
        {
          key: 'value.to.override',
          value: {
            type: 'string',
            string: 'old',
          },
        },
        {
          namespace: 'testNamspace',
          key: 'value.to.override.with.namespace',
          value: {
            type: 'string',
            string: 'old',
          },
        },
      ],
    }),
  },
};

class mockRateLimitService {
  constructor() {
    this.$channel = {
      getTarget() {
      },
    };
  }

  LimitCheck() {
    return {
      on: (evt, cb) => {
        if (evt === 'data') {
          limitCallback = cb;
        }
      },
    };
  }
}


mockRateLimitService.service = {
  LimitCheck: {
    responseDeserialize: () => ({
      passed: true,
      amount: 1,
    })
  }
}

jest.mock('grpc', () => ({
  credentials: {
    createFromMetadataGenerator: () => {
    },
    createSsl: () => {
    },
    combineChannelCredentials: () => {
    },
  },
  loadPackageDefinition: () => ({
    prefab: {
      ConfigService: mockConfigService,
      RateLimitService: mockRateLimitService,
    },
  }),
}));

jest.mock(
    'aws-sdk/clients/s3',
    () =>
        class S3 {
          getObject(_, cb) {
            cb(null, {Body: 'test'});
          }
        }
);

describe('Prefab', () => {
  let config;
  let client;

  beforeEach(done => {
    process.env.CONFIG_CLASSPATH_DIR = 'src/__tests__/';
    process.env.CONFIG_OVERRIDE_DIR = 'src/__tests__/';
    config = new PrefabCloudClient({namespace: 'testNamespace', apiKey: "1|test"});
    config.start((_, _client) => {
      client = _client;
      done();
    });
  });

  describe('start', () => {
    test('returns a promise', done => {
      config
          .start()
          .then(promisedClient => {
            expect(promisedClient.get('testKey')).toEqual('apiValue');
          })
          .then(done);
    });

    test('does not return the promise if you give a callback', () => {
      expect(config.start(() => {
      })).toBeNull();
    });
  });

  test('loads from API', () => {
    expect(client.get('testKey')).toEqual('apiValue');
  });

  test('loads int from API', () => {
    expect(client.get('intkey')).toEqual(40);
  });

  test('updates from GRPC', () => {
    configCallback({
      deltas: [
        {
          key: 'testKey',
          value: {
            type: 'string',
            string: 'updatedValue',
          },
        },
      ],
    });

    expect(client.get('testKey')).toEqual('updatedValue');
  });

  test('loads defaults from yaml file', () => {
    expect(client.get('sample')).toEqual('OneTwoThree');
    expect(client.get('sample_int')).toEqual(123);
    expect(client.get('sample_double')).toEqual(12.12);
    expect(client.get('sample_bool')).toEqual(true);
  });

  test('load overrides from yaml file', () => {
    expect(client.get('value.to.override')).toEqual('new');
    expect(client.get('value.to.override.with.namespace')).toEqual('even newer');
  });

  test('API changes do not overwrite overrides', () => {
    configCallback({
      deltas: [
        {
          key: 'value.to.override',
          value: {
            type: 'string',
            string: 'updatedValue',
          },
        },
      ],
    });

    expect(client.get('value.to.override')).toEqual('new');
  });

  test('checkpoints do not overwrite overrides', done => {
    config.bootstrap().then(() => {
      expect(client.get('value.to.override')).toEqual('new');
      done();
    });
  });
});
