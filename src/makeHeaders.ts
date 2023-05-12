import { makeToken } from "./makeToken";

export const makeHeaders = (apiKey: string): Record<string, string> => {
  const token = makeToken(apiKey);

  return {
    Authorization: `Basic ${token}`,
  };
};
