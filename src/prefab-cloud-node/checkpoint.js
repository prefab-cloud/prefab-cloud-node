var AWS = require('aws-sdk');

var prefabGrpc = require('./gRPC/prefab_grpc_pb');


module.exports = class Checkpoint {
    constructor(prefabCloudClient) {
        this.prefabCloudClient = prefabCloudClient;

        this.storage = new AWS.S3({region: "us-east-1"});
        this.objectKey = prefabCloudClient.apiKey.value.replace("|", "/");
    }

    load(handler) {
        try {
            this.storage.getObject(
                {Bucket: "prefab-cloud-checkpoints-prod", Key: this.objectKey}
                , (error, response) => {
                    var deltas = [];

                    if (!error) {
                        deltas = proto.prefab.ConfigDeltas.deserializeBinary(response.Body).getDeltasList();
                    }

                    handler(deltas);
                }
            );
        }
        catch (e) {
            handler(null);
        }
    }
}
