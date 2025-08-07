//Defines which environment variables are "safe" to expose and their expected types
import { type EnvSchema } from "../types/envTypes.js";

export const envWhitelist: EnvSchema = {
  NODE_ENV: 'string',
  PORT: 'number',
  API_VERSION: 'number',
  API_SEGRETO: 'string',
};