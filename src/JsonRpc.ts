const VERSION = '2.0';

export const enum ErrorCodes {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

type JsonRpcDestination = Window;
type Methods = {[key: string]: Function};
type JsonRpcResult = any;

interface JsonRpcConfig {
  methods?: Methods;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any[] | object;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: JsonRpcResult;
  error?: JsonRpcError;
}

const buildResponse = (id: number) => (result: JsonRpcResult) => ({
  jsonrpc: VERSION,
  id,
  result,
});

const buildErrorResponse = (id: number) => (error: {
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

type Deferred = {resolve: Function; reject: Function};
type DeferredLookup = {[key : number] : Deferred};

class JsonRpc {
  private methods: Methods;
  private destination: JsonRpcDestination;
  private origin: string;
  private sequence = 0;
  private deferreds : DeferredLookup = {};

  constructor({methods}: JsonRpcConfig) {
    this.methods = methods || {};
  }

  apply(method: string, params?: any[]) {
    const id = this.sequence++;
    const promise = new Promise((resolve, reject) => {
      this.deferreds[id] = {resolve, reject};
    });
    this.destination.postMessage(
      {
        id,
        jsonrpc: VERSION,
        method,
        params,
      },
      this.origin
    );

    return promise;
  }

  handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
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

  handleResponse(response: JsonRpcResponse) {
    const deferred = this.deferreds[response.id];
    delete this.deferreds[response.id];
    if (!deferred) return;

    if (response.result) {
      deferred.resolve(response.result);
    }
    else {
      deferred.reject(response.error);
    }
  }

  handleMessage = (e: MessageEvent) => {
    if (e.data.method) {
      this.handleRequest(e.data).then(response =>
        this.destination.postMessage(response, this.origin)
      );
    } else {
      this.handleResponse(e.data);
    }
  };

  mount(source: EventTarget, destination: JsonRpcDestination, origin: string) {
    source.addEventListener('message', this.handleMessage);
    this.destination = destination;
    this.origin = origin;
  }
}

export default JsonRpc;
