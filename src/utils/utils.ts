import pino from 'pino';
import dotenv from 'dotenv';
dotenv.config();

export const retrieveEnvVariable = (variableName: string, logger: pino.Logger): string => {
  const variable: string = process.env[variableName] || '';
  if (!variable) {
    logger.error(`${variableName} is not set`);
    process.exit(1);
  }
  return variable;
}
