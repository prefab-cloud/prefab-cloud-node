const PATTERN =
  /P(?:(?<days>\d+(?:\.\d+)?)D)?(?:T(?:(?<hours>\d+(?:\.\d+)?)H)?(?:(?<minutes>\d+(?:\.\d+)?)M)?(?:(?<seconds>\d+(?:\.\d+)?)S)?)?/;
const MINUTES_IN_SECONDS = 60;
const HOURS_IN_SECONDS = 60 * MINUTES_IN_SECONDS;
const DAYS_IN_SECONDS = 24 * HOURS_IN_SECONDS;

export const durationToMilliseconds = (duration: string): number => {
  const match = PATTERN.exec(duration);
  if (match === null) {
    return 0;
  }

  const days = parseFloat(match.groups?.["days"] ?? "0");
  const hours = parseFloat(match.groups?.["hours"] ?? "0");
  const minutes = parseFloat(match.groups?.["minutes"] ?? "0");
  const seconds = parseFloat(match.groups?.["seconds"] ?? "0");

  return (
    (days * DAYS_IN_SECONDS +
      hours * HOURS_IN_SECONDS +
      minutes * MINUTES_IN_SECONDS +
      seconds) *
    1000
  );
};
