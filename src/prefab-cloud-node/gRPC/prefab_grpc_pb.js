// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var prefab_pb = require('./prefab_pb.js');

function serialize_prefab_ConfigDeltas(arg) {
  if (!(arg instanceof prefab_pb.ConfigDeltas)) {
    throw new Error('Expected argument of type prefab.ConfigDeltas');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_prefab_ConfigDeltas(buffer_arg) {
  return prefab_pb.ConfigDeltas.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_prefab_ConfigServicePointer(arg) {
  if (!(arg instanceof prefab_pb.ConfigServicePointer)) {
    throw new Error('Expected argument of type prefab.ConfigServicePointer');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_prefab_ConfigServicePointer(buffer_arg) {
  return prefab_pb.ConfigServicePointer.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_prefab_LimitRequest(arg) {
  if (!(arg instanceof prefab_pb.LimitRequest)) {
    throw new Error('Expected argument of type prefab.LimitRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_prefab_LimitRequest(buffer_arg) {
  return prefab_pb.LimitRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_prefab_LimitResponse(arg) {
  if (!(arg instanceof prefab_pb.LimitResponse)) {
    throw new Error('Expected argument of type prefab.LimitResponse');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_prefab_LimitResponse(buffer_arg) {
  return prefab_pb.LimitResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_prefab_UpsertRequest(arg) {
  if (!(arg instanceof prefab_pb.UpsertRequest)) {
    throw new Error('Expected argument of type prefab.UpsertRequest');
  }
  return new Buffer(arg.serializeBinary());
}

function deserialize_prefab_UpsertRequest(buffer_arg) {
  return prefab_pb.UpsertRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


var RateLimitServiceService = exports.RateLimitServiceService = {
  limitCheck: {
    path: '/prefab.RateLimitService/LimitCheck',
    requestStream: false,
    responseStream: false,
    requestType: prefab_pb.LimitRequest,
    responseType: prefab_pb.LimitResponse,
    requestSerialize: serialize_prefab_LimitRequest,
    requestDeserialize: deserialize_prefab_LimitRequest,
    responseSerialize: serialize_prefab_LimitResponse,
    responseDeserialize: deserialize_prefab_LimitResponse,
  },
};

exports.RateLimitServiceClient = grpc.makeGenericClientConstructor(RateLimitServiceService);
var ConfigServiceService = exports.ConfigServiceService = {
  getConfig: {
    path: '/prefab.ConfigService/GetConfig',
    requestStream: false,
    responseStream: true,
    requestType: prefab_pb.ConfigServicePointer,
    responseType: prefab_pb.ConfigDeltas,
    requestSerialize: serialize_prefab_ConfigServicePointer,
    requestDeserialize: deserialize_prefab_ConfigServicePointer,
    responseSerialize: serialize_prefab_ConfigDeltas,
    responseDeserialize: deserialize_prefab_ConfigDeltas,
  },
  upsert: {
    path: '/prefab.ConfigService/Upsert',
    requestStream: false,
    responseStream: false,
    requestType: prefab_pb.UpsertRequest,
    responseType: prefab_pb.ConfigServicePointer,
    requestSerialize: serialize_prefab_UpsertRequest,
    requestDeserialize: deserialize_prefab_UpsertRequest,
    responseSerialize: serialize_prefab_ConfigServicePointer,
    responseDeserialize: deserialize_prefab_ConfigServicePointer,
  },
};

exports.ConfigServiceClient = grpc.makeGenericClientConstructor(ConfigServiceService);
