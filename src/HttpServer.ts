import http, { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpClientRequest = http.IncomingMessage & { body: any }
export type UpgradeListener = (response: IncomingMessage, socket: Socket, head: Buffer) => void
export type RequestListener = (req: HttpClientRequest, res: ServerResponse) => Promise<void>
export interface IHttpServer {
    stop();
    start(port: number);
    addUpgradeListener(listener: UpgradeListener): IHttpServer;
    addRequestListener(method: HttpMethod, path: string, listener: RequestListener)
}


export class HttpServer implements IHttpServer {
    httpServer: http.Server;
    httpListener: http.RequestListener;

    constructor() {
        this.httpServer = http.createServer((...args) => this.httpListener(...args));
    }

    private checkMethod(method: HttpMethod, req: HttpClientRequest) {
        return req.method == method
    }
    private checkPath(url, req: HttpClientRequest) {
        return new URL(req.url, `http://${req.headers.host}`).pathname.toUpperCase() === url.toUpperCase();
    }

    addRequestListener(method: HttpMethod, path: string, listener: RequestListener) {
        const newListener = (req: HttpClientRequest, res: ServerResponse) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                req.body = JSON.parse(body)
                if (!this.checkMethod(method, req)) {
                    res.statusCode = 405
                    res.end()
                }
                else if (!this.checkPath(path, req)) {
                    res.statusCode = 404
                    res.end()
                }
                else {
                    listener(req, res).finally(() => res.end())
                }
            });
        }


        this.httpListener = newListener
        return this;
    }

    addUpgradeListener(listener: UpgradeListener) {
        this.httpServer.addListener('upgrade', listener);
        return this;
    }

    start(port: number): IHttpServer {
        this.httpServer.listen(port);
        console.log(`server listening on port: ${port}`)
        return this;
    }

    stop() {
        this.httpServer.close();
        console.log("server stopped");
    }
}