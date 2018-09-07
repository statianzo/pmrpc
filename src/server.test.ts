import Server from './server';

//let target;

//beforeEach(() => {
  //target = new MessageChannel();
//});

it('dispatches requests', () => {
  const server = new Server({
    methods: {
      hello: () => 'goodbye',
    },
  });

  const request = {
    id: '123',
    jsonrpc: '2.0',
    method: 'hello'
  };

  expect(server.dispatch(request)).toEqual({
    jsonrpc: '2.0',
    id: '123',
    result: 'goodbye'
  });
});
