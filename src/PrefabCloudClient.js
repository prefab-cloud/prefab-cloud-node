const _ = require('lodash');
const Client = require('./Client');
const fs = require('fs');
const glob = require('glob');
const grpc = require('grpc');
const os = require('os');
const path = require('path');
const protoLoader = require('@grpc/proto-loader');
const S3 = require('aws-sdk/clients/s3');
const simpleLogger = require('simple-node-logger');
const yaml = require('js-yaml');

const PROTO_FILE = path.join(__dirname, '..', 'proto', 'prefab.proto');
const packageDefinition = protoLoader.loadSync(PROTO_FILE, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const S3_BUCKET = `prefab-cloud-checkpoints-prod`;
const POLLING_INTERVAL = 60 * 1000;

class PrefabCloudClient {
  constructor({
                namespace = null,
                apiKey = process.env.PREFAB_API_KEY,
                logger = simpleLogger.createSimpleLogger({dfltLevel: "all"})
              }) {
    this.logger = logger;
    this.namespace = namespace;
    var apiKeyTokens = apiKey.split('|');
    this.apiKey = {
      accountId: apiKeyTokens[0]
      , apiKeyStr: apiKey
    };

    this.s3Object = this.apiKey.apiKeyStr.replace("|", "/");
    this.protocol = grpc.loadPackageDefinition(packageDefinition).prefab;
    let grpcHost = process.env.PREFAB_API_URL || 'api.prefab.cloud:443';


    var channelCredentials = grpc.credentials.createSsl();
    var callCredentials = grpc.credentials.createFromMetadataGenerator((params, callback) => {
      var metadata = new grpc.Metadata();
      metadata.set('auth', this.apiKey.apiKeyStr);
      callback(null, metadata);
    });

    var combinedCredentials = grpc.credentials.combineChannelCredentials(channelCredentials, callCredentials);


    this.grpcConfig = new this.protocol.ConfigService(grpcHost, combinedCredentials);
    this.grpcLimitCheck = new this.protocol.RateLimitService(grpcHost, combinedCredentials);
    this.s3 = new S3({region: 'us-east-1'});
  }

  start(cb) {
    this.client = new Client(this.namespace, this.logger, this);
    const promise = this.loadDefaults()
        .then(() => this.bootstrap())
        .then(() => this.loadOverrides())
        .then(() => this.client.dumpToLog())
        .then(() => this.startStreaming())
        .then(() => this.startPolling());

    if (!cb) {
      return promise.then(() => this.client);
    }

    promise
        .then(() => {
          cb(null, this.client);
        })
        .catch(err => {
          cb(err);
        });

    return null;
  }

  loadFromYAML(fileGlob, override) {
    return new Promise((resolve, reject) => {
      glob(fileGlob, (err, files) => {
        if (err) {
          reject(err);
        } else {
          Promise.all(
              _.map(
                  files,
                  file =>
                      new Promise((resolveFile, rejectFile) => {
                        this.logger.info(`Prefab - loading values from file: ${file}`);

                        fs.readFile(file, (fileErr, contents) => {
                          if (fileErr) {
                            rejectFile(fileErr);
                          } else {
                            try {
                              _.each(yaml.safeLoad(contents), (value, key) =>
                                  this.client.set(key, {value, override, source: file})
                              );
                              resolveFile();
                            } catch (e) {
                              rejectFile(e);
                            }
                          }
                        });
                      })
              )
          )
              .then(resolve)
              .catch(reject);
        }
      });
    });
  }

  loadDefaults() {
    return this.loadFromYAML(
        path.join(process.env.CONFIG_CLASSPATH_DIR || '.', '.prefab*config.yaml')
    );
  }

  loadOverrides() {
    return this.loadFromYAML(
        path.join(
            process.env.CONFIG_OVERRIDE_DIR || os.userInfo().homedir,
            '.prefab.config.overrides.yaml'
        ),
        true
    );
  }

  bootstrap() {
    this.logger.info('Prefab - Bootstrapping config from API.');
    return this.loadCheckpoint();
  }

  loadCheckpoint() {
    return new Promise((resolve, reject) =>
        this.grpcConfig.GetAllConfig({start_at_id: 0, account_id: this.apiKey.accountId}, (err, configDeltas) => {
          if (err) {
            this.logger.warn("Issue contacting API. Fallback to S3 if available");
            this.loadS3Checkpoint();
          } else {
            _.each(configDeltas.deltas, delta => this.client.handleDelta(delta, 'API'));
            resolve();
          }
        })
    );
  }

  loadS3Checkpoint() {
    this.logger.info('Prefab - load from s3');

    return new Promise((resolve, reject) =>

        this.s3.getObject(
            {
              Bucket: S3_BUCKET,
              Key: this.s3Object,
            },
            (err, resp) => {
              if (err) {
                this.logger.error(
                    'Prefab - Error loading checkpoint from S3: ',
                    err
                );

                if (process.env.NODE_ENV === 'production' && !process.env.CI) {
                  reject(new Error('Prefab - Error loading checkpoint from S3: ', err));
                } else {
                  resolve();
                }
              } else {
                const s3Config = this.protocol.ConfigService.service.GetConfig.responseDeserialize(
                    resp.Body
                ).deltas;
                _.each(s3Config, delta => this.client.handleDelta(delta, 'S3'));
                resolve();
              }
            }
        )
    );
  }

  startStreaming() {
    this.logger.info(
        `Prefab - Beginning streaming from GRPC endpoint: ${this.grpcConfig.$channel.getTarget()}`
    );
    const stream = this.grpcConfig.GetConfig({start_at_id: 0, account_id: this.apiKey.accountId});
    stream.on('data', streamResp => {
      _.each(streamResp.deltas, delta => this.client.handleDelta(delta, 'GRPC'));
    });
    stream.on('error', streamErr => {
      this.logger.warn(
          `Prefab - Error streaming config: "${
              streamErr.details
              }" - Continuing without streaming updates`
      );
    });
  }

  startPolling() {
    setInterval(() => this.loadCheckpoint(), POLLING_INTERVAL);
  }
}

module.exports = PrefabCloudClient;
