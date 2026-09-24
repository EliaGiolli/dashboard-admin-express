import { envWhitelist } from "../helpers/envWhiteList.js";
import { parseEnvVariable } from "../helpers/parseEnvVariable.js";

// This function returns only the environment variables that are considered "safe" (whitelisted)
export function getSafeEnv() {
  
  const result: Record<string, string | number | boolean | undefined> = {};

  for(const key in envWhitelist) {
    // Get the expected type for this variable (string, number, or boolean)
    const type = envWhitelist[key];
    if (type !== undefined) {
      // Parse and assign the environment variable to the result object, 
      // converting it to the correct type
      result[key] = parseEnvVariable(process.env[key], type);
    } else {
      // If the type is not defined in the whitelist, set the value as undefined
      result[key] = undefined;
    }
  }

  // Return the object containing only the safe, parsed environment variables
  return result;
}