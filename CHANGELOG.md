# Changelog

## 0.4.7 - 2025-04-08

- fix: Telemetry hanging after prefab.close() (#100)

## 0.4.6 - 2025-04-08

- Add withContext to get a context-bound resolver (#98)

## 0.4.5 - 2025-02-24
- Updated protos with schema types [#95]

## 0.4.4 - 2025-02-20

- More efficient config downloads using conditional fetch [#93]
- Adds a close method for clean shutdowns [#92]
- Adds semantic version comparison operator support [#91]
- Adds regex matching operator support [#90]
- Adds numeric comparison operator support [#88]
- Adds date comparison operator support [#84] [#86]


## 0.4.3 - 2025-01-28

- Fixes telemetry handling for json value type (#82)
- Implement startsWith/contains operators [#80]

## 0.4.2 - 2024-10-03

- Allow telemetry when using api source directly [#78]

## 0.4.1 - 2024-09-19

- Use stream subdomain for SSE [#76]

## 0.4.0 - 2024-08-22

- Use belt and suspenders for reliability [#75]

## 0.3.0 - 2024-06-24

- Support JSON configs [#74]

## 0.2.2 - 2024-06-17

- Update deps for security [#73]

## 0.2.1 - 2024-04-16

- Config deletion fix [#70]

## 0.2.0 - 2024-04-10

- Add Duration support [#69]

## 0.1.20 - 2024-02-22

- Fix: send context shapes by default [#68]

## 0.1.19 - 2024-02-07

- Fix issue with default context introduced in 0.1.18

## 0.1.18 - 2024-02-07

- Don't include deleted config in `keys()` etc. [#66]

## 0.1.17 - 2024-01-18

- Don't report empty contexts with empty keys. Throw if required environment variable is absent. Throw if we can't parse an environment variable correctly. [#63]

## 0.1.16 - 2024-01-09

- Support timed loggers [#62]

## 0.1.15 - 2024-01-08

- `updateIfStalerThan(someNumberofMs)` updates if no update has happened in someNumberofMs ms [#60]
- `logger()` should inherit context [#59]
- Return the result of `inContext()` [#58]
- Add `.logger() [#57]
- Add `.updateNow()` [#56]
- Fix polling bug [#54]
- Allow prefab.set [#53]

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
