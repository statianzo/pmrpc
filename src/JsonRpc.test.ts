import JsonRpc, {ErrorCodes} from './JsonRpc';

const defer = (ms: number, val?: any) =>
  new Promise(resolve => setTimeout(() => resolve(val), ms));

describe('handling requests', () => {
  let rpc: any;
  const buildRequest = (method: string, params?: any[] | object) => ({
    jsonrpc: '2.0',
    id: 123,
    method,
    params,
  });

  beforeEach(() => {
    rpc = new JsonRpc({
      methods: {
        hello: (name: string) => `goodbye ${name}`,
        canVote: (voter: {age: number}) => voter.age > 18,
        deferred: () => Promise.resolve('deferredResult'),
        blowUp: () => {
          throw Error('BOOM!');
        },
      },
    });
  });

  it('handles array params', async () => {
    const request = buildRequest('hello', ['Alice']);
    const response = await rpc.handleRequest(request);

    expect(response.jsonrpc).toEqual('2.0');
    expect(response.id).toEqual(request.id);
    expect(response.result).toEqual('goodbye Alice');
  });

  it('handles object params', async () => {
    const request = buildRequest('canVote', {age: 22});
    const response = await rpc.handleRequest(request);

    expect(response.jsonrpc).toEqual('2.0');
    expect(response.id).toEqual(request.id);
    expect(response.result).toEqual(true);
  });

  it('waits on promise results', async () => {
    const request = buildRequest('deferred');
    const response = await rpc.handleRequest(request);

    expect(response.result).toEqual('deferredResult');
  });

  it('errors on missing method', async () => {
    const request = buildRequest('missing');
    const response = await rpc.handleRequest(request);

    expect(response.id).toEqual(request.id);
    expect(response.error.code).toEqual(ErrorCodes.MethodNotFound);
  });

  it('errors on throwing method', async () => {
    const request = buildRequest('blowUp');
    const response = await rpc.handleRequest(request);

    expect(response.id).toEqual(request.id);
    expect(response.error.code).toEqual(ErrorCodes.InternalError);
  });
});

describe('mounted', () => {
  let frame1: HTMLIFrameElement;
  let frame2: HTMLIFrameElement;
  let rpc1: JsonRpc;
  let rpc2: JsonRpc;

  // Shim to set MessageEvent.source in jsdom
  const shimHandleSource = (rpc: any, source: object) => {
    const original = rpc.handleMessage;
    rpc.handleMessage = (e: MessageEvent) =>
      original.call(rpc, {data: e.data, source});
  };

  beforeEach(() => {
    frame1 = document.createElement('iframe');
    frame2 = document.createElement('iframe');
    document.body.appendChild(frame1);
    document.body.appendChild(frame2);

    rpc1 = new JsonRpc({
      methods: {one: () => 'one'},
      destination: frame2.contentWindow,
    });

    rpc2 = new JsonRpc({
      destination: frame1.contentWindow,
      methods: {
        greet: (name: string) => `Hello, ${name}`,
        explode: () => {
          throw Error('Kapow');
        },
      },
    });

    shimHandleSource(rpc1, frame2.contentWindow);
    shimHandleSource(rpc2, frame1.contentWindow);

    rpc1.mount(frame1.contentWindow);
    rpc2.mount(frame2.contentWindow);
  });

  afterEach(() => {
    document.body.removeChild(frame1);
    document.body.removeChild(frame2);
  });

  it('communicates between iframes', async () => {
    const result = await rpc1.apply('greet', ['Alice']);
    expect(result).toEqual(`Hello, Alice`);
  });

  it('propagates errors between iframes', async () => {
    await expect(rpc1.apply('explode')).rejects.toMatchObject({
      code: ErrorCodes.InternalError,
    });
  });

  it('propagates missing between iframes', async () => {
    await expect(rpc1.apply('missing')).rejects.toMatchObject({
      code: ErrorCodes.MethodNotFound,
    });
  });
});
