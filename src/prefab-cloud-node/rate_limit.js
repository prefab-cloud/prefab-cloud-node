var prefabGrpc = require('./gRPC/prefab_grpc_pb');


function LReq(accountId, amount, groups, allowPartialResponse) {
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

function LResp(passed, amount) {
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

    pass(group) {
        return this.acquire([group], 1, false).then(function (response) {
            return response.getPassed()
        });
    }

    async acquire(groups, amount, allowPartialResponse, onErrorMode) {
        try {
            var cacheKeyExpiry = `prefab.ratelimit.expiry:${groups.join(".")}`
            var cacheItemExpiry = this.prefabCloudClient.cache.read(cacheKeyExpiry);

            if (cacheItemExpiry != null && cacheItemExpiry.value > Date.now()) {
                this.prefabCloudClient.stats.increment("prefab.ratelimit.limitcheck.expirycache.hit", {tags: []});
                return LResp(false, 0);
            }

            var req = LReq(this.prefabCloudClient.apiKey.accountId, amount, groups, allowPartialResponse);

            let result = await this.makeReq(req);

            if (result.getLimitResetAt() >= 1) {
                this.prefabCloudClient.cache.write(cacheKeyExpiry, result.getLimitResetAt());
            }

            this.prefabCloudClient.stats.increment(
                "prefab.ratelimit.limitcheck"
                , {tags: [`policy_group:${result.getPolicyGroup()}`, `pass:${result.getPassed()}`]}
            );

            return result;
        }
        catch (e) {
            this.prefabCloudClient.stats.increment("prefab.ratelimit.error", {tags: ["type:limit"]});
            var passed = false;

            switch ((onErrorMode || PrefabCloudClient.onErrorMode.LogAndPass)) {
                case PrefabCloudClient.onErrorMode.LogAndPass:
                    passed = true;

                case PrefabCloudClient.onErrorMode.LogAndHit:
                    this.prefabCloudClient.logger.warn(`ratelimit for ${groups} error: ${e.message}`);
                    return LResp(passed, 0);

                case PrefabCloudClient.onErrorMode.Throw:
                    throw e;
            }
        }
    }

    makeReq(request) {
        return new Promise((resolve, reject) => {
            this.prefabCloudClient.rateLimitServiceClient.limitCheck(request, (error, response) => {
                if (error) {
                    reject(error);
                }
                resolve(response);
            });
        });
    }
}
