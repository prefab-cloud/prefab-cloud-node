export const makeToken = (apiKey: string): string => {
  return Buffer.from(`authuser:${apiKey}`).toString("base64");
};
