import JsonRpc, {ErrorCodes} from './JsonRpc';

it('handles requests', async () => {
  const rpc = new JsonRpc({
    methods: {
      hello: () => 'goodbye',
    },
  });

  const request = {
    id: '123',
    jsonrpc: '2.0',
    method: 'hello'
  };

  const response = await rpc.handle(request);
  expect(response).toEqual({
    jsonrpc: '2.0',
    id: '123',
    result: 'goodbye'
  });
});

it('waits on promise results', async () => {
  const rpc = new JsonRpc({
    methods: {
      deferred: () => Promise.resolve('deferredResult'),
    },
  });

  const request = {
    id: '123',
    jsonrpc: '2.0',
    method: 'deferred'
  };

  const response = await rpc.handle(request);
  expect(response.result).toEqual('deferredResult');
});

it('errors on missing method', async () => {
  const rpc = new JsonRpc({});

  const request = {
    id: '123',
    jsonrpc: '2.0',
    method: 'missing'
  };

  const response = await rpc.handle(request);
  expect(response.id).toEqual('123');
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
    id: '123',
    jsonrpc: '2.0',
    method: 'blowUp',
  };

  const response = await rpc.handle(request);
  expect(response.id).toEqual('123');
  expect(response.error.code).toEqual(ErrorCodes.InternalError);
});
