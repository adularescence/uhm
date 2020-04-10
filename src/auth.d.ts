declare module "auth.json" {
    export const pg: {
      database: string,
      host: string,
      password: string,
      port: number,
      user: string
    }
  }