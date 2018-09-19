import JsonRpc, {ErrorCodes} from './JsonRpc';

const defer = (ms: number, val?: any) =>
  new Promise(resolve => setTimeout(() => resolve(val), ms));

it('handles requests', async () => {
  const rpc = new JsonRpc({
    methods: {
      hello: () => 'goodbye',
    },
  });

  const request = {
    id: 123,
    jsonrpc: '2.0',
    method: 'hello',
  };

  const response = await (rpc as any).handleRequest(request);
  expect(response).toEqual({
    jsonrpc: '2.0',
    id: 123,
    result: 'goodbye',
  });
});

it('waits on promise results', async () => {
  const rpc = new JsonRpc({
    methods: {
      deferred: () => Promise.resolve('deferredResult'),
    },
  });

  const request = {
    id: 123,
    jsonrpc: '2.0',
    method: 'deferred',
  };

  const response = await (rpc as any).handleRequest(request);
  expect(response.result).toEqual('deferredResult');
});

it('errors on missing method', async () => {
  const rpc = new JsonRpc();

  const request = {
    id: 123,
    jsonrpc: '2.0',
    method: 'missing',
  };

  const response = await (rpc as any).handleRequest(request);
  expect(response.id).toEqual(123);
  expect(response.error.code).toEqual(ErrorCodes.MethodNotFound);
});

it('errors on throwing method', async () => {
  const rpc = new JsonRpc({
    methods: {
      blowUp: () => {
        throw Error('BOOM!');
      },
    },
  });

  const request = {
    id: 123,
    jsonrpc: '2.0',
    method: 'blowUp',
  };

  const response = await (rpc as any).handleRequest(request);
  expect(response.id).toEqual(123);
  expect(response.error.code).toEqual(ErrorCodes.InternalError);
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
