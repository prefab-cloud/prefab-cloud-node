var grpc = require('grpc');

var prefabGrpc = require('./gRPC/prefab_grpc_pb');

var Cache = require('./cache');
var Stats = require('./stats');
var Logger = require('./logger');
var Config = require('./config');
var FeatureFlag = require('./feature_flag');
var RateLimit = require('./rate_limit');


module.exports = class PrefabCloudClient {
	constructor(apiKey, namespace, cache, stats, logger, host) {
		var apiKeyTokens = apiKey.split('|');
		this.apiKey = {
			accountId : apiKeyTokens[0]
			, value : apiKey
		};

		this.cache = cache || new Cache();
		this.stats = stats || new Stats();
		this.logger = logger || new Logger();
		this.namespace = namespace || "";

		var callCredentials = grpc.credentials.createFromMetadataGenerator((params, callback) => {
			var metadata = new grpc.Metadata();
			metadata.set('auth', this.apiKey["value"]);
			callback(null, metadata);
		});

		var channelCredentials = grpc.credentials.createSsl();
		var combinedCredentials = grpc.credentials.combineChannelCredentials(channelCredentials, callCredentials);

		this.serviceUri = (host == null ? "api.prefab.cloud:8443" : host);

		this.rateLimitServiceClient = new prefabGrpc.RateLimitServiceClient(this.serviceUri, combinedCredentials);
		this.configServiceClient = new prefabGrpc.ConfigServiceClient(this.serviceUri, combinedCredentials);

		this.config = new Config(this);
	}

	getFeatureFlag(name) {
		return new FeatureFlag(this, name);
	}

	get rateLimit() {
		return new RateLimit(this);
	}

	static get onErrorMode() {
		return {
			LogAndPass : 1,
			LogAndHit : 2,
			Throw : 3
		};
	}
}
