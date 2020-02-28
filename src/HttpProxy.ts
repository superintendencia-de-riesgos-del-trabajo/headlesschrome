import httpProxy from "http-proxy";
import { IHeadlessChromeDriver } from "./HeadlessChromeDriver";
import http from "http";

export interface IHttpProxy {
    sendToInstance(instance: IHeadlessChromeDriver, req: http.IncomingMessage, socket: any, head: any)
}

export class HttpProxy implements IHttpProxy {
    private httpProxy: httpProxy;

    constructor() {
        this.httpProxy = httpProxy.createProxyServer({ ws: true });
        this.httpProxy.on('error', (err: Error, _req, res) => {
            res.writeHead && res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Issue communicating with Chrome`);
        });
    }

    public sendToInstance(instance: IHeadlessChromeDriver, req: http.IncomingMessage, socket: any, head: any) {
        this.httpProxy.ws(req, socket, head, { target: instance.wsEndpoint });
    }
}