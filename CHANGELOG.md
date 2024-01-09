# Changelog

## 0.1.16 - 2024-01-09

- Support timed loggers (#62)

## 0.1.15 - 2024-01-08

- `updateIfStalerThan(someNumberofMs)` updates if no update has happened in someNumberofMs ms (#60)
- `logger()` should inherit context (#59)
- Return the result of `inContext()` (#58)
- Add `.logger() (#57)
- Add `.updateNow()` (#56)
- Fix polling bug (#54)
- Allow prefab.set (#53)

## 0.1.14 - 2023-12-14

- Do not report secrets/confidential values in telemetry

## 0.1.13 - 2023-12-14

- Warn when called multiple times

## 0.1.12 - 2023-12-11

- Default context can only return Contexts objects
- Accept objects for context (in addition to Map)

## 0.1.11 - 2023-12-06

- Support loading config from datafiles

## 0.1.10 - 2023-12-04

- Adjust exports
- Support encrypted secrets

## 0.1.9 - 2023-12-01

- Export more things
- Support values provided by ENV vars
- Update proto
- Update integration tests

## 0.1.8 - 2023-10-03

- Expose default context

## 0.1.7 - 2023-10-02

- add onUpdate and default context

## 0.1.5 and 0.1.6 - 2023-09-25

- Add telemetry integration tests
- ESM compatibility
- Expose some internals and update docs

## 0.1.4 - 2023-08-25

- Import package.json (rather than require)

## 0.1.3 - 2023-08-21

- Default SSE to enabled

## 0.1.2 - 2023-08-21

- Initial non-alpha release
