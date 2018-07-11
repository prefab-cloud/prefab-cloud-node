var glob = require('glob');
var yaml = require('js-yaml');
var fs = require('fs');
var path = require('path');

var prefabGrpc = require('./gRPC/prefab_grpc_pb');

var Checkpoint = require('./checkpoint');


function ConfigValue(value) {
	var result = new proto.prefab.ConfigValue();

	var type = typeof value;

	if (type == 'number') {
		if (Number.isInteger(value)) {
			result.setInt(value);
		}
		else {
			result.setDouble(value);
		}
	}
	else if (type == 'string') {
		result.setString(value);
	}
	else if (type == 'boolean') {
		result.setBool(value);
	}

	return result;
}

function ConfigDelta(id, key, value, namespace) {
	var result = new proto.prefab.ConfigDelta();

	if (id != null) {
		result.setId(id);
	}

	if (key != null) {
		if ((namespace || "").length > 0) {
			key = namespace + ":" + key;
		}

		result.setKey(key);
	}

	if (value != null) {
		result.setValue(value);
	}

	return result;
}

function UpsertRequest(accountId, configDelta, previousKey) {
	var result = new proto.prefab.UpsertRequest();

	if (accountId != null) {
		result.setAccountId(accountId);
	}

	if (configDelta != null) {
		result.setConfigDelta(configDelta);
	}

	if (previousKey != null) {
		result.setPreviousKey(previousKey);
	}

	return result;
}


module.exports = class Config {
	constructor(prefabCloudClient) {
		this.prefabCloudClient = prefabCloudClient;
		this.values = {};
		this.highwaterMarkDeltaId = 0;

		if (prefabCloudClient != null && prefabCloudClient.configServiceClient != null) {
			this.checkpoint = new Checkpoint(prefabCloudClient);
			this.checkpoint.load(deltas => {
			});

			var req = new proto.prefab.ConfigServicePointer();
			req.setAccountId(prefabCloudClient.apiKey.accountId);

			var res = prefabCloudClient.configServiceClient.getConfig(req);
			res.on('data', (delta) => {
				fromDeltas(delta.getDeltasList());
			});
		}

		this.fromPath();
	}

	fromDeltas(deltas) {
		for (var i = 0; i < deltas.length; i++) {
			this.setValue(deltas[i].getKey(), deltas[i].getValue(), deltas[i].getId());
		}
	}

	getValue(key) {
		var result = this.values[key];

		return (result != null ? result.value : null);
	}

	setValue(key, value, deltaId) {
		var splitIndex = key.indexOf(":");
		var namespace = "";

		if (splitIndex > -1) {
			namespace = key.substring(0, splitIndex);
			key = key.substring(splitIndex + 1);
		}

		deltaId = deltaId || 0;
		this.highwaterMarkDeltaId = Math.max(this.highwaterMarkDeltaId, deltaId);

		if (namespace.length == 0 || this.prefabCloudClient.namespace.startsWith(namespace)) {
			var existingValue = this.values[key];

			if (!existingValue
					|| (existingValue.namespace.split(".").length < namespace.split(".").length)
					|| ((existingValue.namespace.length == 0 && namespace.length > 0))
					|| (existingValue.namespace == namespace && existingValue.deltaId <= deltaId)) {
				this.values[key] = {namespace : namespace, value : value, deltaId : deltaId};
			}
		}
	}

	upsert(key, value, namespace, previousKey) {
		if (key.includes(":")) {
			throw new Error("Key must not contain ':' set namespaces separately");
		}

		if ((namespace || "").includes(":")) {
			throw new Error("Namespace must not contain ':'");
		}

		this.prefabCloudClient.configServiceClient.upsert(
			UpsertRequest(null, ConfigDelta(null, key, value, namespace), previousKey));

		this.prefabCloudClient.stats.increment("prefab.config.upsert");
	}

	fromPath(filePath, done) {
		filePath = path.join(filePath || "", ".prefab*config.yaml");

		glob(filePath, (error, files) => {
			if (!error) {
				files.forEach(item => this.fromFile(item));
			}

			if (done) {
				done();
			}
		});
	}

	fromFile(filename) {
		var doc = yaml.safeLoad(fs.readFileSync(filename));

		for (var property in doc) {
			this.setValue(property, ConfigValue(doc[property]));
		}
	}

	clear() {
		this.values = {};
	}

	toDeltas() {
		var result = new proto.prefab.ConfigValue();

		for (var key in this.values) {
			var v = this.values[key];
			result.addDeltas(ConfigDelta(v.deltaId, key, v.value, v.namespace));
		}

		return result;
	}

	static ConfigValue(value) {
		var result = new proto.prefab.ConfigValue();

		var type = typeof value;

		if (type == 'number') {
			if (Number.isInteger(value)) {
				result.setInt(value);
			}
			else {
				result.setDouble(value);
			}
		}
		else if (type == 'string') {
			result.setString(value);
		}
		else if (type == 'boolean') {
			result.setBool(value);
		}

		return result;
	}
}
