export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  bootstrapSecret: string;
  corsOrigins: string[];
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? process.env.COMPOSE_API_PORT ?? '8003', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'm3-dev-jwt-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  bootstrapSecret: process.env.BOOTSTRAP_SECRET ?? 'm3-dev-bootstrap-secret',
  corsOrigins: (process.env.API_CORS_ORIGINS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
