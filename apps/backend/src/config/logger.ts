/**
 * BuildFlow - Winston logger
 */
import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]${metaStr} ${message}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
  ],
  exitOnError: false,
});

// Silence logs in test env unless explicitly verbose
if (env.NODE_ENV === 'test') {
  logger.transports.forEach((t) => (t.silent = true));
}