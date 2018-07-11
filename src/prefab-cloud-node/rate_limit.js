var prefabGrpc = require('./gRPC/prefab_grpc_pb');


function LimitRequest(accountId, amount, groups, allowPartialResponse) {
	var result = new proto.prefab.LimitRequest();

	if (accountId != null) {
		result.setAccountId(accountId);
	}

	if (amount != null) {
		result.setAcquireAmount(amount);
	}

	if (groups != null) {
		result.setGroupsList(groups);
	}

	result.setAllowPartialResponse(allowPartialResponse || false);

	return result;
}

function LimitResponse(passed, amount) {
	var result = new proto.prefab.LimitResponse();

	if (passed != null) {
		result.setPassed(passed);
	}

	if (amount != null) {
		result.setAmount(amount);
	}

	return result;
}


module.exports = class RateLimit {
	constructor(prefabCloudClient) {
		this.prefabCloudClient = prefabCloudClient;
	}

	acquire(groups, amount, allowPartialResponse, onErrorMode) {
		try {
			var cacheKeyExpiry = `prefab.ratelimit.expiry:${groups.join(".")}`
			var cacheItemExpiry = this.prefabCloudClient.cache.read(cacheKeyExpiry);

			if (cacheItemExpiry != null && cacheItemExpiry.value > Date.now()) {
				this.prefabCloudClient.stats.increment("prefab.ratelimit.limitcheck.expirycache.hit", {tags : []});
				return LimitResponse(false, 0);
			}

			var req = LimitRequest(this.prefabCloudClient.apiKey.accountId, amount, groups, allowPartialResponse);
			var result = this.prefabCloudClient.rateLimitServiceClient.limitCheck(req);

			if (result.getLimitResetAt() >= 1) {
				this.prefabCloudClient.cache.write(cacheKeyExpiry, result.getLimitResetAt());
			}

			this.prefabCloudClient.stats.increment(
				"prefab.ratelimit.limitcheck"
				, {tags : [`policy_group:${result.getPolicyGroup()}`, `pass:${result.getPassed()}`]}
			);

			return result;
		}
		catch (e) {
			this.prefabCloudClient.stats.increment("prefab.ratelimit.error", {tags : ["type:limit"]});
			var passed = false;

			switch ((onErrorMode || this.prefabCloudClient.onErrorMode.LogAndPass)) {
				case this.prefabCloudClient.onErrorMode.LogAndPass:
					passed = true;

				case this.prefabCloudClient.onErrorMode.LogAndHit:
					this.prefabCloudClient.logger.warn(`ratelimit for ${groups} error: ${e.message}`);
					return LimitResponse(passed, 0);

				case this.prefabCloudClient.onErrorMode.Throw:
					throw e;
			}
		}
	}

	// upsert(group, policyName, limit, burst, safetyLevel) {
	// }
}
