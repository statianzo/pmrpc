import puppeteer from 'puppeteer';
import {rollup} from 'rollup';
import config from '../rollup.config';
const launchArgs = process.env.CI === 'true' ? ['--no-sandbox'] : [];
let browser: puppeteer.Browser;
let page: puppeteer.Page;

beforeAll(async () => {
  const bundle = await rollup({
    input: config['input'],
    plugins: config['plugins'],
  });
  const {output} = await bundle.generate({format: 'iife', name: 'JsonRpc'});
  browser = await puppeteer.launch({args: launchArgs});
  page = await browser.newPage();
  await page.addScriptTag({content: output[0].code});
  await page.setContent(`<iframe sandbox="allow-scripts"></iframe>`);
  await page.evaluate(`
    let resolve;
    let reject;
    let rpc;
    const handshakePromise = new Promise(r => resolve = r);
    window.addEventListener('message', e => {
      const [port] = e.ports;
      port.start();
      rpc = new JsonRpc({source: port, destination: port});
      resolve();
    });
  `);
  const [, frame] = page.frames();
  await frame.addScriptTag({content: output[0].code});
  await frame.evaluate(`
    const {port1, port2} = new MessageChannel();

    const rpc = new JsonRpc({
      source: port1,
      destination: port1,
      methods: {
        greet: name => 'Hello, ' + name,
      },
    });
    port1.start();

    window.top.postMessage({}, '*', [port2]);
  `);
  await page.evaluate(`handshakePromise`);
});

afterAll(async () => {
  (await browser) && browser.close();
});

it('calls between iframes', async () => {
  const result = await page.evaluate(`rpc.call('greet', 'Alice')`);
  expect(result).toEqual('Hello, Alice');
});

it('fails on missing', async () => {
  await expect(page.evaluate(`rpc.call('missing')`)).rejects.toMatchObject({
    message: /method not found/i,
  });
});
