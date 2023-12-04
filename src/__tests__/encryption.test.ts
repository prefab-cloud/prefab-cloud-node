import { decrypt, encrypt, generateNewHexKey } from "../../src/encryption";

describe("encryption/decryption", () => {
  it("can generate a new key and encrypt/decrypt strings", () => {
    const key = generateNewHexKey();
    const input = "hello world";
    const encrypted = encrypt(input, key);
    expect(decrypt(encrypted, key)).toEqual(input);
  });

  it("can generate a new key and encrypt/decrypt empty strings", () => {
    const key = generateNewHexKey();
    const input = "";
    const encrypted = encrypt(input, key);
    expect(decrypt(encrypted, key)).toEqual(input);
  });
});
