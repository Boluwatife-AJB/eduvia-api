import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .required(),
  PORT: Joi.number().default(8000).required(),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('48h').required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d').required(),
  S3_BUCKET_NAME: Joi.string().required(),
  S3_REGION: Joi.string().required(),
  S3_ENDPOINT: Joi.string().required(),
  S3_ACCESS_KEY_ID: Joi.string().required(),
  S3_SECRET_ACCESS_KEY: Joi.string().required(),
  S3_PUBLIC_URL: Joi.string().required(),
  CORS_ORIGINS: Joi.string().required(),

  // Email
  RESEND_API_KEY: Joi.string().required(),
  EMAIL_FROM_NAME: Joi.string().default('Eduvia'),
});
