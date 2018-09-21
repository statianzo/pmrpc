import JsonRpc, {ErrorCodes} from './JsonRpc';

const defer = (ms: number, val?: any) =>
  new Promise(resolve => setTimeout(() => resolve(val), ms));

const buildRequest = (method: string, params?: any[] | object) => ({
  jsonrpc: '2.0',
  id: 123,
  method,
  params,
});

describe('handling requests', () => {
  let rpc: any;

  beforeEach(() => {
    rpc = new JsonRpc({
      methods: {
        hello: (name: string) => `goodbye ${name}`,
        canVote: (voter: {age: number}) => voter.age > 18,
        deferred: () => Promise.resolve('deferredResult'),
        spy: jest.fn().mockImplementation(() => 'mock'),
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

describe('invalid messages', () => {
  let rpc: any;
  let messageEvent : any;

  beforeEach(() => {
    rpc = new JsonRpc({
      methods: {
        spy: jest.fn().mockImplementation(() => 'mock'),
      },
    });
    messageEvent = {
      origin: '*',
      data: buildRequest('spy')
    };
  });

  it('ignores messages missing data', async () => {
    delete messageEvent.data;
    await rpc.handleMessage(messageEvent);
    expect(rpc.methods.spy).not.toHaveBeenCalled();
  });

  it('ignores requests missing jsonrpc', async () => {
    delete messageEvent.data.jsonrpc;
    await rpc.handleMessage(messageEvent);
    expect(rpc.methods.spy).not.toHaveBeenCalled();
  });

  it('ignores requests with wrong origin', async () => {
    rpc.origin = 'http://example.com';
    messageEvent.origin = 'http://fake.com';
    await rpc.handleMessage(messageEvent);
    expect(rpc.methods.spy).not.toHaveBeenCalled();
  });
});

describe('mounted', () => {
  let frame1: HTMLIFrameElement;
  let frame2: HTMLIFrameElement;
  let rpc1: JsonRpc;
  let rpc2: JsonRpc;

  beforeEach(() => {
    frame1 = document.createElement('iframe');
    frame2 = document.createElement('iframe');
    document.body.appendChild(frame1);
    document.body.appendChild(frame2);

    rpc1 = new JsonRpc({
      methods: {one: () => 'one'},
      source: frame1.contentWindow as MessageEventSource,
      destination: frame2.contentWindow as MessageEventSource,
    });

    rpc2 = new JsonRpc({
      destination: frame1.contentWindow as MessageEventSource,
      source: frame2.contentWindow as MessageEventSource,
      methods: {
        greet: (name: string) => `Hello, ${name}`,
        explode: () => {
          throw Error('Kapow');
        },
      },
    });
  });

  afterEach(() => {
    document.body.removeChild(frame1);
    document.body.removeChild(frame2);
  });

  it('communicates between iframes', async () => {
    const result = await rpc1.call('greet', ['Alice']);
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

it('errors when applying without a destination', () => {
  const rpc = new JsonRpc({});
  expect(() => rpc.apply('yo')).toThrow('Attempted to apply with no destination');
});
