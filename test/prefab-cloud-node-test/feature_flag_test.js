var assert = require('chai').assert

var prefabGrpc = require('../../src/prefab-cloud-node/gRPC/prefab_grpc_pb');

var Config = require('../../src/prefab-cloud-node/config')
var FeatureFlag = require('../../src/prefab-cloud-node/feature_flag')
var PrefabCloudClient = require('../../src/prefab-cloud-node/prefab_cloud_client')

class ConfigTest extends Config {
    constructor() {
        super(null)
    }
}

class ClientTest extends PrefabCloudClient {
    constructor() {
        super("1|1");

        this.config = new ConfigTest();
    }

    setFeatureFlag(name, pct, whitelisted) {
        var flag = new proto.prefab.FeatureFlag();

        if (pct != null) {
            flag.setPct(pct);
        }

        if (whitelisted != null) {
            flag.setWhitelistedList(whitelisted);
        }

        var cfgValue = new proto.prefab.ConfigValue();
        cfgValue.setFeatureFlag(flag);

        this.config.setValue(name, cfgValue);
    }
}

var featureName = "FlagName";
var lookupKeyHashHi = "hashes high";
var lookupKeyHashLo = "hashes low";
var lookupKeyAny = "anything";


describe('Feature flag test',
    () => {
        it('test_pct',
            () => {
                var client = new ClientTest();
                client.setFeatureFlag(featureName, 0.5);
                var flag = client.getFeatureFlag(featureName);
                assert.equal(false, flag.isOn(lookupKeyHashHi), lookupKeyHashHi);
                assert.equal(true, flag.isOn(lookupKeyHashLo), lookupKeyHashLo);
            });

        it('test_off',
            () => {
                var client = new ClientTest();
                client.setFeatureFlag(featureName, 0);
                var flag = client.getFeatureFlag(featureName);
                assert.equal(false, flag.isOn(lookupKeyHashHi), lookupKeyHashHi);
                assert.equal(false, flag.isOn(lookupKeyHashLo), lookupKeyHashLo);
            });

        it('test_on',
            () => {
                var client = new ClientTest();
                client.setFeatureFlag(featureName, 1);
                var flag = client.getFeatureFlag(featureName);
                assert.equal(true, flag.isOn(lookupKeyHashHi), lookupKeyHashHi);
                assert.equal(true, flag.isOn(lookupKeyHashLo), lookupKeyHashLo);
            });

        it('test_whitelist',
            () => {
                var client = new ClientTest();
                client.setFeatureFlag(featureName, 0, ["beta", "user:1", "user:3"]);
                var flag = client.getFeatureFlag(featureName);
                assert.equal(false, flag.isOn(lookupKeyAny), lookupKeyAny);
                assert.equal(true, flag.isOn(lookupKeyAny, ["beta"]));
                assert.equal(true, flag.isOn(lookupKeyAny, ["alpha", "beta"]));
                assert.equal(true, flag.isOn(lookupKeyAny, ["alpha", "user:1"]));
                assert.equal(false, flag.isOn(lookupKeyAny, ["alpha", "user:2"]));
            });
    });
