type Methods = {[key : string]: Function };

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
  result: any;
  error?: any;
  params?: any[] | object;
}

class Server {
  private methods : Methods;

  constructor({methods} : ServerConfig) {
    this.methods = methods || {};
  }

  dispatch(request : JsonRpcRequest) : JsonRpcResponse {
    const method = this.methods[request.method];
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: method.apply(null, request.params)
    }
  }
}

export default Server;
