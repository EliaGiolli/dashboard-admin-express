//Defines which environment variables are "safe" to expose and their expected types
import { type EnvSchema } from "./config.types.js";

export const envWhitelist: EnvSchema = {
  NODE_ENV: 'string',
  PORT: 'number',
  API_VERSION: 'number',
};