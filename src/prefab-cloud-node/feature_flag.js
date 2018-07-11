var mmh3 = require('murmurhash3');

function getUserPct(apiKey, lookupKey, featureName) {
	var key = `${apiKey.accountId}${featureName}${lookupKey}`;
	return (mmh3.murmur32Sync(key) / 4294967294);
}

module.exports = class FeatureFlag {
	constructor(prefabCloudClient, name) {
		this.prefabCloudClient = prefabCloudClient;
		this.name = name;
	}

	isOn(lookupKey, attributes) {
		var cfgValue = this.prefabCloudClient.config.getValue(this.name);

		if (cfgValue == null) {
			return false;
		}

		var flag = cfgValue.getFeatureFlag();

		if (flag == null) {
			return false;
		}

		if (attributes == null) {
			attributes = [];
		}

		if (lookupKey != null) {
			attributes.push(lookupKey);
		}

		var whitelisted = flag.getWhitelistedList();

		if (attributes.filter(item => whitelisted.includes(item)).length > 0) {
			return true;
		}

		if (lookupKey != null) {
			return (getUserPct(this.prefabCloudClient.apiKey, lookupKey, this.name) < flag.getPct());
		}

		return (flag.getPct() > Math.random());
	}

	save() {

	}
}
