//Converts a string environment variable to the specified type (string, number, or boolean)
export function parseEnvVariable(value: string | undefined, type: 'string' | 'number' | 'boolean'): string | number | boolean | undefined {
  
    if(value === undefined) return undefined;

  switch(type) {
    case 'number':
      const n = Number(value);
      return isNaN(n) ? undefined : n;
    case 'boolean':
      return value === 'true';
    default:
      return value;
  }
}