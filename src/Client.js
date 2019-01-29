const _ = require('lodash');
const murmurhash3 = require('murmurhash3');

module.exports = class Client {
  constructor(namespace, logger, prefab) {
    this.config = {};
    this.namespace = namespace;
    this.logger = logger;
    this.prefab = prefab;
  }

  get(key) {
    return (
        _.get(this.config, [`${this.namespace}:${key}`, 'value']) ||
        _.get(this.config, [key, 'value'])
    );
  }

  featureFlagIsOn(key, userKey = null, attributes = []) {
    const val = this.get(key);
    if (val === undefined) {
      return false;
    }
    let pct = Math.random();

    if (val && userKey) {
      const MAX_32_FLOAT = 4294967294.0;
      pct = murmurhash3.murmur32Sync(`${key}${userKey}`) / MAX_32_FLOAT;
    }

    return (
        val &&
        (_.includes(val.whitelisted, userKey) ||
            _.intersection(val.whitelisted, attributes).length > 0 ||
            val.pct > pct)
    );
  }

  limitcheck({
               group = nil,
               allow_partial_response = false,
               acquire_amount = 1,
               safety_level = 'L4_BEST_EFFORT'
             }) {
    this.prefab.grpcLimitCheck.LimitCheck({
          account_id: this.prefab.apiKey.accountId,
          acquire_amount: acquire_amount,
          groups: [group],
          allow_partial_response: allow_partial_response,
          safety_level: safety_level
        },
        function (err, response) {
          if (err) {
            console.log("ERR");
          } else {
            console.log(response);
          }
        });
  }

  set(key, val) {
    if (_.get(this.config, [key, 'override']) && !val.override) {
      this.logger.debug(`Prefab - skipping config update for overridden key: ${key}`);
      return false;
    } else if (_.get(this.config, [key, 'id']) >= val.id) {
      this.logger.debug(
          `Prefab - skipping config update for outdated key: ${key} id: ${val.id} (id: ${
              this.config[key].id
              } previously applied)`
      );
      return false;
    }

    this.config[key] = val;
    return true;
  }

  delete(key, id) {
    if (_.get(this.config, [key, 'override'])) {
      this.logger.debug(`Prefab - skipping config delete for overridden key: ${key}`);
      return false;
    } else if (_.get(this.config, [key, 'id']) >= id) {
      this.logger.debug(
          `Prefab - skipping config delete for outdated key: ${key} id: ${id} (id: ${
              this.config[key].id
              } previously applied)`
      );
      return false;
    } else if (this.config[key]) {
      delete this.config[key];
      return true;
    }

    return false;
  }

  handleDelta(delta, source) {
    const key = _([delta.namespace, delta.key])
        .compact()
        .join(':');

    if (delta.value) {


      const val = {
        value: delta.value.type === "int" ? parseInt(delta.value[delta.value.type]) : delta.value[delta.value.type],
        id: delta.id,
        source,
      };

      if (this.set(key, val)) {
        this.logUpdate(key, val);
      }
    } else if (this.delete(key, delta.id)) {
      this.logDelete(key, {id: delta.id, source});
    }
  }

  logVal(msg, val, key) {
    let logVal = val;

    if (process.env.NODE_ENV === 'production') {
      logVal = _.merge(val, {value: '<value logging suppressed in production>'});
    }

    this.logger.info(`Prefab - ${msg} - Key: ${key} = `, logVal);
  }

  dumpToLog() {
    if (this.get('log_level.prefab') === "debug") {
      _(this.config)
          .keys()
          .sort()
          .each(key => this.logVal('Starting Value', this.config[key], key));
    }
  }

  logUpdate(key, val) {
    if (this.get('log_level.prefab') === "debug") {
      this.logVal('Updated Value', val, key);
    }
  }

  logDelete(key, val) {
    if (this.get('log_level.prefab') === "debug") {
      this.logVal('Deleted Value', val, key);
    }
  }
};
