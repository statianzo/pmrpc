# @statianzo/pmrpc

[![Build Status](https://travis-ci.org/statianzo/pmrpc.svg?branch=master)](https://travis-ci.org/statianzo/pmrpc)

JSON-RPC implemented using postMessage API

## Installation

```sh
npm install @statianzo/pmrpc
```

## Usage

### iframe within parent

```js
import JsonRpc from './JsonRpc';

const rpc = new JsonRpc({
  methods: {
    greet: name => `Hello ${name}`
  },
  source: window
});
```


### Parent window

```js
import JsonRpc from './JsonRpc';

const rpc = new JsonRpc({
  destination: iframe.contentWindow
});

rpc
  .call('greet', 'World')
  .then(response => {
    console.log(response); // "Hello World"
  });
```

## JsonRpc Options

- `origin` - (Default: `*`) Origin to send messages
- `methods` - (Default: `{}`) An object of exposed methods. Returning a Promise will defer responding until the promise has completed
- `source` - The source EventTarget to mount JSON rpc on (`Window`, `MessagePort`, etc)
- `destination` - Target MessageEventSource to send requests to

## API

### JsonRpc.apply(method, [arg1, arg2, ...])

Invoke a remote rpc method with an array of arguments (like `Function.apply`).
Returns a `Promise` with the result of the request. Errors from the endpoint
will result in a rejected promise.

### JsonRpc.call(method, ...args)

Invoke a remote rpc method with a variadic list of arguments (like
`Function.call`). Returns a `Promise` with the result of the request.
Errors from the endpoint will result in a rejected promise.

### JsonRpc.mount(source)

Mount JsonRpc to a source EventTarget (Window, MessagePort, Worker). This is
called automatically when a `source` is passed to the constructor.

### JsonRpc.unmount()

Detach the event listener from the JsonRpc instance's `source`
