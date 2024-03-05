import pino from 'pino';
import dotenv from 'dotenv';
dotenv.config();

export const retrieveEnvVariable = (variableName, logger) => {
  const variable = process.env[variableName] || '';
  if (!variable) {
    logger.error(`${variableName} is not set`);
    process.exit(1);
  }
  return variable;
}
