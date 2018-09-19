const VERSION = '2.0';

export const enum ErrorCodes {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

type JsonRpcSource = EventTarget;
type JsonRpcDestination = MessageEventSource;
type Methods = {[key: string]: Function};
type Deferred = {resolve: Function; reject: Function};
type DeferredLookup = {[key: number]: Deferred};

interface JsonRpcConfig {
  origin?: string;
  source?: JsonRpcSource;
  methods?: Methods;
  destination?: JsonRpcDestination;
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
  result?: any;
  error?: JsonRpcError;
}

const buildResponse = (id: number) => (result: any) => ({
  jsonrpc: VERSION,
  id,
  result,
});

const buildErrorResponse = (id: number) => (error: {
  code?: ErrorCodes;
  message?: string;
}) => ({
  jsonrpc: VERSION,
  id,
  error: {
    code: error.code || ErrorCodes.InternalError,
    message: error.message,
  },
});

class JsonRpc {
  private methods: Methods;
  private destination: JsonRpcDestination;
  private source: JsonRpcSource;
  private origin: string;
  private sequence = 0;
  private deferreds: DeferredLookup = {};

  constructor({methods = {}, source, destination, origin}: JsonRpcConfig = {}) {
    this.methods = methods;
    this.destination = destination;
    this.origin = origin || '*';
    if (source) {
      this.mount(source);
    }
  }

  apply(method: string, params?: any[]) {
    const id = this.sequence++;
    const promise = new Promise((resolve, reject) => {
      this.deferreds[id] = {resolve, reject};
    });
    this.postMessage(this.destination, {
      id,
      jsonrpc: VERSION,
      method,
      params,
    });

    return promise;
  }

  private handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return Promise.resolve()
      .then(() => {
        const method = this.methods[request.method];
        return method
          ? method.apply(null, request.params)
          : Promise.reject({
              code: ErrorCodes.MethodNotFound,
              message: 'Method not found',
            });
      })
      .then(buildResponse(request.id), buildErrorResponse(request.id));
  }

  private handleResponse(response: JsonRpcResponse) {
    const deferred = this.deferreds[response.id];
    delete this.deferreds[response.id];
    if (!deferred) return;

    if (response.result) {
      deferred.resolve(response.result);
    } else {
      deferred.reject(response.error);
    }
  }

  private postMessage(target: JsonRpcDestination, message: any) {
    target = target as Window; //Shadow to a Window
    const isWindow = target.window === target;
    target.postMessage(message, isWindow ? this.origin : null);
  }

  private handleMessage = (e: MessageEvent) => {
    if (e.data.method) {
      this.handleRequest(e.data).then(response =>
        this.postMessage(e.source, response)
      );
    } else {
      this.handleResponse(e.data);
    }
  };

  mount(source: EventTarget) {
    this.source = source;
    source.addEventListener('message', this.handleMessage);
  }

  unmount() {
    this.source.removeEventListener('message', this.handleMessage);
  }
}

export default JsonRpc;
