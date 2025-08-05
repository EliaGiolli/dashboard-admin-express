import { envWhitelist } from "../helpers/envWhiteList.js";
import { parseEnvVariable } from "../helpers/parseEnvVariable.js";

export function getSafeEnv() {
  const result: Record<string, string | number | boolean | undefined> = {};

  //It exposes a new "clean" object for safe env variables
  for(const key in envWhitelist) {
    const type = envWhitelist[key];
    if (type !== undefined) {
      result[key] = parseEnvVariable(process.env[key], type);
    } else {
      result[key] = undefined;
    }
  }

  return result;
}