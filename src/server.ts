const VERSION = '2.0';

export const enum ErrorCodes {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

type Methods = {[key: string]: Function};
type JsonRpcResult = any;

interface ServerConfig {
  methods?: Methods;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id: string;
  method: string;
  params?: any[] | object;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: string;
  result?: JsonRpcResult;
  error?: JsonRpcError;
}

const buildResponse = (id: string) => (result: JsonRpcResult) => ({
  jsonrpc: VERSION,
  id,
  result,
});

const buildErrorResponse = (id: string) => (error: {
  code?: ErrorCodes;
  rpcMessage?: string;
}) => ({
  jsonrpc: VERSION,
  id,
  error: {
    code: error.code || ErrorCodes.InternalError,
    message: error.rpcMessage || null,
  },
});

class Server {
  private methods: Methods;

  constructor({methods}: ServerConfig) {
    this.methods = methods || {};
  }

  dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return Promise.resolve()
      .then(() => {
        const method = this.methods[request.method];
        return method
          ? method.apply(null, request.params)
          : Promise.reject({
              code: ErrorCodes.MethodNotFound,
              rpcMessage: 'Method not found',
            });
      })
      .then(buildResponse(request.id), buildErrorResponse(request.id));
  }
}

export default Server;
