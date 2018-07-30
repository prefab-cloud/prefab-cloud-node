var assert = require('chai').assert

var prefabGrpc = require('../../src/prefab-cloud-node/gRPC/prefab_grpc_pb');

var Config = require('../../src/prefab-cloud-node/config')
var PrefabCloudClient = require('../../src/prefab-cloud-node/prefab_cloud_client')

class ConfigValueTest {
    constructor(value) {
        this.value = value;
    }

    getTypeCase() {
        return proto.prefab.ConfigValue.TypeCase.STRING;
    }

    getString() {
        return this.value;
    }
}

class ConfigDeltaTest {
    constructor(key, value, id) {
        this.key = key;
        this.value = value;
        this.id = id || 0;
    }

    getKey() {
        return this.key;
    }

    getValue() {
        return this.value;
    }

    getId() {
        return this.id;
    }
}

class ClientTest {
    constructor(namespace) {
        this.namespace = namespace || "";
        this.config = new Config(this);
        this.config.fromDeltas(configDeltas());
    }
}

function configDeltas() {
    return [
        new ConfigDeltaTest("projectA:key", new ConfigValueTest("valueA"))
        , new ConfigDeltaTest("key", new ConfigValueTest("value_none"))
        , new ConfigDeltaTest("projectB:key", new ConfigValueTest("valueB"))
        , new ConfigDeltaTest("projectB.subprojectX:key", new ConfigValueTest("projectB.subprojectX"))
        , new ConfigDeltaTest("projectB.subprojectY:key", new ConfigValueTest("projectB.subprojectY"))
        , new ConfigDeltaTest("projectB:key2", new ConfigValueTest("valueB2"))
    ];
}


describe('Config resolve test',
    () => {
        it('empty namespace',
            () => {
                var client = new ClientTest();
                assert.equal("value_none", client.config.getValue("key"));
            });

        it('projectA',
            () => {
                var client = new ClientTest("projectA");
                assert.equal("valueA", client.config.getValue("key"));
            });

        it('projectB',
            () => {
                var client = new ClientTest("projectB");
                assert.equal("valueB", client.config.getValue("key"));
            });

        it('projectB.subprojectX',
            () => {
                var client = new ClientTest("projectB.subprojectX");
                assert.equal("projectB.subprojectX", client.config.getValue("key"));
            });

        it('projectB.subprojectX:subsubQ',
            () => {
                var client = new ClientTest("projectB.subprojectX:subsubQ");
                assert.equal("projectB.subprojectX", client.config.getValue("key"));
            });

        it('projectC',
            () => {
                var client = new ClientTest("projectC");
                assert.equal("value_none", client.config.getValue("key"));
            });
    });

describe('Config load test',
    () => {
        it('test_load',
            (done) => {
                var client = new ClientTest();
                client.config.fromPath("test", () => {
                    assert.equal(123, client.config.getValue("sample_int"));
                    assert.equal("OneTwoThree", client.config.getValue("sample"));
                    assert.equal(true, client.config.getValue("sample_bool"));
                    assert.equal(12.12, client.config.getValue("sample_double"));

                    done();
                });
            });

        it('test_highwater',
            (done) => {
                var client = new ClientTest();
                client.config.fromPath("test", () => {
                    assert.equal(0, client.config.highwaterMarkDeltaId);

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(456), 1)]);
                    assert.equal(1, client.config.highwaterMarkDeltaId);

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(456), 5)]);
                    assert.equal(5, client.config.highwaterMarkDeltaId);

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(456), 2)]);
                    assert.equal(5, client.config.highwaterMarkDeltaId);

                    done();
                });
            });

        it('test_keeps_most_recent',
            (done) => {
                var client = new ClientTest();
                client.config.fromPath("test", () => {
                    assert.equal(0, client.config.highwaterMarkDeltaId);

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(1), 1)]);
                    assert.equal(1, client.config.highwaterMarkDeltaId);
                    assert.equal(1, client.config.getValue("sample_int"));

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(4), 4)]);
                    assert.equal(4, client.config.highwaterMarkDeltaId);
                    assert.equal(4, client.config.getValue("sample_int"));

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(2), 2)]);
                    assert.equal(4, client.config.highwaterMarkDeltaId);
                    assert.equal(4, client.config.getValue("sample_int"));

                    done();
                });
            });

        it('test_api_deltas',
            (done) => {
                var client = new ClientTest();
                client.config.fromPath("test", () => {
                    assert.equal(123, client.config.getValue("sample_int"));

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(456))]);
                    assert.equal(456, client.config.getValue("sample_int"));

                    done();
                });
            });

        it('test_api_precedence',
            (done) => {
                var client = new ClientTest();
                client.config.fromPath("test", () => {
                    assert.equal(123, client.config.getValue("sample_int"));

                    client.config.fromDeltas([new ConfigDeltaTest("sample_int", Config.ConfigValue(456))]);
                    assert.equal(456, client.config.getValue("sample_int"));

                    done();
                });
            });
    });
