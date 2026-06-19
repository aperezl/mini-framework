export interface MiddlewareContext {
  toolName: string;
  context?: any;
}

export interface Middleware {
  toolName?: string;
  beforeExecute?(params: any, meta: MiddlewareContext): Promise<any> | any;
  afterExecute?(result: any, params: any, meta: MiddlewareContext): Promise<any> | any;
}
